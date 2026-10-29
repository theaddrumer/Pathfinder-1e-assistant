# Creature imports — current V3.42 contract

Swarms/troops: read `kernel_reference` topic `collectives`. Supply a top-level `collective` profile with component size and printed automatic damage; use the real subtype. The footprint is not the individuals’ size. Legacy subtype-only imports need configuration before taking turns.

Read this before `register_creature`. This guide describes the complete Kernel, including extension validators; `docs/history/RUNTIME_REGISTRY_V3_4.md` is historical. Use `kernel_catalog` with `op:"register_creature"` for the existing minimal command example. This is a mechanics input format, not a statblock parser or a creature builder.

## Import workflow

1. Verify the actual source statblock. Do not invent approximate totals for a named published creature or treat omitted fields as confirmed rules.
2. Read `kernel_status`, discover `register_creature`, and use the current `registry` reference. Query `list_trait_library` for recognized types, subtypes and coverage; labels alone do not install abilities.
3. Register the definition through `kernel_gm` with the current revision, unique request ID and a setup reason. This adds a reusable definition, not a token.
4. Use `spawn_creature` with `definition` (the registered ID), a separate instance `id`, integer `x`/`y`, and `team` (`party`, `enemy` or `neutral`). Inspect the resulting stats before combat.
5. On rejection, correct the named field and submit the corrected payload with a new request ID. For an uncertain response to an otherwise identical request, retry the identical ID and arguments. A rejected registration does not alter encounter state, consume dice or create a partial definition. Validation reports the first failing check; another error can surface after it is fixed.

Definitions cannot overwrite an existing ID. Use a new versioned ID for a changed template. Existing instances are not retroactively changed by registering another definition.

## Where fields belong

| Location | Contents |
| --- | --- |
| `definition` | Required `id`, `name`, `stats`; optional `source`, `rules`, and supported extension metadata such as `creatureType`, `subtypes`, `protections`, `traitExceptions`, `alignment`, `mindless`, `dcDefinitions`, `progression`. |
| `definition.stats` | `maxHp` (required), optional starting `hp`, raw ability scores (`str`, `dex`, `con`, `int`, `wis`, `cha`), `bab`, `size`, `sizeCategory`, `reach`, `speed`, `statTotals`, `abilityLinks`, `skills`, `skillAbilityLinks`, `attacks`, `attackPlan`, `ammunition` and supported combat/equipment fields. |
| `definition.stats.statTotals` | Printed totals: `ac`, `touchAc`, `flatFootedAc`, `initiative`, `fort`, `ref`, `will`, `attack`, `damage`, `cmb`, `cmd`. Values are integers, not strings. |
| `definition.stats.skills` | Skill names mapped to printed integer bonuses, such as `Perception` or `Stealth`; not ranks. |
| `spawn_creature` command | Map position, instance ID and faction. These do not belong in the reusable definition. |

IDs start with a letter and contain up to 64 letters, digits, underscores or hyphens. Names are nonblank text up to 120 characters. `source` is a note up to 300 characters, not executable rules text. Unknown fields reject; unsupported text is not silently imported as mechanics.

If importing any AC total, supply **all three** of `ac`, `touchAc`, `flatFootedAc`. The calculator will not reconstruct published touch or flat-footed AC from an incomplete statblock. Printed totals are already inclusive: do not add raw ability modifiers or armor a second time.

`abilityLinks` maps an imported total to an array of up to three unique ability IDs. It declares which ability changes should adjust that total. `skillAbilityLinks` maps an imported skill to one ability ID. Supply the actual raw scores as well. Dependencies are declarations, not deductions from names. Mixed weapon-specific dependencies may require explicit attack metadata or GM adjudication; a shared attack baseline does not reconstruct every weapon's feat and ability calculations.

`sizeCategory` uses lowercase IDs: `fine`, `diminutive`, `tiny`, `small`, `medium`, `large`, `huge`, `gargantuan`, `colossal`. Put it inside `stats`. `size` is the square footprint side length in grid cells (1–6), not the size category. `reach` is in grid cells; `speed` is feet per move. For Small and Medium creatures the normal footprint is one cell. The GM must provide the intended footprint and reach instead of assuming that a category changes every spatial value.

## Attacks and printed routines

Each entry in `stats.attacks` requires `label`. Up to 20 entries are accepted. An attack's name does not infer weapon rules.

