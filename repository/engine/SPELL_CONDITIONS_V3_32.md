# Spell conditions — V3.32

Current V3.40 combat guidance: read `COMBAT_MECHANICS_V3_40.md` (`kernel_reference` topic `combat`). It supersedes older notes about same-team full attacks, purely manual flanking, prone movement, helpless defenses and advisory-only source immunity. Generic descriptive timers remain advisory.
Spell payloads apply existing native conditions. The GM supplies verified conditions, descriptors, saving throws and duration. There is no spell database or additional condition engine.

```js
game.dispatch({op:'cast_spell',actor:'hero',spell:{
  name:'Synthetic condition example',level:2,casterLevel:5,
  castingTime:'standard',targets:['warden'],
  save:{type:'will',dc:15,onSuccess:'negates'},spellResistance:true,
  effect:{rounds:3,conditions:['shaken'],tags:['mind_affecting']}
}},'actor');
```

This is a fictional contract example, not a published spell. Normal casting spends its action and configured spell resource. `gm_resolve_spell` remains the explicit effect-only override.

## Contract

`effect.conditions` is a nonempty, unique list of standard IDs, excluding `dead`, `dying`, `stable`, `disabled`: HP/life transitions belong to vitality commands. `unconscious` is allowed, but does not change HP or imply waking rules. `effect.mods` becomes optional when conditions are present. Existing modifier-only payloads still work. Both share `rounds`, `dispellable` (default true) and `applyOnSaveSuccess` (default false).

| Gate | Behavior |
|---|---|
| Touch/ray | Apply after the existing attack resolver reports a hit; held charges preserve casting identity |
| Spell resistance | A failed declared SR check blocks the entire recipient payload |
| Successful `negates` save | Blocks damage, healing and ongoing effects, even with `applyOnSaveSuccess:true` |
| Other successful save | Conditions/modifiers require `applyOnSaveSuccess:true`; damage/healing retain their existing half/none behavior |
| `effect.tags` | Optional unique existing tags; matching immunity blocks the whole ongoing bundle, including numeric modifiers |
| Native condition immunity | Each condition additionally uses its existing condition-to-tag mapping; one immune condition does not block unrelated conditions |

Effect tags govern the ongoing bundle, not separate damage/healing. Classify damage through the existing packet fields. Descriptors, Fortitude exceptions and target eligibility are not inferred from spell names. Declare `tags:['sleep','mind_affecting']` when magical unconsciousness has those descriptors. Shaken already carries native fear/mind-affecting tags.

Conditions retain their catalog's automatic/partial/advisory support. `bleed` does not invent DOT damage; use the ailment engine for its amount and timing. Grappling, petrification and incorporeality do not acquire missing mechanics merely because a spell applied their label.

## Ownership and timing

Every spell condition remains an ordinary native instance and effect. Its `applicationKey` is the casting ID, and the effect retains `spellSource`. No second condition registry, timer or dispel queue exists.

Multiple sources retain independent durations and dispel ownership; the same condition's numeric penalties count once. Stronger fear/fatigue conditions supply their family's modifiers without destroying weaker sources. When the stronger one ends, a surviving weaker source becomes effective. Different conditions such as shaken and sickened still combine.

Spell declarations specify the resulting state. Repeated hits, contacts, overlapping casts and area pulses do not infer fear/fatigue escalation. The GM determines when a distinct exposure requires a stronger condition and declares it. Manual applications retain historical refresh/escalation within the manual source and cannot seize spell instances. Explicit GM `remove_condition` clears all sources of that condition on a target. Use a dispel/effect ID to end one source.

With ranked initiative, effects expire at the caster's initiative count using existing events. Without ranked initiative, normal round-duration behavior applies: target-turn expiration in the simple combat cycle, world-round expiration during Fast Forward. Ending initiative migrates deadlines. Refreshing a condition from the same casting replaces its deadline rather than leaving an orphan.

Dispelling a component selects the casting/recipient group and ends all its linked conditions, modifiers and deadlines. Other recipients/castings survive. Non-dispellable bundles still expire normally. Save/load and undo retain these native records. Daily spell capacities remain frozen.

## Persistent regions

`effectScope:'inside'` binds modifiers and conditions to occupancy and area lifetime. Exit removes only that area's effects. Same-round re-entry restores previously eligible parts without another save, damage roll or SR check. A condition originally blocked by immunity does not appear just because another component qualified. The existing `modifierEligible` map stores payload keys; old boolean numeric-modifier records remain readable.

`effectScope:'duration'` uses each effect's own timer, which can outlast exit or region removal. A live part is retained without stacking/resetting on each pulse. Later qualifying exposures can apply missing/expired parts. A successful repeat save does not automatically cure a prior condition; spell-specific recovery is GM adjudication.

Incapacitating entry conditions use the existing movement guard. Conditions preventing casting interrupt through the existing cast hook. Persistent effects retain provenance after a summoned caster departs.

## Workbench and verification

The spell editor has a fictional example, catalog selector, duration, additional tags, save-success option and add/clear controls. JSON remains authoritative. Results expose `conditions`, `effectImmunity`, `effectIds`, and the compatible first `effectId` (or null). Existing condition/dispel views show native state. Time controls remain in Time & Events.

`spell_conditions_tests.mjs` covers saves/SR/immunity, source ownership, manual coexistence, family precedence, dispels, initiative/world expiry, casting interruption, movement entry, re-entry eligibility, overlapping areas, source departure, touch/full attacks, repeated rays, reconstruction, undo and rollback. `test_browser_v3_32.py` exercises editor controls and visible condition/dispel results. See `TEST_RESULTS_V3_32.txt`.

Post-resolution concentration maintenance, automatic waking/cure triggers, suppression/antimagic, spell-specific exceptions and AI integration remain separate work.
