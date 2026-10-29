# Creature classification and subtype coverage — V3.41

`definition.creatureType` is the current creature type. `definition.subtypes` is an array of recognized classifications at the same level as `stats`. It is not limited to subtypes with automated defenses.

```json
{"op":"register_creature","definition":{"id":"classification_demo","name":"Fictional classification example","creatureType":"humanoid","subtypes":["goblinoid"],"stats":{"maxHp":5,"sizeCategory":"small","statTotals":{"ac":15,"touchAc":12,"flatFootedAc":13}}}}
```

This is a minimal schema example, not a published goblin or a complete playable import. Keep the verified statblock's actual HP, attacks, saves, skills, defenses, resources and applicable abilities. A kobold's racial classification can use `subtypes:["reptilian"]`. Do not infer subtypes from the creature's name or appearance.

## Discover before importing

Use `kernel_query` with `command:{"op":"list_trait_library"}` and `path:"/subtypes"` to page through the accepted IDs. Use `path:"/subtypeCoverage/goblinoid"` (or another listed ID) to inspect that subtype's automation status. The catalog also exposes `/subtypeCoverage` as a pageable object.

| Automation value | Meaning |
|---|---|
| `classification_only` | Retained on the definition and token, but grants no automatic abilities or numeric adjustments. Configure applicable mechanics explicitly; adjudicate the remainder. This does not mean the subtype has no rules in Pathfinder. |
| `partial` | Existing trait automation is present. Inspect the creature's resolved `traits`, including notes, for the actual effects and remaining limitations. Recognition is not full coverage. |
| `tracked_marker` | The calculator's `summon` marker uses the native summon timer and is not a racial classification. |

IDs use lowercase and underscores, such as `dark_folk`, `great_old_one` and `spawn_of_rovagug`. A definition accepts up to 24 unique IDs. Unsupported or misspelled IDs reject with their array location and a discovery pointer. This catalog covers the cited subtype index plus explicitly listed additions; it is not an unrestricted custom-tag field or a promise to cover every publication.

For a printed augmented subtype, retain the original type using `augmented_humanoid`, `augmented_animal`, or another `augmented_<creatureType>` ID. The bare `augmented` entry is recognized, but cannot identify the original type. An augmented label never replaces the current `creatureType` or grants the old type's abilities. Importing subtypes does not automatically infer related labels, alignment, senses, class skills, movement speeds, size or base statistics. Racial and skill modifiers already included in published totals must not be added again.

## Inspect and use classifications

`kernel_status(target)` includes `classification` with `creatureType`, `subtypes` and `classificationOnlySubtypes`. The existing `inspect` result's `/traits/<tokenId>` exposes the same classification alongside resolved defenses and notes. These are read-only views of the same stored fields, not a second identity system. Save/load and independent spawned instances preserve the labels.

These fields provide a structured basis for GM decisions involving Bane, favored enemy and other target-dependent effects. They do not themselves grant an attack bonus, damage dice, automatic Bane matching, or special targeting permissions. The GM must check the effect's exact type/subtype requirement, current form and exceptions before applying a supported modifier or damage component. `augmented_*` does not automatically count as the original type for every effect; `summon` and `mindless` are calculator helper labels, not general Bane categories.

Entries such as angel and mythic are classification-only: import their actual mechanics separately. Swarm and troop now have partial native automation in V3.50; read COLLECTIVES_V3_50.md. Recognition still does not imply complete automation.

## Sources

The recognized names were checked against the [Archives of Nethys PF1e subtype index](https://aonprd.com/MonsterSubtypes.aspx?ItemName=All), with [boggard](https://aonprd.com/MonsterDisplay.aspx?ItemName=Boggard), [gnoll](https://aonprd.com/MonsterDisplay.aspx?ItemName=Gnoll) and [tengu](https://aonprd.com/MonsterDisplay.aspx?ItemName=Tengu) classifications from their published statblocks. No complete monster statblocks or subtype rules are embedded by this change.
