> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# V3.19 — Attack Routines, Ammunition, Reloading and Ranged AoOs

This completes the immediate, older **Attack Completion** milestone on top of V3.18. The engine remains an **AI-GM-operated rules calculator**, not a creature tactics generator or full PF1e rules interpreter. All combat decisions and exceptional rulings remain with the GM. Spellcasting, Pending Events, map redesign and template transforms remain in the future backlog.

## Derived plans versus printed full-attack sequences

**Existing imported `stats.attacks` arrays are still exact attack sequences by default.** No new penalties, extra attacks, hand assignment or attack order are inferred for them. The first example below is an optional **opt-in generator** used when the GM supplies *weapon entries* rather than a complete printed routine:

```json
{
  "stats": {
    "bab": 11,
    "str": 16,
    "attacks": [
      {"label": "Sword", "attackKind": "manufactured", "damageDie": 8, "limbId": "right_hand"},
      {"label": "Dagger", "attackKind": "manufactured", "damageDie": 4, "limbId": "left_hand"},
      {"label": "Bite", "attackKind": "natural", "naturalAttack": "bite", "damageDie": 6, "limbId": "mouth"}
    ],
    "attackPlan": {
      "mainIndex": 0,
      "offhandIndex": 1,
      "naturalIndices": [2],
      "twoWeaponFighting": true,
      "improvedTwoWeaponFighting": true,
      "offhandLight": true
    }
  }
}
```

The plan produces primary-hand BAB iterative slots (up to 4); one off-hand slot, plus one for Improved Two-Weapon Fighting and another for Greater Two-Weapon Fighting when declared; then each separate natural-attack entry once. Base dual-wield penalties are -6 primary/-10 off-hand. A light off-hand weapon grants +2/+2; Two-Weapon Fighting grants +2/+6. Off-hand additional slots take -5 and -10 relative to the first. Unspecified attack entries are **not** treated as repeated attacks, and the generated routine is visible in the browser workbench and `attackRoutine(id)`.

Natural attacks used together with manufactured-weapon attacks are secondary at -5 attack and half Strength damage, or -2 with Multiattack; pure natural primary/secondary designations are supported via `naturalRole`. A sole primary natural attack gains 1½ Strength damage. Generated off-hand and secondary natural damage applies half Strength, including relative to an expressly imported *standard main-hand* damage baseline when the generator is used. **Use the generator only if the source attack entries/baselines have not already included these routine-specific adjustments.** Do not invent additional iterative attacks for an imported printed natural-attack routine.

`limbId` is optional but useful: explicit shared identifiers prevent a weapon and a natural attack from being planned using the same appendage. The GM must still verify anatomical feasibility if limb IDs are not provided. Special exceptions, oversized weapons, flurry, Rapid Shot, Manyshot and conditional feats are not automatically inferred; explicit printed slots/offsets remain preferred for unusual situations.

## Ammunition stores and loaded weapons

Each creature can have a validated `stats.ammunition` registry and can reference stores from ranged entries using `ammoId`.

```json
{
  "ammunition": {
    "arrows": {"type": "reserve", "reserve": 20},
    "crossbow_bolts": {"type": "loaded", "capacity": 1, "loaded": 1,
                        "reserve": 12, "reloadAction": "move"},
    "throwing_knives": {"type": "reserve", "reserve": 3,
                         "ready": 0, "drawAction": "move"}
  }
}
```

`reserve` stores spend one round/item on each attack attempt, including misses. A reserve with `drawAction:"move"` requires a `draw_ammunition` operation to move ammunition from reserve into `ready`; firing consumes a ready unit, not reserve again. `loaded` stores require a positive loaded count before firing and subtract one per shot, even if the attack misses. `reload_weapon` transfers ammunition from reserve to the loaded magazine and expends `reloadAction` (`free`, `move`, `standard` or `full_round`; default `move`). The correct reload action depends on the specific weapon and feats and **must be declared**, not guessed. Special magazines and repeated loads are possible by configuring `capacity` and `amount`. The calculator does not assume that the actor has a free hand, a Quick Draw ability or Rapid Reload.

When an attack lacks an `ammoId`, it is **untracked** for compatibility with previous statblocks, not an assertion of infinite ammunition. To have automatic accounting, set a validated `ammoId` and its store. The store is part of game state and survives exports and rollback.

## AI-facing commands

```json
{"op":"reload_weapon","actor":"archer","ammoId":"crossbow_bolts","amount":1}
{"op":"draw_ammunition","actor":"archer","ammoId":"throwing_knives"}
{"op":"gm_set_ammunition","actor":"archer","ammoId":"crossbow_bolts","reserve":20}
{"op":"inspect"}
```

The reload/draw calls are gameplay actions by the active creature; `gm_set_ammunition` is a GM-only inventory correction and can set `reserve`, `loaded`, or `ready` counts within validation limits. `inspect` exposes ammo stores and an unresolved `pendingRangedAction`. The browser's Attack Completion panel holds derived attack routine previews, the ammunition and reload controls and the two sample definitions together.

## Ranged attacks provoking AoOs

When an ordinary projectile or thrown attack is attempted in a threatened square, the existing combat interrupt UI pauses and offers each eligible threatening opponent an AoO decision (`ranged_action_aoo`), observing the existing AoO-per-round limits. A reload also provokes unless its store declares `reloadProvokes:false` from a verified exception. Each AoO is resolved before the shot or reload is executed. Declining advances to the next reactor; taking the AoO may incapacitate the acting creature and cancel the pending shot or reload. An interrupted shot has **not yet** consumed its ammunition. This same mechanism preserves the index of a pending full attack, including its final strike. If an AoO itself generates a monster attack rider choice, the rider is resolved before the interrupted ranged action continues.

**Ray ranged touch attacks do not automatically provoke a second AoO merely for making the attack roll.** The separate spellcasting/casting-action provocation rules are still part of the future spell subsystem, not implied to be implemented here. Likewise, attacks of opportunity still use the kernel's existing simplified melee AoO profile; detailed equipped-weapon AoO selection, threat geometry, fighting defensively, concealment edge cases, spell disruption and full nested reactions are not yet comprehensive.

## Validation and limitations

- 20 new targeted V3.19 Node tests, total 27 Node suites; browser regression V3.10–V3.19 (11 suites).
- Existing printed routines, creature templates and previous release commands remain accepted. New `attackPlan` is strictly opt-in.
- GM should specify rules exceptions using printed attack entries or Free Mode rather than pretending the generator covers every class feature.
- Summoning is largely a use of existing `register_creature`/`spawn_creature` mechanisms; spell-specific duration, dismissal, allegiance and control limits still need the future magic system. Frequently used Advanced, Celestial and Fiendish templates are planned as reusable declared transformations; rare templates can stay GM-supplied. They are **not implemented in V3.19**.
- The AI tool/plugin adapter is separate: this JS engine exposes methods/commands, but each AI host requires its own calling transport and schema adapter. There is no universal plug-and-play integration yet.

## Code and rebuilding

`AttackRoutinesGame extends AttackCompletionGame` in `attack_routines.mjs`. Pure validation is in `attack_routine_rules.mjs`, with shared import declarations in `registry.mjs` and `attack_library.mjs`; `scenarios.mjs` instantiates the subclass. `build_demos.py` loads the validator before `registry.mjs`, and the runtime after `attack_completion.mjs` and before `scenarios.mjs`. Run `python build_demos.py`, `node attack_routines_tests.mjs`, and `python test_browser_v3_19.py` after modifications.
