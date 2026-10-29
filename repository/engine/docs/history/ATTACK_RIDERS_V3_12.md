> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# V3.12 — Optional attack riders, Grab, Constrict, and attack substitution

## Architectural intention

The AI GM selects tactics and whether to activate optional abilities. The deterministic rules engine validates and resolves them. A hit is resolved once and *then* a qualified optional rider is offered to the attacker. The attack's original action is not spent again and its hit/damage rolls are not repeated.

`RiderGame` extends `ManeuverGame` and is now used by `createScenario()`. It shares the existing state, defense-resolution pipeline, CMB/CMD checks, condition library, and rollback. Registered attacks remain data, not new JavaScript classes for every monster.

## Supported commands

- `attack` and `full_attack` automatically discover a `grab` rider **on the actual attack entry** after a successful hit against a surviving target of a valid size. They set `pendingRider` and interrupt `rider_choice`.
- `resolve_interrupt` with `take:true` accepts a normal Grab, and `take:false` declines it. For the third choice, use `resolve_rider` with `actor` and `mode:"appendage"`. `mode:"normal"` and `mode:"decline"` also work explicitly.
- An accepted Grab makes a **free** CMB check with +4 and no additional AoO. An appendage-only hold applies an additional −20 CMB, and only its target gains Grappled. Existing grapple and reach/size restrictions are checked. No second attack or standard action is spent.
- `constrict` on a qualifying Grab profile requires `constrictDie` and `constrictBonus` (e.g. `1d4+3` → `constrictDie:4, constrictBonus:3`). The engine deals this **additional** bludgeoning damage on a successful initiation or maintenance check, not on a mere attack hit or failed Grab.
- On later successful Grapple maintenance checks arising from Grab, the attack establishing the hold also deals damage, separately from Constrict, where appropriate. These damage events use the existing protection and trigger pipeline.
- The normal Grappled condition prevents an attacker from continuing a full-attack routine after establishing a normal hold. A successful appendage-only Grab leaves the holder ungrappled and the remaining strikes available.
- `replace_attack` takes `actor`, `target`, and `kind` (`trip`, `disarm`, or `sunder`; item ID where relevant). It replaces the next melee full-attack slot, including any maneuver AoO interruption, **without spending another action**. The slot advances exactly once after resolution, and subsequent strikes remain available when legal.

For example, an attack entry may contain:

```json
{
  "label": "Bite",
  "attackKind": "natural",
  "naturalAttack": "bite",
  "damageDie": 4,
  "riders": ["grab", "constrict"],
  "constrictDie": 4,
  "constrictBonus": 3
}
```

`grabSizeAllowance` can make an individual Grab profile target a specified number of larger size categories, where the published monster ability explicitly allows it. Without the exception, targets cannot be larger than the attacker.

## Corrections and validation

The Grappled condition's −2 attack-roll and −2 CMB effects no longer incorrectly double count as two CMB penalties. Grapple and escape maneuvers correctly avoid the condition's CMB penalty. Internal condition applications for combat maneuvers and Grab may complete during a paused full attack, but ordinary condition-injection commands cannot bypass that pause.

`rider_integration_tests.mjs` exercises choosing/declining Grab, normal and appendage holds, Constrict timing and failure, maintenance, size limits, action cost, full-attack suspension and replacement, AoO continuation, controller permissions, and rollback validation. Existing tests and old browser fixtures remain part of the project.

## Scope and unfinished work

- Other rider definitions (Trip-on-hit, Poison, Bleed, Paralysis, Pull, Push, Energy Drain) are **not** yet connected automatically to attack results. Their existing definitions remain explicitly partial.
- Grab's specialized rules for multiple simultaneously grabbed creatures, intervening nested reactions, and some positional situations still require GM adjudication.
- Attack substitution by maneuvers during an **AoO** or **charge** is not yet implemented. Full-attack replacement is supported for the three named maneuvers.
- Grapple rules beyond the current one-on-one model (complex pin, tie-up, mounted/unusual body geometry) are not represented fully.
- Constrict without an attack whose Grab entry declares it is not currently automatically integrated into the ordinary Grapple action. Creature-specific overrides remain available to the GM.
- Critical hits, detailed ranged combat and most other rider types remain separate future milestones.

The legacy testing gallery (`tests.html`) remains for regression. The main `index.html` exposes both a Grab decision panel and melee full-attack substitution; the example Bite + Grab + Constrict is loaded from editable JSON in the Foundations inspector.
