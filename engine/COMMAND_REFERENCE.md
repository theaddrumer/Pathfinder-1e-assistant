# Current command map — V3.40

For tool operation, start with **AI_START_HERE.md** and **AI_WORKFLOWS.md**. Catalog guidance distinguishes operating notes from reference-only entries; it does not claim a complete nested schema.

Use `new Kernel(state?)` from `kernel.mjs`, then `dispatch(command, role)`. Every command is an object with `op`. `actor` is the ordinary gameplay role; `gm` explicitly permits setup and adjudication. Role strings are not authentication. Legacy `player` controls only the demo Explorer and does not expose the whole GM API.

This is an orientation map, not an independent schema implementation. The named owner validates exact fields and bounds. Historical feature guides under `docs/history/` contain fuller JSON examples; their old roadmap/coverage statements are superseded by this map and `AI_GM_HANDOFF.md`. All examples below use fictional data and IDs that must exist in the live encounter.

## Observe and save

| Command / method | Inputs | Meaning |
|---|---|---|
| `inspect` | none; actor or GM | Complete controller view of configured subsystems |
| `gm_get_lifecycle` | none | One view of clocks, deadlines, unresolved actions/decisions, casting, resources and summons |
| `gm_get_game_clock` | none | World clock, next event and pending time decision |
| `gm_get_initiative` | none | Ranked/unranked creatures, delay state and initiative deadlines |
| `gm_get_pending_events` | none | Active/triggered events, decisions and bounded history |
| `gm_get_spellcasting` | none | Casting continuations, held charges, ongoing spell effects and counter opportunities |
| `gm_get_spell_resources` | optional `actor` | Stored books and derived remaining usage |
| `gm_get_persistent_areas` | none | Fixed region IDs, footprints, current recipients, triggers and remaining duration |
| `gm_get_summons` | none | Native timer-derived summon view |
| `list_conditions`, `list_trait_library`, `list_maneuvers` | none | Supported vocabulary, including declared coverage/advisories |
| `gm_inspect_defense` | `target` | Equipment, AC and traits |
| `gm_describe_attack` | `actor`, `index` | One imported/generated attack profile |
| `gm_evaluate_effect` | `target`, `tags`, optional `save`, `worksOnObjects`, `harmless` | Immunity/classification query; no effect applied |
| `gm_calculate_dc` | `actor`, `abilityId` or `definition` | Declared formula or fixed DC; no roll |
| `gm_preview_spell_area` | `area` | Supported 2D shape cells and affected creatures |
| `gm_preview_spell_allotment` | `allotment` | Pure fixed-capacity calculation |
| `exportState()` | method, not command | Detached serializable state; reconstruct with `new Kernel(saved)` |

All listed inspection/preview commands are read-only and remain available during checkpoints, subject to their normal role restrictions. Most `gm_*` queries require GM. `exportState()` does not preserve prior session undo checkpoints. Do not mutate inspection results as a substitute for commands.

## Gameplay and continuations

