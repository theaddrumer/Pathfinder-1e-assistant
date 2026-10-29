> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# V3.9.1 changelog

- Added improvised weapon classification and its default -4 hit modifier, with explicit proficiency override.
- Added independent broken weapon condition with -2 hit and weapon damage; broken and improvised coexist.
- Added material catalog (steel, alchemical silver, cold iron, adamantine, mithral) with validated imports, DR tags, and automatic alchemical-silver piercing/slashing penalty.
- Exposed material, condition, and critical profile in `gm_describe_attack`; critical resolution remains pending, explicitly reported with `implemented:false`.
- Added weapon-material metadata to GM direct damage and damage packets for DR resolution.
- Added browser sample with five inspectable weapon profiles and 11 targeted Node tests.
- Preserved imported attack totals, all historic fixtures, and actor vs GM authorization separation.

Read `WEAPON_QUALITIES_V3_9_1.md` for functionality versus unimplemented mechanics.
