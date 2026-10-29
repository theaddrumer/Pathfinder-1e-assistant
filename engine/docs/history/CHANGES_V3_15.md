> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# V3.15 — Final common attack riders (incremental)

- Added validated `pullFeet`, `pushFeet`, `energyDrainLevels`, `energyDrainDC`, `energyDrainTempHp` creature-attack fields.
- Optional free Pull and Push CMB/CMD after a qualifying hit with fixed movement, size eligibility, obstruction and no AoOs. Converted those definitions to executable actions, preserved controller choice and integrated multi-rider queuing.
- Implemented Energy Drain after a qualifying hit, double negative levels on confirmed non-negated criticals, inherited immunities, negative-level death threshold, Fort saves per level after 24h and temporary-to-permanent conversion.
- Added separate persistent negative-level status data with HP adjustments, attacks/CMB/CMD/saves/skill/ability-check penalties and manual GM commands; this does not actually lower imported HD or delete spell slots.
- Added temporary HP pools from Energy Drain, one-hour expiration and Paizo FAQ same-source nonstacking rule. A shared optional hook in the ordinary damage and effect-packet resolvers consumes temporary HP after normal mitigation, preserving compatibility.
- Updated the main offline workbench with V3.15 sample creature, Pull/Push decisions, negative-level/temporary-HP display, and improved version labels. Updated two historical browser assertions to check for the product rather than a frozen V3.7 version.
- Added `final_offense_tests.mjs`, `test_browser_v3_15.py` and V3.15 documentation. Other prior source modules and fixtures retained.
- Remaining: more ordinary offensive mechanics (nonlethal damage, weapon-size progression, ranged attacks), unusually nested interrupts and deferred defense modernization.
