# Map features and reversible elevation — V3.35

The GM interprets the map and declares geometry. The kernel enforces that declaration; it does not read an AP image, invent heights, choose routes or identify terrain from names. Existing five-foot squares, solid wall tiles and V3.34 elevation/scene commands remain supported.

## Shared ownership

`scene.features` is the only feature store. `scene.mjs` owns authoring, movement/cost and elevation hooks, cover and diagnostics. `map_geometry.mjs` contains pure segment, ray, swept-footprint and transition helpers used by defense and spell geometry. Doors are feature state. Optional object durability stays in the existing object instance; there is no second HP counter. Persistent regions keep their Pending Events and exposure receipts.

## Commands

| Command | Fields | Behavior |
|---|---|---|
| `gm_set_map_features` | `features:[feature,...]`, optional `remove:[id,...]`, `reason` | Upsert complete definitions by ID and remove explicitly named existing features, atomically |
| `gm_set_door` | `id`, `state:'open'|'closed'`, `reason` | Change an existing feature with door state |
| `gm_get_geometry` | `actor`, `target` | Pure directional view: line of effect, sight, melee/ranged cover, ruling and advisories |
| `gm_get_map` | — | Existing map view, now including normalized features |
| `gm_set_geometry` | Existing fields | Rulings now also accept `lineOfSight:boolean` and `cover` |

These commands require `gm`. Feature edits require no unresolved action/decision; read-only diagnostics remain available. Edits invalidate previous map geometry/traversal decisions and reconcile persistent area occupancy. Resize rejects clipping feature cells/endpoints. Close scene clears features along with old terrain. Undo and export/reconstruction retain ordinary state semantics. Editing a feature is not an in-character door-opening action: use the existing action command to pay any appropriate action cost, then adjudicate its state.

A feature has `id`, `preset`, exactly one of `cells:[{x,y},...]` or `points:[{x,y},...]`, and optional `name`, `note`, `properties`, `doorState`, `objectId`, `elevationTransition`. IDs use letters/digits/underscore/hyphen, start with a letter, at most 64 characters. A batch has at most 1,000 edits/removals; a scene at most 1,000 features and 100,000 authored cells/points. One region has at most 65,536 unique cells; one path 2–1,000 points.

Cells are integer grid cells. Path coordinates are grid intersections in square units, can be fractional and must lie within the map. Every segment is horizontal, vertical or a 45-degree diagonal; curves are approximated by connected segments. `N` is up/decreasing Y, `E` is right/increasing X; directions are `N, NE, E, SE, S, SW, W, NW`.

## Properties and presets

Properties override a preset. Omitted properties normalize to explicit values when saved.

| Property | Values / meaning |
|---|---|
| `movement` | `allow` or `block` |
| `sight` | `allow` or `block`; no lighting, awareness or exploration system |
| `effect` | `allow`, `block`, or `adjudicate`; the last blocks automatic passage until a ruling |
| `cover` | `none`, `partial`, `soft`, `cover`, `improved`, `total`; use effect blocking for solid barriers |
| `material` | `ordinary` or `force`; classification for incorporeal movement, not object hardness |
| `cost` | Default movement multiplier, 1–1,000; default 1 |
| `directionalCosts` | Optional map from eight-way heading to a multiplier replacing this feature's default |
| `thicknessFeet` | Optional ordinary-barrier phasing limit; omitted means a thin boundary |
| `heightFeet` | Optional annotation; does not infer clearance, flight or reach |

| Preset | Movement | Sight | Effects | Cover | Default cost |
|---|---|---|---|---|---|
| `open` | allow | allow | allow | none | 1 |
| `wall`, `door` | block | block | block | cover | 1 |
| `force_wall` | block | allow | block | cover | 1 |
| `bars` | block | allow | adjudicate | cover | 1 |
| `slit` | block | allow | adjudicate | improved | 1 |
| `debris` | allow | allow | allow | partial | 2 |
| `difficult` | allow | allow | allow | none | 2 |
| `stairs` | allow | allow | allow | none | 1 |
| `screen` | allow | block | allow | none | 1 |

These are editable starting contracts, not universal PF1e rules for all objects with those names. Bars may permit a thrust or projectile but not another effect. A pair-specific `gm_set_geometry` line-of-effect ruling handles one interaction; changing `effect:'allow'` authorizes passage for all relevant attacks/areas until changed. It does not automatically remove cover. Irregular slits, unusually low obstacles and attack-specific permission remain GM rulings. An open feature does not erase overlapping legacy terrain or another feature; edit/remove that obstruction explicitly.

A door defaults closed. Open doors have no active obstruction, cover or terrain cost. A feature may reference an existing object token using `objectId`; that token becomes a durability/targeting proxy instead of an additional occupied terrain square. Its own feature does not block attacks aimed at that proxy, but other barriers still do. Destroyed linked objects deactivate their features; a missing object conservatively leaves the feature active and warns. Put the proxy at a suitable attack location. Repair/reconstruction and consequences such as rubble use existing object/GM commands. A linked object's activation change invalidates geometry rulings and recomputes regions at command completion.

## Movement and heights

