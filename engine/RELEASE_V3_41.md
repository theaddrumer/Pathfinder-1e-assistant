# V3.41 — Broader creature subtype recognition

Creature definitions now accept the broader subtype catalog, including goblinoid, reptilian, human, elf, dwarf, giant and other racial or creature classifications. The catalog contains 103 accepted identifiers, including qualified augmented-type identifiers and existing calculator helper labels. It is not a full bestiary or an unrestricted custom-tag system.

Recognition is separated from rule automation. Existing `SUBTYPE_TRAITS` behavior remains unchanged; newly recognized entries preserve identity without granting implied bonuses, defenses, senses or other abilities. `list_trait_library.subtypeCoverage` identifies classification-only entries, partial automation and the tracked summon marker. Subtypes with substantial unimplemented rules are explicitly classification-only, not presented as fully supported.

Focused `kernel_status(target)` now exposes creature classification. Resolved traits identify classification-only subtypes and remind the AI to configure applicable mechanics separately. Unsupported subtype errors name the array index and value and direct the caller to the catalog. Definitions, independent spawned tokens and saved sessions retain the classifications.

The same structured labels can inform GM adjudication of Bane, favored enemy and other target-dependent effects. This release does not add automatic Bane matching or damage. Read `SUBTYPES_V3_41.md`, available through `kernel_reference` topic `subtypes`, for exact fields, examples and limitations.

The separate import cleanup identified from the Goblin/Kobold trial—replacing the historical registry reference, broader field-specific diagnostics, and complete published-creature import examples—remains follow-up work. This release addresses subtype classification specifically.

## Upgrade

Stop the Node server and back up the configured encounter save (`%USERPROFILE%\.tabletop-kernel\encounter.json` by default). Extract this archive into a new folder and run `node mcp_server.mjs --http` there using the existing settings. Dependencies are included; the existing port 8787 tunnel can be reused.

V3.41 loads session headers from 3.37.0 through 3.40.0, as well as 3.41.0. The next accepted mutation saves a 3.41.0 header. Keep the pre-upgrade save for a downgrade. Existing undo checkpoints and retry receipts remain intact; no migration invents subtype labels for already imported creatures.

## Verification

All 50 Node engine/integration suites passed, including eight new subtype test groups. These cover accepted imports, unchanged numeric totals, passive versus active traits, augmented-type identity, invalid-input rollback, tool discovery, independent instances and save compatibility. The documented minimal JSON example is executed through the integration boundary.

The rebuilt offline bundle passed its targeted browser check for registration/spawning, coverage reporting and precise subtype rejection without state changes. Other browser suites were not rerun for this focused update. See `TEST_RESULTS_V3_41.txt`.
