# V3.42 — Creature import clarity

This release addresses ambiguous import failures encountered during fresh-AI testing. Accepted creature mechanics remain unchanged.

- Import errors identify unsupported keys, attack indices, misplaced fields and invalid printed totals. Missing ammunition stores and missing ranged modes have separate messages.
- Shared ammunition validation reports the store and offending field while preserving quantity, reload and draw constraints.
- Registration checks the definition envelope before extension validators inspect nested attack metadata; malformed input rejects without partial registration.
- `kernel_reference` topic `registry` now serves `CREATURE_IMPORT_V3_42.md`. It describes current nesting, totals, attack offsets, full-attack sequences, ammunition, recovery and intentional GM responsibilities. Historical registry examples are marked superseded.
- No new published-creature examples or creature-specific mechanics were added.

V3.42 accepts saved sessions from V3.37 through V3.41. Preserve a backup before upgrading; new saves identify version 3.42.0. Extract the complete bundle and use its server and documentation together. See `INTEGRATION_V3_37.md` for hosting and `TEST_RESULTS_V3_42.txt` for verification results.

Validation: 51/51 Node suites passed, including nine import diagnostics groups and MCP transport/integration tests. The rebuilt browser import/recovery test also passed.
