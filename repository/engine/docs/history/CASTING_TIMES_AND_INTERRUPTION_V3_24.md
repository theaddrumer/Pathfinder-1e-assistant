> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# V3.24 — Casting times and interruptions

This release continues V3.23's magic milestone. The kernel owns action costs, casting progress, concentration checks, damage, and completion eligibility. The GM chooses targets, areas, tactics, and unusual interpretations. No tactical or narrative AI has been added.

## Casting time

Existing `standard`, `move`, `swift`, and `full_round` casting times remain supported. `full_round` spends a full-round action and resolves during that action. New `1_round` waits until immediately before the caster's next turn. Durations can also be expressed as `{"count":3,"unit":"round"}`, `{"count":1,"unit":"minute"}`, or hour/day equivalents, bounded to 100000 rounds.

Long casting spends a full-round action at initiation and on each subsequent casting turn. `continue_spell` pays the next action. Ending a required turn without continuing loses the spell; replaying a continuation cannot buy extra progress. A paid full-round casting action still permits a legal five-foot step. Other spells cannot be cast while concentrating on the unfinished casting. Ordinary action restrictions from conditions remain in force.

A completed long cast enters `ready` immediately before the next caster turn. Normal turn-start effects and actions wait while the GM chooses its targets or area using `complete_spell`. Completing the spell does not spend an action from the new turn. Targets supplied at initiation are provisional: omit completion targeting to confirm them, or supply replacement `targets` or `area`. Other spell fields cannot be rewritten by the completion command. Invalid completion inputs leave state and RNG unchanged.

```json
{"op":"cast_spell","actor":"hero","spell":{
  "name":"Synthetic delayed force effect","level":1,"casterLevel":5,
  "castingTime":"1_round","concentrationBonus":8,
  "targets":["warden"],"components":[{"damageType":"force","amount":3}]
}}
```

After the required turn boundary:

```json
{"op":"complete_spell","actor":"hero","targets":["warden"]}
```

For a longer casting, use `{"op":"continue_spell","actor":"hero"}` on each intermediate turn. Cancel with `{"op":"cancel_spell","actor":"hero"}`. Actor commands control the active creature; a GM can complete/cancel another creature's eligible casting.

## Damage and concentration

Damage resolved through the kernel automatically checks an unfinished casting. The DC uses damage after protections; damage absorbed by temporary HP still counts. Each distinct attack receives a separate check. A weapon hit's physical, precision, and bonus energy damage are grouped into one check, including a ranged attack resumed after its own interruption. Multi-component packets likewise produce one check. Fully prevented damage does not roll concentration.

Registered damage-over-time ailments retain their actual last damage on the existing ailment instance. Ongoing damage uses half that amount for concentration, with normal rounding. Its last finite pulse no longer supplies an ongoing distraction. Initial casting and later pulses are covered without checking the same pulse again during continuation. Imported ailments lacking a recorded prior damage amount require GM input for that first historical amount. Incapacitation still breaks casting even when no concentration roll is needed. Entangled casting also receives its normal check.

For an externally established ongoing-damage distraction, this checks concentration without applying HP damage again:

```json
{"op":"gm_interrupt_spell","actor":"hero","kind":"continuous_damage","damage":9}
```

Unusual distractions can use `{"op":"gm_interrupt_spell","actor":"hero","dc":19,"reason":"Distracting spell: save DC 18 plus spell level 1"}`. Use `kind:"break"` with a reason for a GM-adjudicated unconditional interruption. The older `gm_check_concentration` remains a standalone check; it does not cancel an active casting by itself.

## Casting opportunity attacks

A provoking cast retains `pendingSpellCast`. `gm_resolve_casting_aoo` accepts an attacker and a boolean choice; taking the opportunity uses that creature's real AoO allowance and the existing attack/damage/rider pipeline. Remaining attackers are exposed individually. Resolve any resulting rider or Readied Action before resuming.

```json
{"op":"gm_resolve_casting_aoo","actor":"warden","take":true}
```

After every offered opportunity is handled, `{"op":"gm_continue_spell"}` resumes. The old `{"op":"gm_continue_spell","aooResolved":true}` remains an explicit GM confirmation for externally adjudicated opportunities and is logged as such. Its legacy `damageTaken` field is only for damage not already processed through the kernel; it is one external damage event, not a sum of unrelated hits. Do not report kernel damage again. For several external damage events, use separate `gm_interrupt_spell` checks with each event's DC before confirming.

Swift casting does not provoke. Allies, down creatures, and creatures without available AoOs are excluded. The standard existing AoO attack is used; selecting alternative attack profiles for casting AoOs remains future work.

## Time, inspection, and undo

Outside initiative, Fast Forward treats the interval as uninterrupted casting activity. Casting completion is included in the existing `clockDeadlines` index; no second time-event queue is created. Fast Forward processes earlier protections, ailments, and recovery at their normal times, then pauses at casting completion for targeting. A GM event can stop time earlier. Partial downtime retains paid progress, and continuing in turns must pay the next action. A failed casting removes its completion deadline automatically.

`gm_get_spellcasting` reports provoking casts, active progress, and the last 30 outcomes. `gm_get_lifecycle` includes that view plus completion warnings and world-clock deadlines. Combat completion is anchored to the caster's consecutive turns; it is not a separately scheduled generic initiative event. Both the spell panel and Time & Events summary expose current progress. State, RNG, casting progress, and damage are included in existing undo snapshots. Completing a cast before turn start does not count as an action on that turn.

The engine blocks Delay and begin/end initiative while a casting is unfinished, so these operations cannot silently grant progress or discard an interruption. Explicit GM initiative edits are retained; unusual retiming needs adjudication. Converting a running ritual between encounter and downtime initiative modes remains future work.

## Shared implementation

`magic.mjs` remains the active `MagicGame extends PendingEventsGame`; no parallel spell interpreter was added. Native ailment state records ongoing damage. Packet and modifier preflight now reuse read-only validators from their existing owners, rejecting malformed long-cast payloads before action expenditure. The native attack pipeline has a bounded begin/end damage-group hook so resumed attacks share the same concentration behavior. Pre-turn and time checkpoints extend existing lifecycle paths. All executable input remains data; no user-supplied scripts are evaluated.

## Remaining magic work

Touch spells/holding charges and ray delivery through a casting action; spell slots and preparation expenditure; counterspell and dispel operations; sustained concentration after a spell has already resolved; components, silence, grappling/pinning specifics, arcane spell failure, metamagic, and unusual spell-specific rules. General nested interruption execution and persistent area properties also remain planned. `gm_resolve_spell` is still a logged explicit override. Ordinary casting validates the supplied definition, but cannot yet certify spell access, range, slots, or components absent those subsystems.

## Rules reference and verification

Rules checked against the [Core Rulebook PRD: Magic](https://legacy.aonprd.com/coreRulebook/magic.html), particularly Casting Time and Concentration, on 2026-10-16. The sample spell is synthetic.

Run `python3 build_demos.py`, then `python3 run_regressions.py --browser`. Browser checks require Python Playwright and an installed Chromium; `BROWSER_EXECUTABLE` can select an existing installation. `BROWSER_ARGS` accepts an optional JSON argument array. `casting_tests.mjs` covers timing, costs, completion ordering, retargeting, atomic errors, injury/ongoing damage, opportunity attacks, multiple casters, Fast Forward, serialization and undo. `test_browser_v3_24.py` exercises the corresponding workbench controls. Exact final results are bundled in `TEST_RESULTS_V3_24.txt`.
