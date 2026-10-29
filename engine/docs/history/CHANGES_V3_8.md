> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# V3.8 change summary

- Consolidated canonical damage vocabulary in `trait_library.mjs`, including divine, holy, unholy and four alignment-named classes while preserving all preexisting physical/energy/force/untyped classes.
- Shared vocabulary now feeds both GM and foundation dropdowns; eliminates manually abbreviated UI options.
- Added `gm_resolve_packet` with separately mitigated components, optional bounded dice, authored alignment multipliers, single shared physical DR pass and one validated damage event.
- Added source-derived subtype weapon alignment: Lawful/Evil for Devil, Chaotic/Evil for Demon, and explicit `good`/`evil`/`lawful`/`chaotic` subtypes.
- Kept creature's *actual* alignment separate from its subtypes; opposite alignment interactions are effect-specific only.
- Added optional enhancement-bonus metadata, basic bypass thresholds, and Epic +6 equivalence inference, without making Epic or Magic into damage types.
- Improved mundane/+1 weapon distinction against incorporeal creatures.
- Added `effect_packet_tests.mjs` and `test_browser_v3_8.py`; existing core/fixture functionality retained.
- Still a selective rules engine, not a complete PF1e special damage, spell, attack rider or full interrupt system.
