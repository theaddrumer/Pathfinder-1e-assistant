# Maintained concentration — V3.33

Post-resolution concentration now uses one native Pending Event per maintained casting. It links the existing spell effects and fixed regions by casting identity. No new action pool, slot counter, effect registry or timer engine is introduced.

## Payload and commands

```js
game.dispatch({op:'cast_spell',actor:'hero',spell:{
  name:'Synthetic maintained effect',level:2,casterLevel:5,
  targets:['warden'],save:{type:'will',dc:15,onSuccess:'negates'},
  concentration:{maxRounds:5,afterRounds:1},
  effect:{conditions:['dazzled']}
}},'actor');
```

This fictional example specifies mechanics, not a published spell. Use the real spell's verified parameters.

`concentration:{}` means unlimited maintenance with no lingering duration. Optional `maxRounds:1..100000` is an absolute maximum for the complete lifetime, including a tail. Optional `afterRounds:0..100000` is the duration after voluntary stopping, missed upkeep, failed concentration or incapacitation, truncated by that maximum. Do not infer either value from caster level. Expiration at the absolute maximum ends the whole spell without starting another tail.

Concentration owns duration: omit `effect.rounds` and `persistent.duration` (null is also accepted). Ordinary non-concentration payloads retain their existing duration requirements. Supported payloads are native condition/modifier bundles and fixed persistent regions; touch/ray delivery, dispel/counterspell payloads, and instantaneous-only spells cannot declare maintained concentration. A narrative effect may use `effect:{mods:[]}` as an explicit tracked marker; its narrative behavior remains GM-owned.

| Command | Meaning |
|---|---|
| `maintain_concentration`, `actor` | Spend that active creature's standard action for upkeep; once per turn |
| `stop_concentration`, `actor`, optional `reason` | Stop without spending an action; apply declared tail |
| `gm_interrupt_spell`, `actor`, `dc`, `reason` | Existing check-and-terminate command now also handles a maintained spell |
| `gm_interrupt_spell`, `kind:'continuous_damage'`, `actor`, `damage` | Existing contextual half-damage check; does not deal damage again |
| `gm_interrupt_spell`, `kind:'break'`, `actor`, optional `reason` | Explicit GM interruption, including declared tail |
| `gm_get_spellcasting` | Pure view; `maintenance` includes maintained/lingering event IDs and upkeep status |
| `gm_cancel_pending_event`, concentration event `id` | Explicit GM removal of the entire linked spell immediately, without a tail |

Actor commands are limited to the active creature. GM adjudication retains its authority but upkeep still requires the active creature and a real available standard action. Generic event triggering is forbidden for this native event. A lingering event cannot resume concentration.

## Actions and interruption

The initial casting action covers its resolution turn; subsequent turns require upkeep. Completion of a long cast immediately before a deferred turn start also covers that turn. Movement and other permitted actions remain available. Maintenance neither provokes casting AoOs nor spends another spell resource. It does not reroll or reapply the spell payload.

Missing upkeep ends concentration when that turn ends; Delay uses the same turn-end hook. This is the calculator's declared timing convention: explicitly stop first if an earlier within-turn ending matters. A new ordinary casting, including a swift spell, is rejected until concentration stops. A readied counterspell cannot execute while its caster is maintaining another spell. An explicit GM effect-only resolution remains an override.

Damage reuses the existing casting concentration path: one check per packet or complete weapon hit after mitigation, including temporary HP absorbed. Fully prevented damage causes no injury check. Registered continuous damage uses the existing half-last-damage logic, avoiding a second check for its individual components. Incapacitation ends maintenance. Entanglement and registered continuous damage also use existing checks during upkeep. Other distractions—weather, contextual grappling, a nondamaging interfering spell, special exceptions—remain explicit GM checks rather than invented automatic rules.

The underlying PF1e rules are documented in the [Core Rulebook duration rules](https://legacy.aonprd.com/coreRulebook/magic.html) and [concentration rules](https://aonprd.com/Rules.aspx?ID=205). In particular, maintenance uses a standard action without provoking; another spell cannot be cast while concentrating. Concentration checks use the existing caster-level/ability calculation rather than a new save mechanic.

## Lifetime and ownership

The native event's `payload.phase` is `maintaining` or `lingering`. Its payload contains the minimal spell check parameters, casting provenance and whether upkeep is due. `focusFor` selects an active casting or the native maintenance payload so both use `checkCasting`, `castingDamage` and `checkContinuousCasting`. It does not create a second casting registry.

Linked effects have no individual countdown while the concentration event owns their lifetime. A maximum uses the existing initiative or world-clock deadline. Stopping with a tail changes the same event to lingering and sets its existing duration; no second event is created. The tail starts at the current initiative count, or current world round outside ranked initiative, and is clamped to the original maximum. Ending ranked initiative migrates the native timer normally.

Recipient-specific dispelling removes that casting's effects on the selected recipient. Other recipients remain. Dispelling/removing the final effect or region ends the now-empty maintenance record. Ending concentration removes all remaining effects and regions for its casting ID, preserving other castings. Area exit/re-entry still follows occupancy and eligibility rules. An area pulse that breaks its own caster's concentration cannot leave a newly applied orphan condition behind. Instantaneous damage/healing already resolved is never reversed.

Maximum/tail clock expiration occurs before same-time affliction checks and area pulses. Summoned caster departure removes the complete maintained spell, consistent with existing source cleanup. State reconstruction and undo preserve native ownership, upkeep and deadlines.

## Downtime and workbench

Fast Forward while a caster maintains a spell requires explicit `maintainConcentration:true` on `gm_advance_time` or `gm_advance_to_event`. This declares maintenance during elapsed time; it does not invent rest, concentration exceptions or actions for an AI. Existing hazard checks and maximum deadlines still resolve. After elapsed time, ordinary turn actions are reset as in the existing long-casting downtime path, and the next combat turn must pay its own upkeep. Lingering spells need no maintenance declaration.

All configuration, upkeep, stopping, distraction checks and active status are grouped in Time & Events. The duration helper edits the existing spell JSON and removes conflicting fixed durations. The Fast Forward checkbox supplies the explicit downtime declaration. No AI connection or spell database is added.

## Verification and next work

`concentration_tests.mjs` covers actions, slots, damage grouping, temporary HP, continuous damage, incapacitation, tails/caps, Fast Forward, partial dispels, fixed regions, source departure, self-breaking area pulses, deferred casting completion, save/load, undo, validation and authority. `test_browser_v3_33.py` checks the offline controls. See `TEST_RESULTS_V3_33.txt` for the full run.

The user plans to provide a separate instance's V3.30 critique after this mechanical pass. Review that critique against the current implementation before UI cleanup or integration work; some observations may already be superseded. Spell-specific narrative behavior, suppression/antimagic, exceptions and AI/VTT integration remain outside this release.
