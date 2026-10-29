> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# V3.10 — Combat Maneuver Framework

This release adds a **mechanical referee**, not autonomous monster tactics. The controlling AI/player chooses an action; the engine checks prerequisites, spends resources, rolls, resolves legal outcomes, and records state.

## What is executable

- Base CMB and CMD (with full PF1 combat-size table), using printed `statTotals` if supplied. Tiny and smaller creatures use Dexterity in place of Strength for calculated CMB. Ability damage, drain, and existing adjustments still propagate through the existing stat model.
- Typed AC modifiers that apply to CMD, loss of positive Dexterity/dodge when flat-footed, extra legs against Trip/Disarm, and +4 against stunned opponents. General attack penalties (e.g. Shaken) also modify CMB. `stats.maneuverModifiers` supplies exceptions instead of requiring source edits.
- `maneuver` as a **standard-action** gameplay command for Trip, Disarm, Sunder, Bull Rush, and Grapple. Size/reach restrictions and relevant immunity checks are applied. A provoking maneuver pauses for a **target AoO**; damage from that AoO penalizes the maneuver's subsequent check. Improved feats/abilities may be registered in `stats.maneuverImprovements` to suppress provoking; register their numerical bonuses separately.
- Trip inflicts Prone; failure by 10 makes the attacker prone. Disarm modifies *registered held items*, including both hands on a margin of 10, with failed-by-10 backfire for a registered attacking weapon. Sunder uses the selected item's hardness and HP; reaching half HP sets Broken. Bull Rush moves a target away until a blocker intervenes (one-target straight-line subset only).
- One-on-one Grapple: initial grapple produces a tracked holder/target relationship and grappled conditions, pulls the target adjacent if a legal square exists, allows free release, standard-action maintaining (+5 on subsequent rounds), escape using CMB or an imported Escape Artist total, reversal, pinning and basic maintained-grapple damage. The grapple expires if not maintained on the holder's following turn. Undo restores the relationship and condition effects together. Ordinary walking out of the hold is blocked. Teleporting a participant releases it.
- Weapon equipment linking: an attack with `itemId` cannot execute once its registered weapon is dropped/destroyed, and inherits Broken penalties if the item is broken.

### Commands

```json
{"op":"maneuver","actor":"hero","target":"warden","kind":"trip"}
```

This may return `{"status":"interrupt","interrupt":{...}}`. The target's controller submits `{"op":"resolve_interrupt","take":true}` or `false` to finish the original check. As with movement, the original action is not taken twice.

```json
{"op":"maneuver","actor":"hero","target":"warden","kind":"sunder","item":"sword"}
{"op":"grapple_action","actor":"hero","kind":"maintain","option":"pin"}
{"op":"grapple_action","actor":"warden","kind":"escape"}
{"op":"grapple_action","actor":"hero","kind":"release"}
```

Only GM-authorized commands may inject manual extra CMB, a precomputed sunder damage amount, or the `gm_maneuver_check` operation; ordinary actor commands cannot forge bonuses. An ordinary legal maneuver always consumes its standard action even if the check fails.

### Creature data extensions

`stats.sizeCategory` is one of Fine, Diminutive, Tiny, Small, Medium, Large, Huge, Gargantuan, Colossal (lowercase IDs), **separate from grid-footprint `stats.size`**. Optional `legs`, `tripImmune`, `flying`, `freeHands`, `grab`, `maneuverImprovements`, `maneuverModifiers` and `equipment` are accepted after strict validation.

Equipment entries contain `id`, `name`, `location` (`held`, `worn`, `carried`, `dropped`), and optionally `hp`, `maxHp`, `hardness`, `broken`. An attack may refer to the item's ID through `itemId`. For Sunder, the item must have explicit durability data. Published full stat totals continue to be authoritative rather than recalculated from undocumented equipment bonuses.

## Still unsupported or partial

- Full-attack / AoO **attack replacement** by maneuvers, Bull Rush as a charge replacement, and target-supplied AoO during actions of another kind. The library records their PF1 legal action possibilities, but V3.10 executes only standard-action maneuvers.
- Drag, Reposition, Overrun, Dirty Trick, Steal: defined and explicitly **rejected** when executed, rather than pretending to resolve their movement/effects.
- Several grapple branches: multiple grapplers/Aid Another, the free Grab rider after an attack, −20 appendage holds, tying up, grappled spellcasting, movement while maintaining a hold, full handedness restrictions, Constrict, and interactions with equipment. `grappleAction` basic damage does not yet implement weapon selection.
- Sunder's non-object-defining exceptions, magic item durability, equipment-based AC recomputation after Disarm or Sunder, and objects without registered hardness/HP.
- Collision chains during Bull Rush, more sophisticated spatial movement, unusually shaped bodies, range/cover geometry, full natural attack/critical mechanics, and nested reaction queues beyond the bounded maneuver-AoO continuation.

**Design constraint:** Missing data produces rejection or a visible limitation. The engine does not guess the missing item durability, maneuver feat bonuses, or tactics. GM adjudication commands remain available for unusual cases.

Rule reference: Pathfinder 1e Core Rulebook, Combat Maneuvers and Grapple (Archives of Nethys); Advanced Player's Guide maneuvers are represented but not executed in this release.
