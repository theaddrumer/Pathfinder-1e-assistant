# Common combat mechanics — V3.40

## Operating contract

Use ordinary `attack`, `full_attack`, `full_attack_next` and `charge` for attacks. Faction is no longer a targeting prohibition on any of these paths. Factions still determine automatic threat/allegiance relationships. Self-targeting, range, walls, action costs and incapacitation checks still apply. An unusual allegiance relationship remains a GM decision.

`gm_get_combat` optionally takes `target`. It returns verified combat configuration, active modes and source-specific immunities. `gm_get_flanking` takes `actor`, `target`, optional attack `index`; it is read-only. Focused `kernel_status(target)` includes the same combat information. Query these instead of guessing from feat names in prose.

## Verified capabilities, not inferred builds

Import `stats.combatProfile`, or configure an existing token with:

```json
{"op":"gm_set_combat_profile","target":"hero","profile":{"feats":["power_attack","furious_focus"],"acrobaticsRanks":3,"totalsExcludeCombatOptions":true}}
```

The profile is replaced as a whole. Its `feats` array grants only the supported capabilities. Supported IDs: `power_attack`, `deadly_aim`, `piranha_strike`, `combat_expertise`, `rapid_shot`, `point_blank_shot`, `vital_strike`, `improved_vital_strike`, `greater_vital_strike`, `furious_focus`, `critical_focus`. `cannotBeFlanked:true` is an explicit defensive declaration; conditional exceptions such as differences in rogue levels require a GM ruling/profile adjustment.

`totalsExcludeCombatOptions:true` is mandatory: it confirms the imported attack, damage and AC totals do not already include the options being automated. Do not enable automation on an already-adjusted Power Attack routine or preincluded Point-Blank Shot bonus. Import its ordinary totals first. The engine does not reverse-engineer a printed build or validate feat acquisition, prerequisite exceptions or class grants; the importer verifies ownership and continued availability. It does check that the capability is configured and that the declared action/weapon is compatible.

Per attack, declare `weaponHands:2` for a weapon wielded in two hands, `offhand:true` for an explicit off-hand attack and `lightWeapon:true` for a light weapon. Native attack-plan roles and natural secondary roles are reused. A primary natural weapon adding 1½ Strength uses `damageAbility:"one_half_str"`. Printed damage totals remain authoritative. These declarations determine conditional feat scaling, not an extra recalculation of printed Strength damage. `threatens:false` disables an attack's threat; an unarmed attack requires `threatens:true` to declare that it threatens. Ranged-only creatures do not threaten merely because their default reach field is positive.

## Selecting combat options

```json
{"op":"attack","actor":"hero","target":"foe","combatOptions":{"powerAttack":true}}
```

`combatOptions` is optional. Choose modes when starting an `attack` or `full_attack`; Power Attack, Piranha Strike and Deadly Aim also accept compatible `charge` initiation. Do not attach options to continuations. Modes expire at the beginning of the actor's next turn; selecting false is rejected, and omitting an option does not cancel an active mode. Native Pending Events and ordinary modifiers own the lifetime. Ending initiative or explicitly fast-forwarding outside initiative migrates remaining turn-based modes to one world-clock round. An extra granted action does not reset them.

| Option | Automated consequence and restriction |
|---|---|
| `powerAttack:true` | BAB-scaled melee attack/CMB penalty and weapon damage bonus; two-handed/primary 1½-Strength and offhand/secondary scaling. Touch attacks receive no bonus damage. |
| `deadlyAim:true` | BAB-scaled ranged attack penalty and damage bonus; no bonus damage on touch attacks. |
| `piranhaStrike:true` | Light-weapon melee damage/attack and CMB adjustment; offhand/secondary scaling. Cannot combine with Power Attack. |
| `combatExpertise:true` | BAB-scaled melee attack/CMB penalty and dodge AC; requires a melee attack/full-attack action. |
| `fightingDefensively:true` | Attack penalty and dodge AC; requires attack/full-attack action. Supplied Acrobatics ranks improve AC. |
| `rapidShot:true` | Full ranged-weapon attack only; inserts one highest-bonus shot and applies the attack penalty. Each shot uses normal ammunition/reaction/continuation handling. Once per round; do not import a routine already expanded for Rapid Shot. |
| `vitalStrike:1`, `2`, or `3` | Ordinary `attack` action only, with the corresponding configured feat. Adds one/two/three sets of weapon dice, without multiplying those extra dice on criticals or repeating static bonuses, precision or elemental dice. |

`total_defense` takes `actor`, costs a standard action, grants dodge AC, and blocks AoOs until the next turn. It cannot combine with fighting defensively or Combat Expertise. Dodge modifiers do not contribute to flat-footed AC or while the defender loses its Dexterity bonus. The profile's Acrobatics field is ranks, not its total skill modifier.

Point-Blank Shot is automatic within 30 feet for configured ranged attacks; attack/damage effects are applied once. Critical Focus affects confirmation only. Furious Focus removes the Power Attack attack penalty only on the first actual attack of the actor's own turn with a two-handed weapon; it does not erase the CMB penalty or improve later attacks/AoOs. Misses count as attacks. No selections are inferred from NPC tactics: the GM decides when to use an option.

Manyshot, feat chains outside this list, variant rules, special-action Vital Strike exceptions and prerequisite/build management remain outside this release.

## Flanking and precision

