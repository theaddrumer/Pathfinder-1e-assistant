# V3.34 — map lifecycle, elevation annotations and shared occupancy

The engine remains a two-dimensional, 5-foot-square calculator. The AI GM supplies map layout and vertical rulings. This release adds no tactical planner, flight simulation, campaign archive, AI host or external connection. Use a separate, interchangeable companion tool for campaign notes and long-term records; no particular product is required.

## Map setup and soft lock

`gm_configure_map` accepts integer `width` and `height` from 1 to 256, optional `name`, and a nonempty `reason`. The legacy default remains 10×8. Enlargement retains coordinates, terrain and actors. Shrinking rejects clipping any creature footprint, stored terrain/elevation tile, existing area cell or area origin; failures roll back atomically. Expansion can expose additional cells of an existing area, using its ordinary entry rules.

`gm_set_tiles` applies a batch of `{x,y,kind}` cells through the existing terrain command. Kinds remain `open`, `wall`, `force_wall`, `difficult`, `hazard`. The whole batch rolls back on failure; cells must be unique. Up to 65536 cells per command. Existing `gm_set_tile` remains available. These commands define geometry; a `hazard` tile alone does not author a full damage rule in the complete engine. Use existing automation or persistent spell payloads for the hazard's mechanics.

`gm_establish_scene` marks the map established and reconciles area/aura occupancy. Beginning initiative also marks it established. Later resizing still succeeds, with an advisory to avoid resizing in response to every player input. This flag is not a permission gate and does not require human confirmation. Geometry edits still cannot interrupt an unresolved native action/checkpoint or silently clip state.

`gm_get_map` returns detached dimensions, sparse terrain, `elevationTiles`, the scene label/established flag, current rulings and creature elevation annotations. `inspect` includes this view. Both reads are pure.

```json
{"op":"gm_configure_map","width":60,"height":40,"name":"Ruined fort","reason":"Adventure map dimensions"}
```

```json
{"op":"gm_set_tiles","cells":[{"x":12,"y":8,"kind":"wall"},{"x":13,"y":8,"kind":"difficult"}],"reason":"North wall and rubble"}
```

## Elevation and occupancy layers

`gm_set_elevation` takes `target`, `elevation:{feet,grounded,layer?,note?}` and `reason`. `feet` is a finite signed number relative to a shared map datum, not a second measurement relative to each tile. `grounded` states contact with the local surface; a creature on a balcony can be grounded at +20 feet. `layer` is a short GM-declared occupancy group, default `ground`. Different declared layers may share X/Y squares. Layer names do not calculate creature height or physical clearance: the GM is declaring that the occupants do not collide. The elevation number alone does not bypass occupancy. `elevation:null` removes the annotation after validating the resulting placement.

A spawn may include the same `elevation` object. This is instance placement data, not a species trait or a bonus. Elevation never grants flight, changes speed, spends an action, or computes climb/fall damage. The GM must spend the appropriate ordinary actions and declare costs. Any vertical annotations cause spatial advisories in inspection and successful mutation results.

`gm_set_tile_elevation` takes `x,y,elevation:{surfaceFeet,obstacleHeightFeet?,note?},reason`. Negative surface values can describe pits; positive values describe platforms/embankments; obstacle height describes a wall above its local surface. These are annotations, not automatically traversable ramps or automatic falling damage. `elevation:null` removes them. Tile kinds still control ordinary blocking.

```json
{"op":"gm_set_elevation","target":"hero","elevation":{"feet":20,"grounded":false,"layer":"air_20","note":"Flying above the floor"},"reason":"GM establishes vertical position"}
```

```json
{"op":"gm_set_tile_elevation","x":12,"y":8,"elevation":{"surfaceFeet":0,"obstacleHeightFeet":10,"note":"Ten-foot wall"},"reason":"Adventure description"}
```

## Explicit geometry and movement rulings

