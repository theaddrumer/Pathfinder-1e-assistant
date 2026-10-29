> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# V3.23 — Shared Lifecycle Cleanup

- Added `lifecycle.mjs`: pure deadline indexing and ordering, initiative crossing predicate, unresolved action/decision probes, and cleanup of orphaned effect-expiration records.
- `time_engine.mjs` indexes ailment ticks, negative-level saves, temp-HP expirations, numeric modifier durations, GM time events and Pending Events in one chronological clock view. Individual rules resolvers remain unchanged; automatic mechanics still execute at their deadlines without requiring GM approval.
- Pending Events and initiative counts reuse the same crossing predicate. Redundant Pending Event clock-deadline enumeration was retired.
- Time advancement, initiative safety checks, and casting initiation share the same source-of-truth probe for unresolved operations; GM's authoritative initiative edits remain possible during interruptions.
- Effect removal unlinks associated initiative-expiration records. Turn-start automatic expirations now use the same removal pathway without incorrectly spending an action.
- Added read-only `gm_get_lifecycle` for a combined AI-facing view of chronological deadlines, initiative deadlines, Pending Events, suspended actions/GM decisions, and orphan timer diagnostics. Included an inspect button in the existing Time & Events workbench section.
- Added `lifecycle_tests.mjs` (7 test groups) and `test_browser_v3_23.py`.

**Not included:** This is not a replacement for all existing effect storage, a full nested-interruption executor, a declarative spell/effect interpreter, or the proposed persistent-map property layers. Those remain future work. No published creature/spell libraries were invented.
