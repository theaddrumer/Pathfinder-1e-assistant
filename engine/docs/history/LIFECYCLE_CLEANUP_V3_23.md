> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# Lifecycle and Interruption Preflight — V3.23

## Design

`lifecycle.mjs` is stateless. It reads existing state but never invokes PF1e mechanics. Source modules remain the owners of actual outcomes (poison saves, modifier stacking, conditions, GM checkpoints, damage, Ready, and so forth). This prevents the shared infrastructure from inventing game decisions or processing a timer twice.

Shared helpers:

- `clockDeadlines(state)` returns chronological `{kind,id,at}` records from ailments, negative-level recovery, temporary HP, numeric modifier durations, scheduled GM clock events and active time-based Pending Events. Ordering is deterministic; querying does not mutate state. Combat initiative deadlines appear in the separate initiative array.
- `crossedInitiative(score,upper,lower,includeUpper)` is used by initiative event resolution and conditional initiative-duration events; no empty initiative counts are stepped.
- `unresolvedActions(state)` returns pending action and interruption sources including movement, charges, full attacks, riders, maneuvers, ranged actions, casts, and Readied Action resolution; `unresolvedDecisions(state)` separately returns narrative checkpoints. These are safety checks, not an autonomous execution stack.
- `unlinkEffectDeadlines(state,id)` removes any stale initiative-expiration instructions tied to a removed effect. This is not a dispel-effects implementation.

## GM interface

Send `{"op":"gm_get_lifecycle"}` with `role="gm"` to query `clock`, `combatRound`, `initiativeActive`, chronological `deadlines`, `initiativeDeadlines`, simplified `pendingEvents`, `unresolvedActions`, `unresolvedDecisions`, and `orphanInitiativeExpiries`. The query does not advance time or consume character actions. The same information can be inspected next to Fast Forward using the workbench's 'GM: inspect all timers & unresolved actions' button.

The action names and inputs for `gm_advance_time`, `gm_get_initiative`, `gm_get_pending_events`, `cast_spell`, `gm_continue_spell`, `remove_effect`, etc., are unchanged.

## Important boundaries and caveats

- The common deadline index is *not* a full rewrite of all timing state into a single queue. Native specialized trackers are retained for correctness and compatibility. It supplies a single indexed view and common timing predicates.
- Do not turn mechanically deterministic expirations into GM prompts. The GM resolves only genuine choices and unrecognized effects.
- The GM can still correct initiative during an unresolved interrupt, without resetting the active action. Safety blocks apply to operations that inherently cannot proceed during interruption.
- A manual effect removal now removes its associated expiry deadline, and automatic turn-start effect removal uses the same cleanup **without being counted as a gameplay action**.
- Full general nested interruptions, variable casting-duration completion, counterspelling, persistent area properties, template logic, spell library, and host-neutral integration are still to do.
- For malformed imported data and unknown mechanics, rely on existing input validation and explicit GM Free Mode; do not infer or rewrite PF1e rules silently.

## Verification

Run `node lifecycle_tests.mjs`, then all `*tests.mjs`, then `python build_demos.py` and `python test_browser_v3_23.py`, plus regression browser tests. The test suite specifically checks no mutation when querying deadlines, expiry order, effect/timer unlinking, and action-vs-automatic-expiration accounting.
