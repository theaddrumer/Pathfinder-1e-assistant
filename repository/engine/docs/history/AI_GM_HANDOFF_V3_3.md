> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# AI GM / Tabletop Kernel — V3.3 handoff (October 13, 2026)

## Goal
Build a flexible autonomous Pathfinder 1e GM around a stable deterministic state engine, registered declarative rules/automatic mandatory effects, optional interrupt scheduling, extensible source packs and a future GPT-based rules interpreter. UI is a low-priority offline test harness.

## Latest archive and entrypoint
`tabletop_kernel_v3_3_full_attack.zip` contains all source files, documentation, standalone browser UI (`index.html` or `automation-demo.html`), and regression tests. `tabletop_kernel_v3_3_demo.html` is the same current standalone UI distributed separately. `demo.html` remains the legacy V1 interface. `CHANGES_V3_3.md` details the newest milestone. All existing V3.2 fixes retained.

## V3.3 implementation
The user asked whether it was time to add full-round actions such as full attacks, having verified the Choker's 10-foot reach and ability to make an ordinary one-attack standard action. Implemented a true `full_attack` / `full_attack_next` / `finish_full_attack` sequence in core and UI. Each attack is resolved with an individual target choice and logs. A five-foot step can be taken before or between strikes. Full attack consumes standard + one move; Choker's bonus Quickness move action remains available afterward if no step was taken and it was not previously spent. Natural attack routines are configured in creature data; Choker uses two tentacles +6/+6, 1d4+3 each. BAB-based default sequences implement basic manufactured-weapon iteratives. Rollbacks and authorization preserved.

V3.2 AoO UI continues to show reactions above battlefield; Explorer and Choker both use active-creature movement. Quickness auto-grants 1 move per turn, and a five-foot step blocks additional movement. Choker has PF1e speed 20 ft and reach 10 ft. Entering reach does not provoke; leaving a threatened square does.

## Tests
**87 named Node tests passing** across `tests.mjs`, `vocabulary_probe_tests.mjs`, `automation_tests.mjs`, `action_economy_tests.mjs`, `aoo_ui_regression_tests.mjs`, `choker_movement_regression_tests.mjs`, and the new `full_attack_tests.mjs` (15 tests). Headless Chromium `test_browser_v3_3.py` also passes interleaved 5-ft-step and Quickness movement after full attack. See `CHANGES_V3_3.md`.

## Limitations and next step
This is not yet full PF1e combat: no Grab/Constrict, critical confirmations, off-hand penalty modeling or full natural/manufactured mixed routines. `finish_full_attack` *forgoes* remaining attacks; the Core Rulebook's after-first-strike switch to a move action (and action resource refund) is not implemented. Crucially, generic nested interruptions, readied and immediate actions are still incomplete. Prefer progressing toward resumable/nested interrupt transactions and broader combat actions before UI polish or importing every feat. Do not misrepresent the current narrow scheduler as complete.

## User style/preferences
User knows PF1e very well but is not a programmer. Explain the practical rule effect, not implementation minutiae. Do not assume PCs and monsters need symmetric abilities; model Choker Quickness as a general extra-move grant rather than hard-coded monster logic. Preserve the tests and downloadable complete ZIP and handoff with each significant milestone.
