> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# AI GM / Tabletop Kernel — V3.14 handoff (October 15, 2026)

## Project

Reusable, deterministic Pathfinder 1e rules/state calculator beneath a creative AI GM. The GM chooses creature actions, tactics, exceptional rulings, published modules, custom definitions and eligibility for conditional effects. The engine manages math, time, action resources, event and condition state, rollback, and authoritative imported stats; it does not decide NPC actions. Historical fixtures remain on `tests.html` and main workbench on `index.html`.

## Baseline and changes

Use V3.14 as the next source baseline, superseding V3.13. The new reference is `OFFENSIVE_RIDERS_V3_14.md` and changelog `CHANGES_V3_14.md`. Module `riders.mjs` still extends `ManeuverGame`; `critical.mjs` extends `RiderGame`, so all criticals, precision, fortification and other V3.13 mechanics remain intact.

V3.14 introduces executable `trip`, `poison`, `bleed`, `paralysis` riders through imported attack profile data, and serial optional Grab/Trip choices. Trip uses CMB/CMD and applies Prone without AoO or counter-trip. Poison references a pre-registered injury ailment (`poisonId`) and applies only when the hit deals weapon HP damage. Bleed uses a built-in registered `dot` ailment, status inflictor, stronger same-kind HP bleed rule, and existing cure endpoints. Paralysis uses a Fort save and timed condition. Relevant creature immunities are inherited from V3.7 traits.

New fields on `stats.attacks[]`: `poisonId`, `bleedAmount`, `paralysisDC`, `paralysisRounds`. These are validated by `attack_library.mjs`; creature registry whitelist is in `registry.mjs`. `condition_ailment_game.mjs` allows internally dispatched rider applications during a paused full attack, but retains the old restriction for ordinary external condition-injection commands.

## Tests and build

Run all `node *_tests.mjs`, `node tests.mjs` and `python test_browser_v3_*.py`; browser uses `/usr/bin/chromium`. Important new suites: `offensive_rider_tests.mjs`, `test_browser_v3_14.py`. `python build_demos.py` flattens modules into `automation-demo.html`, copies it to `tests.html`, and builds the default `index.html` workbench. Copy `index.html` as standalone distributable HTML and ZIP the complete directory. Keep Roll20/GM-facing logic data-driven and avoid monster-specific hardcoding.

## Pending offensive work before defensive phase

The user explicitly prioritizes finishing the **offensive network before defensive/armor/concealment work**. Next: Pull and Push special attack riders (free checks and fixed-distance movement, correct AoO behavior), energy drain (negative-level application, stat penalties, HP changes, temporary HP and recovery), remaining direct attack riders as needed, nonlethal damage, weapon size/dice scaling, and ranged attack execution. A general nested interrupt scheduler remains a necessary supporting piece, especially when triggers recursively provoke reactions. Do not claim these mechanics complete.

Only after the offensive network is done: equip/unequip AC linkage, armor/shield materials and broken status, cover, concealment, visibility and miss chances, automatic precision eligibility from positioning where deterministic.

## Communication preferences

User is very familiar with PF1e, not a programmer; concise prose, minimal flattery and minimal review of things they already know. No unnecessary offers or extraneous lists. When publishing, provide working offline HTML, complete ZIP and this handoff, with clear tested scope and implementation boundaries.
