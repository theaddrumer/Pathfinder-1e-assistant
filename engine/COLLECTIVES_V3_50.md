# Swarms and troops — V3.50

Use the actual `swarm` or `troop` subtype. These now activate collective defenses, shared occupancy and dispersal. They are not interchangeable: troops retain their component creatures' critical/precision defenses; swarms gain critical, precision and flanking immunity. Both are unflankable.

## Import and configure

Keep `stats.size` as the square footprint width in five-foot cells. `collective.componentSize` and `stats.sizeCategory` describe the individuals and must agree when both are supplied. A configured collective defaults to a 2×2 swarm or 4×4 troop footprint if size is omitted. Swarms default to zero reach. Troop reach is still entered in cells.

Add this top-level field to a registered creature definition, or pass it as `profile` to `gm_set_collective` with an existing collective's `target` ID:

```json
{
  "collective": {
    "componentSize": "tiny",
    "attack": {
      "components": [{"damageType": "piercing", "dice": {"count": 2, "sides": 6, "bonus": 0}}]
    },
    "distractionDC": 13
  }
}
```

Use printed damage, including its already-calculated Strength bonus where applicable. The example is synthetic. `attack.components` uses the existing damage packet schema; `attack.metadata` can declare magic, damage types or DR bypass. No ordinary attack bonus is required. Optional `hiveMind:true` enables a swarm's targeting exception when it is intelligent and the effect is declared mind-affecting. `distractionDC` is swarm-only and should use the published DC; omit it for exceptional distraction requiring GM adjudication.

Legacy subtype-only saves remain readable. Configure their automatic damage before taking turns. Unknown swarm component size blocks weapon damage with an actionable error rather than guessing from its footprint. Imported printed totals are never recalculated.

## Damage and targeting

Fine/Diminutive swarms ignore weapon damage; Tiny swarms halve piercing/slashing weapon damage, with bludgeoning remaining effective. Magical weapon damage does not automatically bypass this. Ordinary energy damage is distinct from energy attached to a weapon hit. Troops have no general weapon immunity.

Area damage is amplified by 50%, after the save and before mitigation. Native area spells supply the flag automatically, including persistent areas. For a generic area or splash packet use `metadata.areaEffect:true`; do not also multiply its input damage. One packet still applies weapon DR once, temporary HP once and casting-damage checks once.

Native spells with `targets` are assumed to affect a specified number of creatures, and are blocked before saves, SR, healing or conditions. For a published effect that does not limit creature count, explicitly declare `spell.targeting:"unrestricted"`. A list of recipient IDs is not itself an area: this exception does not grant the area-damage multiplier. Classify rays from their actual spell rules. `gm_evaluate_effect` and damage metadata also accept `targeting:"creatures"`, `"area"` or `"unrestricted"`. Unrestricted generic GM condition/modifier commands remain adjudication tools, not inferred spell casting.

Creature-targeted dispels are blocked; explicitly selecting an ongoing spell effect remains possible. Counterspells target the casting. Targeted beneficial magic is subject to the same restriction as harmful magic.

## Turns, movement and reactions

The engine resolves configured automatic damage after completed ordinary movement, or when ending a stationary turn. Use `collective_attack` to spend a stationary move action and resolve it earlier. Ordinary melee/full attacks are not substitutes; separately configured ranged attacks still work. All creatures in the affected space/reach, including allies, are recipients. Walls and occupancy layers are respected; concealment and cover do not impose miss chances.

Timing contract: one ordinary automatic damage resolution per turn, recorded in the native action budget. Multiple move commands, five-foot steps, retry receipts and end-turn fallback cannot duplicate it. Interrupted movement waits for completion; incapacitation stops it. This conservative once-per-turn policy avoids treating every path fragment as another attack. Adjudicate exceptional timing explicitly rather than inventing extra ordinary actions. Forced movement, teleport and GM-free repositioning do not trigger automatic damage.

Swarms never make AoOs. Troops use the existing offered-reaction workflow and AoO allowance, inflicting automatic damage instead of rolling to hit. Swarms/troops can share occupied squares in either direction; they still cannot walk through solid obstacles. Incoming maneuver restrictions include on-hit Grab/Trip. Troops may initiate grapple; swarms may not.

At zero HP the unit disperses, ends its attacks and cannot be restored by ordinary healing. Nonlethal dispersal can recover once HP exceeds accumulated nonlethal damage. No member list or extra health pool is created. Distraction applies its save/one-round nauseated condition only after actual swarm damage, including damage absorbed by temporary HP. Casting and concentration maintenance in an active collective's affected space use the subtype's caster-level check, separately from normal concentration checks and AoOs.

## GM boundaries

Irregular formations, moving through gaps based on individual size, wind, exceptional distraction, additional poison/bleed/other riders and patience-dependent skill checks remain explicit GM adjudication using existing tools. Footprints remain squares; this update does not silently make whole walls passable. Elevation still requires the existing spatial rulings. Native generic area effects can represent area maneuvers, but ordinary targeted maneuver commands cannot bypass troop immunity.

Sources: [Swarm](https://aonprd.com/MonsterSubtypes.aspx?ItemName=Swarm), [Troop](https://aonprd.com/MonsterSubtypes.aspx?ItemName=Troop), [Hell's Rebels troop rules](https://aonprd.com/MonsterFamilies.aspx?ItemName=Troops), [Distraction](https://www.aonprd.com/UMR.aspx?ItemName=Distraction).
