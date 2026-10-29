# Explicit creature falling — V3.36

The GM declares a completed fall and landing after resolving reactions. The engine
calculates damage, applies native HP/nonlethal/condition mechanics, and optionally
updates the existing elevation record. Movement and height changes never imply a
fall. There is no gravity loop, falling status, second damage ledger or new timer.

## Commands

`gm_preview_fall` is GM-only and read-only, including during pending decisions.
It returns dice, check DC/outcome, prone policy and landing data without rolling.
`gm_resolve_fall` is GM-only, requires a nonempty `reason`, and applies the result
atomically. Finish pending actions/decisions before resolving; the command spends
no action or spell resource and does not advance the clock. It is a GM event,
not permission to jump, move, cast a reaction or repeat a previous landing.

```json
{
  "op": "gm_resolve_fall",
  "target": "hero",
  "fall": {
    "distanceFeet": 30,
    "deliberate": true,
    "surface": "hard",
    "acrobaticsTotal": 18
  },
  "landing": {"feet": -30, "grounded": true, "layer": "ground"},
  "reason": "Completed jump into the lower chamber"
}
```

Replace `op` with `gm_preview_fall` to inspect the same declaration. Damage and
skill outcomes are recomputed from the supplied declaration; preview stores no
pending job and consumes no RNG. Check totals are completed checks, including
applicable modifiers; use the existing generic roll tools to obtain them.

| Fall input | Contract |
| --- | --- |
| `distanceFeet` | Required finite 0–100000; complete 10-foot increments count. |
| `deliberate` | Boolean, default false. |
| `surface` | `hard` (default), `yielding`, or `water`. |
| `acrobaticsTotal` | Optional integer total for a deliberate land fall; DC 15. |
| `waterDepthFeet` | Required finite 0–100000 for water only. |
| `diveTotal` | Optional integer Swim or Acrobatics total for a deliberate dive. |
| `reduceFeet` | Optional finite 0–100000, default 0; GM declares an applicable special distance reduction. |
| `override` | Optional `{lethal,nonlethal,prone?,reason}`; fixed nonnegative integer damage amounts up to 100000, optional boolean prone decision, mandatory explanation. Replaces calculated damage before native target defenses. |

`landing` is optional and uses the existing elevation schema (`feet`, `grounded`,
optional `layer` and `note`). It replaces that record; it never infers an occupancy
layer or a horizontal destination. Omit it for damage-only adjudication. Position
the token using existing movement/GM relocation tools if its landing square differs.
Use airborne contact during relocation when appropriate, then declare contact at
landing. Illegal final occupancy fails atomically, including damage and RNG rollback.
Fall distance and landing height are independent declarations: the former is travel,
the latter is absolute height from the map datum. Distance reduction affects damage,
not physical landing height. Underwater does not imply contact with the bottom.

## Implemented calculation

Ordinary falls use d6s. A deliberate jump converts one damage die to nonlethal.
A successful Acrobatics check removes the first 10 feet and leaves the following
damage die nonlethal; it does not add another conversion on top of the deliberate
jump. Yielding ground converts one additional die, cumulatively. The land-fall cap
is 20 total damage dice after distance reduction/ignored distance; converted dice
remain part of that cap. No fractional damage die is rolled.

Water at least 10 feet deep has separate bands: first 20 feet harmless, next 20 feet
up to 2d3 nonlethal, then d6 lethal increments (maximum 20 lethal dice). A deliberate
dive avoids damage when its supplied check reaches DC `15 + 5 * floor(distance/50)`
and depth is at least `max(10, distance/3)` feet. Dive DC/depth use actual fall
distance, not damage-reduced distance. Failed dives use water bands; land-surface
conversions do not additionally stack onto the water formula. Shallow water needs
an explicit damage override because depth alone does not describe the impact.

These cap/threshold conventions are explicit so a fresh GM can inspect them and
override a different table ruling rather than silently inventing behavior.

Default prone follows the Environment chapter's lethal-damage rule. When an
Acrobatics softening check is supplied, any applied damage causes prone, following
that skill's broader wording. Temporary HP lost counts as damage; prevented damage
does not. `override.prone` supplies an explicit alternative, including water posture.
False prevents a new prone application; it does not stand an already-prone creature.
Nonlethal immunity and overflow retain their existing native behavior.

Impact is environmental bludgeoning, so weapon DR does not reduce it. Mixed lethal
and nonlethal parts share the existing concentration damage grouping: one impact,
one concentration check. The existing elevation setter runs after impact/condition
resolution, triggering contact-sensitive terrain/area entry once. Area exposure
receipts remain owned by the existing area system. Landing hazard damage is a
separate event. Undo restores the command's normal state changes and RNG.

## Boundaries and owners

`falling_rules.mjs` is pure arithmetic/validation. `SceneGame` owns the two commands
and delegates damage, nonlethal, prone and landing to existing owners. `MagicGame`
extends its existing grouped-damage hook with a cause argument, defaulting to weapon
for all existing callers. No new serialized state is introduced.

The GM decides whether falling occurs, check eligibility/modifiers, interruption,
catching, flight, feather fall, unusual gravity, underwater aftermath and encounter
timing. Long falls can use the existing events mechanism for a GM checkpoint; this
resolver does not schedule travel or interrupt a suspended movement operation.
Falling objects and impacts against another creature are separate adjudications;
object tokens are rejected by this creature resolver. Stairs and ordinary controlled
descent remain the existing map transition system.

Core sources:
- https://legacy.aonprd.com/coreRulebook/environment.html#falling
- https://legacy.aonprd.com/coreRulebook/skills/acrobatics.html

The offline workbench groups fall controls with map/elevation management. Special
overrides also work in its existing scene JSON editor. `falling_tests.mjs` covers
the rule branches, native integrations, atomicity and undo; `test_browser_v3_36.py`
exercises the controls and generated standalone bundle.
