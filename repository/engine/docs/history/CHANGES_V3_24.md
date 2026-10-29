> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# V3.24 — Casting times and interruptions

- Added 1-round and longer casting times, consecutive full-round action costs, continuation/cancellation, and a pre-turn completion checkpoint with final target/area selection.
- Connected native damage to concentration, including individual attacks, grouped weapon bonus damage, mitigated packets, temporary HP, ongoing damage, entanglement and incapacitation.
- Added individual casting AoO decisions that reuse real attack and opportunity budgets. Preserved explicit GM external-adjudication compatibility without rechecking native damage.
- Added world-clock casting deadlines to the shared lifecycle index and Fast Forward completion stops; retained progress across partial downtime.
- Reused shared packet/modifier validators before casting costs. Preserved atomic failure, serialization, prior mechanics and undo.
- Updated the offline workbench with duration selection, progress, individual AoO controls, continuation, targeting/completion and cancellation. Progress also appears in Time & Events.
- Added 36 casting regression groups, browser integration coverage, and a portable regression runner. Full results are in TEST_RESULTS_V3_24.txt.

See CASTING_TIMES_AND_INTERRUPTION_V3_24.md for API examples and explicit limits. Touch/ray casting, slots, counterspells, dispels, resolved-spell concentration, persistent areas and general nested interrupts remain on the roadmap.
