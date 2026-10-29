> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# V3.20 Changes — Encounter Initiative

- Added GM-controlled encounter initiative roster (d20+modifier rolls or imported results; ties, arbitrary signed counts, manual edits).
- Corrected the combat round transition to use encounter ordering, not the creature-array index, while retaining historical behavior when initiative has not begun.
- Added standard Delay with GM-queued resumption after a completed turn, permanent new initiative position, and no duplicate action budget.
- Added initiative-count deadlines for effect expiration or GM adjudication, including empty initiative counts and multiple simultaneous event queueing.
- Prevented Fast Forward while encounter initiative is active. Ending initiative migrates unresolved countdowns into the existing world-clock scheduler.
- Added nearby Time & Events browser controls for initiative and active deadline records.
- Added Node and Chromium test coverage for roster sorting/editing/rolls, Delay, round clock, deadlines, migration and backward compatibility.
- **Not included:** Readied Actions, general conditional Pending Events, a fully nested interrupt engine, full spellcasting, or generic creature templates.
