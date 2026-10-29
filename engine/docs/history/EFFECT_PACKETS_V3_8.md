> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# V3.8 — Explicit Damage Types and Composite Effect Packets

The engine is still a deterministic GM-controlled PF1e *mechanical referee*, not an AI decision-maker. Existing definitions, saved states, actions, registered conditions, and ailments continue to function. The main GUI loads damage options from `DAMAGE_TYPES` in `trait_library.mjs`, not a manually maintained dropdown.

## Canonical vocabulary

- Physical: `bludgeoning`, `piercing`, `slashing`.
- Energy: `acid`, `cold`, `electricity`, `fire`, `sonic`.
- Other damage labels: `force`, `untyped`, `divine`, `holy`, `unholy`, `good`, `evil`, `lawful`, `chaotic`.

**Caution:** PF1e does not assign universal alignment multipliers, immunities, or vulnerabilities to `good`/`evil`/`lawful`/`chaotic`/`holy`/`unholy` damage labels. They are explicit classifications that an imported ability may use; the ability's own targeting conditions control what they do. `divine` represents nonfire damage such as *flame strike*; it is not automatically Good. `untyped` remains the fallback for unspecified spell/effect damage. `magic` and `epic` are **weapon/DR-bypass properties** (and optional metadata), not damage types.

`list_trait_library` returns `damageTypes`, `weaponBypassTags`, and existing type/subtype/effect vocabularies. Both damage selectors in the default offline workbench use the engine's `DAMAGE_TYPES` source directly. New values cannot be missed in the UI while present in the underlying vocabulary.

## Composite packet GM command

One adjudication command can deliver multiple differently classified damage components as a single event:

```json
{
  "op": "gm_resolve_packet",
  "target": "devil_1",
  "source": null,
  "cause": "spell",
  "metadata": {"sourceKind": "spell", "tags": ["evil"]},
  "components": [
    {"damageType": "fire", "amount": 12},
    {"damageType": "unholy", "amount": 12}
  ]
}
```

This is a *Hellfire Ray-style* packet: the devil's fire immunity prevents the fire portion, but the unholy portion causes damage because this particular spell doesn't say evil creatures are immune to it. The spell's `[evil]` descriptor isn't synonymous with universal Evil-aligned damage rules.

The effect packet may instead specify an explicit alignment-based exception (example environmental Hellfire):

```json
{
  "op": "gm_resolve_packet",
  "target": "devil_1",
  "cause": "environment",
  "metadata": {"sourceKind": "environment"},
  "components": [
    {"damageType": "fire", "amount": 20},
    {"damageType": "unholy", "amount": 20,
     "alignmentMultipliers": [
       {"alignment": "evil", "factor": 0},
       {"alignment": "good", "factor": 2}
     ]}
  ]
}
```

The sample Devil is Evil through its subtype and fire-immune, so both components are negated. An ordinarily Neutral creature takes both portions, while a Good creature takes the fire portion and twice the unholy portion, assuming no other defenses. Those multipliers come from the *specific effect*, **not** the unholy classification itself. Set `defaultMultiplier` on a component, for example `0.5`, when a spell explicitly treats unmatched targets differently (e.g., neutral targets). In conflicting target cases—such as Evil subtype plus actual Good alignment—different matching multipliers cause a loud GM error instead of an arbitrary choice.

Components may use `"dice":{"count":2,"sides":6,"bonus":0}` **instead of** `amount`. Random rolls use the normal seeded engine and are rollback-safe. Separate components roll separately; this version does not automatically split a shared spell-wide roll into halves. For *flame strike*, the AI GM can roll the total and supply two values, or request separate components if appropriate to the source. The existing `gm_roll` command can still provide an explicit shared roll.

Per-component mitigations and roll details are returned, together with raw, alignment-scaled, applied, prevented and amplified amounts. Source metadata can include `magical`, `ghostTouch`, `incorporealSource`, `sourceKind`, `weaponTags`, `tags`, `enhancementBonus`, and `enhancementEquivalent`. Unrecognized metadata and malformed components fail rather than executing arbitrary script.

A single attack with several physical components receives **one application of applicable DR** against their combined post-immunity physical amount, not one DR application per component. Energy resistance and energy immunity remain component-specific. A packet emits one `damage_before` event (`damageType:"mixed"` for multiple components), not multiple independent attacks. Existing special triggers that only inspect one damage type may not understand mixed packets; they remain a documented limitation until the broader trigger/rider layer is upgraded.

## Alignment subtype, actual alignment and weapons

An imported definition may specify its **actual** alignment (e.g. `"alignment":"NE"`, `"alignment":"N"`) separately from its `subtypes` (`evil`, `good`, `lawful`, `chaotic`, and the existing `devil` or `demon`). The **subtype**, not merely the creature's alignment or Outsider type, grants the corresponding offensive weapon property for overcoming DR. Devil grants Lawful and Evil, Demon grants Chaotic and Evil. This applies to any ordinary weapon attack made by that creature; the weapon is not permanently modified and **no extra damage** is granted. Matching the attack to the target's DR is automatic on the ordinary attack command as well as the GM packet command when a source creature is specified.

DR-bypass tags recognize `magic`, `epic`, special materials, alignments and physical types. For modeled cases, actual enhancement bonus +3/+4/+5 can bypass DR requiring silver/cold iron, adamantine or alignment respectively; Epic is inferred from enhancement-equivalent +6 or higher. Complex DR combinations remain advisory/unsupported; each currently registered DR entry uses OR semantics.

## Unsupported / deferred

- Automatic splitting of a **shared rolled total**, per-target saves / spell resistance and area geometry, ongoing DoT ticks and attached poison or condition *riders* are not added to packet commands yet.
- There is no complete PF1e alignment-effects library. `holy` and `unholy` are usable labels, not universal alignment rules.
- No complete spellcasting, hardness, vulnerability/regeneration pipeline or full creature type/subtype catalog.
- This is a GM-authorized effect operation. Ordinary AI-controlled creatures cannot freely issue it without spending actions; they still use validated actor commands.
- Full nested interrupts have not yet been implemented; packets cannot execute while an existing AoO/charge/full-attack interrupt is unresolved.

## Tests

`node effect_packet_tests.mjs` verifies the vocabulary, generic data validation, *flame strike* and both Hellfire styles, subtype-dependent weapon DR bypass, nonstacking DR, Epic, incorporeal magic, dice rolls, neutral defaults, atomic errors and permissions. All existing Node suites and previous eight browser suites plus `test_browser_v3_8.py` remain runnable. Use `python build_demos.py` after editing modular source or browser template files.

Reference rules: Pathfinder 1e Bestiary creature types (especially alignment subtype); damage reduction and enhancement equivalences; *Flame Strike*; *Hellfire Ray*; environmental Hellfire. The examples here are illustrative mechanics, not complete imported official spell definitions.