| Commands | Key fields / behavior | Owner |
|---|---|---|
| `move` | `actor`, adjacent-square `path:[{x,y}]`; optional `step:true` or `asStandard:true` | Core movement/actions |
| `double_move` | `actor`, `path`; pays two move-equivalent actions | Core |
| `charge` | `actor`, `target`; closest legal charge path, action and AC consequences | Core |
| `attack` | `actor`, `target`, optional routine `index` | Shared attack resolver |
| `full_attack`, `full_attack_next` | `actor`, `target`; each command resolves one chosen strike | Core/attack routines |
| `finish_full_attack` | `actor`; forgo remaining strikes | Core |
| `use_action` | `actor`, `type:standard/move/swift/full_round`, optional `label` | Core; pays a cost without inventing an effect |
| `resolve_interrupt` | `take:true/false`; inspect the actual interrupt first | Current continuation owner |
| `maneuver` | `actor`, `target`, `kind`, plus maneuver-specific item/condition/path | Maneuvers |
| `grapple_action` | `actor`, `kind:maintain/escape/reverse/release`, optional maintenance `option:hold/pin/damage` | Maneuvers; inspect native grapple first |
| `remove_dirty_trick` | `actor`, `effectId` | Maneuvers; pays recorded removal cost |
| `replace_attack` | `actor`, `target`, `kind`, plus replacement fields | Riders; consumes a pending strike |
| `resolve_rider` | `mode` from the offered choice; actor role also supplies reacting `actor` | Riders; do not auto-select optional tactics |
| `reload_weapon`, `draw_ammunition` | `actor`, `ammoId`; reload may include `amount` | Attack routines; uses configured costs/AoOs |
| `end_turn` | none | Current actor ends; unresolved continuations/checkpoints constrain it |
| `delay_turn` | none; active initiative required | Initiative; before taking actions |
| `cast_spell` | `actor`, validated `spell` payload | Magic; normal action/resource checks |
| `continue_spell`, `complete_spell`, `cancel_spell` | `actor`; completion may supply `targets` or `area`; cancellation optional `reason` | Existing long-cast continuation |
| `deliver_touch_spell` | `actor`, `target` | Existing held charge; free casting-turn attempt or standard action |
| `ready_counterspell` | `actor`, unique event `id`, `spell` with counterspell payload | Native Ready/Pending Events |

An unfinished action is state, not permission to start a different action. Read `status`, `interrupt`, casting/event views and lifecycle output. Resolve the offered choice through its owner, then continue. A spell can pause as `needs_gm` without using the movement-style `interrupt` field. Do not treat “not done yet” as failure and repeat the original action; that can spend resources twice or hit a pending-action guard.

Nonstandard `defense` and `defenseContext` inputs require GM authority. `precisionEligible` is an explicit controller judgment about eligibility, not an automatic flanking detector. Ordinary action commands still enforce mechanical costs when called as GM.

## Setup, effects and explicit adjudication

| Commands | Key fields | Notes / owner |
|---|---|---|
| `register_creature` | `definition:{id,name,stats,...}` | Registry validates supported fields; use versioned IDs instead of overwriting |
| `spawn_creature` | `definition`, instance `id`, `x`, `y`, optional `team`, `name`, `summon` | team is party/enemy/neutral (default enemy). Independent instance; rank it explicitly if initiative is active |
| `register_effect`, `apply_registered_effect` | definition object; then definition ID, `target`, optional `source`, `rounds` | Reusable numeric effects; same definition/target refreshes |
| `apply_effect`, `remove_effect` | `effect:{id,name,target,mods,...}`; or effect `id` | Native modifiers; removal unlinks its initiative deadline |
| `apply_condition`, `remove_condition` | `target`, `condition`; apply optional `source`, `rounds` | Native policies and coverage advisories |
| `register_ailment`, `expose_ailment`, `cure_ailment` | definition; then target/definition for exposure or native ailment ID for cure | Generic timed afflictions; inspect actual active IDs |
| `apply_ability_damage`, `heal_ability_damage`, `apply_ability_drain`, `restore_ability_drain` | `target`, `ability`, `amount` | Independent loss tracks; do not merge or subtract damage from the printed score |
| `gm_apply_negative_levels`, `gm_restore_negative_levels` | apply: `target`, `levels`, `dc`, optional `source`, `permanent`; restore: `target`, `count` | Separate from ability loss and printed HD |
| `gm_resolve_damage` | `target`, `amount`, `damageType`, optional `source`, `cause`, `metadata` | One classified damage event |
| `gm_resolve_packet` | `target`, `components`, optional `source`, `cause`, `metadata` | Multi-component event with shared physical DR handling |
| `gm_apply_nonlethal`, `gm_heal_nonlethal`, `gm_heal_hp` | `target`, `amount`; nonlethal damage may include classification | HP healing also removes equal nonlethal damage |
| `save`, `check` | target + `save`, `dc`; or target + `kind:skill/ability`, `subject`, `dc` | Saves use natural 1/20; ordinary checks do not |
| `gm_roll` | `kind:"plain"`, `count`, `sides`, optional `bonus`, `label`; defaults are plain/1/6/0 | Dice only: no target or effects. Example: `{op:"gm_roll",kind:"plain",count:1,sides:4}`. Explicit `damage`/`healing` kinds require a target. See PRONE_AND_DICE_V3_38.md. |
| `gm_modifier` | target/stat/value/type/duration | Explicit GM numeric modifier |
| `gm_maneuver_check` | `actor`, `target`, `kind`, optional `bonus` | Roll only, without pretending a full maneuver action happened |
| `gm_adjudicate` | `kind`, required `reason`, operation-specific fields | Logged Free Mode exception; see owner methods |
| `teleport`, `random_teleport` | target and destination / range | GM relocation; zones update |
| `gm_set_tile`, `gm_set_equipment`, `gm_set_defense_profile` | coordinates/kind; target/item/change fields; target/profile | Explicit battlefield/equipment edits |
| `gm_set_ammunition` | `actor`, `ammoId`, optional `reserve`, `loaded`, `ready` | Manual bounded stock correction |
| `admin_attack`, `admin_grant_action`, `admin_damage` / `deal_damage` | corresponding actor/target, resource or damage fields | Explicit cost-bypassing GM actions; not normal gameplay |
| `undo_turn`, `undo_round` | none | Existing deterministic checkpoints, including RNG |

