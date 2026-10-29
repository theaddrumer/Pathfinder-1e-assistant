> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# V3.16 — Defensive equipment and visibility

This release implements reusable defensive mechanics beneath the AI GM. It does **not** decide where cover exists or whether a hidden creature is located. The GM supplies the defensive context, and the calculator resolves the check. Historical tests and fixtures remain intact.

## Armor and shields

Creature statblocks can supply items in `stats.equipment` with `kind:"armor"` or `"shield"`, `location:"worn"`, `armorBonus`, `enhancementBonus`, `armorCategory` (`light`/`medium`/`heavy` for armor), optional `maxDexBonus`, `armorCheckPenalty` (negative), `arcaneSpellFailure`, `material`, `hp`, `maxHp`, `hardness`, `broken`, and `fortification`. The importer validates these fields. Dynamic equipment changes are issued by a GM via `gm_set_equipment` and appear in `inspect` / `gm_inspect_defense`.

**Authoritative printed totals:** Existing `statTotals.ac`, `touchAc`, and `flatFootedAc` are never treated as unarmored statistics. On spawn, the engine takes an equipment snapshot. Changing the initially equipped armor/shield applies *only the difference* between the initial and current equipment values (including Dexterity caps and skill check penalties), preventing double-counting. For explicitly generated, non-imported AC, `equipmentACMode:"derived"` instead derives equipped bonuses and subtracts the existing `armor`/`shield` fields. If another system imposes a separate unarmored Dex cap, specify `unarmoredMaxDex`. The older `maxDex` may describe the cap of the originally worn armor.

Broken armor/shields halve their AC bonus, rounding down. Broken armor doubles its armor check penalty. Item HP at or below half max HP also causes broken consequences even if the explicit flag was omitted. Removed/dropped/destroyed equipment no longer provides its bonuses. An armor/suit with no HP cannot provide its special properties. Hardness is read from an explicit item hardness first, or derived for explicitly declared common metals if absent; Sunder now respects these defaults. Unspecified material is **not** presumed to be steel.

Mithral armor grants +2 maximum Dexterity, improves armor check penalty by 3 (minimum 0), reduces arcane spell failure by 10 percentage points, and changes the armor's effective category for certain limitations but **not** proficiency. These properties are inspectable; the engine does not yet calculate spellcasting failure or automatically recalculate movement speed. Mithral shields receive the corresponding material benefit. Adamantine armor adds nonstacking DR 1/— (light), 2/— (medium), 3/— (heavy) to the existing DR evaluator; categories must be explicitly declared. Existing 25/50/75% fortification on worn armor remains active, except when the item is destroyed/has zero HP. Detailed armor pricing and uncommon special materials are not modeled.

## Cover, concealment and senses

The GM can supply `defenseContext` to an attack (GM-only) or set a target's persistent `defenseProfile` through `gm_set_defense_profile`. Both use the same validated fields:

```json
{"cover":"cover","concealment":20,"concealmentSource":"visual"}
```

Allowed cover: `none` (+0), `cover` (+4 AC), `soft` (+4 AC), `improved` (+8 AC), `total` (cannot directly target). Miss chance uses a single percentile roll against the largest currently supplied concealment, such as 20% ordinary/blur or 50% displacement/total concealment. There is no arithmetic stacking of concealment. A successful attack roll that fails the miss chance causes **no damage, critical confirmation, precision or riders**. Concealment also prevents ordinary precision eligibility even if the miss chance was passed. Blind-Fight grants one miss-chance reroll for melee attacks only. Blindsight within its stated range ignores visual concealment, blur and displacement; blindsense merely locates and does not remove miss chance. GM-authorized override flags are available where a rule warrants ignoring cover/concealment.

The engine does **not yet derive cover from corners, friendly creatures or walls**, or determine illumination, awareness or line of sight beyond the inherited board model. The GM supplies positional context. Total concealment still requires GM knowledge of the selected square, and its separate targeting/AoO restrictions require further integration. These contextual defenses only operate in the currently executable melee attack path. Ranged execution, independent reflex bonuses from cover, mirror-image decoys, blink's non-concealment miss chance, special spell targeting, and uncommon defensive enchantments remain follow-ups. This is a foundational pass, not a claim of complete PF1e defensive automation.

### Operations

```json
{"op":"gm_inspect_defense","target":"sentinel_1"}
{"op":"gm_set_equipment","target":"sentinel_1","item":"shield","location":"carried"}
{"op":"gm_set_equipment","target":"sentinel_1","item":"plate","broken":true}
{"op":"gm_set_defense_profile","target":"sentinel_1","profile":{"cover":"none","concealment":50,"concealmentSource":"displacement"}}
{"op":"attack","actor":"hero","target":"sentinel_1","defenseContext":{"cover":"cover","concealment":20,"concealmentSource":"visual"}}
```

The fifth example is GM-only because it includes adjudicated context. An ordinary creature controller can attack a target with an already registered defensive profile, without accessing override permissions.

### Rules sources

- [PF1e Special Materials](https://legacy.aonprd.com/ultimateEquipment/armsAndArmor/materials.html)
- [PF1e Combat: Cover and Concealment](https://legacy.aonprd.com/coreRuleBook/COMBAT.html)
- [PF1e Core Glossary: Broken](https://legacy.aonprd.com/coreRuleBook/glossary.html)
- [PF1e Blind-Fight](https://legacy.aonprd.com/coreRuleBook/feats.html)
- [PF1e Blindsight and Blindsense](https://www.aonprd.com/Rules.aspx?ID=421)
