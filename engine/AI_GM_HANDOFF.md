# V3.51 artwork boundary

Masking now operates at source resolution instead of rasterizing the map into a 2048-pixel canvas. `gm_set_map_artwork.calibration` resolves two source/grid intersection pairs into the existing placement; no duplicate geometry owner. Keep 5-ft mechanics for 10-ft printed maps. Image limits: 16 MiB, 8192 per side, 16 megapixels; map bookmarks 32 MiB each / 64 MiB total, session 384 MiB including checkpoints. Normal tool arguments remain 2 MiB; artwork receives a 23 MiB allowance. See MAP_ARTWORK_V3_47.md for payloads and privacy edge handling. No user maps are bundled. Independent fresh-user setup testing and multiplayer remain outside this update.

# V3.50 swarms and troops

CollectiveGame composes the existing damage, vitality, occupancy and reaction owners. Native action state records one ordinary automatic damage resolution per turn; vitality records nonlethal dispersal until HP exceeds nonlethal. Read COLLECTIVES_V3_50.md for targeting declarations, component-size import, reaction/casting behavior and remaining geometry limits. Previous saves remain supported; legacy collective subtype labels need a configured attack before taking turns. No user encounter is bundled. Larger artwork and grid calibration are implemented in V3.51; see the section above.

# V3.49 player token vitals

Click a public token’s square to inspect opted-in HP and condition names. `playerDisplay.showVitals:true` uses existing state and the existing public projection; no second health store or player mutation endpoint. Defaults remain private. See PLAYER_VIEW_V3_43.md and RELEASE_V3_49.md. Larger artwork limits, grid-calibration guidance and swarm/troop mechanics are still pending; this release does not implement them.

# V3.48.2 save compatibility repair

Session format /1 remains unchanged. Keep every published compatible writer in SUPPORTED_SESSION_VERSIONS when bumping ENGINE_VERSION. V3.48.0/.1 accidentally rejected V3.47 saves because the old acceptance expression depended on ENGINE_VERSION. A real V3.47-generated synthetic fixture now checks maps, artwork, fog, clock, actors, receipts and checkpoints through restart. Never fix this by rewriting the user's save version or selecting a new encounter. Future unknown versions/formats remain rejected without modifying the file.

# Developer and detailed GM handoff — V3.48

## V3.48 setup and coordinates

Read SETUP.md (kernel_reference topic setup) for first installation before a connection exists. The website package now has a bundled onboarding skill and local ZIP. Preserve the registered app identity; distributing this app does not provision per-user tunnels. Independent testers need their own connection; public account onboarding remains to be verified.

Player coordinates are implemented: sticky rulers, A1 labels continuing after Z, exact hover readout and click-to-pin. No player mutations or coordinate state are sent to the server. See MAP_COORDINATES_V3_48.md (topic coordinates) for zero-based X/Y conversion and inclusive ranges. README and the launcher guide are also exposed as reference topics. No save schema or combat rules changed.

## User requirements

The AI GM supplies imagination, tactics and adjudication; the engine owns configured mechanics and repetitive arithmetic. Use normal `dispatch` commands for gameplay and deliberate GM commands for exceptions. Direct writes to `s` are not the intended AI interface. `gm_resolve_spell`, `admin_attack`, direct GM damage and `gm_adjudicate` are explicit overrides, not normal attack/casting shortcuts.

Keep **daily spell capacities frozen**. Imported totals already include bonus spells; derived setup uses an explicit daily ability score once. Buffs, penalties, damage/drain, permanent score edits and elapsed time never resize or refill capacity. Explicit refresh restores expenditure against stored maxima without recalculation. Only explicit book replacement recalculates capacity. Current casting-score eligibility is separate. Unconfigured historical casters retain untracked usage; configure every caster whose resources must be enforced.

Held touch charges and Summon durations live in **Pending Events**. Ready owns counterspell timing/initiative. Casting continuations retain actual resource expenditure. Do not create another slot counter, summon clock, ready queue or held-charge registry.

