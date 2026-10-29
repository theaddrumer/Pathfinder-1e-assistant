# Current architecture — V3.47

This describes the executable engine, not the original design proposal. The old proposal is preserved in `docs/history/ARCHITECTURE_ORIGINAL_PROPOSAL.md`.

## Entry points and trust boundary

`kernel.mjs` exports `Kernel`, an alias of `MagicGame`, and `initialState`. `MagicGame` is the complete engine. Older classes remain compositional layers and regression targets; importing `Game` from `core.mjs` does **not** enable the complete ruleset.

```js
import {Kernel} from './kernel.mjs';
const game = new Kernel(); // Fictional Explorer/Warden fixture by default.
game.dispatch({op:'use_action', actor:'hero', type:'move', label:'Draw item'}, 'actor');
const view = game.dispatch({op:'inspect'}, 'actor');
const restored = new Kernel(game.exportState());
```

Call `dispatch` for public mutations. Low-level methods compose resolvers and support isolated tests; they are not a second public mutation API. Direct edits to `game.s`, direct resolver calls, and arbitrary saved-state imports can bypass validation and final summon removal. A restored state is trusted engine output, not an untrusted statblock import. Undo checkpoints are session-local fields on the instance; `exportState()` saves encounter state and RNG, not an undo history.

`actor` enforces ordinary gameplay. `gm` permits named setup/adjudication commands. `player` is a legacy demo role limited to `hero`, not multiplayer authentication. The AI adapter distinguishes normal gameplay from deliberate GM overrides. Passing every command as GM or rewriting state directly defeats the intended limits.

The kernel verifies the declared mechanical contract. It cannot prove that a supplied spell payload, statblock, immunity or precision-eligibility choice matches a book it has never received. The kernel itself contains no full rules database, AP reader, tactical planner, network service, model connection or VTT adapter.

## One state, distinct owners

All layers share one serializable `game.s`. Inspection derives views; it does not maintain parallel counters. The inheritance order reflects incremental development, not multiple engines running in parallel:

`Game → AutomationGame → RegistryGame → ConditionAilmentGame → FoundationsGame → ManeuverGame → RiderGame → CriticalGame → FinalOffenseGame → DefenseGame → TimeGame → AttackCompletionGame → AttackRoutinesGame → InitiativeGame → PendingEventsGame → SpellResourcesGame → SummonsGame → PersistentAreasGame → EncounterBasicsGame → SceneGame → CombatMechanicsGame → CollectiveGame → MagicGame`.

