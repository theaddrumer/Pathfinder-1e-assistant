> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# V3.17 — Game Clock and Fast Forward

- Added reusable `TimeGame extends DefenseGame` in `time_engine.mjs`; existing encounters now instantiate it.
- Added a visible, GM-settable in-world day and clock, independent of combat rounds and actions.
- Added `gm_advance_to_event` and chronological `gm_advance_time`; no iterative combat-round simulation.
- Integrated timed conditions/effects, automation marks, ailment frequencies, 24-hour temporary negative-level saves, and one-hour energy-drain temporary HP expiry.
- Added GM-authored scheduled event checkpoints, acknowledgement and cancellation. Character activities are never selected by the calculator.
- Added clock controls, scheduling, acknowledgement, next-event Fast Forward, time-event details to offline workbench.
- Added `time_engine_tests.mjs` and `test_browser_v3_17.py`; retained historical suites.
- Preserved V3.16.1 wall movement and defensive behavior unchanged.