`gm_set_geometry` takes `actor,target,ruling,reason`. `ruling` may specify `distanceFeet`, `meleeReach`, `threatens`, and/or `lineOfEffect`. The ruling is directional; declare the reverse direction separately when needed. Distances feed ordinary attack range arithmetic and creature-targeted dispel/counterspell distances. Melee and threat flags settle those particular questions. Line of effect affects the existing wall geometry check; it does not remove blindness, concealment, declared total cover, immunity or other restrictions. Use existing defense-context commands for those rulings. Ordinary actions still spend their actions, ammunition and spell resources.

Rulings are stamped with both creatures' positions, sizes, reach, elevation and map revision. A positional/elevation/terrain change invalidates them rather than silently reusing old measurements. A multi-step move can therefore require a new ruling at a later AoO offer; decline an invalid offer through its native continuation. `gm_set_geometry` can be used during a pending decision and does not start a new action. Do not rerun an interrupted move/cast. Contradictory threat/reach declarations are rejected.

`gm_set_traversal` takes `target,cells:[{x,y,passable?,costSquares?}],reason`. It replaces that creature's declared traversal exceptions (up to 1000 cells); an empty array clears them. Passability bypasses only terrain blocking, never bounds, collisions or action/condition rules. Cost is the total cost of entering that destination in 5-foot-square units, at least 1, including any declared vertical/diagonal difficulty. The exception is tied to the creature's elevation and the current terrain revision. Airborne movement avoids ordinary surface difficult-terrain penalties; ascent, movement mode and obstacle clearance remain GM-declared. Core charge geometry retains its stricter straight-path/terrain constraints; use ordinary declared movement and a separate action when the charge cannot be represented faithfully.

To land on a wall/platform while changing its passability ruling, `gm_set_elevation` accepts optional `traversal:[...]` in the same atomic command. Setting elevation alone never provides an extra move or recharges action resources. Paths may contain up to 1000 adjacent entered squares; action speed/cost limits still apply.

```json
{"op":"gm_set_geometry","actor":"archer","target":"flyer","ruling":{"distanceFeet":45,"meleeReach":false,"lineOfEffect":true},"reason":"GM measures range and clear line above the parapet"}
```

```json
{"op":"gm_set_traversal","target":"hero","cells":[{"x":12,"y":8,"passable":true,"costSquares":3}],"reason":"Fly over wall, including ascent cost"}
```

## Hazard and area exposure

An exposure profile is `{mode:"surface"|"volume",targets?:{creatureId:boolean},reason?}`. Surface mode requires local surface contact. Volume mode does not exempt flying creatures. An explicit per-creature boolean overrides that contact test; a reason is mandatory when supplying target decisions. It never includes a creature outside the ordinary X/Y footprint/team filter. Overrides remain until changed: review them when the scene or creature altitude changes. They are judgments, not computed vertical ranges.

Author the profile on a spell's `persistent.exposure`, or `spell.exposure` for an area spell (including a persistent spell). Declare it in only one location. Existing persistent spells default to volume behavior. Automatic entry, turn-start, downtime exposure and inside-only modifier removal/restoration use the same profile and existing receipts/timers. Landing updates occupancy immediately and respects existing once-per-round exposure limits. Flying out of a surface-bound region removes its inside-only effects; re-entry restores only the already-qualified effect parts.

Existing automation rules support `exposure` on `tile_enter`, `zone_enter`, and `turn_start`. Tile entry defaults to surface contact; zones default to volume. A turn-start rule with no profile retains its old behavior. Landing emits surface-sensitive tile entry once; merely editing an already-grounded note does not retrigger it. Volume tile rules do not fire from a surface-only landing notification.

`gm_set_exposure` takes exactly one `areaId` or `ruleId`, an `exposure` profile, and `reason`. It updates that existing owner's exposure configuration, then reconciles regions/auras. There is no additional exposure registry, clock or effect store. Instantaneous areas can instead use an explicit GM-selected target list when their vertical shape cannot be represented; dice, saves and mitigation still use the ordinary spell payload.

## Tiny and smaller creatures

