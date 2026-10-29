> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# Changes in V3.18

- Resumed the old Attack Completion milestone, starting with nonlethal damage, size dice, ranged/thrown/ranged-touch attacks.
- Added `attack_completion_rules.mjs` for validated ranged, lethal/nonlethal, and common weapon damage-size progression definitions.
- Added `attack_completion.mjs` as the new top-level game subclass, preserving TimeGame, defenses, riders, and maneuver systems.
- Extended imported attack descriptors and inspection; imported printed totals stay authoritative.
- Added dynamic nonlethal statuses, GM healing commands, and separate state tracking with undo support.
- Added range limits and increment penalties, firing into melee and Precise Shot, Dexterity to hit for calculated ranged attacks, and projectile/thrown damage ability defaults.
- Enabled ranged full attacks through existing explicit full-attack routine without using melee reach restrictions.
- Fixed prone AC interaction for ranged attacks.
- Added the V3.18 attack example and GM nonlethal/healing controls to the offline workbench.
- Introduced `attack_completion_tests.mjs` and `test_browser_v3_18.py` for targeted validation. Existing regression fixtures remain.

**Not yet implemented**: new Pending Events registry; full two-weapon-fighting attack derivation; general reaction scheduler; full ranged ammunition/reload/AoO semantics; partial-square map geometry, line-wall redesign; complete regeneration and nonlethal spell packet coverage.
