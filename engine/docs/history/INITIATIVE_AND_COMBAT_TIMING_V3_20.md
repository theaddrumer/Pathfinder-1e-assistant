> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# V3.20 — Initiative and Combat Timing (Pathfinder 1e)

V3.20 adds an **opt-in, deterministic encounter initiative roster** around the existing V3.19 combat rules, preserves the V3.17 six-second world clock and Fast Forward, and provides GM-editable initiative throughout the encounter. The GM decides tactics, Delay decisions, unusual turn-order exceptions, and what a narrative trigger means. No tactical NPC decision engine has been introduced.

## GM and actor commands

```json
{"op":"gm_begin_initiative","roll":true}
{"op":"gm_begin_initiative","scores":{"hero":22,"guard":11,"cleric":7}}
{"op":"gm_get_initiative"}
{"op":"gm_set_initiative","id":"guard","score":-25}
{"op":"gm_move_initiative_after","id":"guard","afterId":"cleric"}
{"op":"delay_turn"}
{"op":"gm_queue_delay_resume","id":"guard"}
{"op":"gm_schedule_initiative_event","id":"spell_end","label":"Shield spell expires","afterRounds":3,"atScore":22,"expireEffectId":"shield_effect"}
{"op":"gm_schedule_initiative_event","id":"trap_beep","label":"Trap beeps","afterRounds":2,"atScore":12,"requiresInput":true}
{"op":"gm_acknowledge_initiative_event","reason":"GM resolved the trap warning"}
{"op":"gm_cancel_initiative_event","id":"trap_beep"}
{"op":"gm_end_initiative"}
```

`gm_begin_initiative` accepts either a complete dictionary of results or a `roll:true` flag, which rolls d20 + the existing `initiative` stat for participants lacking supplied results. There is **no natural-1/20 automatic outcome** for initiative. Ties are initially ranked by initiative modifier and then registration order (the GM can reorder ties; a random tie roll-off is not yet automatic). Prefer rolling before encounter activation: activating first may already have processed a creature's opening turn-start effects; a late initiative start logs an advisory when it changes the opening actor.

`gm_set_initiative` updates a result without retroactively granting a turn, even during another unresolved combat operation. `gm_move_initiative_after` places a creature immediately after another in a same-score tie; again, no retroactive extra action. Any turn that is moved above a position already passed will wait until a following round rather than be granted a second turn. Scores are integers within a generous safety range ±1,000,000; the engine **never iterates through empty initiative values**. New spawned combatants remain `unranked` and do not receive a turn until the GM explicitly assigns them a count.

`delay_turn` is available only before spending that creature's actions. It removes the actor from automatic scheduling. The AI GM may use `gm_queue_delay_resume` to place it immediately after the **currently active creature's turn ends**; the delayed creature's new initiative position persists. It cannot interrupt the current action, and cannot receive an extra turn in the same round. This is the ordinary functional path for Delay. More unusual timing uses the GM's manual initiative edit commands.

## Clock and initiative deadlines

Combat turns are selected from the sorted roster, skipping empty counts. After the last eligible turn in the round, the encounter round increments and **worldRounds advances exactly once** via the existing ConditionAilmentGame hook. The world clock remains a separate source of elapsed time; Fast Forward is intentionally blocked while encounter initiative is active, preventing double-advancement. End initiative first to use Fast Forward.

Legacy conditions and effects retain their existing creature-turn duration semantics. **Opt-in initiative-count expiration** is available through `gm_schedule_initiative_event` with `expireEffectId`, for round-duration effects that must end before their original initiative count. Specify an event ID, positive number of rounds, and optional initiative count (defaults to current actor's count). An initiative deadline at a count without a creature still fires as the cursor passes it. For GM narrative decisions, `requiresInput:true` produces a pending decision, temporarily blocking additional combat commands until `gm_acknowledge_initiative_event`. Multiple same-time GM decisions are queued; each requires acknowledgement. Alerts appear near the initiative roster and Fast Forward controls.

Ending initiative converts unresolved effects and narrative events to world-clock expirations with the remaining whole-round duration. Sub-round initiative positions cannot be represented outside combat; this loses initiative-count ordering but preserves rounded six-second deadlines and allows further Fast Forward.

The roster, queued Delay decisions, timed events and alerts live in serializable state and participate in turn/round rollback. Old scenarios without a started initiative roster still use their historical combatant-array order for compatibility.

## Boundaries / future Pending Events

- Readied Actions and general arbitrary conditional event registrations **are not implemented in V3.20**; they are the next Pending Events milestone.
- Resolving several reactions nested inside other interrupts requires additional work; initiative edits during an interrupt do not change the identity of its current actor.
- An initiative alert requiring GM input is recognized while moving to the next actor; some legacy turn-start effects may already resolve before the GM acknowledges. Strict pre-turn pausing is left to the Pending Events/interrupt scheduler milestone.
- Initiative score edits made mid-round never replay completed turns. The GM remains authoritative for exceptional initiative retcons, simultaneous effects, tie decisions, and creature removal from combat.
- The initiative event API tracks deadlines, not execution of spells, traps or narrative actions. GM interpretation and the existing action/Free Mode systems handle the consequence.
- When all combatants Delay, the scheduler resumes the last actor on the next round and logs a GM warning rather than stalling indefinitely. This exceptional fallback is intended to be adjudicated by the GM.

## Relevant implementation files and verification

`initiative.mjs` extends `AttackRoutinesGame`, with targeted low-level round-transition hooks in `core.mjs`, `automation.mjs`, and `condition_ailment_game.mjs`. `scenarios.mjs` constructs `InitiativeGame`. `build_demos.py` bundles it as the last rules module before scenario fixtures. The same Time & Events panel contains initiative, scheduled initiative deadlines, world clock and Fast Forward. New tests are `initiative_tests.mjs` and `test_browser_v3_20.py`; historical V3.10–V3.19 tests should continue to pass.
