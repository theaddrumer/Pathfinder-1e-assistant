> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# AI GM / Tabletop Kernel — V3.6.1 handoff (October 13, 2026)

## Project purpose

Develop a deterministic, extensible PF1e mechanics kernel controlled by an interpreting AI GM. The AI eventually accepts an uploaded Adventure Path, reads content, imports creature numbers and special-rule definitions as data, decides NPC tactics and narrative, and uses the kernel as the authoritative ledger/calculator. Don't hardcode NPC tactics or story paths. Game-rule flexibility matters more than interface polish. The user knows PF1e but not programming and expects practical explanations. AI-specific commands and optional interrupts are later milestones.

## Files

Main archive: `tabletop_kernel_v3_6_1_ability_loss.zip`. Primary demo `index.html`, historical test fixtures `tests.html`. Source `.mjs` and JSON-based GM workbench UI in `automation-demo-template.html` / `automation-demo-ui.js`. `python build_demos.py` rebuilds offline pages. V3.6 conditions catalog (34 entries) and generic ailment engine retained.

## Changes this version

- Independent accumulated ability **damage** pool (existing, now GM-controllable), **drain** pool (new), and temporary typed modifiers (existing, shown separately).
- Core PF1e rules respected: damage -1 relevant stats per 2 points, no score reduction; drain lowers actual score and recalculates declared dependencies; temporary ability penalties cannot alone reduce ability score below 1.
- GM-only commands `apply_ability_damage`, `heal_ability_damage`, `apply_ability_drain`, and `restore_ability_drain`. `inspect` exposes ability-score breakdown. Both kinds of injury persist after their ailment ends.
- The ailment definition schema now supports `ability_drain` in `effects`, independently of `ability_damage`; attack rider integration is still intentionally deferred.
- Creature definitions support optional `hitDiceCount`; when registered, Con score changes and damage adjust current/max HP, reversible and separate from actual wounds. If HD missing, GM advisory instead of guessing. More complex death and HP exceptions are not fully modeled.
- Workbench includes new ability injury/restoration controls and per-creature breakdown, with fictional Marsh Raider having a defined HD count for testing.

## Verification

13 dedicated ability-loss tests, all previous 168 named tests = 181 passing. Seven Chromium scripts pass (6 previous + new V3.6.1 UI). See `CHANGES_V3_6_1.md` for test details and limitations.

## Deferred

Not a complete PF1e rule engine. Condition catalog remains largely partial/advisory; current HP logic doesn't model negative HP/dying fully. Existing type stacking exceptions incomplete, and ailment dose stacking / natural ability damage daily healing not automated. Full rider-on-hit support, interrupt scheduler, LLM interface, AoN ingestion, and Adventure Path memory are future stages. Do not interpret data injection as complete rules coverage.

## Next possible milestone

After user testing, review affliction and condition interactions, including saving throw immunity/resistance, bleed termination, damage tracking at 0, then implement reusable rider-effect hooks once the underlying condition/ailment model is stable. The guiding goal is *general* mechanical commands and definitions, not a tactical second AI.
