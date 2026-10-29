> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# V3.22 — Spellcasting foundations and spell-area geometry

V3.22 begins the magic milestone; **it does not implement every Pathfinder 1e spell**. The existing deterministic kernel and GM adjudication model are preserved. `MagicGame extends PendingEventsGame` in `magic.mjs`; area math is in standalone `spell_geometry.mjs`. All outputs and active casting state live in serializable game state and existing undo snapshots.

## Geometry

`gm_preview_spell_area` accepts `{ "op":"gm_preview_spell_area", "area":{"shape":"sphere", "mode":"burst", "origin":{"x":3,"y":4}, "sizeFeet":20} }`. `origin` is a **grid intersection**. Valid shapes: `sphere`, `cone`, `line`. Modes: `burst`, `emanation`, `spread` (spread supported on sphere only). Cones and lines also require an eight-way `direction`: `N,NE,E,SE,S,SW,W,NW`.

The preview returns `cells` and `affected` creature IDs and doesn't alter game state. Multi-square creature footprints are checked against all occupied cells. Bursts and emanations respect walls as solid line-of-effect obstructions. Spherical spreads propagate through open cells around walls and cannot cut diagonally through blocked corners; line templates stop at the first solid wall. Range measurements use PF1e's alternating diagonal 5/10/5 movement-count approximation. The workbench highlights affected cells in-place.

**Conservative geometry limitations:** This is the existing 2D square-map model, not a complete reproduction of every official area diagram. It doesn't handle 3D spheres, cylinder height, arbitrary non-octant line orientations, low ceilings, wall apertures, sculpted/shapeable spells, unusual emanation source attachment, partially filled squares, or GM-certified line of effect through narrow openings. Line and cone shapes are discrete five-foot square templates. **The AI GM remains the authority** on doubtful corner contacts or excluded squares. For `spread`, routing uses shortest passable tile paths with 5/10/5 parity, not true curved geometry around continuous wall segments.

## Spell adjudication (GM-authoritative definitions)

```
{"op":"gm_resolve_spell","actor":"hero","spell":{
  "name":"Example fire burst", "level":3,"casterLevel":5,
  "area":{"shape":"sphere","mode":"burst","origin":{"x":2,"y":4},"sizeFeet":20},
  "save":{"type":"ref","dc":16,"onSuccess":"half"},
  "spellResistance":true,
  "components":[{"damageType":"fire","dice":{"count":5,"sides":6}}]
}}
```

This GM-only command bypasses casting action cost, useful for GM-adjudicated effects and delayed spell execution. Ordinary casting instead uses `{"op":"cast_spell","actor":"hero","spell":{...}}`, where the `spell` object has all fields from above and optional `castingTime` (`standard` default, `move`, `swift`, `full_round`), `defensive`, `concentrationBonus` and `ability` (`int`, `wis` or `cha`). These values are GM-supplied and **not guessed from classes**.

### Mechanical behavior

- Validates spell definition; spends the declared casting action. Defensive casting immediately rolls `d20 + concentration` vs DC `15 + 2 × spell level`, without automatic natural 1/20 outcomes. `concentrationBonus` is authoritative when supplied; otherwise uses caster level plus the named spellcasting ability modifier (default `int`, so supply `ability` for other caster types).
- If not defensive and threatened, returns `needs_gm` with a list of potential AoO attackers, preserving `pendingSpellCast` **before executing the spell**. GM determines which attacks actually happen and resolves them using existing damage/attack commands. Call `{"op":"gm_continue_spell","aooResolved":true,"damageTaken":10}` to resume. A nonzero amount checks concentration vs `10 + damage taken + spell level`; failure loses the spell. The GM must account for total spellcasting-interruption damage; the engine does not automatically orchestrate multiple nested AoOs at this milestone.
- Spell resistance is rolled independently per eligible target (`d20 + caster level >= target.spellResistance`) and is **not** a natural-20 automatic success. Caster never resists own spell. The GM supplies `spellResistance:true` only when the spell is actually subject to SR.
- Saves are per creature using existing Fort/Ref/Will rules. The `save` object takes `{type,dc,onSuccess}`; supported result types are `negates`, `half`, `none`. Natural 1 and 20 remain automatic failure/success on **saving throws**.
- For damage `components`, dice are rolled **once per spell**, then mitigation/resistance is applied separately per target by the existing damage-packet calculator. Successful half saves halve packet amounts before individual resistance. To heal instead, use `"healing":{"amount":8}` or `"healing":{"dice":{"count":1,"sides":8,"bonus":3}}`, sharing a single roll and applying existing HP/nonlethal healing.
- Optional spell modifiers: `"effect":{"mods":[{"stat":"ac","value":2,"type":"dodge"}],"rounds":3}`. In active initiative, the effect expires through the V3.20 initiative-count deadline scheduler at the **caster's initiative**. Leaving combat migrates the remaining duration to the Fast Forward game clock. Outside initiative it uses the existing timed modifier mechanism.
- The returned result includes area cells, chosen creatures, initial dice, SR checks, saving throws, mitigation and HP/effect results. It does not assert that a spell was valid under rules not present in its definition (spell slots, prepared spells, components, normal spell range, line of sight to targeted subjects, etc.).

## Explicitly not yet implemented

Counterspell and dispel magic; caster spell slot/preparation economy; readied counterspell execution; arcane spell failure from armor, materials/components and silence/pinning; spell attacks such as rays/touch delivery through a full casting action; automatic attack-of-opportunity subturns and movement interruption during casting; metamagic; ongoing concentration-maintained spells; continuous zone-entry effects from persistent emanations and hazards; unusual spell shapes; complete condition polymorph, summon, or class-specific spell mechanics. **Advanced, Celestial, and Fiendish creature templates remain on the magic backlog.** Summoning should reuse runtime creature-registration/spawn with duration, dismiss and control limits added later.

## Verification

`node magic_tests.mjs`, all `*tests.mjs`, `python test_browser_v3_22.py`, plus relevant historical browser suites. `python build_demos.py` rebuilds `index.html`, `automation-demo.html` and `tests.html` without dependencies or network access. Sample spell JSON lives in the Spellcasting & Area Geometry panel; preview, casting, GM resolution and AoO confirmation are co-located.

The source is intentionally host-independent JavaScript; it has no AI decision maker, web access, or user-supplied executable code.
