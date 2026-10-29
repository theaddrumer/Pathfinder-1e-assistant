> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# AI GM / Tabletop Kernel — V3.18 Handoff

## Mission and architecture

Deterministic Pathfinder 1e mechanics calculator subordinate to an independent interpreting AI GM. No tactical AI, trigger-language understanding, or autonomous narrative choice. Printed creature totals and attack sequences remain authoritative. Work from `tabletop_kernel_v3_18/` as the latest source and read `ATTACK_COMPLETION_V3_18.md` for new commands and mechanics. Prior handoff `AI_GM_HANDOFF_V3_17.md` describes the game clock/event queue; historical handoffs remain included.

## Latest integration

`AttackCompletionGame extends TimeGame` (`attack_completion.mjs`), instantiated by `scenarios.mjs`. `attack_completion_rules.mjs` supplies range and weapon-size validation and progression. `automation.mjs` calls subclass hooks for range, attack abilities, damage dice, nonlethal intent; `core.mjs` full-attack reach validation now allows declared ranged slots; `condition_ailment_game.mjs` differentiates prone ranged and melee AC; imported attack fields registered in `registry.mjs` and `attack_library.mjs`. `build_demos.py` includes `ATTACK_COMPLETION_RULES` before `ATTACK_LIBRARY` and `ATTACK_COMPLETION` after `TIME_ENGINE` but before scenarios.

Implemented: physical nonlethal tracking, staggered/unconscious action restrictions, healing and GM overrides, standard dice size scaling, ranged projectile/thrown/ray execution with range increments, shooting-into-melee modifier, Precise Shot flag, ranged full-attack slots, ranged-touch AC, and wall/visibility integration. The available importable sample includes one bow, scaled club, and nonlethal club. Import `damageSizeSteps` only when size scaling is needed, not for already-scaled printed damage dice.

## Regression

Run `node attack_completion_tests.mjs`, `python test_browser_v3_18.py`, then all `*tests.mjs` and recent browser suites. `python build_demos.py` must run after any source/UI change. Chromium test scripts use `/usr/bin/chromium`.

## Remaining roadmap

The **older Attack Completion roadmap** is *partially* complete. More work remains on full two-weapon/primary-secondary natural attack logic when source data is not explicit, ranged ammunition/reload/AoO behavior, and broader nonlethal interactions. Do not invent imported BAB-iteratives or tactics; prefer exact printed creature entries.

The newer **Pending Events** registry/readied-action bookkeeping remains on the docket. V3.17 `TimeGame` already supports clock-based scheduled GM events and Fast Forward but not turn/encounter scoped arbitrary pending trigger declarations. Put Pending Events with clock and Fast Forward in the same control group when implemented. The user also wants a future substantial map overhaul supporting walls along grid boundaries, partial-square walls/cover and squeezing; do not conflate that with tactical pathfinding. A generalized nested interrupt scheduler, rest/downtime, unusual defensive rules and sophisticated ranged feats remain separate.

## Key limitations

Nonlethal override is for physical attacks; regeneration and typed packets need separate follow-through. Ray spell targeting, range, saving throws and SR beyond attack-to-AC remain GM controlled. Ammo and precise soft-cover geometry are not automated. Range distance uses the existing coarse 5-ft tile geometry until map redesign. AI GM chooses all tactical options and supplies special rulings through Free Mode.