| Owner | Canonical responsibility | Reuse boundary |
|---|---|---|
| `core.mjs` | Creatures, grid, action budget, modifiers, RNG, movement loop, turn/round undo | Transactions, modifier stacking, action spending, movement and turn-start hooks |
| `automation.mjs` | Bounded data-only rules, zone presence, marks | Calls existing resolvers; no imported executable scripts |
| `registry.mjs` | Creature/effect definitions and spawning | Validate, initialize traits, register instance lifecycle, then run entry effects |
| `condition_ailment_game.mjs` | Conditions, ailments, ability damage/drain, Constitution HP adjustments, elapsed rounds | Conditions use ordinary effects and source-scoped instances; duplicate condition modifiers count once; damage and drain remain separate mechanics |
| `foundations.mjs` | Type/subtype traits, immunities, DR/resistance, damage packets, declared DCs | Attacks and effects share mitigation; printed totals remain authoritative |
| `maneuvers.mjs` | CMB/CMD, grapples, Dirty Trick links, maneuver continuations, override log | Reuses effects, actions, geometry and damage |
| `riders.mjs` | Optional hit riders, attack replacements, bleed/poison/paralysis | GM chooses optional riders after a qualifying hit |
| `critical.mjs`, `critical_rules.mjs` | Precision eligibility context and pure critical-profile rules | Actual attack/critical rolling has one resolver in `automation.mjs` |
| `final_offense.mjs` | Pull/Push, negative levels, Energy Drain temporary HP | Negative levels are distinct from ability damage and printed HD |
| `defense.mjs` | Equipment deltas, declared cover/concealment, walls | Shared ray/feature obstruction from `map_geometry.mjs` |
| `time_engine.mjs` | Clock display, world-time GM events, chronological Fast Forward | Deadline indexes and owner callbacks; no per-six-second simulation loop |
| `attack_completion.mjs` | Ability substitution, ranged limits, nonlethal damage/healing | Shared attack checks, mitigation and HP-healing path |
| `attack_routines.mjs` | Routines, ammunition, reloads, ranged AoO continuations | Printed sequences are regenerated only with explicit `attackPlan` opt-in |
| `initiative.mjs` | Ranked roster, delay, initiative deadlines, encounter-end migration | Skips empty scores while processing crossed deadlines |
| `pending_events.mjs` | Conditional events, Ready, held-touch, Summon, concentration and persistent-area deadlines/history | Native payloads use this owner; trigger prose is never interpreted automatically |
| `spell_resources.mjs` | Frozen allotments, prepared/spontaneous expenditure, resource history | Casting receipts are provenance, not additional slot counters |
| `summons.mjs` | Summon marker and departure cleanup | Its only timer is a native Pending Event |
| `persistent_areas.mjs` | Fixed regions in native Pending Event payloads, occupancy and exposure policy | Shared geometry and spell payload resolver; existing clock/initiative timer; derived area views |
| `encounter_basics.mjs` | Derived HP status, configured recovery, immediate/cooldown bookkeeping, inanimate object instances | Shared HP hooks and clock; native Pending Events; existing registry and damage resolution |
| `object_rules.mjs` | Material estimates and hardness arithmetic | Shared by object damage and equipment Sunder |
| `map_geometry.mjs` | Pure eight-way segments, rays, swept footprints and reversible height crossings | Shared by movement, defense and spell-area geometry; no stored cache |
| `scene.mjs` | Features, doors, declared height transitions, map metadata, explicit geometry/traversal rulings, elevation/contact/layers and scene closure | Reuses occupancy, damage, area exposure and native cleanup; no extra timers or campaign archive |
| `magic.mjs` | Casting, casting/maintained concentration, delivery, native condition payloads, dispels/counters | Reuses actions, attacks, packets, Ready and Pending Events; final command boundary cleans summons |
| `lifecycle.mjs` | Pure deadline/continuation indexes; read-only command classification | Diagnostic views, not a second scheduler |

Vocabulary, validators and pure rules live in `stats.mjs`, `conditions.mjs`, `ailments.mjs`, `trait_library.mjs`, attack rule/library files and `weapon_materials.mjs`. `scenarios.mjs` supplies fixtures. `vocabulary_probe.mjs` is a historical experiment outside the active class chain and current browser bundle.

## Atomic commands

The public boundary validates command and role, permits read-only inspection during checkpoints, then delegates to the owning layer. Mutations run inside `Game.transaction`. The first transaction snapshots `s`, `turnStart`, `roundStart` and `previousTurnStart`; nested dispatches and automatic events join it. Failure restores all four, including RNG/test rolls inside `s`. A caught nested transaction failure still prevents partial commit.

Transactions are synchronous. Retrieve external information before constructing a command; do not introduce asynchronous work into resolvers. Temporary execution flags use `try/finally`. Existing recursion and operation limits bound automatic rules.

Read-only commands neither flush summons nor advance time/mark activity. Accepted manual mutations without an action cost mark the current turn as modified if no new checkpoint was established. Fast Forward retains its existing no-action-budget behavior. Definition registration intentionally persists catalogs into existing undo checkpoints.

No persistent derived-stat caches were added: they would require invalidation after effects, equipment changes, undo and reconstruction. The measured repeated whole-state serialization at nested command/event boundaries was removed instead.

## Movement and reactions

`Game.continueMove` owns the movement loop. Before leaving a threatened square it offers an AoO; entering reach alone does not provoke. Automation supplies `onMovementSquare` for tile events and zones. Conditions supply `canContinueMovement`, so a suspended move stops after incapacitation or immobilization. Queued movement/ranged reactors are revalidated before an offer; accepting an AoO rechecks eligibility.

`pendingMove`, `pendingRangedAction`, `pendingManeuver`, `pendingRider` and casting continuations store different resumption data. They are not duplicate general event schedulers. A universal arbitrary interrupt stack would be separate work. `unresolvedActions` provides one diagnostic list without transferring ownership.

## Turn start and time

Normal and deferred turn starts share one path:

