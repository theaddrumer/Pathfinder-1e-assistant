> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# V3.22 Magic Foundations

- Added `spell_geometry.mjs`: 2D square-grid intersection-based spherical bursts/emanations/spreads, directional cones and lines; opaque wall blocking, around-corner spreads, 5/10/5 diagonal ranges, multi-square creature overlap, preview cells.
- Added `magic.mjs`: optional action-costed spell casting; defensive casting concentration; GM-controlled provoking spell checkpoint and resume; save/SR resolution, shared spell damage/healing roll, typed packets and duration effects.
- Reuses the V3.20 initiative-count event scheduler for spell modifier expiration and V3.17 clock after encounter transitions.
- Added Magic & Area Geometry panel and map overlay to offline workbench. Runtime creature registration accepts `spellResistance`, `casterLevel` and `concentrationBonus` fields.
- Added `magic_tests.mjs` and `test_browser_v3_22.py`. Previous command names preserved.
- Scope is intentionally narrow; see `MAGIC_AND_AREA_GEOMETRY_V3_22.md` for limitations and upcoming magic work.
