> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# AI GM / Tabletop Kernel — V3 handoff (October 12, 2026)

## Goal
Autonomous, flexible Pathfinder 1e GM: deterministic state engine handles mechanical state, automatic rules subscriptions handle mandatory effects, later an LLM interprets/compiles external rules and handles narrative/choices. Do not hard-code each named creature, spell or monster. Campaign house rules, 3PP source packs, undo permissions and player/AI control are future requirements.

## Deliverable
`tabletop_kernel_v3_action_economy.zip` contains complete runnable source, test files, and offline standalone `automation-demo.html` and `demo.html`. The best overview is `README.md`; exact changes and unsupported mechanics are in `ACTION_ECONOMY_V3.md`. Original V2 technical docs remain present.

## V3 change
Normal actions now consume resource counts `{standard:1,move:1,swift:1}`. Moving can spend a move or exchange a standard; a full-round activity consumes a standard and a move. Five-foot steps are separately tracked against *actual movement* rather than against any move-equivalent action. A generic `use_action` spends resources without pretending to implement that action's effects.

Automatic rule data may now issue `grant_action`, validated and bounded, on the active creature's turn. `chokerQuickness` in `scenarios.mjs` uses an ordinary `turn_start` subscription, giving one extra **move** action (PF1e, unlike 3.5). Choker can therefore move three times by trading its standard, or take a full-round action plus one additional move. The browser demo has a Choker fixture to show this.

The `dispatch` boundary has roles `actor` (default, active creature gameplay only), `player` (Explorer only in current fixture), and `gm` (explicit administrative effects and overrides). All regular gameplay commands use resources even with GM privileges. `admin_damage`, `admin_attack`, `admin_grant_action`, undo, effects, teleports and saves are privileged. V2's `deal_damage` is preserved as a GM-only legacy alias; browser direct-effect buttons now say GM.

## Validation
**62 named automated tests pass:** `node tests.mjs` (16), `node vocabulary_probe_tests.mjs` (8), `node automation_tests.mjs` (17), `node action_economy_tests.mjs` (21); additionally there is a post-summary atomic/role-gating assertion group in the baseline suite. In Chromium browser checks, Choker moves 3 times (fourth is rejected), takes a full-round plus one move, and the Black Pudding/Archon original fixtures run without exceptions. `TEST_RESULTS_V3.txt` contains console output. The HTML is built from source by `python build_demos.py`, but runs standalone in a browser.

## Remaining gaps and next step
**Next major milestone: resumable/nested interrupt scheduler.** Current AoOs can interrupt movement; generic `offer_interrupt` remains restricted to `turn_start` and test `ping`. A `damage_before` optional response cannot yet suspend and resume an attack/damage transaction. Before implementing more named abilities, design a bounded, atomic *reaction stack* with event stages, multiple choices/priority, ownership, and explicit rollback/RNG behavior. Then test movement AoOs, readied/immediate actions, and mid-damage prevention while preserving aura/Split/Vienna regression tests.

Still incomplete: true spellcasting, actual full attacks, immediate next-turn swift debts, readied/delayed/contingent timing, all PF1e move exceptions, source ingestion, LLM controls, multiplayer identity/auth, complete 3D geometry, and full condition/modifier stacking. `use_action` is action accounting only, not permission to invent arbitrary mechanical effects. GM overrides are for administrative adjudication, not ordinary tactical AI choices. The current module classes expose direct methods in the same process; a future server/API must encapsulate them to enforce role separation against untrusted callers.

## Re-entry instruction
"Continue the AI GM/Tabletop Kernel project from the attached V3 zip and V3 handoff. Keep all existing tests green. Design/implement the next resumable interrupt/event transaction scheduler, beginning with a mid-damage optional interrupt and a nested AoO example. Preserve data-driven automation and bounded action grants; do not treat direct GM override effects as free creature actions."