Movement checks both destination legality and the footprint swept across a feature. A large creature cannot tunnel through a boundary merely because its destination is open. Traveling along a boundary without crossing its interior is allowed. A line through a cell can make normal placement illegal; use an explicit traversal ruling for a GM-approved partial-cell position. Tiny tokens retain their one-cell logical footprint: squeezing through specific gaps remains adjudication.

Cost applies per entered region cell or crossed boundary, using the heading of that path leg. The highest applicable terrain multiplier is used; overlapping tags do not multiply penalties repeatedly. Normal alternating diagonal cost still applies. A per-creature traversal `costSquares` ruling remains an explicit final cost. Airborne (`grounded:false`) creatures ignore surface costs, but altitude alone does not bypass a movement/effect barrier. Charges reject configured hindrance. Existing forced-movement resolvers consult crossing rules. Teleport checks destination, not intervening boundaries.

**An elevation annotation alone never moves a height tag.** For automatic changes, author a straight boundary with `elevationTransition:{up:'E',riseFeet:5}`. `up` must be perpendicular to the boundary; `riseFeet` is a positive number. A grounded creature gains that height when its footprint center crosses to the upper side and loses it when crossing back. Existing height, layer, grounded flag and note are retained. A creature without an elevation tag starts from height zero. Negative elevations work normally.

The boundary belongs to its upper side, so stopping exactly on a diagonal line and then continuing/reversing cannot double-count or lose the rise. Moving along it or within a level adds nothing. Each committed physical movement step invokes the same hook, including supported forced moves. An AoO pause does not apply height early; failed/rolled-back moves and undo preserve the matching position and height. Flying over a transition and teleporting across it do not change height. For teleport/landing, declare the destination height separately. Movement cost never determines the rise.

One step may cross only one active elevation transition; overlapping/ambiguous rises are rejected. For several landings, use separate boundaries with the appropriate rise at each. Do not apply a whole staircase's rise once per occupied stair cell. Auto height changes invalidate position/elevation-stamped rulings; update exceptional traversal/geometry decisions if movement pauses. Heights stay within the existing ±100,000-foot contract.

Example: ascent east, with increased cost for all eastward headings, and automatic reverse descent:

```json
{"op":"gm_set_map_features","features":[{"id":"east_stairs","preset":"stairs","points":[{"x":4,"y":2},{"x":4,"y":5}],"properties":{"directionalCosts":{"NE":2,"E":2,"SE":2}},"elevationTransition":{"up":"E","riseFeet":5}}],"reason":"Five-foot rise to the eastern landing"}
```

A wall and a separately controlled doorway should be separate paths, so opening the door does not erase the entire wall:

```json
{"op":"gm_set_map_features","features":[{"id":"west_wall","preset":"wall","points":[{"x":4,"y":0},{"x":4,"y":2}]},{"id":"doorway","preset":"door","points":[{"x":4,"y":2},{"x":4,"y":3}],"doorState":"closed"},{"id":"east_wall","preset":"wall","points":[{"x":4,"y":3},{"x":4,"y":8}]}],"reason":"Wall with one door opening"}
```

## Combat, spell geometry and limitations

Attack line-of-effect and sight use existing footprint-cell center rays. This remains a conservative square abstraction, not exact creature silhouettes: use pair rulings for corner peeking, very narrow openings or vertical discrepancies. Cover samples cell corners, uses adjacent-melee versus ranged selection, chooses an available footprint square for larger creatures, and applies the strongest intersected configured cover. It does not infer soft cover from every creature, low-obstacle exceptions from a picture, or hidden posture. Explicit defense context/profile and geometry rulings remain available; ordinary action/resource checks still apply.

Cover feeds existing AC resolution; covered targets and total concealment prevent ordinary AoOs. Declared sight barriers produce total concealment for attacks and block sight-dependent targeted spell placement; no awareness state is introduced. Blindsight and existing concealment overrides retain their attack rules. A special sense can be declared via a line-of-sight ruling when necessary.

Reflex saves for supported spell payloads receive partial/normal/improved cover bonuses of 1/2/4, with improved-cover damage avoidance on Reflex-half effects. These are contextual, not permanent stat modifiers. Spreads do not receive cover bonuses. Burst/emanation saves use the area origin, including persistent exposures, rather than the caster's later position. Stealth, unusually low obstacles and effects outside the spell resolver remain GM adjudication.

Burst/emanation rays, cones, line stepping and spread flood paths all consult shared effect obstruction. A spread may go around a finite wall but cannot cross it. The same checks govern area dispel access. Targeted spells and creation of an area origin require line of effect; no silent placement through walls. Raw packet injection remains an explicit GM event, not a casting shortcut. Terrain edits reconcile persistent regions through existing exposure receipts, preserving once-per-round behavior.

PF1e reference consulted: https://legacy.aonprd.com/coreRulebook/combat.html (Cover, Cover and Attacks of Opportunity, Cover and Reflex Saves). The configured model does not claim complete sourcebook geometry or full 3-D physics.

The workbench offers JSON feature examples, eight-way selection, door controls, path overlays and region marks. The future AI adapter should call structured commands. Image alignment, map interpretation, climbing/falling, landing, permission to fly, unusual openings, and campaign history remain outside this calculator update.
