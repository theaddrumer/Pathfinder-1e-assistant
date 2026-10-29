> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# AI GM / Tabletop Kernel — handoff (V3.9)

## Objective
Autonomous Pathfinder 1e GM with a deterministic mechanical referee the AI operates, not a second tactics engine. AI interprets rules/AP content, imports reusable definitions and decides creature actions; engine performs validated calculations and state changes. Keep official/3PP/homebrew packs extensible; preserve published statblock totals rather than reverse-engineer the character build.

## Most recent change: V3.9 attack definitions before riders
Builds on V3.8 effect packets, inherited traits and calculated DCs. New `attack_library.mjs` defines attack kinds, modes, Bestiary-style natural attack physical-type defaults, and *definitions only* for common attack riders (Grab, Constrict, Trip, Poison, Bleed, Pull, Push, Paralysis, Energy Drain). A bite is one B/P/S physical damage roll, not three components. DR sees any listed physical type and applies once; physically distinct components and elemental additions remain separate. Imported attacks preserve metadata through normal attacks, full attacks and charges. Standard `attack` has optional `index`; `gm_describe_attack` returns a controller-readable description. `list_trait_library` now includes attack vocabulary. Test fixtures moved to tests.html in prior releases.

Grab rules are **defined but not executed**: free optional maneuver on hit without AoO, +4 CMB to start/maintain, normal grapple or -20 appendage hold, size limit normally equal/smaller, no extra initial damage without Constrict. Next needed core mechanic: genuine combat maneuvers CMB/CMD with stateful grappling and appropriate interrupts/target decisions. Do not add automatic Grab riders before this exists. Grab and Constrict are separate. Other rider entries are also deliberately nonfunctional definitions; report this rather than pretending they apply effects.

## Project files
Complete archive `tabletop_kernel_v3_9_attack_foundations.zip` includes ES modules, tests and offline generated workbench (`index.html`, `tests.html`), plus ATTACKS_AND_RIDERS_V3_9.md and CHANGES_V3_9.md. Standalone main demo exported as `tabletop_kernel_v3_9_demo.html`. To rebuild after changing modules, execute `python build_demos.py`. Run `node attack_foundation_tests.mjs` and the historical `*tests.mjs` files; Chromium smoke tests use `python test_browser_v3_9.py` and older scripts.

## Limits inherited from prior versions
Actor/GM permissions and action economy implemented; nested reaction scheduler not complete. More exotic conditions are advisory, not fully automated. Creature types/subtypes are selective. Damage reduction compound AND bypass requirements need additional modeling. Complex damage timing, ailments attached to attacks, range/cover geometry, all criticals, and full spells/UMRs still absent. The AI should be able to supply ad hoc GM calculations; don't hardcode creature tactics. Use explicit errors/advisories for unsupported semantics.

## Suggested next milestone
Build generic combat maneuver resolution before activating Grab/Constrict/Trip and before attaching ailment riders to attack hits. Then implement the optional interrupt/controller decision interface for Grab and other after-hit choices. Keep test fixture library for regression but do not add more legacy encounters to the main GM workbench.