GM permission does not make every edit safe at every interrupt phase: owner-specific guards remain. Generic effect `rounds` uses the established target-turn expiry model during combat. Use explicit initiative timing where a precise count is required; do not silently assume all duration models are interchangeable.

```json
{"op":"register_creature","definition":{"id":"guard_v1","name":"Fictional guard","creatureType":"humanoid","stats":{"maxHp":20,"str":14,"dex":12,"bab":3,"damageDie":6,"statTotals":{"ac":16,"touchAc":11,"flatFootedAc":15,"attack":5,"damage":2,"fort":4,"ref":2,"will":1},"abilityLinks":{"attack":["str"],"damage":["str"]}}}}
```

```json
{"op":"spawn_creature","definition":"guard_v1","id":"guard_1","x":3,"y":4,"team":"enemy"}
```

Printed totals already include their base bonuses. `abilityLinks` declare allowed ability deltas; they do not reconstruct the statblock's hidden components. Do not add existing bonuses a second time.

## Time & Events

| Commands | Key fields / behavior |
|---|---|
| `gm_begin_initiative` | `scores:{id:score,...}` or `roll:true`; supplied scores may be combined with rolling missing entries |
| `gm_set_initiative`, `gm_move_initiative_after` | `id,score`; or `id,afterId`; no retroactive extra turn |
| `gm_queue_delay_resume` | delaying creature `id` |
| `gm_end_initiative` | explicit encounter end; supported deadlines migrate to world time |
| `gm_schedule_initiative_event` | `id,label,afterRounds`, optional `atScore`, `requiresInput`, `expireEffectId` |
| `gm_cancel_initiative_event`, `gm_acknowledge_initiative_event` | event `id`; or pending-event `reason` |
| `gm_set_game_clock` | `day,hour,minute`; changes calendar display, not elapsed time |
| `gm_advance_time`, `gm_advance_to_event` | count/unit for elapsed interval; or next native deadline; optional `confirmPendingEvents:true` |
| `gm_schedule_time_event` | `id,label,after:{count,unit}`, optional `requiresInput` (default true) |
| `gm_cancel_time_event`, `gm_acknowledge_time_event` | queued event `id`; or pending-event `reason` |
| `gm_register_pending_event` | `id,label,trigger`, optional kind/actor/action/duration/input flag; native payloads use their dedicated commands |
| `gm_trigger_pending_event`, `gm_resolve_pending_event`, `gm_cancel_pending_event` | native event `id`; resolution requires `reason` |
| `gm_mark_summon`, `gm_dismiss_summon` | target/duration/source/reason; or target/reason |

