> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# V3.10 Changes — Combat Maneuver Framework

- New `maneuvers.mjs` built on `FoundationsGame` rather than recreating the attack and statistics engine.
- Standardized PF1 special size CMB/CMD modifiers, imported totals, contextual CMD, and maneuver-specific modifiers.
- Standard-action Trip, Disarm, Sunder, Bull Rush, and grapple initiation; dedicated grapple actions for maintain, escape, reverse, release.
- AoO suspension/continuation for provoked maneuvers, including damage penalty on check.
- Persistent grapple relationship with condition synchronization and rollback.
- Validated equipment records and attack-to-equipment references; Broken and dropped weapons affect attacks.
- New browser maneuver controls, grapple controls, and CMB/CMD per-creature display. Historic encounter fixtures remain under `tests.html`.
- All previous regression tests remain; new `maneuver_tests.mjs` plus `test_browser_v3_10.py`.

See `COMBAT_MANEUVERS_V3_10.md` for implemented-vs-deferred detail.
