> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# V3.2 — Choker movement interrupt visibility and five-foot-step messaging

## Reproduced report

With Explorer approaching to `(6,4)`, resolving Choker's AoO, and attacking from adjacency, the Choker can spend a move action on its next turn to leave `(7,3)` for `(8,3)`. The kernel correctly pauses **before moving the Choker**, because **Explorer** can make an AoO. After Explorer takes or declines, Choker finishes that movement and can expend its remaining bonus move action. The underlying `continueMove()` and `resolveInterrupt()` code already supported this; there was no missing Explorer AoO implementation.

Separately, if the Choker first takes a five-foot step on its turn, moving again is disallowed, even though Quickness has granted additional move actions. This is correct Pathfinder 1e action-economy behavior. The previous interface displayed unused move-action resources but did not sufficiently explain they could no longer be spent on movement.

## Changes

- Moved the existing Take opportunity / Decline buttons into a conspicuous AoO panel immediately above the battlefield, rather than below the test-action section.
- On movement interruption, the status line names both the mover and the reacting creature, says the mover is still in its departure square, and points to the AoO controls.
- The battlefield caption also identifies when an AoO is pending.
- After a five-foot step, the status, action ledger, and battlefield caption explicitly say that further movement is prohibited for the turn despite remaining move actions; attempting it provides a specific error.
- Added three engine-level regression cases for the reported sequence (Explorer can take or decline AoO), and the five-foot-step prohibition.

No changes to kernel AoO geometry, action-resource accounting, or registered Quickness rules.

## Validation

- Existing named Node tests: 70 passing across `tests.mjs`, `vocabulary_probe_tests.mjs`, `automation_tests.mjs`, `action_economy_tests.mjs`, `aoo_ui_regression_tests.mjs`.
- New reported-sequence tests: 3 passing in `choker_movement_regression_tests.mjs`.
- Headless Chromium (local standalone HTML): Explorer approaches / Choker AoO pause / Explorer attacks / Choker moves / Explorer AoO prompt / decline / Choker completes and moves again; all passed.
- Headless Chromium: Choker five-foot step followed by attempted move produces correct explanation and no second movement; passed.
- Zero browser JavaScript errors in those runs.

## Limitations

The movement interrupt mechanism remains narrow (AoO only). No nested-interrupt scheduling or full PF1e special combat abilities have been implemented here. There is still no autonomous monster decision-maker in this test harness.