Fast Forward requires encounter initiative to be ended and current actions/decisions resolved. Active narrative Pending Events first return `pending_events_warning` without advancing time; a confirmed repeat permits progress. Native summon-only timers do not require this narrative confirmation. A `needs_gm` result supplies the stopping point and remaining interval. Acknowledge/resolve the right owner before requesting the remaining interval.

Pending Event durations are `indefinite`, `encounter`, `turn_start` with actor, `time` with count/unit, or `initiative` with afterRounds/optional atScore. Timed events can expire or trigger. Ready requires active initiative, actor's turn, a described action and next-turn-start expiry; it spends a standard action. Generic trigger prose is not executed automatically. Native counterspells, held charges and summons enforce additional dedicated contracts.

```json
{"op":"gm_mark_summon","target":"guard_1","source":"hero","duration":{"count":5,"unit":"round"},"reason":"GM confirms duration"}
```

For spawn-time marking, add `summon:{duration:{count:5,unit:'round'},source:'hero'}` to `spawn_creature`. A definition tagged `subtypes:['summon']` requires this instance duration. Use `gm_set_initiative` to rank a newly spawned creature; summoning grants no implicit extra turn.

## Magic and fixed resources

| Commands | Key fields / behavior |
|---|---|
| `gm_set_spellcasting` | `actor`, `book`, `reason`; existing ID additionally requires `replace:true` |
| `gm_refresh_spellcasting` | `actor`, book ID, `reason`; optional new prepared choices; stored capacity unchanged |
| `gm_prepare_spell` | `actor`, book ID, `preparation`, `reason`; fills genuinely open capacity |
| `gm_restore_spell_resource` | actor/book/reason plus exact preparation or spontaneous pool/slotLevel/amount |
| `gm_resolve_casting_aoo` | reactor `actor`, `take`; handles one casting opportunity |
| `gm_continue_spell` | resumes a provoking/countered casting after its decisions; documented `aooResolved:true` is an explicit GM override |
| `gm_interrupt_spell` | caster `actor`, interruption `kind`, relevant DC/damage/reason |
| `gm_check_concentration` | `actor`, `dc`, `casterLevel`, optional `ability`, `bonus`; check only |
| `gm_resolve_counterspell` | Ready event `id`, `take`; taking additionally confirms `perceived:true` |
| `gm_discharge_touch_spell` | `actor`, optional contact `target`, required `reason` |
| `gm_resolve_spell` | actor/spell; logged effect-only override without normal action/slot costs |

An ordinary spell declares name, level, caster level, targets or area, and a supported damage/healing/modifier/condition/dispel payload. Casting time, save, SR, delivery and resource selection are explicit. No database fills missing mechanics. Damage area rolls are shared across recipients; each recipient still resolves its own defenses.

Configured prepared casts select `resource:{book,preparation}`; spontaneous casts select `resource:{book,spell,pool?,slotLevel?}`. Missing selectors on configured casters reject. Casts commit once at casting action payment; interruption/countering does not refund, and continuation/held delivery does not debit again. Ready does not reserve/spend a slot until an actual counter begins.

Import allotments as `{type:'imported',totals:{1:4,2:2}}`, or derive once with `{type:'derived',base:{1:2,2:1},abilityScore:18}`. Missing/null levels are inaccessible; a zero base can gain bonus spells. Only one pool per book may derive ability bonuses. Extra restricted pools should use fixed totals. Current ability changes never resize/refill the stored allotment. Explicit refresh restores usage against its existing maxima.

A targeted dispel uses `spell.dispel:{}` or a specific native `effectId`; greater targeted removal uses `greater:true`. Ready counters use `spell.counterspell:{mode:'same'}` or `{mode:'dispel'}`. Their selected target is the opposing caster. For a fixed region, use `targets:[areaId]` with the same dispel payload; the region origin is its range/line-of-effect target. Ongoing eligible spell effects are indexed from native effects, held events and persistent-area events, not a second active-spell ledger. General summon banishment uses explicit dismissal after GM adjudication.

