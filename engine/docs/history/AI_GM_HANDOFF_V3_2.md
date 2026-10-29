> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# AI GM / Tabletop Kernel — V3.2 handoff (October 13, 2026)

## Goal
Build an autonomous PF1e GM: deterministic generic game-state kernel, declarative automatic rules/interrupt subscriptions, eventually GPT interpreter/GM. Use configurable source packs, GM overrides, action-resource budgets with extensions (Choker Quickness) and preserve tests. UI currently serves as an offline test harness.

## Current full project
`tabletop_kernel_v3_2_choker_interrupt_ui.zip` contains full source, tests, build scripts and offline `index.html`/`automation-demo.html`. `demo.html` is the older V1 sandbox, not the current demonstration. Separate single-file offline demonstration: `tabletop_kernel_v3_2_demo.html`.

## V3.2 reported behavior and fix
User reported Choker could AoO/attack/5-foot-step but appeared unable to move after Explorer reached/attacked it; wondered whether Explorer lacked AoOs. Reproduced two distinct cases in code and Chromium:

1. **Move from adjacency:** Explorer DOES have AoOs. When Choker leaves an Explorer-threatened square, engine pauses before moving, records a pending interrupt and deducts a move action. The AoO accept/decline controls in V3.1 were below the battlefield, making movement look broken. Taking or declining AoO resumes the Choker's movement; its Quickness move remains usable. V3.2 places a clearly marked interrupt box **above the battlefield** with action text naming reactor/mover and status explanation.
2. **Five-foot step first:** By PF1e rules no other movement can be taken in the same turn after a five-foot step, even if Choker Quickness grants more move-action resources. This is intentionally enforced. V3.2 explains it in status text, ledger, and on attempted extra movement; move resources are not consumed by illegal attempts.

Choker retains PF1e 10-ft reach, 20-ft speed, and +1 move action each turn. Explorer reaches only 5 ft. Prior V3.1 fix restored active-creature movement and attack UI. No core mechanics modified in V3.2.

## Tests
70 existing named Node tests plus 3 new `choker_movement_regression_tests.mjs` cases pass. Headless Chromium showed Choker successfully moving after Explorer attacks, paused for Explorer AoO and able to move a second time; also confirmed correct five-foot-step lockout, no JS exceptions. Refer to `CHANGES_V3_2.md` for details.

## Next phase
Implement resumable/nested interrupt transaction scheduling (AoO/reactive abilities, ready and immediate reactions, pre-damage interventions), not hard-coded per monster. Preserve current regression tests and respect the user's high PF1e rules fluency. Avoid substantial UI polish before mechanics unless UI hides actual behavior (as happened here).