1. End the old turn, expire its round-duration effects, and advance the existing turn/initiative cursor.
2. Advance `worldRounds` at the combat-round boundary and process native clock deadlines. Initiative crossings retain their score ordering.
3. Check casting completion and scheduled time events. Defer the new turn's automatic effects if a decision/completion is pending.
4. Run `finishTurnStart` once. Its `beginTurnEffects` chain handles turn-start deadlines/effects, automatic round/turn events/zones, conditions/ailments/Constitution HP, then negative-level/temporary-HP processing and configured HP recovery/stabilization.
5. Capture the turn/round checkpoint after mandatory effects. Their activity is not a voluntary action after that checkpoint.

Acknowledgements call `resumeDeferredTurnStart`, which uses the same `finishTurnStart`. Multiple same-time decisions must clear first. Normal gameplay cannot bypass a pre-turn checkpoint; controller/lifecycle views remain available.

Persistent areas use Pending Events for expiration and index only their next occupied downtime exposure in `clockDeadlines`. `onClockExpirations` removes due region-bound modifiers/conditions before same-time affliction/recovery checks. `onPendingClockAdvanced` resolves the surviving regions' downtime exposures; ordinary combat uses the existing `turn_start` event. `syncZones` also reconciles fixed-region occupancy after movement/teleport/spawn. Region state is stored once; cells and views are derived.

World time, initiative deadlines and narrative triggers intentionally differ. World time uses six-second rounds; initiative also records score/round. “If the door opens” is GM-adjudicated prose. Encounter-end migration preserves supported durations at world-clock resolution without inventing sub-round chronology outside combat.

## Spawn and removal

Registry spawning builds a creature, calls `initializeCreature` to attach traits before placement validation, installs rules, calls `onCreatureSpawned` for instance lifecycle, then synchronizes zones. A devil has fire immunity when an entry effect fires; a summon has its timer before an entry effect defeats it.

Summon expiry/defeat concludes its Pending Event and sets transient `summonDeparture`. Owned automation stops immediately. Final cleanup waits for atomic resolution to unwind, then removes the token, initiative entry and owned native state. Surviving condition/effect/ailment source references are detached where appropriate. Fixed area events use `actor:null` and retain original casting provenance in their payload; areas and their marked exposure effects survive caster departure. Removal does not reverse instantaneous damage already inflicted. Copies inherit the original deadline, not a fresh lifetime.

## Statistics and resources

Printed `statTotals`, skill totals and imported routines are snapshots. `abilityLinks` explicitly authorize ability deltas; never infer missing class levels, armor caps or weapon dependencies. Contributing live modifiers stack together, including general/specific skills and attack/CMB or AC/CMD pools. Ability damage follows the selected governing ability. Fixed DCs remain fixed; declared spell-DC formulas account for mental ability damage.

Imported totals conceal their internal typed bonuses. The kernel can stack registered live modifiers against each other, but cannot reconstruct a hidden bonus decomposition in a printed total. The importer/GM must avoid double-counting preincluded effects or supply explicit deltas. This boundary is not permission to guess a creature's build.

Daily spell allotments are snapshots. Imported totals include bonus spells; derived setup uses an explicit fixed daily score once. Live score changes, damage/drain, inspection and elapsed time never resize or refill them. Explicit GM refresh resets expenditure against stored maxima; restoration restores spent resources; book replacement recalculates capacity. Current minimum-score eligibility may block a cast without changing capacity.

## Browser and verification

`automation-demo-ui.js` submits commands, displays views and offers path selection; the engine remains authoritative. `build_demos.py` bundles production modules and templates into the workbench/gallery. Edit modules/templates and rebuild, never generated HTML as the source of truth.

The runner discovers `*tests.mjs` and `test_browser*.py`. Historical tests exercise lower layers as well as the complete kernel. The audit suite imports `kernel.mjs`. See `AUDIT_V3_29.md` for scope and limits; this release does not certify complete PF1e coverage.

## V3.31 HP and object boundaries

`Game.applyHpLoss`, `adjustedHp`, `canAct` and `canBeAttacked` are narrow hooks. Historical lower-layer fixtures retain their defaults; the complete engine supplies negative HP and vitality policy. `creature.vitality` stores only irreversible/history-dependent health facts and a recovery deadline. Derived health is exposed through inspection and existing condition/action predicates. Healing is shared and rejects ordinary resurrection. Standard-action strain is a continuation receipt, settled at the public command boundary after the action completes.

Objects are registry instances with `objectProfile`, excluded from turn selection and initiative. `object_rules.mjs` contains a small material table and the hardness function shared with Sunder. Packet and weapon-hit grouping retain their original owners. Spell geometry includes living downed recipients. The UI never writes HP directly for these controls.

