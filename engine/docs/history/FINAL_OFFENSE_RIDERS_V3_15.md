> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# Tabletop Kernel V3.15 — Pull, Push, Energy Drain and Negative Levels

## Scope

This release finishes three **previously descriptive monster attack riders** using ordinary imported attack data, shared CMB/CMD and deterministic game-state updates. Existing Grab, Constrict, Trip, Poison, Bleed, Paralysis, critical/precision and fortification logic remains in place. The AI GM decides optional rider use; the engine does not decide tactics. Armor/cover/concealment are intentionally deferred.

## Attack profile format

Imported creature `stats.attacks[]` fields (validated by `attack_library.mjs` and the registry):

```json
{"label":"Pulling tentacle","naturalAttack":"tentacle","damageDie":6,"riders":["pull"],"pullFeet":10}
```

```json
{"label":"Pushing slam","naturalAttack":"slam","damageDie":6,"riders":["push"],"pushFeet":15}
```

```json
{"label":"Draining touch","naturalAttack":"other","damageTypes":["bludgeoning"],"damageDie":6,
 "riders":["energy_drain"],"energyDrainLevels":2,"energyDrainDC":18,"energyDrainTempHp":true}
```

`pullFeet` and `pushFeet` are fixed multiples of 5 feet, not extra squares per 5 by which the check beats CMD. Each ability needs a successful qualifying hit, is size-limited to targets **no larger than the attacking creature**, and allows a **free** CMB check with no additional action. The controller can decline. Pull moves the target directly toward the attacker; Push directly away. Movement stops if a square would be illegal or blocked. This forced movement does **not** provoke AoOs, but still exposes the creature to entered-square triggers. For correct math, the two special-attack CMB checks do not accidentally inherit modifiers specific to the ordinary Reposition or Bull Rush combat maneuvers.

Both decisions use the existing optional-rider queue, so successive Trip/Grab/Pull/Push choices suspend and resume after a single hit without repeating the attack roll or damage. Arbitrarily nested reactions spawned by an entered-square trigger remain limited by the current interrupt scheduler; the GM may finish complex cases with adjudication controls.

## Energy Drain and negative levels

Energy Drain applies automatically after a successful qualifying attack. On a **confirmed, non-negated critical hit**, the number of levels bestowed doubles; no additional HP damage is required to deliver it. Immunity to `energy_drain` prevents the effect. The source gains 5 temporary HP per negative level actually bestowed unless `energyDrainTempHp:false` is explicitly imported. Per the Paizo FAQ, successive grants from the **same** Energy Drain ability do **not stack**; the higher still-active grant is retained, and grants expire after one hour.

Each negative level is a separately tracked record, with source, Fortitude save DC, elapsed-time due date, and temporary/permanent state. The target takes a cumulative –1 to attack rolls, CMB, CMD, saving throws, skill checks and ability checks, along with –5 to both current and maximum HP per negative level. **Actual character level/Hit Dice and ability scores are not decremented.** When the active negative-level count reaches registered `hitDiceCount`, the target dies. If HD is unavailable, the engine emits an explicit advisory rather than inventing it.

After **24 hours**, the engine makes a **separate Fortitude saving throw for each temporary negative level**. On success that level disappears and lost HP capacity is restored; on failure it becomes permanent, requiring restoration. The 24-hour check follows the specific universal monster Energy Drain rule, not the less-specific daily-check general rule. Other level-dependent variables (spellcaster level, class abilities), magical restoration edge cases, unusual negative-level sources, and spell slots are not fully automated; the encounter's GM must adjudicate them. The negative levels themselves do not remove prepared spells or spell slots.

Energy Drain temporary HP is deducted **after ordinary defenses** and before real hit points, including for multi-component damage packets. The parent damage/packet engines call a generic optional `absorbTemporaryHp` hook; earlier engines without that hook are unchanged.

## GM operations

```json
{"op":"gm_apply_negative_levels","target":"hero","source":"warden","levels":2,"dc":18}
{"op":"gm_restore_negative_levels","target":"hero","count":1}
{"op":"gm_advance_time","count":24,"unit":"hour"}
{"op":"inspect"}
```

Manual negative-level operations require the GM role; invalid commands revert to their prior snapshot. Undo, export/import and the ordinary time progression retain negative-level data. Undo is not resurrection: creatures killed when negative levels meet their HD need a separate GM-authorized revival.

## Test instructions and known limits

`node final_offense_tests.mjs` tests behavior including critical doubling, no stacking of temporary HP, save persistence and conversion, item/creature immunity, size limits, blocked terrain, serial decisions, free action economy, rollback and save/reload. Run every `*_tests.mjs` with Node to check older mechanics. `python test_browser_v3_15.py` runs the new browser demonstration in Chromium; earlier versioned browser files remain regression fixtures. Run `python build_demos.py` to regenerate standalone HTML.

Known offensive work **still pending**: full nonlethal-damage workflow, variable weapon-dice scaling with size, general ranged/thrown attack execution and range-increment/line-of-sight integration, complex nested reactions, other bespoke monster abilities. The next planned phase remains armor/shields and special materials, concealment/miss chances, cover and other defensive interactions **after** those remaining ordinary offensive mechanics are resolved.

PF1e references: https://aonprd.com/UMR.aspx?ItemName=Pull ; https://aonprd.com/UMR.aspx?ItemName=Push ; https://aonprd.com/UMR.aspx?ItemName=Energy%20Drain ; https://aonprd.com/Rules.aspx?Category=Special+Abilities&Name=Energy+Drain+and+Negative+Levels ; Paizo Core Rulebook FAQ (temporary HP same-source nonstacking): https://paizo.com/paizo/faq/v5748nruor1fm .
