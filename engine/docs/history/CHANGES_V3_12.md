> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# V3.12 — Attack riders and full-attack substitution

- Added `RiderGame` and `riders.mjs` for an explicit optional post-hit Grab decision and free CMB resolution.
- Added normal and appendage-only grapples, Constrict on successful grapple checks, Grab maintenance damage, and size validation.
- Added `replace_attack` for Trip, Disarm, and Sunder during a melee full attack, including continuation after an AoO pause.
- Updated imported attack schema to accept explicit Constrict dice, bonus, and Grab size exception.
- Corrected double application of the Grappled CMB/attack penalty.
- Extended the workbench with Grab decision buttons, Bite + Grab + Constrict example and full-attack maneuver replacement controls.
- Preserved all prior core and browser fixtures; added `rider_integration_tests.mjs` and `test_browser_v3_12.py`.
- See `ATTACK_RIDERS_V3_12.md` for precise support boundaries and unresolved interactions.