See `ENCOUNTER_BASICS_V3_31.md` for exact scope, time semantics and GM-managed exceptions.

## Spell condition boundary — V3.32

`MagicGame.applySpellEffect` connects declared modifiers/conditions to existing immunity, condition, provenance and expiry owners. `bindSpellEffect` attaches casting source and native initiative deadline for either kind. The condition owner uses a casting `applicationKey` to avoid refreshing another source, and derives effective numeric modifiers without storing aggregate condition state. Area eligibility records payload keys so re-entry cannot add an originally immune condition alongside an eligible modifier. See `SPELL_CONDITIONS_V3_32.md`.

## Maintained concentration — V3.33

`MagicGame` owns maintenance policy through native `concentration` Pending Events. The event payload is the sole maintenance record; `focusFor` adapts it to existing casting concentration checks. Effects and fixed areas remain native and link through the original casting ID. Concentration owns their shared maximum/tail deadline; `concludePendingEvent` removes linked records. Turn-start/end hooks govern upkeep; clock expiration clears effects before same-time checks. See `CONCENTRATION_V3_33.md` for the public contract.

## V3.34 spatial boundary

`SceneGame` extends `EncounterBasicsGame` and is the direct parent of `MagicGame`. `s.scene` stores map metadata and bounded GM rulings; per-creature `elevation` stores the instance annotation. Exposure settings live on the existing rule/area payload. Core placement, reach, terrain and movement-AoO hooks serve all paths. Positional signatures invalidate stale geometry. Scene closure preserves surviving owner data and resets undo snapshots inside the existing atomic transaction. Pure map/closure-preview queries are in the existing read-only command set. See MAP_AND_ELEVATION_V3_34.md for exact limits and cleanup policy.

V3.35 features live only in `scene.features`. Physical movement calls `onSpatialMovement` after committing coordinates and before entry/area evaluation; this updates explicitly declared height transitions in both directions. Teleport deliberately skips crossing updates. Costs and height are independent inputs. See MAP_FEATURES_V3_35.md for the authoritative schema and geometric limits.

V3.36 adds pure `falling_rules.mjs` for landing arithmetic. SceneGame owns `gm_preview_fall`/`gm_resolve_fall`, delegating HP/nonlethal/prone/elevation to native owners. The existing MagicGame damage-group hook accepts an optional cause (weapon default), allowing a mixed environmental impact to check concentration once. No new state or timers. See FALLING_V3_36.md.

## V3.37 integration boundary

AIAdapter wraps Kernel; it is not another mechanics subclass. All changes use dispatch. Catalog metadata indexes existing operations. MCP tools expose separate actor and GM routes, pure views and paged reference docs. SessionStore persists native state/checkpoints plus bounded transport receipts before acknowledgment, with one writer. Transport revisions never rewind with game undo. The official MCP SDK owns protocol framing/handshake/transports. See INTEGRATION_V3_37.md for deployment and limits.

## V3.38 focused corrections

Prone stays in ConditionAilmentGame; one posture predicate serves preflight, shared attack resolution and interrupted-shot eligibility. `usableWhileProne` is optional per-attack data validated by the existing completed-attack validator. No posture queue or weapon database. `gm_roll` still belongs to RegistryGame; plain-mode discovery, validation and examples clarify its pre-existing dice-only branch. Session compatibility explicitly accepts 3.37.0 with unchanged state/checkpoint/receipt shapes.

## V3.39 discovery boundary

The existing integration catalog now includes curated use/change/limitation notes, valid examples, input hints and a reference topic. It remains metadata, not an independent mechanics validator. Missing required-field metadata is explicitly marked incomplete. AI_START_HERE.md and AI_WORKFLOWS.md are the concise operating entry points; this architecture/handoff remains developer context. MCP errors link to the relevant catalog and guide. Focused status reads speed directly from the configured creature field, with a base-speed note, instead of calling the unsupported derived-stat resolver. Saves from 3.37.0 and 3.38.0 remain accepted without native state changes.

## V3.40 common combat mechanics

`combat_mechanics.mjs` composes SceneGame and supplies attack adjustments to the existing AutomationGame resolver. Modes use native Pending Events plus ordinary modifier effects; conclusion removes their effect. Source immunity lives only in native Pending Event payloads. First-attack bookkeeping uses the existing per-turn action record. No independent timer or precision damage resolver was added. Stand-up extends the existing provoked-action continuation; crawl extends the existing movement record to offer entering threats after position commit. The same source modules are bundled for the offline workbench.