Detailed payload examples: [casting](docs/history/CASTING_TIMES_AND_INTERRUPTION_V3_24.md), [touch/rays](docs/history/TOUCH_AND_RAY_DELIVERY_V3_25.md), [counter/dispel](docs/history/COUNTERSPELL_AND_DISPEL_V3_26.md), [resources](docs/history/SPELL_RESOURCES_V3_27.md), [summons](docs/history/SUMMONS_V3_28.md). Apply the current scope and resource policy above when reading those milestone documents.


## Fixed persistent regions — V3.31

Add `persistent` to an ordinary `area` spell, then use `cast_spell` normally. `gm_resolve_spell` remains an explicit override. Existing geometry fields stay unchanged. The declaration accepts `duration:{count,unit,atScore?}`, optional `triggers` drawn from `create`, `enter`, `turn_start`; `affects:'all'|'allies'|'enemies'`; `frequency:'once_per_round'|'each_trigger'`; `effectScope:'inside'|'duration'`; and `dispellable:boolean`.

Defaults: all three triggers, all creatures, once per recipient per elapsed round, inside-only modifiers/conditions, and normal dispellability. `duration` is required and bounded to 1–100000 rounds; an optional initiative count requires active initiative. Creation returns `areaId`; observe with `gm_get_persistent_areas` and remove with `gm_cancel_pending_event`. Generic trigger is disabled for native area events. See [PERSISTENT_AREAS_V3_30.md](PERSISTENT_AREAS_V3_30.md) for an executable example and timing semantics.

## V3.31 encounter basics

| Command | Inputs | Purpose |
|---|---|---|
| `gm_get_health` | none | Pure derived HP/recovery view |
| `gm_set_recovery` | `target`, `recovery:{fastHealing?,regeneration?:{amount,bypass},disabled?,excludedDamage?}` | Replace explicit recovery configuration; also a top-level creature-definition field |
| `gm_stabilize` | `target`, optional `aided` (default true) | GM-established stabilization below zero HP |
| `gm_set_continuous_damage` | `target`, boolean `active` | Declare ongoing damage outside registered DOT ailments |
| `gm_suppress_regeneration` | `target`, `rounds`, `reason` | Native shutdown timer for an adjudicated special rule |
| `use_immediate` | `actor`, optional `label` | Actor/GM bookkeeping for current or coming swift action |
| `gm_set_cooldown` | `target`, `ability`, `rounds` | Named unavailable reminder in Pending Events |
| `gm_get_cooldowns` | none | Pure cooldown view |
| `gm_preview_object` | material/thickness or explicit stats | Pure material estimate |
| `gm_spawn_object` | `id`, `name`, `x`, `y`, optional `material`, `thicknessInches`, `maxHp`, `hardness`, `size`, `sizeCategory`, `ac`, `magicCasterLevel`, `attendedBy`, `energyMultiplier`, `rangedMultiplier` | Inanimate registry/map token |
| `gm_repair_object` | `target`, `amount` | Repair a damaged surviving object |
| `gm_adjudicate`, `kind:'health'` | `target`, `hp`, `reason`, optional `revive`, `stable`, `conscious` | Explicit logged HP/life correction |

Use `gm_cancel_pending_event` to clear a native cooldown or shutdown early. No second timer-removal API exists. Health, cooldown and object-preview views remain accessible during checkpoints. See `ENCOUNTER_BASICS_V3_31.md` for runnable examples, timer semantics and the boundary between configured mechanics and GM decisions.

## V3.32 spell condition payload

No new casting or condition command is required. In `spell.effect`, supply `rounds:1..100000` and `conditions:[id,...]`; `mods` becomes optional. Optional unique `tags:[...]` use the existing effect-tag vocabulary and gate the entire ongoing bundle. Existing `applyOnSaveSuccess` and `dispellable` flags apply to conditions as well as modifiers. A successful negating save always prevents the bundle.

