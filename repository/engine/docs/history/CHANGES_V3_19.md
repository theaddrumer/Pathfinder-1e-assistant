> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# Changes in V3.19

V3.19 continues the original unfinished Attack Completion roadmap. See `ATTACK_ROUTINES_AND_AMMUNITION_V3_19.md` for full mechanics.

- Add opt-in `attackPlan` for BAB-based manufactured attacks, two-weapon fighting, improved/greater offhand attacks, light offhand penalties, secondary natural attacks, Multiattack, and single-primary-natural 1½ Strength. Printed attack routines remain authoritative.
- Add validated `stats.ammunition`, `ammoId` on ranged attack entries, loaded and spare rounds, ammo draw/preparation, and reload action accounting with interrupt support.
- Ranged shooting/reloading can provoke AoOs; decisions resolve before the actual shot/reload, without advancing full-attack cursor or expending ammunition prematurely. Rays do not provoke a second AoO on their own attack roll.
- Add `reload_weapon`, `draw_ammunition` and GM `gm_set_ammunition`; show controls and state together in Attack Completion workbench.
- Add V3.19 Node and browser tests, preserve V3.10–V3.18 regression suites.
- Update handoff with Pending Events, spellcasting, basic template transforms, later map geometry, and provider-specific AI plugin/tool adapter as **future**, not current, work.
