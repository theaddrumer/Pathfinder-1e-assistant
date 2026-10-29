> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# V3.7 — Mechanical Foundations: defense layers, effect tags, calculated DCs, inherited traits

This release tests reusable PF1e mechanics as **data**, not monster-specific JavaScript. It is not a complete Pathfinder 1e rules implementation, monster importer, or AI GM. The decision-maker remains external; commands are the GM/controller interface.

## Modules and operations

`trait_library.mjs` declares the 13 recognized baseline creature types, a **selective** subtype library (`devil`, `demon`, `incorporeal`, `elemental`, `fire`, `cold`, `mindless`), a validated effect descriptor vocabulary, and which defenses can currently be applied. Many type entries intentionally contain advisory text rather than fully executable rules. `foundations.mjs` extends the V3.6.1 game to inherit those data, validate additions and exceptions, and centralize damage/condition/ailment gatekeeping.

`createScenario()` now constructs `FoundationsGame`, so historical demonstrations exercise the extended resolver too. Older mechanics, registered abilities, and condition entries remain intact. The main `index.html` GM workbench adds a foundation test panel, while `tests.html` remains the historical fixture gallery.

New GM commands:

- `gm_resolve_damage`: `{ "op":"gm_resolve_damage","target":"devil_1","amount":20,"damageType":"acid","cause":"environment","metadata":{} }` applies the strongest qualifying energy resistance or immunity. For weapon attacks, pass `cause:"weapon"` and descriptors such as `metadata.magical`, `metadata.ghostTouch`, `metadata.weaponTags:["silver"]`.
- `gm_evaluate_effect`: `{ "op":"gm_evaluate_effect","target":"devil_1","tags":["poison"] }` reports immunity without rolling or inflicting anything. For eligible construct/undead Fort saves, add `save:"fort"` and the context flags `worksOnObjects` or `harmless`.
- `gm_calculate_dc`: `{ "op":"gm_calculate_dc","actor":"devil_1","abilityId":"infernal_presence" }` returns calculated/published values and discrepancy advisories.
- `list_trait_library` reads the recognized type, subtype and effect vocabularies.

All modifying and adjudicating foundation commands are GM-only, retain rollback on error, and do not spend creature actions. Existing ordinary attacks and generic GM damage rolls use the same defense resolver. Imported attack metadata may be supplied via `stats.attackTraits`. **Without explicit magical-weapon metadata, a weapon is presumed mundane.** Don't infer enchanted weapons from a printed attack bonus.

## Definition format and DC formulas

```json
{
  "id": "fictional-devil-v1", "name":"Infernal Test Subject",
  "creatureType":"outsider", "subtypes":["devil"],
  "stats":{"maxHp":48,"hitDiceCount":8,"bab":8,"str":16,"cha":20,
    "statTotals":{"ac":20,"touchAc":11,"flatFootedAc":19}},
  "dcDefinitions":{"infernal_presence":{
    "basis":"half_hd","ability":"cha","published":19
  }}
}
```

This is an **illustration**; supply other stats required by the creature importer as appropriate. All three published ACs remain authoritative. The Devil subtype supplies fire/poison immunity and acid/cold resistance 10; no numeric bonuses are added a second time.

DC `basis` values: `half_hd`, `half_racial_hd`, `class_level` (requires `progression.classLevels` and `className`), `bab`, `spell` (requires `spellLevel`), and `fixed`. The base defaults to 10; a formula may specify `numerator`, `denominator`, `ability`, `bonus`, `base`, and optional `published`. Missing HD or class level is an error, not silently zero. Fixed DCs are not automatically recomputed. On ability damage, temporary modifiers and drain, the calculated DC updates through the existing ability-score subsystem. A mismatch with a printed DC is a **warning**, not automatic replacement of the printed number.

For undead, Constitution-based DCs use Charisma; for constructs lacking Constitution, such DCs use +0. **Full absent-ability-score representation and retroactive HP/Fort recalculation for inherited type rules are not complete**: imported printed totals remain authoritative and carry explicit dependencies. The type catalog does **not** reconstruct monster advancement or HD-based class features.