Summon is an instance marker plus an explicit duration. Expiry, 0 HP, applied dead condition or explicit dismissal removes that instance. Nonlethal unconsciousness alone does not dismiss it. Creature choice, summoning permission, placement, duration and control are GM decisions. Spawn does not infer a spell or spend a slot. Generic trigger cannot fire native Summon/held events; cancelling Summon dismisses it. Automatic spell-dispel targeting of summons remains separate work.

Keep clock, Fast Forward, scheduling, Pending Events and resolution controls together in **Time & Events**. This is a project UI choice, not a general user preference.

## Persistent areas — V3.31

Fixed lingering regions are implemented by `persistent_areas.mjs`. The region lives in one native Pending Event payload; no second area registry or expiry scheduler exists. Geometry and affected recipients are derived with `spell_geometry.mjs`. Exposures call the ordinary spell damage/healing/save/SR/modifier resolver without a new casting action or resource debit.

Add `spell.persistent:{duration:{count,unit},triggers:['create','enter','turn_start']}` to a normal area spell. Select triggers and frequency from the actual spell; defaults are only a mechanical contract, not a rules database. Default frequency is once per recipient per elapsed round; `each_trigger` is explicit. Entry includes movement, teleport destinations and spawning. During Fast Forward, selected turn-start exposure repeats every elapsed round for occupants; empty regions skip directly to another deadline. Expiration runs before exposure at the same instant.

Default `effectScope:'inside'` ties numeric modifiers and native spell conditions to occupancy and the region lifetime. Explicit `effectScope:'duration'` keeps the effect's own timer after exit or region termination. Existing modifiers from the same area/recipient do not accumulate on repeated exposure. SR is checked once per recipient/region; saves repeat on qualifying exposures. Regions remain fixed and survive caster movement/defeat/removal. Team filters use the caster's team when the region is created.

Use `gm_get_persistent_areas` for a pure view, `gm_cancel_pending_event` with the area ID for removal, and the existing dispel spell with `targets:[areaId]` for mechanical dispelling. The workbench shows footprints and groups region countdown/removal in Time & Events. See `PERSISTENT_AREAS_V3_30.md` and `TEST_RESULTS_V3_39.txt`.

## Encounter basics — V3.31

Read `ENCOUNTER_BASICS_V3_31.md` before adding HP-related mechanics. Existing damage and healing now share vitality hooks. HP status is derived; do not install duplicate dying/stable conditions to mirror it. Use `gm_stabilize`, `gm_set_recovery` and `gm_get_health`. Recovery rates are explicit data. Creature vitality holds persistent death, stabilization/consciousness, aid and a native recovery deadline; the shared clock indexes it. Daily spell capacities remain untouched by recovery.

Immediate actions, named cooldowns and regeneration shutdown use native Pending Events. Use their dedicated commands; generic triggering is rejected. Cooldowns are GM-visible reminders, not a new ability execution registry. Immediate-action bookkeeping does not introduce a universal interruption stack.

Objects use existing map/registry instances with `objectProfile`, shared packet resolution and the small `object_rules.mjs` material/hardness helper. They cannot act or enter initiative. Linked map barriers deactivate when their object is destroyed; other terrain consequences remain explicit GM edits. Published object stats override estimates. Free Mode `gm_adjudicate` with `kind:'health'` and a reason permits explicit HP/life correction.

## Spell conditions — V3.32

Read `SPELL_CONDITIONS_V3_32.md`. Add `effect:{rounds,conditions:[id,...],mods?:[...],tags?:[...]}` to an ordinary spell. Conditions use the existing save/SR/delivery path, native condition immunity, and the spell's expiry/dispel provenance. Declared effect tags gate the whole ongoing bundle, not separate damage/healing. HP/life statuses are excluded; unconsciousness is allowed with GM-supplied descriptors and waking rules.

`conditionInstances.applicationKey` scopes a spell condition to its casting ID; manual instances remain separate. Each source keeps its native effect/timer, while condition modifier selection counts duplicate conditions once and uses the strongest fear/fatigue family's modifiers. Spell declarations specify the resulting condition: repeated exposures do not infer escalation. Manual refresh/escalation stays within manual instances. Explicit GM `remove_condition` removes all sources; targeted dispel removes one casting/recipient group.

