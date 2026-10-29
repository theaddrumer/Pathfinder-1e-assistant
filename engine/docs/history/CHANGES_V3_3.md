> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# V3.3 — Real full-attack actions (October 13, 2026)

## Scope

This phase adds a functioning, restricted gameplay `full_attack` operation to V3.2's deterministic action economy. It is a **partial PF1e implementation** rather than a completed combat scheduler. The current offline test page is `index.html` / `automation-demo.html`; `demo.html` is the historical V1 sandbox.

## Engine

- `full_attack`: validates an opposing target in reach, spends a full-round action (1 standard + 1 move resource), resolves the first strike and saves the remaining strike slots as `pendingFullAttack` in game state.
- `full_attack_next`: resolves exactly one remaining strike against a freshly selected target. Targets can change between strikes and hit/miss outcomes are visible before choosing another. The sequence automatically closes after its last strike.
- `finish_full_attack`: explicitly forfeits pending strikes so the active creature may use any remaining legal actions.
- Ordinary movement and attacks are blocked during a pending full attack; one five-foot step can be taken before, during, or after the sequence, provided no other actual movement was taken during the turn. AoO interrupts during later separately granted movement continue to use the existing state-machine implementation.
- `attackRoutine(id)` generates a limited manufactured-weapon iterative sequence from BAB (+BAB/+BAB-5/...); a creature may instead supply explicit `attacks` slots with a name and numerical modifiers for natural weapon attacks or other routines. The kernel has no Choker-specific conditional.
- All new gameplay commands are allowed for an ordinary actor but remain subject to turn authorization and action resources; failed commands roll back atomically with the RNG.
- Choker fixture now supplies the **official two primary tentacles at +6/+6 (1d4+3 each)**, plus its prior 10-ft reach, 20-ft speed and declarative Quickness (+1 move action). A standard attack still makes only one attack. Grab, constrict and strangle are not simulated.

## Test in the offline browser

Select **Choker — Quickness**, activate, and use Explorer's Move tool to approach within 10 feet (square 5,4 is an easy target). End Explorer's turn. Select **Full attack (full-round)** and click Explorer: the first tentacle attack resolves, leaving one strike queued. Either click Explorer again, choose a different legal target, or select a five-foot step and return to Full attack for the second strike. **Finish full attack** can forgo the second strike.

If Choker has not taken a five-foot step, its remaining Quickness-granted move action can be used to move after the full attack; this may provoke an Explorer AoO as usual. Taking a five-foot step prevents other movement during the turn regardless of leftover action resources.

## Verification

- `tests.mjs` 16 tests
- `vocabulary_probe_tests.mjs` 8 tests
- `automation_tests.mjs` 17 tests
- `action_economy_tests.mjs` 21 tests
- `aoo_ui_regression_tests.mjs` 7 tests
- `choker_movement_regression_tests.mjs` 3 tests
- `full_attack_tests.mjs` 15 new tests
- **87 named Node tests passing**, plus the separate authorization assertion from the V3 baseline.
- `test_browser_v3_3.py`: headless Chromium successful for both Choker strikes, a five-foot step between attacks, movement after full attack, and no JavaScript errors.

## Intentionally incomplete

- Critical-hit confirmations, iterative off-hand penalties, multi-weapon style effects, attack-roll choice modifiers, exact natural/manufactured mixed routines, combat maneuver replacements and grab/constrict.
- Core Rulebook option to decide **after the first strike** to stop a full attack and instead take a move action as an ordinary attack action, subject to its eligibility restrictions. `finish_full_attack` currently simply forgoes the remaining strikes and does **not** refund action resources.
- Readied/immediate actions, true nested interrupts at hit or pre-damage boundaries, dying/attacker incapacitation during attack chains, off-turn full attacks, and general action scheduling. These remain priorities for subsequent engine work.

Published PF1e references:
- https://legacy.aonprd.com/coreRuleBook/COMBAT.html (Full Attack, five-foot step)
- https://legacy.aonprd.com/bestiary/choker.html (statblock and Quickness)
