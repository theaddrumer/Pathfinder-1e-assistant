> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# V3.16.1 — Wall Occlusion and Controller-Specified Movement

- Solid wall and force-barrier tiles now block ordinary direct attacks and attack-of-opportunity threat checks. The barrier check is performed using rays between occupied square centers, including creatures occupying more than one square. This is intentionally a conservative **total barrier** check, NOT automatic partial cover or full PF1 corner-derived cover.
- Incorporeal creatures can traverse thin ordinary walls and pass through occupied corporeal creature squares, but not force barriers. Thick wall masses require GM adjudication. This models the PF1 rule that incorporeals must remain near an object's exterior rather than walk through arbitrarily large solids.
- An incorporeal creature inside a thin wall may make attacks into exterior squares within its reach, with the wall's inherent 50% concealment miss chance. Reach alone does not bypass separate intervening walls. Special attacks that ignore solid walls can use **GM-only** `defenseContext.ignoreWalls: true`.
- Movement command `move` already accepted each entered square in order; the browser now exposes manual path input for regular, double, standard-action, five-foot, and GM-free movement, rather than forcing the shortest-path clickable helper. This does **not** select creature tactics.
- Added `gm_set_tile` for controlled changes to the small encounter grid: `open`, `wall`, `force_wall`, `difficult`, `hazard`.
- Wall and force barrier tile styles are visible in the browser workbench.

## Limits

The example grid is a coarse 5-foot tile model, not continuous terrain geometry. Closed-edge obstruction rays conservatively block attacks grazing wall corners; the AI GM can explicitly override exceptional terrain. Thick-object phasing rules and attacking a ghost while it exposes itself through the wall require more advanced timing/geometry. Charge still imposes its own straight unobstructed attack lane. Cover bonuses for partial walls, firing slits, and elevated objects are GM supplied as in V3.16. The AI, not the calculator, chooses paths, adversary tactics, and exceptions. Fast Forward remains next in the project plan.

## Test coverage

`wall_geometry_tests.mjs` specifically verifies ordinary blocked attacks and AoOs, explicit GM bypass permissions, thin-wall phasing, force barriers, thick solids, wall concealment, and tile changes. `test_browser_v3_16_1.py` verifies the actual browser workbench path and terrain controls. Prior V3.16 tests remain in the archive.
