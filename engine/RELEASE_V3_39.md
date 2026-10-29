# V3.39 — Clearer AI operation and command discovery

The command catalog now explains 58 common commands' purpose, state/action consequences, limitations, valid input choices and next steps. It provides 51 executable command examples with explicit setup caveats. Every command has a guide topic; entries with incomplete short-form guidance say so, including that `required:null` does not mean zero required inputs. Native owners remain the only mechanics validators.

AI_START_HERE.md explains the seven tools, result paging/retries, interruption ownership, imported totals and automatic versus advisory behavior. AI_WORKFLOWS.md gives short sequences for imports, unfamiliar abilities, movement/full attacks, interrupted casting, time advancement and deliberate scene closure. These are available as `kernel_reference` topics `start` and `workflows`; the handoff is now clearly deeper developer context.

Errors for known commands point back to their catalog entry and guide. Invalid faction messages list `party`, `enemy` and `neutral`. Focused `kernel_status(target)` now works: it reports configured base speed directly, instead of sending `speed` to a derived-stat function that does not support it. No combat rules were expanded in this release.

Known limitations are explicit: generic immunity/cooldown reminders are advisory; condition coverage can be partial; Prone posture movement remains adjudicated; ordinary/full attacks differ in same-team targeting; ending initiative retains the scene, while scene closure discards its map. Map-preserving roster/catalog cleanup, map libraries, synchronized player viewing and Roll20 integration are not implemented by this update.

## Upgrade

Use the same server/tunnel setup. With the Node server stopped, retain a backup of the saved encounter (`%USERPROFILE%\.tabletop-kernel\encounter.json` by default, or the configured TABLETOP_STATE_PATH). Extract this archive into a new folder and run `node mcp_server.mjs --http` there with your existing environment settings. Dependencies are included. The tunnel endpoint remains port 8787; no new tunnel is required.

V3.39 accepts 3.37.0, 3.38.0 and 3.39.0 session headers without changing native state/checkpoints/receipts. The next accepted mutation writes a 3.39.0 header; downgrading requires the pre-upgrade backup. A fresh status reports the running version. Existing retry receipts may retain their original versioned responses.

## Validation

All 48 Node engine/integration suites passed, along with two selected browser regression checks. See TEST_RESULTS_V3_39.txt. `clarity_tests.mjs` exercises all 51 catalog examples through the MCP boundary with prerequisite setup, targeted status purity, valid error pointers, reminder expiry versus advisory enforcement, initiative end versus scene discard, and prior-save compatibility. Guidance is not an exhaustive schema for all nested fields, and these checks do not establish full PF1e rules coverage.