Persistent areas retain qualifying payload keys in their existing `modifierEligible` map. Re-entry restores only those parts without new saves or damage; old boolean numeric-only records remain supported. Do not introduce a second condition list, countdown or dispel owner. Temporary spell-application context is internal and restored in `finally`; it permits automatic entry/touch effects during their existing continuations without loosening manual command guards.

## Maintained concentration — V3.33

Read `CONCENTRATION_V3_33.md`. `spell.concentration:{maxRounds?,afterRounds?}` replaces `effect.rounds` and `persistent.duration`. One native Pending Event owns maintenance and lifetime; numeric/condition effects and fixed areas remain their existing records, linked by casting ID. No new scheduler or action pool exists. Maximum duration is an absolute cap including any lingering tail.

`maintain_concentration` spends a standard action on subsequent turns; it neither provokes nor re-spends slots. Initial resolution covers that turn, including a deferred long-cast completion turn. Skipped upkeep ends at turn end; stop explicitly if earlier within-turn timing matters. `stop_concentration` costs no action and applies the declared tail. New normal casting and readied counterspell execution are blocked while maintaining another spell. `focusFor` routes maintenance through the existing damage/contextual concentration checks. `gm_interrupt_spell` handles GM distractions for either active casting or maintenance.

Fast Forward requires `maintainConcentration:true` while a spell is being maintained; lingering tails do not require it. Maximum/tail expiration clears linked effects before same-time clock exposures. Partial dispels retain other recipients; the last removed link clears maintenance. GM cancellation of the native event removes the whole spell without a tail. Source departure clears maintained regions as well. Keep controls in Time & Events.

The V3.30 external critique has been reviewed. The user deprioritized human-facing visual polish; the MCP integration follows the V3.36 falling resolver. Use a thin, discoverable interface over existing mechanics. Do not replace the engine or automatically adopt the memo's optional approval/campaign policies.

## Earlier architecture audit

V3.29 consolidates transactions, movement continuation, normal/deferred turn start, ability-check rolling, HP healing and ray/tile intersection. Nested rollback no longer repeatedly copies the whole state. The canonical guides now describe active code rather than the original proposal.

Fixed boundaries include cross-category typed modifier stacking; ability-damage dependencies in ranged attacks and Tiny CMB; derived mental spell DCs; negative Strength damage scaling; automatic expiry activity flags; manual-mutation undo selection; traits/timers before entry effects; incapacitation during suspended movement; clock/checkpoint ordering; read-only inspection during checkpoints; and surviving conditions referencing departed summons. Tests also cover nested rollback, deferred ticks and same-time decisions. See `AUDIT_V3_29.md` and `TEST_RESULTS_V3_29.txt`.

The layer chain remains long and historically named. Its current owners are mapped in `ARCHITECTURE.md`; a wholesale rewrite was unnecessary. A subclass wrapper around a shared resolver is not another independent mechanics system.

## Next work and limits

Fixed persistent areas are complete within the declared payload contract. Concentration maintained **after** resolution is implemented in V3.33; native spell conditions are implemented in V3.32. Moving regions, wind/spread evolution, terrain changes and spell-specific exceptions require explicit GM adjudication; do not infer them from an area tag.

Creature components are assumed available; player inventory tracking is external. Comprehensive rest qualification and exhaustive spell-specific exceptions remain GM adjudication. A validated payload or resource book does not imply a complete spell/class/feat database.

The engine enforces supported declared mechanics, not unseen sourcebook facts or hidden bonus components in imported totals. Negative HP, disabled actions, dying/stabilization, death persistence and configured recovery are implemented in V3.31. Resurrection eligibility and its side effects remain GM decisions; ordinary healing cannot restore life. Full three-dimensional geometry (beyond V3.34 annotations and explicit spatial rulings), arbitrary nested interrupts, suppression/antimagic, possession/body ownership and exceptional maneuver geometry remain outside this release. Do not silently emulate missing mechanics by inventing state.

