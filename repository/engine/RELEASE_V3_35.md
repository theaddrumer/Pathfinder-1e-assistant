# V3.35 — Map features, walls and reversible elevation

V3.35 adds one scene-owned feature model for cell regions and eight-direction boundary paths. Presets configure independent movement, sight, effect passage, cover and directional costs. Doors have explicit open/closed states; optional linked object tokens retain native HP/hardness ownership. Legacy solid tiles and V3.34 scene/elevation commands remain supported.

Movement, charge checks, supported forced-movement paths, attacks, AoOs, spell shapes and persistent-region interaction now consult shared feature geometry. Explicit cover supplies existing AC and contextual Reflex behavior. Bars/slits require passage rulings rather than assuming that visibility permits every attack or effect. The engine remains a calculator for declared mechanics, not an AP interpreter or tactical AI.

An optional `elevationTransition:{up,riseFeet}` on a straight boundary updates grounded creature elevation when physical movement crosses it. Uphill adds the declared rise; reverse crossing subtracts it. Footprint-center crossing avoids repeated changes while moving along the same level. Flying, teleport and annotation-only terrain do not infer height changes. The movement hook applies after the position commits, including continuation after an AoO, and participates in normal rollback/undo.

New public GM operations are `gm_set_map_features`, `gm_set_door`, and pure `gm_get_geometry`; `gm_set_geometry` also supports sight and cover declarations. The workbench includes feature examples, eight-way selection, door controls, path overlays and region labels. See MAP_FEATURES_V3_35.md for schema, examples and limits. README, architecture, command reference and AI handoff are updated.

Validation: **81/81 suites passed — 43 Node suites and 38 browser suites.** New coverage includes 26 map/elevation integration groups and four browser scenarios. This includes bidirectional and negative heights, all eight orientations, interrupted movement, forced movement, airborne behavior, malformed/ambiguous transitions, door/area recomputation, cover, persistence, undo and cleanup. Standalone HTML was rebuilt and the new controls/map overlays visually inspected. TEST_RESULTS_V3_35.txt contains the full report.

No complete 3-D simulation, automatic image import, climbing/falling subsystem or AI adapter is included. Partial-cell placement, narrow openings, low-obstacle exceptions and unusual vertical interactions retain explicit GM rulings. Daily spell allotments and existing time/event owners are unchanged.