## Defense resolution and stacking

1. Registered event subscribers get the existing `damage_before` notification, including cancellation (e.g. Black Pudding Split).
2. Tagged inherited/explicit immunity is checked.
3. Incorporeal checks block normal nonmagical weapons, halve qualifying magical corporeal sources (rounding down), and exempt force, ghost touch and incorporeal sources.
4. For energy damage, the highest **applicable** resistance applies once, not the sum.
5. For ordinary physical weapon damage, check each DR source's bypass descriptor list separately, then use the highest DR source not bypassed. DR doesn't automatically apply to spells or energy damage.
6. Resolved damage is applied to HP and logged with its mitigation steps.

A definition can add `protections:{immunities:["fire"],resistances:{cold:20},dr:[{"amount":5,"bypass":["silver"]}]}`; `traitExceptions:{suppressImmunities:["fire"],suppressResistances:["cold"]}` explicitly removes inherited properties for a particular creature. Such source exceptions are important for templates and unusual monsters. Unsupported subtypes or malformed data are rejected rather than falsely accepted as executable abilities. DR bypass entries use **OR** semantics (`silver` OR `magic`); mixed AND/OR DR, weapon enhancement equivalences (+3/+4/+5), hardness and precision-damage exception details still require GM interpretation.

### Conditions and ailments

Registered Shaken/Frightened/Panicked carry mind-affecting/fear tags when applied as baseline conditions; immune creatures are not affected. Standard Poison/Disease ailment exposure is checked against inherited immunity before rolling an exposure save. Direct ability damage and drain also respect the corresponding known type immunities. The full effect-delivery metadata of an arbitrary spell or attack rider still needs future development. V3.6 condition coverage remains mostly partial/advisory.

### Explicit limitations

- The library recognizes all 13 baseline type **names**, but only a selected set of associated mechanics is active; other traits are surfaced as notes. Not a complete type/subtype catalog.
- It does not implement full incorporeal movement, incorporeal AC, cover, ethereal interactions, critical/precision damage from attack packets, see-in-darkness/telepathy, attack alignment conversion, or nonstandard damage exceptions.
- No complete spell resistance, hardness, fast healing/regeneration, energy vulnerability, temporary HP, damage-over-time timing beyond the existing ailment subsystem, or full negative HP/death state.
- Unsupported effect descriptors must be supplied/adjudicated by the GM; the calculator does not guess them.
- Reuse published monster totals instead of recomputing creature advancement, HP or saves from subtype traits. Numeric type-derived benefits should never be added twice.

## Testing

`node foundation_tests.mjs` runs 17 new named tests including inherited immunities, resistance and DR stacking, two ways to bypass incorporeality, dynamic DC changes, duplicate-application prevention, trait exceptions, atomic invalid imports, save/reload, and incoming ordinary attack metadata.

`python test_browser_v3_7.py` verifies the standalone workbench's fictional Devil import and its fire, acid, poison and DC operations. Previous Node suites and seven browser regression scenarios were rerun against V3.7 (the old browser scripts have version-title-only compatibility copies named `compat_test_browser_*.py`).

## Rules reviewed

- Paizo Bestiary creature types: https://aonprd.com/MonsterTypes.aspx?ItemName=Undead and https://aonprd.com/MonsterTypes.aspx?ItemName=Construct and https://aonprd.com/MonsterTypes.aspx?ItemName=Ooze
- Devil subtype: https://www.aonprd.com/MonsterDisplay.aspx?ItemName=Host+Devil%2C+Greater+%28Magaav%29
- Incorporeal subtype: https://aonprd.com/MonsterSubtypes.aspx?ItemName=Incorporeal
- Pathfinder damage reduction: https://aonprd.com/Rules.aspx?ID=424
- Standard monster ability save DCs: https://aonprd.com/Rules.aspx?ID=2460
