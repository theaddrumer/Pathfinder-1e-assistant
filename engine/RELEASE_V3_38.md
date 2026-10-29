# V3.38 — Prone attack corrections and dice discovery

Prone no longer applies its melee attack penalty to permitted ranged attacks or spell rays. The shared attack paths reject prohibited ranged weapons; an explicit, validated per-attack `usableWhileProne` flag records rules-supported exceptions. Existing target AC adjustments remain intact. Invalid actions roll back, and a shot made illegal during an opportunity attack stops without consuming ammunition.

The existing `gm_roll kind:"plain"` operation is now directly discoverable through the catalog, tool description and current guides. Errors explain the valid payload, and unknown dice-only fields reject instead of silently rolling defaults. There is no duplicate roller. Explicit damage/healing and Free Mode remain on their original paths.

Standing/crawling automation, interface corrections, map retention changes, source-specific immunity work and feat expansion are outside this release. See PRONE_AND_DICE_V3_38.md for exact coverage.

## Updating the Windows installation

1. Stop the Node server terminal listening on 8787 with Ctrl+C. Do not delete the saved encounter. If using the default path, make a backup copy of `%USERPROFILE%\.tabletop-kernel\encounter.json` while the server is stopped. If you configured `TABLETOP_STATE_PATH`, back up that file instead.
2. Extract this archive into a new folder so the previous release remains available. It includes its dependencies.
3. Open a terminal in the new extracted folder and run `node mcp_server.mjs --http`, retaining any custom environment settings used previously.
4. The existing tunnel still targets `http://127.0.0.1:8787/mcp`; it can stay open. Ask the connected AI to call `kernel_status` and verify `engineVersion: "3.38.0"` and the preserved encounter/map/clock.

The server accepts both 3.37.0 and 3.38.0 saved sessions. State, map, world clock, undo checkpoints and retry receipts are retained; no scene reset occurs. The next accepted mutation writes a 3.38.0 save. Old retry receipts may contain their original 3.37 response; fresh status reports the current version. Downgrading requires restoring the pre-upgrade backup because V3.37 rejects newer save headers.

This archive does not automatically replace the running Windows server.

## Validation

All 47 Node suites and 40 browser suites passed (87 total), including 14 focused Prone/dice groups. An additional cross-version check loaded a snapshot produced by the actual V3.37 adapter with native state, checkpoints and receipts unchanged. The release includes `prone_dice_tests.mjs` and the complete regression report in `TEST_RESULTS_V3_38.txt`. Focused checks cover melee/touch/ranged penalties, critical confirmations, imported totals, weapon exceptions, ray casting, defender AC, rejection rollback, opportunity continuations, dice-only state invariants, retries, validation and 3.37 save compatibility.
