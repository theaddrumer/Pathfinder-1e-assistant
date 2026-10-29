> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# V3.9.1 — Broken, improvised weapons, and materials

This is an incremental expansion of the V3.9 attack-definition layer. It is not a full equipment system. The authoritative V3.9 data and controller/GM role boundary are preserved. Definitions are validated rather than silently accepted.

## Design

An attack's **kind** describes how it is used. `attackKind:"improvised"` is the new special attack classification. It normally imposes -4 on attack rolls, unless `improvisedProficient:true` is explicitly registered (for a relevant exception). Its critical-threat profile is 20/x2, but the current attack executor **does not yet resolve critical confirmation**. Improvised weapon dice and physical types are supplied by the importing AI/GM based on a comparable weapon; the engine will not guess whether a frying pan is a club, mace, or other weapon.

An item's **condition** is an independent field. `itemCondition:"broken"` imposes -2 to attack and damage rolls and changes its critical profile to 20/x2. Broken + improvised stack in the default case. A condition belongs to the specific weapon profile, so a second intact weapon is unaffected. Broken armor, shields, and tools still need separate item/AC/skill resolution. Updating a weapon's condition dynamically through an equipment inventory is a *future* milestone; V3.9.1 imports its current status as part of the attack profile.

An attack's **material** is independent of both kind and condition. `weaponMaterial` accepts:

| Value | Executable handling | Remaining gaps |
|---|---|---|
| `steel` | No material bypass | Ordinary/reference default |
| `alchemical_silver` | Silver DR bypass; -1 damage on slashing/piercing weapon hits (minimum 1 if damage positive) | Metal-only manufacture restrictions, cost |
| `cold_iron` | Cold iron DR bypass | Cost/enchantment-cost rules |
| `adamantine` | Adamantine DR bypass | Object hardness <20 bypass requires object hardness system |
| `mithral` | Counts as silver for DR | Weight and armor handling; masterwork already in imported totals |

The material's DR tags are applied *when the attack happens*; inherited alignment bypass and weapon enhancement bypass are combined independently. Imported attack totals are authoritative: masterwork/quality bonuses already present in printed statblocks are never added again.

Metadata for GM damage packets can include `weaponMaterial`. It supplies material DR bypass but **does not automatically calculate weapon penalties or critical effects** because a manually entered packet amount is treated as already adjudicated. Ordinary weapon attacks apply alchemical silver damage penalty automatically.

## Example creature attack entries

```json
{
  "attacks": [
    {"label":"Broken cold iron sword", "attackKind":"manufactured", "itemCondition":"broken", "weaponMaterial":"cold_iron", "damageTypes":["slashing"], "damageDie":8},
    {"label":"Chair leg", "attackKind":"improvised", "weaponMaterial":"steel", "damageTypes":["bludgeoning"], "damageDie":6},
    {"label":"Silvered dagger", "attackKind":"manufactured", "weaponMaterial":"alchemical_silver", "damageTypes":["piercing"], "damageDie":4}
  ]
}
```

These entries belong inside `stats` of a registered creature. The AI is responsible for identifying the weapon's improvised damage profile and any applicable proficiency exception. For attack totals, supply a baseline without the newly declared broken/improvised penalty so the engine doesn't count it twice. If the source's printed attack value already includes those penalties, declare an appropriate correction in the offset or leave the status for inspection and manually adjudicate; do not double-apply.

## Coverage / next steps

Still missing: confirmed critical hits, dynamic equipped-item inventory and item-HP damage, ranged geometry and improvised thrown range increments, hardness/objects, miscellaneous special materials, and automatic implementation of all the material restrictions/secondary qualities. Broken armor/shield/tool penalties remain unimplemented. These are intentionally not claimed as functional.

The attack inspector (`gm_describe_attack`) exposes kind, material, condition, effective attack/damage penalties, critical profile with `implemented:false`, material advisories, and existing optional rider descriptions. `list_trait_library` includes `weaponMaterials` and `itemConditions`, so clients do not need a separately hardcoded UI list.

Tests: run `node weapon_quality_tests.mjs` and the existing `*_tests.mjs` suite; browser verification is `python test_browser_v3_9_1.py`. Open `index.html` or the exported standalone demo; select **Load material / broken / improvised examples** to register and inspect five examples.

## Rule references

- PF1e Core Rulebook equipment, Improvised Weapons: https://legacy.aonprd.com/coreRulebook/equipment.html
- PF1e Core Rulebook glossary, Broken: https://legacy.aonprd.com/coreRuleBook/glossary.html
- PF1e Ultimate Equipment, Special Materials: https://legacy.aonprd.com/ultimateEquipment/armsAndArmor/materials.html
