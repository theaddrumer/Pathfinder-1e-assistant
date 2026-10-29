> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# V3.9 — Attack definitions before attached riders

- Added `attack_library.mjs`: standardized attack kind/mode vocabulary, natural attack physical-type defaults, and documented reusable rider entries, including Grab's free maneuver, +4 CMB and -20 appendage hold.
- Added validated creature attack descriptors with explicit damage types and riders; rejects unknown fields/unknown rider names.
- Preserved attack descriptor metadata through full-attack slots, standard attacks, and charges. Standard `attack` accepts `index` for creature routine selection.
- Prevented BAB iteratives from being invented for lone natural attacks.
- Damage mitigation accepts multiple simultaneous physical damage types on *one* hit/packet component; DR checked once and bypass descriptors include every applicable physical type.
- Existing damage-before subscriptions now receive an array `event.damageTypes`; legacy `event.damageType` is retained. Black Pudding Split uses the multi-type-aware test.
- Added GM-readable `gm_describe_attack` and expanded `list_trait_library` to include attack kinds/modes, natural attack defaults and rider definitions.
- Added workbench example Bite + Grab and a reusable profile inspector. Grab and other riders are deliberately **not executed** pending the CMB/CMD/grapple scheduler.
- Added targeted Node and Chromium tests, retaining historical fixtures and the older regression suites.

**Not implemented:** generic grapple execution, natural-attack mixed manufactured/natural penalties and limb arbitration, equipment critical hits, ranged geometry, touch attack targeting automation, target-specific Grab size exceptions and most universal monster rule execution. See ATTACKS_AND_RIDERS_V3_9.md.
