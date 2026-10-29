> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# V3.13 — Critical hits, precision damage, and fortification

## Design

A critical hit changes how often an attack's ordinary weapon damage is rolled; precision damage is an *extra contribution* to the attack's existing damage type, not a new elemental or physical type. Equipment and innate abilities may independently negate confirmed criticals and qualifying precision damage, often through a shared Fortification chance. The AI GM determines sneak-attack or other precision eligibility; the engine rolls and applies its consequences.

## Attack entry fields

| Field | Interpretation |
|---|---|
| `criticalThreat: 18` | 18–20 critical threat range (default 20) |
| `criticalMultiplier: 3` | x3 confirmed critical (default x2) |
| `keen: true` | Doubles original threat-range breadth; does not stack with Improved Critical |
| `improvedCritical: true` | Alternative nonstacking threat-range expansion |
| `precision: {"count": 2,"sides":6,"bonus":0}` | Extra precision dice and optional positive flat precision bonus, ONLY if this specific attack is qualified by its controller |
| `extraDamage: [{"damageType":"fire","count":1,"sides":6}]` | Independent additional dice, rolled once and not multiplied |

Broken and improvised weapons force 20/x2 as already defined. A natural 20 is an automatic hit and threat; a natural 1 misses, including on the confirmation check. An expanded-range threat must still hit AC. Confirmation uses the original attack bonus. On a confirmed critical, regular weapon damage dice and static bonuses are rolled the number of times prescribed by the multiplier. Precision dice and extra weapon-property damage dice are **never multiplied**.

An ordinary attack command may declare `precisionEligible: true`, e.g.

```json
{"op":"attack","actor":"hero","target":"warden","index":0,"precisionEligible":true}
```

The same Boolean is accepted on the individual `full_attack`, `full_attack_next`, and GM `admin_attack` commands. The interactive workbench provides a **Precision applies (GM-verified)** checkbox. If omitted or false, the attack's precision dice are not included. This is deliberate: the kernel does not infer flanking, concealment, sneak-attack qualifications, or target anatomy from an imported damage bonus. It does not grant an ability to sneak attack; it executes one only after its eligibility has been established.

The hit's normal weapon and applicable precision contribution are **combined before physical DR**, so DR applies once to the total. Both inherit the same simultaneous physical types (for instance a Bite's bludgeoning/piercing/slashing labels); a Flaming extra component is separate and subject to its own defenses.

## Fortification and innate negation

A dynamically imported creature can declare:

```json
{
  "protections": {"fortification": 50}
}
```

or include worn armor among `stats.equipment`:

```json
{"id":"mail","name":"Fortified mail","location":"worn","fortification":75}
```

`25`, `50`, and `75` implement standard light, moderate, and heavy Fortification; a validated 0–100 percentage also supports authored abilities. The creature may instead or additionally declare `protections.criticalNegationChance` and `protections.precisionNegationChance` for separately worded native abilities. Multiple chances are not simply added: the **highest applicable percentage** is used in each category. When the same hit threatens both a crit and precision, one d% defense roll is compared with both applicable thresholds. If the confirmed crit is negated, the ordinary attack still hits, but weapon damage is no longer multiplied. If precision is negated, its extra contribution is suppressed. Inherent `critical` or `precision` immunity takes precedence and needs no d% roll.

For example, elemental and ooze traits grant critical and precision immunity in the existing trait catalog; they need no independent special-case implementation. Undead do **not** inherit those immunities by default under Pathfinder 1e rules.

## Spell/effect packet precision

A GM can attach extra precision dice **inside** the existing spell or weapon damage component:

```json
{
  "op":"gm_resolve_packet", "target":"target_1", "cause":"spell",
  "metadata":{"sourceKind":"spell"},
  "components":[{"damageType":"fire","amount":12,"precision":{"count":2,"sides":6}}]
}
```

Because precision is nested in the fire component, it is also fire damage and shares that component's energy resistance once. Attaching it to bludgeoning/piercing/slashing weapon damage likewise shares physical DR. The GM explicitly supplies qualified precision; packets do **not** perform spell attack rolls, concealment checks, SR, or sneak attack eligibility calculations. A single packet containing precision contributions makes one relevant defense d% roll. Precision-immune targets suppress the extra dice without losing the base packet damage.

## Current boundaries

- The model handles critical threat/confirmation and damage, and fortification/precision defenses, but does **not** yet automate critical-only weapon burst effects, critical feats, specific damage-on-critical riders, variable critical confirmation modifiers, critical-hit decks, or nonlethal precision interactions.
- Range, cover, concealment, flanking, spell attack rolls, and touch geometry need further implementation. The AI GM must authorize precision eligibility rather than having the engine presume it.
- Imported generic attack entries have one die size and a flat damage offset, not an arbitrary multi-die weapon-damage expression. Expanding this is a later attack-completion milestone.
- For PF1e unusual or third-party exceptions, use validated imported data and GM adjudication rather than silently assigning default immunity or stacking percentages.
- A packet's explicit precision follows its component's damage type; it is not a new member of `DAMAGE_TYPES`.

## Validation

`node critical_precision_tests.mjs` exercises confirmed and failed criticals, automatic hits, threat expansion, 25/50/75/100% defenses, armor and innate defenses, precision immunity, combined DR, extra flaming dice, typed spell packets, undoable validation, and registration failures. `python test_browser_v3_13.py` tests attack inspection, workbench precision toggle, critical confirmation, and armor fortification. Historical Node/browser tests remain in the archive.