Pure flanking queries derive geometry/threats afresh. Creature combatProfile and weapon handling metadata are explicit input contracts. Helpless effective abilities/defenses are derived without overwriting original imported values. Native damage, fortification, spell slots, action costs and undo retain their owners. Schema discovery and the new combat guide expose the boundaries to fresh AI instances.

## V3.41 subtype recognition

trait_library.mjs owns SUBTYPE_CATALOG for recognized classifications and coverage; SUBTYPE_TRAITS remains the sole owner of automatic subtype traits. FoundationsGame validates recognized IDs, resolves only existing mechanical traits, and exposes classification(id) from the same stored creature fields. AI focused status uses that read-only view. No second identity store, scheduler or Bane resolver was added. See SUBTYPES_V3_41.md.

## Player presentation (V3.43)

`player_view.mjs` validates presentation-only edits and projects an allowlisted public map. SceneGame retains scene/mask ownership; display metadata lives on native creature/feature records. MagicGame preserves transaction/undo selection without running combat side effects for display edits. `player_server.mjs` reads the AIAdapter and serves only fixed viewer assets plus public `/state` on a separate loopback listener. It does not mount MCP, read arbitrary paths or mutate state. `player.js` has no engine imports or GM commands. Public ETags derive from public JSON, not private revisions.

## Map bookmarks and launcher — V3.46

`SceneGame` owns map-save/load/list/delete and map-preserving encounter cleanup. `map_snapshots.mjs` is a helper, not a second state owner: bookmarks reside in `s.savedMaps` and the existing session file. Restore uses native scene closure, spawnObject, terrain, feature and presentation validators in the existing transaction. No arbitrary-path file writer is exposed. Bookmark operations update all current undo checkpoints; encounter/map loads establish fresh checkpoints. Source world clocks and surviving resource/effect owners remain authoritative.

`playerVisibilityStatus` is GM-only diagnostic data; `playerProjection` remains the sole allowlisted public payload. `launcher/windows_shortcuts.py` uses Windows COM to write two per-user .lnk files; paths are encoded as data, not interpolated PowerShell expressions. Their stable `launch.py` target selects the installed release using non-secret settings. Native Windows execution still requires user-PC verification.

## Map artwork — V3.47

`map_artwork.mjs` owns the portable scene presentation contract; `scene.artwork` holds bounded PNG bytes, placement and redactions. It participates in existing checkpoints, map snapshots and the atomic session file, with no sidecar owner. `artwork_raster.mjs` is server-only: pngjs validates and normalizes imports; a bounded cached renderer redacts and masks source pixels before serving a PNG. `player_server.mjs` exposes only the current public raster URL and content hash. The portable geometry projection never contains private image bytes. The adapter's player-preview query and live server use the same raster renderer.

`artwork_editor_server.mjs` mounts a narrow same-origin loopback editor on the private engine listener. It accepts only artwork commands through AIAdapter.execute, preserving revision checks, retry receipts and persistence rollback. The player listener has no editor or mutation routes. Browser upload converts PNG/JPEG/WebP to bounded PNG, previews alignment and source-pixel covers, and requires explicit Apply. No mechanical geometry is inferred from pixels.

## V3.50 collective boundary

`collectives.mjs` composes swarm/troop rules over CombatMechanicsGame. Profile data lives on the existing creature, the once-per-turn receipt in `s.actions`, and persistent nonlethal dispersal in native vitality. Existing packets, saves, conditions, movement continuations, AoO allowances and casting checks own outcomes. No member simulation, alternate HP store, spatial grid or reaction scheduler. Generic damage metadata now declares area/targeting explicitly.

## V3.51 artwork boundary

`map_artwork.mjs` owns image limits and two-point calibration, which derives the existing placement only. The local editor imports at source resolution or explicitly requested reduced resolution. `artwork_raster.mjs` transforms source pixel footprints into the revealed-cell mask with a summed-area table; it emits a masked source-size PNG and its placement, never an enormous grid-size canvas. Hidden RGBA is zero and redactions precede masking. Player rendering uses the public transform and clips to revealed cells. Map snapshots and the atomic session store remain the only persistence owners; no external image server, sidecar storage or dependencies were added.