## Maintenance rules

Public mutations are synchronous and atomic through `Game.transaction`; nested owners join it. An inner transaction error aborts the outer operation even if caught. Expected validation probes should be pure and precede mutation. Restore temporary context flags in `finally`.

Use `beginTurnEffects`/`finishTurnStart` for mandatory turn effects; do not copy a deferred-start path. Use `initializeCreature`/`onCreatureSpawned` before entry triggers. Forward override options, especially `removeEffect(id, {countAsAction:false})`. Index deadlines centrally but let native owners resolve their records. Read-only commands must remain pure and accessible during checkpoints.

Rebuild with `python3 build_demos.py`. Verify with `python3 run_regressions.py --browser` (Node, Python Playwright, Chromium; optional `BROWSER_EXECUTABLE`). Add focused integration tests for changed boundaries. Exclude test screenshots/runtime caches from releases. Keep source, builders, tests, current report and standalone HTML together.

## V3.34 map and scene contract

See MAP_AND_ELEVATION_V3_34.md. Map dimensions are GM-configurable (1–256 squares per axis); establishment warns on resizing without requiring approval. Scene closure is explicit, after initiative and native continuations finish. Supply a keep list and survivor placements; it clears old terrain, discarded actors, fixed areas and undo/history without healing, refreshing daily resources, or advancing time. Surviving ailments/effects detach departed sources. Independent spell provenance must not become owned by a new actor reusing an old ID. Lingering concentration tails retain their existing native timer.

Elevation is an annotation plus declared grounded/contact and occupancy layer. Warnings expose the limits of X/Y measurements. `gm_set_geometry` makes directional reach/threat/range/line-of-effect rulings without bypassing action costs, and invalidates on changed positions/terrain. `gm_set_traversal` handles terrain clearance/costs. Exposure remains on existing area/automation records; surface hazards differ from volume effects. Do not assume all flying creatures ignore all effects. Same-square Tiny-and-smaller attacks, capacities and movement AoOs use ordinary combat continuations.

The user explicitly does not want a secondary NPC archive/GM-notes subsystem inside the calculator. Document an interchangeable companion notes/storage tool without naming a specific product. The offline workbench is for inspection/testing; integration should operate the structured API. V3.37 implements the adapter, ordinary/override separation, concise state and continuation discovery. Fresh-GM trials have exercised the connection and exposed discovery gaps. V3.39 adds operating guidance, tested catalog examples and command-specific recovery pointers. Known remaining limitations are listed in AI_START_HERE.md.

## V3.35 walls, terrain and automatic elevation transitions

Read MAP_FEATURES_V3_35.md before authoring map geometry. Use `gm_set_map_features` for eight-way paths or cell regions, `gm_set_door` for door state, and pure `gm_get_geometry` for diagnostics. Shape properties separate movement, vision, effects, cover and directional costs. Bars/slits require a passage ruling; visibility does not imply passage. Reference object HP with `objectId`; never add another durability counter.

Elevation tags remain manually editable. Automatic stair/hill transitions are opt-in: declare one straight boundary with `elevationTransition:{up,riseFeet}`. Grounded crossing adds height toward the upper side and subtracts it in reverse; airborne passage and teleport do not. Costs do not imply heights. Use multiple distinct boundaries for multiple landings. The shared movement hook applies after a committed step, not when an AoO pauses it. Do not implement a second height store or infer flight/3-D reach from these tags.

The adapter remains next. Preserve the existing clock, interrupt, spell-resource, exposure and scene owners. This release does not include an AP-image importer, automatic tactical route planner or complete visibility/awareness simulation.

## V3.36 explicit falling

Read FALLING_V3_36.md. Use pure `gm_preview_fall` then `gm_resolve_fall` for a GM-declared completed fall. No automatic falling is inferred from descending terrain/elevation. Supply completed skill totals and optional final elevation; adjudicate reactions/eligibility before resolving. Water is a separate branch; shallow water and special effects permit reasoned overrides. Existing damage, nonlethal, prone, concentration and entry hooks own the consequences, with one concentration check for mixed impact damage. No new fall queue or state store.

