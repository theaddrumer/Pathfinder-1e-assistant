> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# AI GM / Tabletop Kernel — V3.16 handoff (October 15, 2026)

## Project goal and architecture

The game engine is a deterministic, reusable PF1e state/referee calculator underneath an independent creative AI GM. It does not decide character actions or GM adjudications. Preserve imported published stat totals rather than inferring their underlying items, feat selections, skills or bonuses. GM uses validated commands and Free Mode to override exceptional scenarios. Offline JS engine and interactive HTML demo remain independent of networking or an AI API.

## Current authoritative source

`tabletop_kernel_v3_16/`. New `defense.mjs` extends `FinalOffenseGame`; `scenarios.mjs` now instantiates `DefenseGame`; `build_demos.py` bundles `/*__DEFENSE__*/` AFTER `/*__FINAL_OFFENSE__*/` and BEFORE `/*__SCENARIOS__*/`. Main primary workbench `index.html`, historical fixtures `tests.html`, fully standalone `tabletop_kernel_v3_16_demo.html` outside project directory. Preserve `defense_tests.mjs` and `test_browser_v3_16.py` plus all prior tests.

## Added in V3.16

Read `DEFENSIVE_EQUIPMENT_VISIBILITY_V3_16.md`, `CHANGES_V3_16.md` and inherited `AI_GM_HANDOFF_V3_15.md`. Armor/shield active item definitions with material, category, bonus, enchantment, cap, check penalty, spell failure and durability; imported AC baseline/delta tracking; mithral and adamantine armor, item broken consequences, material-derived hardness for Sunder, persistent fortification. `gm_set_equipment`, `gm_inspect_defense`, `gm_set_defense_profile`. Attack `defenseContext` can supply GM-determined cover and miss chance; concealment d% is checked AFTER hitting AC but BEFORE critical confirmation, precision damage, ordinary damage, and riders. Blind-Fight one reroll for melee, blindsight with range removes visual/blur/displacement miss chances, blindsense does not. Concealment prevents sneak attack even on a successful hit. Cover is +4/+8 AC, total cover refuses direct attack.

## Validation

23 Node test files passed after V3.16 modifications, including targeted defensive tests; `test_browser_v3_16.py` and `test_browser_v3_15.py` passed after the final package rebuild; historical `test_browser_v3_8.py`, `test_browser_v3_9_1.py`, `test_browser_v3_10.py`, `test_browser_v3_11.py` also passed in a recent batch, but the massive historical browser sweep hit a timeout before completing. Never claim all historical browser suites passed in one single complete run. Browser uses `/usr/bin/chromium`.

## Limitations and next requested milestone

All nine common attack riders covered in V3.15 remain. Ordinary offense gaps: nonlethal damage, weapon size, ranged attacks, nested interrupts. Defense foundations are present but NOT exhaustive: GM supplies cover/lighting/visibility rather than automatic map corner calculations, and total concealment targeting/AoO nuances and cover Reflex bonus still need work. Advanced armor and spellcasting effects, armor speed rules, shield special abilities, exotic materials are not fully automatic. The user explicitly wants the **Fast Forward / Advance Time scheduler** implemented after the defensive framework: core clock, timed effects, recurring affliction checks, negative-level recovery, decisions returned to AI instead of being chosen by calculator; do not simulate every combat round. Existing `gm_advance_time` is a limited older subsystem, not the full scheduler. Rest and elapsed time must be separate.