`conditions` accepts unique standard IDs except `dead`, `dying`, `stable`, `disabled` (use vitality commands). Each condition retains its native immunity and coverage/advisories. Results expose `conditions`, `effectImmunity`, `effectIds`, and the compatible first `effectId`. Dispel any linked effect to end that casting's entire recipient bundle. `remove_condition` remains an explicit GM removal of all sources of that condition. See [SPELL_CONDITIONS_V3_32.md](SPELL_CONDITIONS_V3_32.md) for an example, ownership, timing, region re-entry and GM boundaries.

## V3.33 maintained concentration

Set `spell.concentration:{maxRounds?,afterRounds?}` on a native effect or fixed persistent area, omitting `effect.rounds` / `persistent.duration`. `maxRounds` is the whole lifetime cap; `afterRounds` is the optional tail when concentration stops, clamped by that cap. Ordinary spell duration schemas remain unchanged.

Use actor/GM `maintain_concentration {actor}` to spend the active caster's standard action on upkeep and `stop_concentration {actor,reason?}` to stop without action cost. Existing GM `gm_interrupt_spell` checks/breaks either active casting or maintenance. `gm_get_spellcasting` includes the pure `maintenance` view. Native event cancellation is a GM removal of the entire linked spell without a tail; generic triggering is forbidden.

Fast Forward requires `maintainConcentration:true` while maintaining. Its checkbox and concentration controls are in Time & Events. See [CONCENTRATION_V3_33.md](CONCENTRATION_V3_33.md) for action timing, exceptions, effect cleanup and an executable example.

## V3.34 map, elevation and scene lifecycle

All commands below use `gm`; ordinary attacks/movement/casts still use `actor` and keep their costs. See [MAP_AND_ELEVATION_V3_34.md](MAP_AND_ELEVATION_V3_34.md) for exact validation, examples, exposure semantics and limits.

| Command | Fields / result |
|---|---|
| `gm_get_map` | Pure dimensions, sparse tiles, elevation tiles, current rulings and warnings |
| `gm_configure_map` | `width,height,reason`, optional `name`; 1–256 squares per axis, rejects clipping, warns after establishment |
| `gm_set_tiles` | `cells:[{x,y,kind}],reason`; atomic terrain batch using existing tile vocabulary |
| `gm_establish_scene` | Marks established and reconciles existing areas; initiative start also establishes |
| `gm_set_elevation` | `target,elevation:{feet,grounded,layer?,note?}|null,reason`, optional replacement `traversal` for same-command landing |
| `gm_set_tile_elevation` | `x,y,elevation:{surfaceFeet,obstacleHeightFeet?,note?}|null,reason` |
| `gm_set_geometry` | `actor,target,ruling:{distanceFeet?,meleeReach?,threatens?,lineOfEffect?}|null,reason`; directional, invalidated by position/terrain changes |
| `gm_set_traversal` | `target,cells:[{x,y,passable?,costSquares?}],reason`; replaces that creature's terrain exceptions |
| `gm_set_exposure` | One `areaId` or `ruleId`, `exposure:{mode,targets?,reason?}`, `reason`; edits existing exposure owner |
| `gm_preview_scene_close` | Pure preview with explicit `keep:[ids]` |
| `gm_close_scene` | `keep,placements:[{id,x,y,elevation?}],reason`, optional `width,height,name`; ends scene after initiative/actions are resolved, preserves retained mechanical state |

`spawn_creature` additionally accepts instance `elevation`. `spell.exposure` (area spells) or `spell.persistent.exposure` supports surface/volume and explicit per-target exposure decisions; use only one location. Automation supports exposure on tile/zone entry and turn start. `sizeCategory` Tiny/Diminutive/Fine supports shared occupancy and default zero reach; explicit printed reach overrides that default. The engine does not calculate 3-D distance or tactical choices.

## V3.35 map features

GM commands: `gm_set_map_features {features,remove?,reason}`, `gm_set_door {id,state,reason}`, and read-only `gm_get_geometry {actor,target}`. `gm_get_map` includes normalized features. Existing `gm_set_geometry.ruling` additionally accepts `lineOfSight` and `cover`. Read [MAP_FEATURES_V3_35.md](MAP_FEATURES_V3_35.md) for feature shape, property and elevation-transition schemas and examples.

