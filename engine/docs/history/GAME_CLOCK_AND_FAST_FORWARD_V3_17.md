> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# V3.17 — Game Clock, Fast Forward, Chronological Event Scheduler

The Tabletop Kernel is a deterministic calculator, not a character decision-maker. The AI GM supplies what happened during downtime. The calculator advances the in-game clock, expires registered effects, rolls already-declared ongoing afflictions and negative-level saves, and reports due GM-authored events. It **does not** choose characters' activities, movement, watches, crafting, lodging, rest, or healing.

## Time model

`worldRounds` is the preexisting canonical elapsed-time clock; one round is six seconds. Ten rounds are one minute, 600 an hour, 14,400 a day. V3.17 adds a human-readable campaign clock (`gameClock`) whose initial display is **Day 1, 00:00:00**. The GM may set the displayed day/hour/minute using `gm_set_game_clock`, without changing elapsed time, spell durations, saves, or the combat sequence. All game time and scheduled events are part of the serialized game state and undo snapshots.

Combat's `round` and `turn` counters stay **separate** from downtime: advancing three days doesn't execute 43,200 combat turns, spend action resources, or grant resting benefits. Standard combat turn advancement still progresses `worldRounds` at round boundaries.

## GM command examples

```json
{"op":"gm_get_game_clock"}
{"op":"gm_set_game_clock","day":17,"hour":9,"minute":30}
{"op":"gm_advance_time","count":8,"unit":"hour"}
{"op":"gm_advance_to_event"}
{"op":"gm_schedule_time_event","id":"watch_change","label":"Watch changes at the east gate","after":{"count":2,"unit":"hour"},"requiresInput":true}
{"op":"gm_acknowledge_time_event","reason":"GM narrates that the guard captain has arrived"}
{"op":"gm_cancel_time_event","id":"watch_change"}
```

`unit` is one of `round`, `minute`, `hour`, `day`. The event scheduler uses explicit data, never generated code. Event IDs are unique. Scheduling a GM event without `requiresInput` or with it set to true creates a **decision checkpoint**; setting it to false creates a logged event without blocking the skip. `gm_advance_to_event` advances to the next known deadline, including ailment saves, timed effects, negative-level saves, temporary HP expiry, and custom events.

A Fast Forward interrupted by a GM checkpoint returns `status: "needs_gm"`, `pending`, `advancedRounds`, and `remainingRounds`. The GM acknowledges the event with an explanation, then can advance the remaining time. No GM-authored character decisions are automatically resolved or guessed. Multiple events at the same instant remain individually addressable. Invalid commands roll back state atomically.

## Mechanical event processing

The engine steps from deadline to deadline, not one round at a time. For each scheduled timestamp it processes the following in order:

1. Expire elapsed round-duration modifiers and conditions, automation marks, and temporary HP.
2. Roll already-registered poison, disease and damage-over-time frequency checks, including cures/effects.
3. Resolve individual 24-hour Fortitude checks for temporary negative levels; success removes, failure makes permanent.
4. Report scheduled GM events and stop for unresolved GM decisions.

The returned result contains per-event timestamps, elapsed amount, affliction `ticks`, `negativeLevelSaves`, `expiredEffects`, `expiredTempHp`, and `scheduled` events. Events with saved ongoing effects can create new deadlines, which are integrated into the same skip. Simultaneous processing order is explicit and deterministic. The scheduler has a 20,000-event safety limit for unusually dense or pathological afflictions; use smaller intervals if exceeded.

## Test coverage

`time_engine_tests.mjs` tests initialization, clock adjustment, non-action-consuming long skips, chronological effect expiration, 24-hour negative-level saves, hourly poison, temporary HP expiry, stopping/resuming decision points, same-time events, validation/rollback, no implicit rest, and undo. `test_browser_v3_17.py` tests the UI end-to-end. Earlier `.mjs` test suites and recent browser suites remain as regressions.

## Deliberate limitations

- The game calendar is a day counter and 24-hour clock, **not** a real-world calendar with months, holidays or time zones.
- The clock is accurate to **six-second rounds**, not fractions of a round.
- Merely advancing time never assumes rest, spell preparation, travel, crafts, healing or player decisions. Those require separate GM adjudications or a later activity system.
- The engine doesn't autonomously choose responses to narrative events; GM-authored decision checkpoints pause advancement and return control.
- The existing older effect rules include partial/advisory features. Time advancement handles their numeric duration and active ailments; it does not expand unsupported spells or simulate undocumented effects. Some special event-triggered `onEnd` behaviors are still implemented for event triggers, not every possible timed-expiration path.
- Dense event chains over the bounded limit must be processed in smaller intervals; the engine does not pretend to summarize them without their rolls.
- The V3.16.1 tiled map is unchanged. Subtile walls, line segments, partial-square terrain and geometric cover remain a separate future map redesign.
