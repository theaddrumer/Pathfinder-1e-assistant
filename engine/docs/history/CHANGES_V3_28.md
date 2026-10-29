> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# V3.28 — Summon timers

- Added per-instance Summon marking and optional summoning data to normal spawning. Existing creature traits are preserved and duration is required.
- Reused native Pending Events for initiative and world-clock expiry; no independent summon clock, registry or remaining-time counter.
- Added removal on expiry/defeat and explicit GM dismissal; cancellation cannot leave an unlimited summon.
- Integrated removal with initiative, interrupted actions, grapples, conditions, held charges, resources and native spell effects. Copies inherit the same expiry.
- Extracted existing initiative-end migration into a shared method so losing the last participant cannot strand deadlines.
- Added workbench setup, inspection, dismissal, Summon labels and empty-encounter handling. No inventory/component accounting.
- Added `summon_tests.mjs` and `test_browser_v3_28.py`. Complete verification: `TEST_RESULTS_V3_28.txt`.

The V3.27 frozen daily-allotment policy is unchanged. The current handoff and README record the user's narrower scope for remaining magic work.
