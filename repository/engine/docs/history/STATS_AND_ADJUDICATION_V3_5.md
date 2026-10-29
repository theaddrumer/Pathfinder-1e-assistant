> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# V3.5 — Hybrid stat vocabulary and GM adjudication

This is an **experimental PF1e mechanical calculator**, not a rules-complete character builder or independent AI GM. Its primary inputs are JSON definitions and commands from a future interpreting GM. No model API, external rulebook retrieval, or adventure ingestion is implemented.

## Design: imported totals + changes, not reverse-engineering

A printed attack bonus, save, skill total, or AC value is authoritative. The engine does **not** infer feats, rank expenditures, or equipment bonuses to reproduce that number. The interpreter can separately declare which ability modifiers influence it. The engine adds **deltas** to the printed total when that ability changes.

Example (abbreviated):

```json
{
  "id": "sample-raider", "name": "Sample Raider",
  "stats": {
    "maxHp": 26, "dex": 12, "wis": 10,
    "statTotals": {
      "ac": 18, "touchAc": 11, "flatFootedAc": 17,
      "initiative": 1, "attack": 7, "fort": 5, "ref": 2, "will": 1
    },
    "abilityLinks": {"ac":["dex"],"touchAc":["dex"],"initiative":["dex"],"ref":["dex"]},
    "skills": {"Perception": 6},
    "skillAbilityLinks": {"Perception": "wis"}
  }
}
```

The example is intentionally incomplete as a game-ready creature (missing attacks, narrative abilities, etc.); missing supported fields get limited legacy defaults. Unlike V3.4, if **any** printed AC defense is supplied, all three are required so the program will not silently fabricate a published touch or flat-footed AC.

**Supported calculated totals:** `ac`, `touchAc`, `flatFootedAc`, `initiative`, `fort`, `ref`, `will`, `attack`, `damage`, `cmb`, and `cmd`. Standard ability scores are `str`, `dex`, `con`, `int`, `wis`, and `cha`. Skills use imported printed bonuses plus changes to their governing abilities; a standard mapping is available for common PF1 skills and the interpreter may override each via `skillAbilityLinks`. Unknown skills have no assumed ability dependency.

For AC built from components instead of printed totals, this prototype combines the supplied armor, shield, natural armor, deflection, dodge, size, and capped Dexterity components. Flat-footed excludes dodge and **positive** Dexterity; negative Dexterity still applies. For imported totals, the interpreter must supply appropriate `abilityLinks` and optionally `maxDex` when necessary. This is **not** a full stacking/exceptions engine; unusual features such as uncanny dodge require explicit interpretation.

The engine can calculate an attack against a selected defense (`ac`, `touchAc`, or `flatFootedAc`). Nonstandard defense selection is restricted to GM authorization, because the ordinary actor should not freely convert an attack into a touch attack. No automatic detection of flat-footed circumstances, touch-attack properties, cover, concealment, DR, critical confirmation, or unusual attack types is claimed.

## GM direct adjudication commands

These operations are GM-only, separate from creature actions. Each validates its parameters and rolls back state/RNG on errors.

**Dice plus optional damage/healing**:

```json
{"op":"gm_roll","kind":"damage","count":1,"sides":6,
 "bonus":0,"target":"raider_1","damageType":"bludgeoning",
 "cause":"environment","label":"Fall from a 10-foot tree"}
```

Use `kind: "plain"` for a standalone die roll and `kind: "healing"` for healing capped at max HP. Damage uses the existing `damage_before` event, so registered effects (such as the sample Black Pudding split) still have the opportunity to respond. Direct damage/healing is *not* automatically mitigated by unimplemented general DR, resistances, temporary HP, nonlethal accounting, or immunities.

**Persistent or timed modifier**:

```json
{"op":"gm_modifier","target":"raider_1","stat":"ac_all",
 "value":-2,"type":"circumstance","name":"GM ruling",
 "rounds":2}
```

`ac_all` deliberately targets all three AC totals; `ac` alone targets normal AC only. Likewise `saves` affects all three saving throws; `skill_checks` applies to all recorded skills, and `skill:Perception` only to that skill. `rounds: null` (or omission) persists until an effect is removed with `{ "op":"remove_effect", "id":"..." }`. Duration uses the existing *end of affected creature's turn* approximation, not a general Pathfinder timing scheduler. Stat typing/stacking is provisional and has known exceptions.

**GM attack test vs a particular defense**:

```json
{"op":"admin_attack","actor":"hero","target":"raider_1","defense":"touchAc"}
```

This bypasses the actor's action cost and is for testing/adjudication. Ordinary actor `attack` commands continue to use normal AC; changing the defense in an actor command is rejected.

## Separation of interfaces

- `index.html`: main offline **GM workbench**. Register JSON creature and effect definitions, spawn instances, inspect AC and skills, move/attack on the grid, and use generic GM operations.
- `tests.html`: retains the historical Choker, Archon, Black Pudding, Vienna, and registry fixture gallery for regression testing; it is not the proposed eventual campaign interface.
- `automation-demo.html`: copy of the fixture gallery retained for existing links and scripts.
- `demo.html`: V1 legacy comparator.

The HTML files are rebuilt with `python build_demos.py` and need no web connection.

## Validation and honest limitations

Tests: `node stat_vocabulary_v3_5_tests.mjs`, all eight prior Node suites, `python test_browser_v3_5.py`, plus the three older Chromium test scripts (now pointed to the fixture gallery). As of this build **115 named Node tests** and the Chromium smoke checks pass.

The import parser remains intentionally restrictive. It does not yet provide a full PF1 statblock representation (special defenses, senses, separate movement modes, resistances, spells, feats, etc.). Adding informational fields without mechanical support must not be presented as automatic implementation. Printed stats imported from V3.4 with **only** an `ac` total must be supplied with `touchAc` and `flatFootedAc` before V3.5 registration. This is an intentional early-prototype schema change.