The scoped mechanics foundation is complete for this milestone. V3.37 adds the adapter below; do not delay connected testing to implement an exhaustive rules database.

## V3.37 MCP integration

Read INTEGRATION_V3_37.md. Seven tools expose the existing engine through normal actor actions, explicit reasoned GM mutations, pure queries, paged state/discovery/references and latest-result inspection. Every mutation needs the current revision and a retry ID; repeating an uncertain request uses identical arguments. Saved state includes native undo checkpoints and 64 bounded request receipts. No new mechanical state owners exist. The server starts empty, is private/single-encounter, and supports stdio or authenticated Streamable HTTP via the official MCP SDK.

Historical V3.37 milestone: local manifests were packaged. Since then, the owner has verified a live tunnel connection, fresh-AI mechanics tests, Firefox player view and Ubuntu launcher. Public listing and independent-account onboarding are still unverified. The standalone HTML remains a separate sandbox.

## Prone attacks and standalone dice — V3.38

Read PRONE_AND_DICE_V3_38.md. Use `gm_roll` with `kind:"plain", count:1, sides:4` for a standalone 1d4, without any target. Never use damage/healing as a surrogate dice roller. It remains a mutation for RNG, logs, undo and retry receipts, but spends no creature action resources and applies no effects. `kernel_catalog(op:"gm_roll")` supplies a working example.

Prone attack penalties and ranged eligibility are now enforced in the shared resolver and preflight. Declare `usableWhileProne:true` per ranged attack only when justified by rules; labels are not parsed. Spell rays remain usable. Standing/crawling and their AoOs are still GM-adjudicated; do not mistake unrestricted ordinary movement for correct prone movement. No second posture tracker or dice engine was added.

## V3.40 handoff

Mechanical followups implemented: targeting consistency, planar flanking/precision, prone stand/crawl, expanded helpless/paralysis defenses, common combat options, source-specific immunity helper. Read COMBAT_MECHANICS_V3_40.md for exact limitations. Map-preserving cleanup and named map-only saves are implemented in V3.46. V3.47 adds original artwork import, affine placement, source-pixel secret covers and server-side fog masking beneath existing public overlays. Arbitrary painting/object extraction and remote sharing remain deferred. Manyshot was explicitly deferred. Do not mutate the user's live encounter to test a release. README now distinguishes imported mechanics, GM context and unsupported systems for fast-model users.

## V3.41 subtype handoff

Recognition and automatic traits now have distinct coverage. Read SUBTYPES_V3_41.md. V3.42 follows this with current import guidance and field-path diagnostics; see CREATURE_IMPORT_V3_42.md and RELEASE_V3_42.md. No new published-creature examples were added. Specialized validators remain authoritative, with attack/profile context on failures.

## V3.43 player view handoff

Read PLAYER_VIEW_V3_43.md. Presentation is owned by existing scene/playerView and creature/feature playerDisplay fields, not a second engine. Pure playerProjection is the only allowed source for the public HTTP payload. The separate loopback player server serves fixed assets and GET/HEAD state only. MCP stays private on its original listener. Preserve the server-side hidden-entry/geometry filtering in future image, remote-hosting and map-library work. Never ship the original unrevealed image beneath client-only fog.

## V3.46 scene/map lifecycle

Read MAP_LIBRARY_V3_46.md. `map_snapshots.mjs` contains scene-owned bookmark operations and reuses native object/terrain validators. `state.savedMaps` uses the existing encounter persistence, with explicit budgets and no parallel filesystem registry. Bookmark save/delete changes are copied into combat checkpoints so undo cannot remove durable bookmarks. `gm_clear_encounter` reuses `closeScene` with internal map preservation, ends idle initiative and refuses pending work. Do not reset HP/resources or cancel survivor clocks as a rest. Player diagnostics are GM-only and must never be added to the public projection. The Windows shortcut now calls a stable Python bootstrap, whose settings select the current installed release; no new Windows executable or security-policy changes.
