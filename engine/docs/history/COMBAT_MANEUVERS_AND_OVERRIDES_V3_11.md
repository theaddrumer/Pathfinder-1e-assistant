> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# V3.11 — Advanced maneuvers and GM adjudication

This is a **mechanical kernel**, not an AI tactical controller. The creature's controller chooses what to do; the engine validates supported rules and records state. Unless otherwise specified, new maneuver implementations are **basic, grid-limited standard actions**. Advanced cases remain GM adjudications.

## Advanced maneuvers

The common operation is `maneuver` and uses the existing CMB/CMD, action accounting, maneuver AoO and rollback infrastructure. A successful basic maneuver is not an invitation for the kernel to choose an NPC's tactics.

- **Dirty Trick:** `kind:"dirty_trick"` with `condition` equal to `blinded`, `dazzled`, `deafened`, `entangled`, `shaken` or `sickened`. Those six choices are also **separate dropdown entries**, but internally share one maneuver. Normal duration is `1 + floor(max(0, success margin)/5)` rounds. `stats.greaterManeuvers:["dirty_trick"]` changes the base to 1d4 and the removal cost to a standard action. Otherwise an afflicted creature can spend a move action with `remove_dirty_trick` to remove the specific tracked effect. No AI decides when the target spends this action. Stronger preexisting conditions may supersede the attempted effect; the result explicitly reports this, without registering a phantom effect. Condition details inherit the V3.6 partial/automatic/advisory classifications.
- **Reposition:** `kind:"reposition"`, `path:[{"x":4,"y":3},...]`. The target moves up to one 5-ft square per 5 points over CMD, plus the first square. The planned path is validated for legal destination, reach throughout the movement (the last square may leave reach), and intrinsic terrain hazards. The GM/AI chooses the desired path instead of the engine selecting a tactic. The advanced AoO rules of Greater Reposition are not implemented.
- **Drag:** `kind:"drag"`. Basic implementation pulls an **adjacent** target straight behind the actor and moves the actor backward into unoccupied squares. Distance increases by 5 feet per 5 points over CMD, with the moving actor's speed as a cap. Movement geometry beyond this pairwise straight line, diagonal distance complications, and additional movement AoOs are still adjudicated by the GM.
- **Steal:** `kind:"steal"`, `item:"pouch"`. Requires an imported equipment entry that is neither held nor dropped, with `accessible:true`. `fastened:true` adds +5 to target's effective CMD. The actor needs a free hand if `freeHands` is explicitly imported. A successful steal transfers the recorded item to the actor. A closely worn or hidden item must not be marked accessible. This is independent of Disarm, which removes held items.
- **Overrun:** `kind:"overrun"`. A basic adjacent one-target version checks that an empty landing square exists beyond the defender. After a provoking AoO (if applicable), the defender gets a separate `overrun_avoid` decision. **Take/Avoid** allows passage without the CMB check; **Decline/Stand ground** contests CMB vs CMD and falling prone on a margin of 5. A registered `maneuverImprovements:["overrun"]` prevents both the initial AoO and the option to avoid. The current implementation is **not yet integrated into an ongoing move or charge** and does not resolve all other creatures' AoOs during that crossing. This is not a complete Overrun implementation.

Additional `stats.greaterManeuvers` (list of names) is validated alongside `maneuverImprovements`, and equipment entries accept optional boolean `accessible` and `fastened` flags. As with prior versions, maneuver bonuses from feats are supplied as authoritative modifiers rather than guessed or automatically added to printed totals.

### Example commands

```json
{"op":"maneuver","actor":"hero","target":"enemy","kind":"dirty_trick","condition":"blinded"}
{"op":"remove_dirty_trick","actor":"enemy","effectId":"condition_19"}
{"op":"maneuver","actor":"hero","target":"enemy","kind":"reposition","path":[{"x":4,"y":4},{"x":5,"y":4}]}
{"op":"maneuver","actor":"hero","target":"enemy","kind":"drag"}
{"op":"maneuver","actor":"hero","target":"enemy","kind":"steal","item":"pouch"}
{"op":"maneuver","actor":"hero","target":"enemy","kind":"overrun"}
{"op":"resolve_interrupt","take":true}
```

A pending Overrun avoidance uses the **same** `resolve_interrupt` operation, but `take:true` means **avoid**, not take an AoO; the response contains `interrupt.type:"overrun_avoid"`. Controller interfaces must use the interrupt type to label the choice correctly. It is intentional that the defender/AI chooses rather than the engine deciding.

## GM Adjudication — one audited gateway, same underlying rules

`gm_adjudicate` is **GM-only** and requires a nonempty `reason`. It routes to the existing modifiers/conditions/GM-rolls/action grants/relocation operations rather than creating a second condition system. Every invocation appends a bounded entry to the serializable `overrideLog` and is included in the undo state.

```json
{"op":"gm_adjudicate","kind":"modifier","target":"hero","stat":"attack","value":2,"reason":"Adventure situational attack bonus"}
{"op":"gm_adjudicate","kind":"condition","target":"hero","condition":"shaken","rounds":2,"reason":"Encounter fear effect"}
{"op":"gm_adjudicate","kind":"move_free","actor":"hero","path":[{"x":2,"y":3}],"allowanceFeet":5,"reason":"Magical floor grants 5 feet free movement"}
{"op":"gm_adjudicate","kind":"relocate","target":"hero","x":2,"y":3,"reason":"Scripted relocation"}
```

**IMPORTANT:** `speed` is not yet a legal ordinary modifier target; the engine will reject a speed modifier until the vocabulary supports it. To give 5 feet of movement now, use `move_free` with an explicit path, or grant an action if that better represents the source. Unsupported calculations must not be represented as successful. The GM may also use `kind:"damage"`, `"healing"`, `"remove_condition"`, `"remove_effect"` and `"grant_action"` with the same gateway.

`move_free` uses ordinary adjacent path validation, AoO pauses, entered-square hazards and zone triggers. It does **not** spend a standard or move action, and the GM can move a non-active creature. If moving the active creature, the engine still records that it moved for rules such as the five-foot-step prohibition. `relocate` directly changes a creature's square without treating intervening squares as traversed; it is appropriate for teleports or explicit placement, not walking through a trigger. Grappled actors cannot walk through a grapple with `move_free`; GM relocation may break the grapple via the existing teleport logic.

The Free Mode browser controls live in the *existing GM adjudication card*, next to modifiers and HP changes. To use free movement, select a target, a reason and a maximum distance, choose Free Movement and click a grid destination. Do not use the free-movement control to bypass a scripted hazard: the route resolves it normally. Free Mode is **not unrestricted code execution**.

## Not yet resolved

- Proper movement/charge integration and arbitrary-path geometry for Overrun/Drag, plus secondary/Greater feat AoOs.
- Melee attack replacement by maneuvers, simultaneous target reactions beyond the current bounded AoO scheduler, fully featured Grapple/Grab/Constrict, and multi-combatant interactions.
- Item access that requires geometry, size, limbs, or unusual equipment constraints beyond the explicit inventory flags.
- Full automation of all effects of the six Dirty Trick conditions; the V3.6 condition coverage labels and advisories remain authoritative.
- Recalculation of a creature's **speed** from a new generic modifier. GM free movement is supported now, but a persistent speed adjustment remains a future vocabulary extension.

**Rule references:** Pathfinder 1e Advanced Player's Guide combat maneuvers (Drag, Reposition, Dirty Trick, Steal); Pathfinder 1e Core Rulebook Combat (Overrun). The current kernel deliberately describes advanced cases as partial instead of claiming full PF1e compliance.
