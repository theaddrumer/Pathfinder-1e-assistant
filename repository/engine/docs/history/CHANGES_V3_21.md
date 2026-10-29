> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# V3.21 — Pending Events

- Added `PendingEventsGame` and persistent GM-authored conditional-event registry.
- Support indefinite, encounter, next-turn, clock, and initiative-count expiration, with separate activate-vs-expire timer actions.
- Added lightweight PF1e Readied Action standard-action cost, next-turn expiration, GM-declared activation and initiative relocation; actual arbitrary action remains GM-controlled.
- Added Fast Forward soft preflight when outstanding Pending Events exist; confirmation is explicit and occurs before elapsed time changes.
- Clock and initiative schedulers invoke Pending Event callbacks at actual deadline crossings; timed events can stop for GM input without withholding already-due deterministic effects.
- Deferred turn-start effects when an initiative checkpoint requires GM input immediately before the creature's turn.
- Kept all event controls together inside Time & Events and added Node/Chromium regression tests.
- No arbitrary trigger parsing, generalized nested interrupt execution, or spellcasting automation is claimed.
