> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# V3.16 — Defensive equipment, armor materials, cover, visibility

- New `defense.mjs` extends `FinalOffenseGame` without replacing its attack, rider, maneuver, ailment, critical or condition implementations.
- Added armor/shield bonus derivation, enhancement values, item status and equipment changes, Dexterity cap changes for normal/touch/flat-footed AC, nonproficiency and AC/skill penalty deltas from imported printed totals. Preserves authoritative imported stats and captures baseline on creature spawn.
- Mithral defensive equipment effects and adamantine armor DR; material-derived metal hardness feeds existing Sunder calculation when an item has no explicit hardness. Broken and removed armor/shields change AC as expected.
- Added contextual cover (+4/+8/total restriction), 20/50% and custom concealment, miss chance after attack-hit test and before critical/damage/riders, melee Blind-Fight reroll, range-scoped blindsight, persistent target defensive profiles and GM attack context. Concealment blocks precision eligibility even on a successful miss-chance check.
- New GM operations `gm_inspect_defense`, `gm_set_equipment`, `gm_set_defense_profile`, with validated input and transactional rollback. Read-only `inspect()` includes defense/equipment.
- Workbench example and controls for equip/unequip, broken armor, persistent or per-attack visibility/cover, and defense inspection.
- New `defense_tests.mjs` and `test_browser_v3_16.py`; inherited tests and fixtures remain present.
- Explicit limitations: no automatic corner geometry or illumination; total-concealment targeting/AoO subtleties and cover Reflex bonuses require extension; advanced enchanted armor effects, armor-adjusted movement, spell failure rolls and ranged attack resolution deferred. Time fast-forward is NEXT milestone and is not implemented in this version.
