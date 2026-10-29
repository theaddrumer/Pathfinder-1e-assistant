> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# V3.14 — On-hit special attacks and condition/affliction reuse

This is an incremental **offensive** release. Armor, concealment, cover, miss chances, spell resistance, and general ranged attacks remain separate future defensive/targeting work. The AI GM still decides tactics; the engine resolves validated combat state.

## Attack entry fields

The imported attack data can include the following in `stats.attacks[]`:

| Rider | Imported data | Behavior |
| --- | --- | --- |
| `trip` | `riders:["trip"]` | An optional free Trip CMB vs CMD after the specified natural attack hits; no provoking AoO and no counter-trip if the maneuver fails. Uses size/leg/flight trip eligibility and target CMD. |
| `poison` | `riders:["poison"], poisonId:"registered_id"` | Automatically exposes the hit creature to an already-registered **injury** poison when the attack's weapon damage penetrates defenses (at least 1 HP). Uses existing saves, immunity, onset, frequency, cure, and damage/drain handling. |
| `bleed` | `riders:["bleed"], bleedAmount:3` | Starts a fixed HP-bleed recurring affliction, with no immediate bonus damage; ticks at the beginning of the victim's next turn. Uses existing ailment and condition state; stronger same-kind bleed supersedes lesser. |
| `paralysis` | `riders:["paralysis"], paralysisDC:17, paralysisRounds:3` | Attempts a Fortitude save on a successful hit, honors inherited paralysis and Fortitude immunities, applies the Paralyzed condition on failure. |

The previous `grab` and `constrict` riders remain functional. A single qualifying attack may include multiple riders. Any `trip` and `grab` choices are queued sequentially, not made automatically. Declining costs no new action or extra attack roll. Automatic riders fire after base hit/damage resolution. A fatal hit does not continue imposing additional statuses on a defeated creature.

The registered poison definition must exist when the attack is actually executed, not necessarily when the creature template is first registered. A missing poison ID causes a validation failure before rolling or damaging the target. Injection and exposure must not happen when DR prevented all of the physical attack's hit point damage.

## Interaction with existing statuses

Bleed uses a registered `dot` ailment plus a `bleed` condition, not a separate new damage type. Removing or curing the linked ailment also removes the linked bleed condition. The existing `cure_ailment` GM command terminates it; a GM may also use `remove_condition` with `bleed`. Same-kind HP bleed uses the higher fixed number rather than stacking, per the ordinary PF1e rule. Variable-die bleed, ability-score bleed, stacking exceptions (such as the *wounding* property), Heal checks, and automatic interruption of bleed by magical healing are **not automated** yet. The GM may adjudicate those exceptions with Free Mode.

Poison's ongoing effects and their cure remain in the existing affliction engine; disabling a poison does not retroactively heal accumulated ability damage. Unusual delivery modes (contact, ingested, etc.) remain under the GM's existing explicit `expose_ailment` operation. Unusual injury-delivery overrides must also be GM adjudicated.

Paralysis uses the existing partial `paralyzed` condition implementation, not a declaration that every helplessness, spellcasting, or targeting consequence has been completed.

## Important limitations

- Pull, Push, Energy Drain, other on-hit abilities and mixed/complex rider-trigger chains remain unfinished. These retain explicit descriptive definitions and are not misrepresented as executable.
- Only two optional rider choices (`trip`, `grab`) are currently queued. A truly nested arbitrary interrupt scheduler, especially a new reaction originating during an unresolved other reaction, remains future work.
- Ranged attack execution, attack miss chances, spell resistance, direct spell targeting and saves, and additional equipment-derived defenses are still unfinished.
- The `bleedAmount` field covers **fixed HP bleed only**, deliberately not every bespoke monster bleed subtype.

## Browser test

Open `index.html`, activate, select **Load offensive rider examples**, register the injury venom under Ailments first, then register/spawn the supplied Fictional Rider Beast. Its three attack entries demonstrate Trip, Bleed and Poison + Paralysis. A GM can still issue direct commands through the engine API. `test_browser_v3_14.py` tests the browser workflow.

## Examples

```json
{"label":"Bite","naturalAttack":"bite","damageDie":6,"riders":["trip"]}
```

```json
{"label":"Claw","naturalAttack":"claw","damageDie":6,"riders":["bleed"],"bleedAmount":3}
```

```json
{"label":"Sting","naturalAttack":"sting","damageDie":4,"riders":["poison","paralysis"],"poisonId":"rider_venom","paralysisDC":17,"paralysisRounds":2}
```
