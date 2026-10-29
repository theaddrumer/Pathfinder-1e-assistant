> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# V3.9 — Attack vocabulary and modular rider definitions

**Scope:** This version defines/validates attack profiles and reusable rider *definitions*. It extends ordinary attacks and composite GM damage packets to resolve a **single physical damage roll with multiple simultaneous physical types**, but does not yet execute combat maneuvers or the optional riders. The engine is a deterministic referee; the AI GM/controller still makes tactical choices.

## Attack data versus triggered abilities

An attack record may contain `label`, `attackKind`, `attackMode`, `naturalAttack`, `damageType` (legacy), `damageTypes` (simultaneous physical types), `damageMode`, `damageDie`, `attackOffset`, `damageOffset`, `attackTraits`, and `riders` (list of registered rider names). Unknown properties are rejected on imported records. `attackTraits` retains the existing source metadata, for example magical status, alignment bypass, ghost touch or enhancement bonuses.

```json
{
  "label":"Bite + Grab", "attackKind":"natural", "naturalAttack":"bite",
  "damageDie":6, "damageTypes":["bludgeoning","piercing","slashing"],
  "damageMode":"all", "riders":["grab"]
}
```

The `naturalAttack` field supplies Bestiary-style **defaults** for bite, claw, gore, slam, sting, talon, hoof, tentacle, wing, pincers, and tail slap (plus `other`). Individual monsters can override defaults through explicit `damageTypes`. The natural attack table marks typical primary or secondary status for the benefit of the GM, but does **not** derive every attack modifier and Strength damage fraction; imported printed attack and damage totals/offsets remain authoritative. A single natural attack does not gain BAB iterative attacks. Explicit natural attack routines continue to determine an individual monster's attacks per turn.

Common attack categories and modes are defined for import/inspection: manufactured, natural, unarmed, touch, ranged touch, ray and special; melee, ranged, melee touch, ranged touch. **Ranged attack execution remains blocked with an explicit error** because range increments, line of sight, and cover have not been completed. Defining a kind is not the same thing as having all of its rules automated. Touch-specific and critical-hit semantics also require further work.

Standard `attack` accepts a zero-based `index` to select a creature's imported attack slot; index 0 is default. Full attacks use the registered entire routine; charging uses the first slot. The browser workbench exposes an attack index for single attacks.

## One damage roll, multiple physical types

A bite's physical damage is **all** bludgeoning, piercing and slashing. It is not three rolls, not one-third each, and does not suffer DR three times. A piercing/slashing weapon qualifies for a DR/slashing bypass even when its first type happens to be piercing. A separate fire enchantment is represented as an **additional component** (and is separately subject to fire resistance). The V3.8 packet format accepts an optional `damageTypes` list for a physical component:

```json
{
  "op":"gm_resolve_packet","source":"predator_1","target":"defender_1",
  "cause":"weapon","components":[
    {"damageType":"bludgeoning", "damageTypes":["bludgeoning","piercing","slashing"],"amount":12},
    {"damageType":"fire","amount":4}
  ]
}
```

Current DR rules still support **simple OR-bypass descriptors**, not all compound requirements. Other defenses need further work. A future context-aware damage event should distinguish multiple physical *types on a single hit* from genuinely separate damage *sources*.

## Reusable attack riders

`attack_library.mjs` defines Grab, Constrict, Trip, Poison, Bleed, Pull, Push, Paralysis and Energy Drain as independently reusable definitions. These definitions have an explicit **`definition_only`** status. The engine may report eligible riders after a hit, but **does not attempt a grapple, apply an ailment, or inflict extra rider damage** automatically. Missing mechanics are exposed honestly to the controller.

**Grab (Ex)**: after a successful hit with a listed attack, the creature may attempt a grapple as a *free action* without provoking an AoO. Grab grants **+4 CMB to initiate/maintain**. By default the target must be the same size category or smaller, subject to the individual creature's special rule. On a successful grapple attempt, the monster may either (a) grapple normally, or (b) attempt a one-appendage hold at **−20 CMB** without acquiring the grappled condition itself. Initial Grab does not deal extra damage unless another ability (e.g., Constrict) explicitly applies; later rounds follow the normal grapple maintenance/damage rules. **All of those resolution mechanics await the combat-maneuver/grapple system**. In particular, do not silently treat a successful Bite as a successful Grab.

## Testing and future work

Run `node attack_foundation_tests.mjs` for focused mechanics and `python test_browser_v3_9.py` for the workbench inspection flow; the historical fixtures remain in `tests.html` and all older Node tests remain runnable.

The next implementation should add a generic maneuver resolution layer (CMB, CMD, maneuver-specific bonuses, size-category validation, threatened positioning, decision pauses, ongoing grapple states, and maintain checks). Only *then* wire Grab/Constrict and other riders into attacks. Preserve the distinction between **optional choices** made by the AI controller and **mandatory calculations** run automatically.
