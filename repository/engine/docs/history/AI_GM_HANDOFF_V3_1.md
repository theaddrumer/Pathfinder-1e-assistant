> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# AI GM / Tabletop Kernel — V3.1 handoff (October 13, 2026)

The user's V3 feedback: the Choker movement AoO looked incorrect, there was no obvious way to move the Choker from the grid, and the “extra standard”/standard-spend button had no gameplay effect. The Choker case uncovered a real UI regression, not a wrong AoO predicate. In PF1e the Choker has 10-foot natural reach (not 5 feet), so a movement from 10 feet away to 5 feet away leaves a threatened square and can provoke; entering the outermost square does not.

## V3.1 deliverable
`tabletop_kernel_v3_1_choker_ui.zip` contains the full working project, `index.html` (preferred offline entrypoint), `automation-demo.html`, legacy-labeled `demo.html`, original engine/automation source/tests, and new `aoo_ui_regression_tests.mjs`, `CHANGES_V3_1.md`, `TEST_RESULTS_V3_1.txt`.

The automatic-rule UI now exposes Move, 5-foot step and Attack controls working for whichever creature is active. The Choker has 2 move resources plus 1 standard on its turns (generic Quickness grant). Movement speed corrected to 20 ft, reach remains 10 ft, and the simplified stat baseline aligns with the Bestiary. Choker movement can now be tested on the grid as well as via a one-square convenience button. Action-ledger buttons labeled “no effect” deliberately do not represent combat actions. Threatened Choker squares are outlined and AoO interrupts identify the departure square and intended next square. The underlying AoO trigger was not modified, because it already checked the starting square and skipped 5-foot steps correctly.

All 69 named Node tests pass (16+8+17+21+7), plus the baseline atomic/role-gating assertion, and the targeted browser smoke tests pass with no JavaScript exceptions.

## Project goal and design
Create an autonomous PF1e GM where deterministic kernel tracks mechanical state, interpreted official/3PP/homebrew rule data supplies declarative automatic effects, and later an LLM GM decides narrative and optional choices. Preserve extender-based rules and action grants, GM override vs actor commands, undo, configurable source packs including ABP, Elephant in the Room, Skill Champions, and 3PP. User is highly fluent in PF1e but not programming; explain software behavior in mechanical terms. Do not prioritize UI polish ahead of mechanics.

## Next development
Build the resumable/nested interrupt transaction scheduler: mid-damage optional interrupts, AoOs combined with secondary reactions, readied/immediate action resource/timing. Keep all V3/V3.1 regression tests green. If investigating perceived rule faults, cross-check actual official creature statblock; Choker specifically has 10-foot natural reach and extra move, whereas 3.5 Quickness differs. Avoid assuming all approach AoOs are invalid: triggering on leaving a threatened square is key.
