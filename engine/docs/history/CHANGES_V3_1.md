> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# Tabletop Kernel V3.1 — usability and movement AoO audit

Date: October 13, 2026. This updates V3, not the broader reaction/interrupt architecture.

## Findings

1. **AoO trigger**: The engine already checks the mover's **current square** before each path step and pauses before leaving it. That implements the core PF1e movement AoO rule correctly: entering a threatened square alone does not provoke, leaving a threatened square ordinarily does. A five-foot step is exempt. The reported AoO when *approaching* a Choker can nevertheless be legal because the official PF1e Choker has **10-foot natural reach**, not 5 feet. Approaching from a threatened square 10 feet away to the adjacent 5-foot square involves **leaving a threatened square**. That is what was happening, not a false AoO for entering reach. The interrupt now names both coordinates to make timing visible; cells threatened by the Choker are outlined on the board.
2. **Monster movement UI**: The V3 automatic-rules demo had hardcoded its battlefield click handling to `hero`; during a monster's turn it rejected all clicks. Now Move, 5-foot step, and Attack act on the currently active creature, following the original sandbox's interaction model. The Choker's single-tile move shortcut remains and explicitly says it costs a move action. The Choker can also select a destination up to its speed from the grid in one move action. The active unit has a highlighted label.
3. **Unclear test actions / wrong HTML file**: The spend-standard and spend-full-round fixture buttons only call `use_action`, a deliberate **resource-ledger test** with no combat effect. They are now labelled “no effect.” We include `index.html` as the current primary entry point and explicitly mark `demo.html` as a legacy V1 comparison page, making it harder to launch the wrong test harness.
4. **Fixture accuracy**: Choker's published 20-foot speed, 10-foot reach, base Strength, Dexterity, Constitution, Wisdom, attack, HP and natural armor are represented. It remains a simplified **single attack** demonstrator, not a complete Choker implementation: two attacks/full attack, grab, constrict, climbing and strangle are not modeled.

Sources: [Pathfinder 1e Choker, Bestiary](https://pathfinder.d20srd.org/bestiary/choker.html), [AoN Attacks of Opportunity, Core Rulebook p. 180](https://www.aonprd.com/Rules.aspx?ID=102).

## Expected manual test

Open `index.html` or `automation-demo.html`, choose Choker, and activate the encounter.

- Explorer begins at (3,4), Choker at (7,3). Moving Explorer to (5,4) **enters** the 10-foot threatened area and **does not** provoke an AoO. A subsequent normal move to (6,4) **leaves** (5,4), so it pauses BEFORE movement and offers the Choker an AoO. Declining allows the Explorer to complete the move. A five-foot step is immune, provided Explorer did not already move that turn.
- Reset/activate; end Explorer's turn. Choker gets **standard 1 / move 2 / swift 1**. The test move button, or clicking free squares with the Move tool, works for Choker. The first two moves use move resources; the third spends the standard as a move; the fourth fails. A legal standard Attack against Explorer is also available if Choker gets within reach with a move.
- The “Test: spend Choker standard (no effect)” button is an action **ledger** test, not an attack. The “Test: spend Choker full-round (no effect)” button likewise records a full-round spend; the remaining bonus move can still be used.

## Validation

The initial V3 suites are unchanged and pass: `tests.mjs` (16), `vocabulary_probe_tests.mjs` (8), `automation_tests.mjs` (17), and `action_economy_tests.mjs` (21); additionally the baseline has a post-summary atomic/role-gating assertion. `aoo_ui_regression_tests.mjs` adds 7 tests for 5-foot and 10-foot reach, entering versus exiting, timing of interrupts, five-foot steps, published Choker movement speed, and real Choker attack after movement. Chromium browser checks verify monster-turn movement, attack, a fourth move rejection, pause coordinates, 5-foot step nonprovocation, and no JavaScript exceptions.

## Remaining limitations

The movement scheduler still offers at most one opportunity per reactor for each move action, pauses in its specialized AoO handler, and does not implement a general nested interruption stack; it is not a PF1e-complete event resolver. No actual full attacks, readied actions, immediate actions, full combat maneuver resolution, or creature-specific grab/constrict are supported yet. The interface is a manual/GM testing harness; it does not autonomously choose monster actions.