The native rules use `stats.sizeCategory` (`tiny`, `diminutive`, `fine`) with a one-cell logical token footprint. Omitted reach defaults to zero for these sizes; printed exceptional reach remains authoritative. Fractions of one square are tracked for capacity: Tiny 1/4, Diminutive 1/25, Fine 1/100. Mixed small occupants sum those fractions. They may share a larger creature's square. Ordinary same-layer larger creatures still block one another; downed living creatures remain occupants, unlike removed/dead creatures. Incorporeal traversal retains its existing special handling.

Melee attacks may target another occupant in the same square. Zero reach does not threaten adjacent squares, but permits attacks/threats in the creature's own square. Very small entry into an enemy's occupied square is checked through the existing movement/AoO continuation, including zero-reach defenders. The entrant stays in the departure square until the reaction resolves; actions and AoO allowances are not duplicated. Five-foot steps retain their nonprovoking rule. No sub-square coordinate system is introduced.

Reference: [PF1e Combat — Big and Little Creatures](https://legacy.aonprd.com/coreRuleBook/COMBAT.html). Size exceptions and unusual weapons still require their declared profile.

## Closing a scene, not resting

First resolve pending actions/decisions and complete/cancel active casting; end initiative through `gm_end_initiative`. Ending initiative alone does not clear a map. Inspect `gm_preview_scene_close` with an explicit `keep:[ids]` list. Then `gm_close_scene` uses that same list, one `placements:[{id,x,y,elevation?}]` entry per survivor, a reason, and optional new `width,height,name`. An empty keep list is valid. Validate required exports/notes in the companion system before destructive closure.

```json
{"op":"gm_preview_scene_close","keep":["hero"]}
```

```json
{"op":"gm_close_scene","keep":["hero"],"placements":[{"id":"hero","x":2,"y":2}],"width":40,"height":30,"name":"Next chamber","reason":"GM confirms the previous scene is finished"}
```

Closure clears fixed regions, terrain/elevation metadata, positional rulings, grapples, discarded creatures and their target-owned state, obsolete definitions, encounter logs/history and prior undo checkpoints. Creature definitions retained by survivors and ailment definitions required by their active afflictions remain; registered effect templates are cleared. Generic scheduled world events and continuing events with surviving owners remain. Scene-owned narrative events should be explicitly cancelled by the GM if they should not travel with the party.

Survivors retain HP, ability damage/drain, nonlethal damage, temporary HP, spent spells/ammunition, cooldowns, immediate-action debt, independent conditions/ailments/effects and their deadlines. World time and the RNG sequence do not reset. There is no healing, refresh, rest or elapsed-time inference. Debug test dice are cleared. New combat turn actions are initialized; prior combat action receipts are not campaign resources.

A removed source is detached from surviving poison/conditions rather than leaving a broken live reference. Spell provenance records the departed actor separately, so reusing an actor ID does not grant ownership of an old spell. Removed casters stop concentration through its native lifecycle; declared lingering tails on survivors keep their existing timer. Retained held touch spells preserve their remaining charges but lose the old turn's free delivery attempt and obsolete target/cache references. Summon timers use their existing owner.

The next scene starts unestablished. Placement itself does not fire aura entry effects during cleanup; establishing the scene, subsequent movement/spawn, or ordinary turn processing resumes those existing hooks. No long-term NPC box or campaign notes service is implemented here.

## Workbench and verification

Map controls expose resizing, establishing, inspection and a GM JSON editor for these commands, plus closure preview. The board displays at most a 20×16 window with X/Y offsets; this bounds browser tile rendering on large maps. The shared-square selector chooses the click target and the tile shows occupant count/elevation in its tooltip. Full map state remains available to the API.

`scene_tests.mjs` covers map atomicity, pure reads, clipping, ordinary-action geometry, stale rulings, Tiny occupancy/attacks/AoOs, traversal costs, landing/area exposure, scene cleanup, source removal, lingering concentration and held charges. `test_browser_v3_34.py` covers map/window controls, shared selection, closure/empty recovery and departed-caster inspection. See `TEST_RESULTS_V3_34.txt` for the complete run.