## V3.36 falling

GM-only `gm_preview_fall {target,fall,landing?}` is pure. `gm_resolve_fall {target,fall,landing?,reason}` applies a declared landing with existing damage/condition/elevation owners. See [FALLING_V3_36.md](FALLING_V3_36.md) for the complete schema and rule conventions. No automatic fall occurs when elevation decreases.

## V3.37 public MCP interface

Use kernel_status/catalog/query/reference/result for reads. kernel_action sends the command under actor authority; kernel_gm sends it under GM authority and requires a separate reason. Every mutation needs expectedRevision and requestId. No generic role argument or arbitrary state replacement is exposed. See INTEGRATION_V3_37.md for the full transport and retry contract.

## Prone attack declarations — V3.38

Prone applies -4 only to melee/melee-touch attacks; defender AC adjustments remain -4 against melee and +4 against ranged. Most ranged weapons are rejected while prone. For a verified exception, put `usableWhileProne:true` on that specific `stats.attacks[]` entry when registering the creature. Crossbows, firearms and shuriken are standard examples. Names alone do not grant rules. Rays (`attackMode:"ranged_touch", rangedKind:"ray"`) stay usable without a melee penalty. Stand-up, crawl, and their opportunities remain explicit GM adjudication; ordinary movement does not enforce posture. See PRONE_AND_DICE_V3_38.md.

## Common combat mechanics (V3.40)

See `COMBAT_MECHANICS_V3_40.md` for `stand_up`, `crawl`, `total_defense`, `gm_set_combat_profile`, `gm_get_combat`, `gm_get_flanking` and `gm_grant_source_immunity`; and the optional `combatOptions`, `flanking`, `precisionEligible`, `source`/`ability` additions to existing commands. These use the same actor/GM/query boundaries as other mechanics. No map library or player-view synchronization is introduced in this release.

V3.41: list_trait_library also returns subtypeCoverage. Query /subtypes for accepted IDs or /subtypeCoverage/<id> for classification_only, partial or tracked_marker coverage. kernel_status(target) includes classification. See SUBTYPES_V3_41.md (reference topic subtypes).

V3.42: register_creature help now uses CREATURE_IMPORT_V3_42.md (reference topic registry). Rejections identify field paths and separate missing ammunition stores from incorrect ranged modes. Read this before importing statblocks; historical V3.4 recipes are superseded.

V3.43: `gm_set_player_view`, `gm_set_player_display` and `gm_preview_player_view` implement shared player visibility and a private GM layer. See PLAYER_VIEW_V3_43.md (reference topic player_view) for schemas and the live local viewer.

## V3.46 map lifecycle

Read MAP_LIBRARY_V3_46.md (`kernel_reference` topic `map_library`).

- Query: `gm_list_maps`, `gm_preview_encounter_clear` (optional keep list), `gm_get_player_visibility`.
- GM: `gm_save_map` (id, optional name/overwrite), `gm_load_map` (id, confirm:true), `gm_delete_map` (id), `gm_clear_encounter` (optional keep list). All mutations require a reason.
- Map objects stay during cleanup. Character HP/resources/ongoing effects are preserved only for explicit keep IDs; no rest occurs. Pending work blocks cleanup. Map load requires an empty non-object roster.

## Background artwork — V3.47

- `gm_get_map_artwork`: query configuration, source dimensions, placement and redactions without bytes.
- `gm_set_map_artwork`: presentation-only mutation with `image` (base64 PNG or null), `placement` ({x,y,width,height,rotation}, grid squares/degrees), and/or `redactions` (replacement array of {x,y,width,height,color}, source pixels). Reason required.

Read MAP_ARTWORK_V3_47.md or topic `artwork` before use. Prefer the local file picker for upload; never fabricate image bytes. Artwork cannot infer mechanics or remove secrets printed into an unredacted source.