Automatic flanking uses a line between occupied-square centers crossing opposite borders/corners of the defender's footprint. A supporting creature must actually threaten the defender, with positive reach and a usable melee attack. Walls and incapacitation matter. Large footprints are supported. The check is recomputed for every strike, not cached across movement or a full attack.

If the attacker, target or relevant supporting creature has an elevation annotation, that geometry is not inferred. A GM-channel attack can supply `flanking:true` or `false` for that strike. Automatic planar flanking remains possible with an independent untagged eligible partner. A configured unflankable defense takes priority. Position changes require a fresh ruling; a full-attack first-strike ruling is not copied onto all later strikes.

Flanking supplies its attack bonus and automatic eligibility for configured precision dice. Helpless targets also enable precision (ranged attacks limited to 30 feet). Existing concealment, precision immunity and fortification checks still apply. `precisionEligible:false` explicitly suppresses precision; true supplies GM-verified eligibility for other circumstances. No precision dice are invented if the attack lacks a `precision` specification. Generic precision effects with different eligibility rules need that explicit adjudication. Higher ground and squeezing remain GM-declared modifiers.

## Prone and helpless conditions

`stand_up` takes `actor`: pays one move action, offers native AoOs while the creature is still prone, then removes prone only if the creature can finish. A resulting attack rider is resolved before continuation. No second action is charged on resume.

`crawl` takes `actor` and a one-cell adjacent `path`: pays one move action, retains prone, and offers AoOs both for leaving and entering threat, at most once per enemy for that crawl. New entering threats resolve from the entered square. Ordinary movement/steps/charges while prone reject; use standing or crawling. Terrain costs still apply to the five-foot allowance. Special crawling, Acrobatics avoidance and alternative stand-up abilities use explicit GM adjudication.

The complete Kernel now treats paralysis as effective Strength/Dexterity 0, and helpless/unconscious creatures as effective Dexterity 0. AC uses the existing supplied flat-footed defense plus the effective Dexterity penalty, rather than guessing the printed Dex/dodge breakdown; touch AC removes the same lost positive portion. Melee attacks get the helpless adjustment. Conditions do not overwrite original abilities or defenses; removal restores them. Imported non-AC statistics still require appropriate abilityLinks for ability-dependent recalculation.

Purely mental actions while paralyzed, coup de grace, falling/swimming consequences, and moving through paralyzed bodies remain explicit GM adjudication. This is expanded partial coverage, not a declaration that every condition consequence is automatic.

## Source-specific temporary immunity

After resolving an ability's initial save AND consequences, grant its immunity if the actual ability calls for it:

```json
{"op":"gm_grant_source_immunity","target":"hero","source":"foe","ability":"despair","count":24,"unit":"hour"}
```

`ability` is a stable identifier, not interpreted prose. `source` identifies this particular live creature. The native Pending Event holds the target/source/ability tuple and expiration. Regranting refreshes without shortening a longer immunity; other sources/abilities remain independent. Generic Pending Event cancellation can remove an immunity early with GM authority.

For repeat exposure, inspect `gm_get_combat`, or use a source-aware operation:

```json
{"op":"save","target":"hero","save":"will","dc":16,"source":"foe","ability":"despair","tags":["fear","mind_affecting"]}
```

A matching immunity returns `skipped:true` without rolling. `apply_condition` accepts the same `source`, `ability` and optional `tags` and skips a matching application. `gm_evaluate_effect` accepts source/ability for a pure preflight check. If a save returns skipped, STOP: do not apply consequences or reroll through an unidentified command.

This cannot recognize an ability whose source/identifier was omitted. Plain saves, existing spell/ailment payloads and arbitrary GM damage retain their existing semantics; explicitly preflight source immunity before those paths. A descriptive conditional timer remains advisory. The GM still decides who sees an aura, when exposure occurs, and whether immunity follows success, failure or either. This helper is generic; no mummy-specific rules were added. Do not recycle a source instance ID for a different creature while related immunity records remain.

## Rule references

- [PF1e combat: flanking, helpless defenders, crawling, defensive actions](https://legacy.aonprd.com/coreRulebook/combat.html)
- [Conditions](https://legacy.aonprd.com/coreRulebook/glossary.html)
- [Power Attack](https://aonprd.com/FeatDisplay.aspx?ItemName=Power%20Attack), [Piranha Strike](https://aonprd.com/FeatDisplay.aspx?ItemName=Piranha%20Strike), [Deadly Aim](https://aonprd.com/FeatDisplay.aspx?ItemName=Deadly%20Aim)
- [Combat Expertise](https://aonprd.com/FeatDisplay.aspx?ItemName=Combat%20Expertise), [Acrobatics](https://aonprd.com/Skills.aspx?ItemName=Acrobatics)
- [Rapid Shot](https://aonprd.com/FeatDisplay.aspx?ItemName=Rapid%20Shot), [Point-Blank Shot](https://aonprd.com/FeatDisplay.aspx?ItemName=Point-Blank%20Shot)
- [Vital Strike](https://aonprd.com/FeatDisplay.aspx?ItemName=Vital%20Strike), [Improved](https://aonprd.com/FeatDisplay.aspx?ItemName=Improved%20Vital%20Strike), [Greater](https://aonprd.com/FeatDisplay.aspx?ItemName=Greater%20Vital%20Strike)
- [Furious Focus](https://aonprd.com/FeatDisplay.aspx?ItemName=Furious%20Focus), [Critical Focus](https://aonprd.com/FeatDisplay.aspx?ItemName=Critical%20Focus)
