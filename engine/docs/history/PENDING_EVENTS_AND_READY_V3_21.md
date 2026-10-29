> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# V3.21 — Pending Events, Readied Actions and GM checkpoints

This update builds on V3.20 initiative and V3.17 Fast Forward; it does **not** introduce a natural-language trigger evaluator or an AI tactical agent. An event is an arbitrary GM-readable condition, separate from a precise mechanical expiration. The GM decides whether an arbitrary trigger occurs; the calculator handles durations, action expenditure, state transitions and compatible initiative bookkeeping.

## The registry

`PendingEventsGame extends InitiativeGame` (`pending_events.mjs`; `scenarios.mjs` constructs the new class). Every entry is serialized in `state.pendingEvents`, with fields for `id`, `label`, `trigger` (uninterpreted text), `kind`, optional `actor`/`action`, `duration`, `requiresInput`, and status. Recent resolutions appear in `pendingEventHistory` and GM-adjudication checkpoints in `pendingEventDecisions`. Existing world-clock and initiative schedulers remain intact. All these fields live in game state and are included in state copies/rollback.

GM commands:

```json
{"op":"gm_get_pending_events"}
{"op":"gm_register_pending_event","id":"door","label":"Guard watches doorway","trigger":"If an enemy opens the northern door","duration":{"type":"encounter"},"requiresInput":true}
{"op":"gm_trigger_pending_event","id":"door"}
{"op":"gm_resolve_pending_event","id":"door","reason":"GM adjudicated the creature's attack and door opening"}
{"op":"gm_cancel_pending_event","id":"door"}
```

Durations:

- `{"type":"indefinite"}`: never automatically expires; GM triggers or cancels it.
- `{"type":"encounter"}`: expires without activation when the GM ends the initiative encounter using `gm_end_initiative`.
- `{"type":"turn_start","actor":"hero"}`: expires at the start of that creature's next turn (not at the round boundary).
- `{"type":"time","count":3,"unit":"round","onExpire":"trigger"}`: wall-clock countdown (`round`, `minute`, `hour`, `day`). Timers activate at their deadline when `onExpire:"trigger"`, otherwise quietly expire. Setting `requiresInput:false` means the event activation is logged and retired without a GM checkpoint; arbitrary effects are **not** executed by interpreting its text.
- `{"type":"initiative","afterRounds":2,"atScore":12,"onExpire":"trigger"}`: encounter initiative deadline, including an empty initiative count. `atScore` defaults to the active creature's count. On leaving initiative, unfinished initiative timers migrate to a six-second-resolution world-clock deadline.

The expiry outcome defaults to `expire`; expiry **never** implicitly triggers a readiness. Only a GM-declared conditional trigger or an explicit `onExpire:"trigger"` timer activates a Pending Event.

## Readied Actions

```json
{"op":"gm_register_pending_event","id":"ready_arrow","label":"Archer guards the door","kind":"ready","actor":"hero","action":"Fire arrow at creature entering room","trigger":"First enemy enters through the door","duration":{"type":"turn_start","actor":"hero"},"requiresInput":true}
{"op":"end_turn"}
{"op":"gm_trigger_pending_event","id":"ready_arrow"}
{"op":"gm_resolve_pending_event","id":"ready_arrow","reason":"GM resolves the readied arrow using existing attack/override mechanics"}
```

Registering a Ready requires active initiative, the readying creature's active turn, and an available standard action. It consumes that standard action immediately. An unused Ready expires at the beginning of the actor's next turn or when the GM ends the encounter. It must require a GM adjudication checkpoint. On activation, the kernel repositions the actor in the initiative roster immediately ahead of the triggering active creature, marks that actor as having acted in the current round, and sets a `pendingReadyAction` record. **It does not grant a full new turn, refresh action resources, or execute the declared attack/spell.** The AI GM uses the existing attack/effect/Free Mode tools for adjudication and then resolves the Pending Event; an unresolved Readied Action blocks ending the interrupted creature's turn. This is an initial bookkeeping foundation, not a fully nested interrupt executor. Triggers must be activated at the appropriate safe point by the GM.

## Fast Forward preflight and resolution

If active Pending Events exist, `gm_advance_time` and `gm_advance_to_event` first return `status:"pending_events_warning"`, a list of active event IDs, and **advance no time**. A second call with `confirmPendingEvents:true` proceeds. The workbench automatically offers this second-step confirmation when Fast Forward is pressed again; the AI-facing interface must pass the flag explicitly. This is a soft confirmation, not a permanent block.

```json
{"op":"gm_advance_time","count":6,"unit":"round"}
{"op":"gm_advance_time","count":6,"unit":"round","confirmPendingEvents":true}
{"op":"gm_advance_to_event","confirmPendingEvents":true}
```

When advancing, the existing deterministic deadlines (effect expiration, periodic ailments, negative-level saves, expiring temporary HP) resolve normally at their timestamps. An activated Pending Event with `requiresInput:true` returns `status:"needs_gm"`, including `advancedRounds`, `remainingRounds`, and the specific `pending` checkpoint; the GM resolves it with `gm_resolve_pending_event` before continuing with the remaining interval. Automatic mechanics never wait for an unrelated speculative GM interpretation.

Initiative-count events that require GM input pause the *following creature's turn start* before new turn-start triggers and ailment ticks execute. Acknowledging the last GM event resumes those mechanics exactly once; events and expirations that were already due earlier stay resolved. This also improves V3.20's pre-turn initiative alerts. A similar guard applies when a clock countdown becomes due at the combat round boundary.

## Workbench layout

The Pending Events entry form, active and triggered event selectors, Resolve/Trigger/Cancel controls and summary are all located in the existing **Time & Events** section alongside Initiative, world clock and Fast Forward. There is no separate event-management pane to search through.

## Boundaries and known limitations

- Narrative triggers such as spoken phrases, movement predicates, opening doors or conditional traps are not automatically recognized. The AI GM decides and invokes `gm_trigger_pending_event`.
- Triggering does not itself cast a spell, damage a creature, operate an object or calculate complex Readied Action reaction chains. Execute those via existing operations/Free Mode, then acknowledge the event. Running Ready as an interrupt *midway through* an already unresolved complicated attack is still a GM coordination problem; no general nested stack is promised.
- `gm_end_initiative` is the explicit encounter-end signal. The `encounter` lifetime does not infer combat's end from HP or behavior.
- Timers linked to an initiative score lose sub-round ordering when transferred to the world clock outside combat, matching the V3.20 six-second timebase.
- Existing legacy creature-turn durations continue using their original models unless explicitly registered for initiative counts. The engine is not a fully rules-complete Pathfinder 1e magic framework.

## Verification

`node pending_events_tests.mjs`, `python test_browser_v3_21.py`, and the historical Node and browser regression suites. Rebuild offline pages with `python build_demos.py`.