| Field | Meaning |
| --- | --- |
| `attackOffset`, `damageOffset` | Integer differences from the creature's attack/damage baseline, not independent printed totals. Do not put the full printed attack bonus into an offset unless the baseline is zero. |
| `damageDie`, `damageDiceCount` | Numeric die size and number of dice; do not put a dice string such as `1d6+2` into `damageDie`. The fixed bonus is supplied by the baseline/offset. |
| `damageType` / `damageTypes` | Physical damage type or types. `damageMode` is `all` or `choice`. Extra energy damage uses supported extra-damage metadata or an effect packet. |
| `attackKind`, `attackMode` | Kind describes the attack; mode is `melee`, `ranged`, `melee_touch` or `ranged_touch`. A weapon label or `rangedKind` does not replace explicit mode. |
| `rangeIncrementFeet`, `rangeFeet`, `rangedKind` | Projectile/thrown attacks require `rangeIncrementFeet`. A ray declares `rangedKind:"ray"`, `attackMode:"ranged_touch"` and `rangeFeet`. Read topic `attacks` for supported cases. |
| `criticalThreat`, `criticalMultiplier` | Numeric critical threshold and multiplier, not a formatted `19–20/x2` string. |
| `ammoId` | ID of a store inside this definition's `stats.ammunition`; requires explicit `ranged` or `ranged_touch` mode. |
| `weaponHands`, `lightWeapon`, `offhand`, `threatens` | Explicit metadata used by supported combat options. Hands is 1 or 2; other fields are booleans. |
| `riders`, `attackTraits`, `precision`, `extraDamage` | Structured mechanics with their own validation. Read the relevant `riders`, `traits`, `combat` or `attacks` reference; a plain text ability description is not interchangeable with these structures. |

**Without `attackPlan`, `stats.attacks` is the explicit full-attack sequence.** It is not automatically a menu of mutually exclusive weapons. Do not combine a printed melee routine and an alternative ranged routine into one array and then request a full attack as if the engine will choose between them. An ordinary attack can select its entry by index; the GM must configure the intended full routine and verify legal combinations.

`attackPlan` is an optional generator for declared weapon entries and supported iterative/offhand/natural rules. Only use it when the baselines do not already include the generated routine's adjustments. Read topic `attacks` before using it. The engine does not infer all feats from BAB, Strength or weapon names.

For supported conditional feats and combat options, read topic `combat`. `stats.combatProfile` requires `totalsExcludeCombatOptions:true`; already included conditional penalties must not be applied twice.

## Ammunition

`stats.ammunition` is an object mapping store IDs to store objects, at most 30. It is local to the creature definition, not a separate global ammunition registry. Each attack's `ammoId` must exactly match a local key.

| Store field | Accepted values |
| --- | --- |
| `type` | Required: `reserve` or `loaded`. |
| `reserve` | Required integer from 0 to 100000. |
| `capacity`, `loaded` | Required for `loaded` stores: capacity 1–100; loaded 0–capacity. Unsupported for reserve stores. |
| `reloadAction` | Optional `free`, `move`, `standard`, `full_round`; declare the actual weapon/feat rule. |
| `reloadProvokes` | Optional boolean for the verified reload exception. |
| `ready`, `drawAction` | Reserve stores only: optional ready count 0–100 and draw action `free` or `move`. |

No `ammoId` means ammunition is untracked, not that an infinite supply has been verified. Loaded and reserve stores use the existing reload/draw/spend rules; this release only clarifies validation.

## Reading a rejection

- `Unknown attack field: definition.stats.attacks[1].…` identifies the exact array entry and unsupported key. Use documented fields; do not strip a required mechanic merely to get registration accepted.
- A missing-store error names the attack's `ammoId`, the referenced ID and available local IDs. Fix the store/reference.
- A ranged-mode error says the store exists and identifies the attack's `attackMode`. Fix mode instead of creating another store.
- A misplaced root `sizeCategory` points to `definition.stats.sizeCategory`; uppercase category values list valid lowercase IDs.
- Specialized profile errors include their containing attack/profile path. These validators remain the authority; this guide does not introduce a second permissive importer.

## Intentional boundaries

The GM reads statblocks/AP text, selects tactics and targets, establishes awareness/lighting, and adjudicates unsupported exceptions. Supported vision fields and visibility calculations are not a complete automatic perception or lighting simulation. Unknown vision labels are not silently installed. See the scope table in `README.md` and topic `defenses`.

The calculator does not contain the entire spell/feat/monster library. Names, source notes and classification-only subtypes do not grant their published special abilities. Express supported effects through the generalized mechanics; keep narrative or unsupported rules in GM notes and explain any manual ruling. Inventory beyond declared combat resources, campaign consequences and long-term narrative effects stay outside this tool. Use `kernel_catalog` and reference topics to determine coverage before declaring a rule implemented.
