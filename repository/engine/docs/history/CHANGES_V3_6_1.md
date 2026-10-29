> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# V3.6.1 — Ability damage and drain

V3.6 had an ability-damage reservoir driven by afflictions. V3.6.1 makes the distinctions among **ability damage, actual ability drain, and temporary ability-score adjustments** explicit, including GM-controlled operations in the workbench.

## Rules model

The creature's printed ability score is never rewritten. A creature instance tracks `abilityDamage[creatureId][ability]` and `abilityDrain[creatureId][ability]` as **independent, cumulative pools**. Reusable GM effects (`s.effects`) continue to represent timed and typed bonuses/penalties. The read-only `inspect` operation now exposes `abilityScores` with printed score, damage, drain, active ability modifiers, effective score, and the damage-derived statistical penalty.

**Damage:** Every two points of ability damage incur -1 on relevant rolls and statistics, including imported skill/attack/save totals via declared ability dependencies. Odd damage values still remain accumulated for later hits. Ability damage alone does not lower the displayed score. Exceeding the ability score raises an explicit GM advisory for unconsciousness or death (Constitution).

**Drain:** Ability drain subtracts directly from the effective ability score, producing changes in ability modifiers at their normal breakpoints. Drain is capped at a score of 0. Zero scores raise explicit GM advisories. Ailment cure never restores drain or previously dealt damage; restoration is a distinct operation. Recovery from ability damage and ability drain use different commands.

**Temporary penalties:** Continue to be represented as ordinary typed, timed modifiers. Penalties alone cannot push an ability below 1. Their source, duration, and stacking apply through the existing effect infrastructure. Fully handling all Pathfinder stacking and exceptional abilities remains outside scope.

**Constitution and HP:** Imported creature definitions may include `hitDiceCount` (positive integer). When provided, changes in the Con-derived modifier (including drain and timed Con modifiers) and Con damage penalties update **both maximum and current HP by HD × modifier change**. The adjustment is reversible without erasing unrelated HP damage. Without a registered Hit Dice count, the engine does *not* invent one and returns an explicit advisory. Full unconscious/death/resurrection bookkeeping and all special HP exceptions remain unfinished.

## Commands

All new mutation operations require GM authorization and are transactional.

```json
{"op":"apply_ability_damage","target":"raider_1","ability":"str","amount":4}
{"op":"heal_ability_damage","target":"raider_1","ability":"str","amount":2}
{"op":"apply_ability_drain","target":"raider_1","ability":"con","amount":1}
{"op":"restore_ability_drain","target":"raider_1","ability":"con","amount":1}
```

The ailment schema permits both `ability_damage` and `ability_drain` among recurring effect kinds:

```json
{"kind":"ability_drain","ability":"wis","dice":{"count":1,"sides":4}}
```

Initial exposure, periodic saves, onset, cure rules, and manual rider delivery work as they did in V3.6. Full attack integration remains postponed as requested.

## Validation

- `node ability_loss_tests.mjs`: 13 named focused tests (pool separation, modifier breakpoints, Con HP, GM authorization, rollback, persistence, ailments, and zero score).
- All earlier Node suites remain included and passing (181 named tests total across 12 suites).
- All six prior Chromium browser regressions and the new `test_browser_v3_6_1.py` pass.

## Limitations

- PF1 condition support remains partial as cataloged in `CONDITIONS_AND_AILMENTS_V3_6.md`.
- Natural daily healing of ability damage is not yet scheduled, even though manual restoration works.
- Imported records without `hitDiceCount` do not get automatic Con-based HP recomputation.
- Automatic incapacitation/death, skill rank changes from Int drain, class-feature thresholds, ability immunity, negative levels and other exceptional dependencies still need design and testing.
- Current HP bookkeeping inherits the original prototype's simplified 0-HP handling (not full negative-HP/dying/death mechanics).
- Temporary/statistical modifiers support only the existing typed-modifier subset; source-specific exceptions remain GM work.
