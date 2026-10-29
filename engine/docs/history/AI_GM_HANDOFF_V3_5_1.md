> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# AI GM / Tabletop Kernel — V3.5.1 handoff (October 13, 2026)

## Purpose and architectural boundary

User is building a flexible PF1e AI GM eventually able to load an Adventure Path and player character data, then GM the adventure. AI interprets rules, reads source documents, adjudicates exceptions, controls creatures and story. The deterministic engine is a mechanical memory/referee, not an NPC tactician. AI supplies imported authoritative creature totals and reuseable declarative effects; engine validates actions, modifiers, turn resources, and automatic triggers. User is a PF1e expert but is not a programmer. Keep practical explanation and expose legitimate GM overrides, especially in geometry and circumstances.

The *full* working V3.5.1 source plus test suite and HTML workbench is in `tabletop_kernel_v3_5_1_named_actions.zip`; open `index.html` (offline). Historical encounters remain in `tests.html` rather than the main interface.

## New in V3.5.1

Player/AI-facing named commands:
- `{"op":"move","actor":"hero","path":[...],"asStandard":true}` explicitly exchanges a standard action for ordinary movement. Existing `move` still uses a move first and the standard when no move remains.
- `{"op":"double_move","actor":"hero","path":[...]}` consumes two move-equivalent resources and permits a path up to 2x speed. AoO pauses are preserved.
- `{"op":"charge","actor":"hero","target":"enemy"}` is an ordinary **full-round** charge, moves to the closest attacking position reachable on the engine's current straight-grid geometry, attacks **once** at +2, and imposes **-2 to all AC variants until the start of the charger's next turn**. This persists on opponents' turns, then expires at the exact charger turn-start boundary. Movement resumes through AoOs and only attacks after arrival. No manual toggle of attack/AC modifiers required.

The UI exposes `Move (standard action)`, `Double move`, and `Charge`, with Charge activated by clicking an enemy. The original movement-cost arithmetic contained a diagonal/straight mix bug; this is fixed. Source `core.mjs`, `automation.mjs`, `automation-demo-ui.js` and offline browser builds updated. `CHANGES_V3_5_1.md` has example JSON and explicit limitations.

## Tests

`node charge_and_double_move_tests.mjs` runs 22 new deterministic tests. The original 9 Node files still pass; **137 named Node tests total**. Five Chromium scripts (`test_browser_v3_2.py` ... `test_browser_v3_5_1.py`) pass. `python build_demos.py` recreates self-contained HTML from tested `.mjs` and JS sources.

## Known limits and next step

Charge path is a bounded square-grid *approximation*: straight Bresenham centerline with conservative corner blocking and simple visibility, not all PF1e corner/line-of-sight cases. It rejects obstructed and difficult terrain, requires at least 10ft, and charges to nearest attack location. This version does not model restricted-standard-action charge, pounce, special charge feats, bull rush/overrun, mounted charge, concealment/cover, or exact 3D terrain. GM overrides are necessary for unusual charge interactions. The current AoO system is not a general nested interrupt scheduler. Even standard conditions are not complete; next proposed major version remains **Standard Conditions Library / contextual advisories**, after these named-action tests.

## Important user decision

User asked whether the eventual AI wants action toggles or manually entering charge modifiers. Best division: AI issues a **single named command**; a human UI may expose a selected mode/button; engine applies, times and removes the modifiers. Manual GM injections stay for improvisation, not ordinary charge or double-move rules. Don't turn AI GM into character-specific tactical automation.
