> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# V3.7 — Reusable defense, trait and ability DC foundations (October 14, 2026)

Built on V3.6.1 without abandoning the existing action-economy, automated rules, condition library, or timed ailments. Added `trait_library.mjs`, `foundations.mjs`, and `foundation_tests.mjs`. `createScenario()` now uses the extended engine. Added GM controls to the offline workbench to load a fictional Devil, apply classified damage, evaluate a tagged immunity and calculate a dynamic ability DC. Historic encounters remain in `tests.html`.

Defensive sources are retained separately, but resistances and DR are resolved as the strongest applicable source, not added. Explicit creature exceptions can suppress inherited defaults. Attack metadata is passed to the central damage resolver; the engine never assumes an unspecified weapon is magical. Condition/ailment entry points now check the tagged immunities that are currently supported.

Added 17 new foundation tests; previous 181 named Node tests pass. The V3.7 browser acceptance and seven legacy browser regression scenarios pass. The legacy browser scripts' compatibility copies modify only version-label assertions, not the mechanical test assertions.

The new library is an intentional **foundation**, not a complete PF1e rules implementation. Type/subtype coverage is selective and notes remain for unsupported effects. Full-incorporeal AC/movement, complex DR bypass, special senses, healing/regeneration, broad spell/weapon effect metadata, and creature-import provenance are postponed. See `FOUNDATIONS_V3_7.md` for schema, supported cases, and the key caveats.
