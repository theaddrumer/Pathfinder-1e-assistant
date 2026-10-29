> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# V3.18 — Attack Completion (first resumed milestone)

This continues the older Attack Completion plan rather than adding Pending Events or tactical map logic. The calculator makes no character choices; the GM/controller selects an imported attack entry, target, damage intent, and exceptional circumstances.

## Nonlethal damage

- A `damageIntent: "nonlethal"` attack adds post-mitigation physical damage to a separate `nonlethalDamage` tally, instead of decreasing ordinary HP. Damage typing and DR remain those of the attack. Default unarmed attacks are nonlethal; using a lethal weapon nonlethally, or reversing an unarmed strike, normally imposes a -4 attack penalty. An attack can declare `nonlethalProficient: true` for a justified exemption.
- At nonlethal total equal to **current** HP, status is staggered; above current HP, status is unconscious (no actions/AoOs). This status is derived from live HP and nonlethal values so lethal injury can change it without a second bookkeeping operation. Construct/undead innate nonlethal immunity is respected.
- Once already-accrued nonlethal equals/exceeds **maximum** HP, later nonlethal hits become lethal, pending specialized regeneration behavior.
- `gm_apply_nonlethal` (GM, target, amount, optional damageType/cause/metadata) applies ordinary mitigation; `gm_heal_hp` (target, amount) restores up to maximum HP and removes equivalent nonlethal; `gm_heal_nonlethal` removes only the latter. These operations use snapshots and are undoable. Natural nonlethal healing with rest is **not automatic**: rest/downtime requires separate GM adjudication, as in V3.17.
- Limitations: nonlethal is currently supported through ordinary physical hit resolution and GM damage commands, not universal typed spell packets; unconsciousness/helplessness and regeneration have additional PF1e interactions that are not fully automated. Hit-point bars and other statuses still depend on their respective systems. Temporary HP/nonlethal interactions require further adjudication.

## Weapon size and dice

- `damageDie` plus optional `damageDiceCount` describe source dice. An explicit `damageSizeSteps` integer (-5..5) scales common PF1e weapon dice, without inferring size changes from creature size (the printed statblock already includes them). A 1d6 enlarges to 1d8; 1d8 enlarges to 2d6, rolled *once per hit* as a group. Static bonuses apply once per normal hit, and once for each critical multiplier iteration.
- Unsupported / ambiguous dice progressions fail with an explicit GM error rather than inventing a number. Import the resulting printed dice explicitly for rare/complex size interactions. Actual size and effective size change stacking remain GM-authored until their mechanics are separately implemented.

## Ranged attacks

- Imported attack entries can use `attackMode: "ranged"` or `"ranged_touch"`, plus `rangedKind: "projectile" | "thrown" | "ray"`. Projectile and thrown attacks declare `rangeIncrementFeet`; rays require `rangeFeet`. The engine uses 5-ft grid distance and -2 attack for each increment after the first. Projectile limit is 10 increments, thrown limit 5, and rays use the supplied maximum spell range. Ranged touch attacks use touch AC by default.
- Derived attack bonuses switch to Dexterity for ranged attacks; thrown weapons retain Strength-to-damage while ordinary projectiles do not. If a creature imports authoritative printed `statTotals.attack`/`statTotals.damage`, those totals are not reverse-engineered or silently changed: individual printed `attackOffset`, `damageOffset` and explicit attack entries remain the correct way to represent the creature. `attackAbility` or `damageAbility` can declare exceptional behavior on derived statistics.
- Firing into melee applies -4 when an ally threatens/is threatened by the target, or through a declared `firingIntoMelee` flag. `flags.preciseShot` prevents the penalty. Real walls and GM-supplied cover/concealment continue through the defensive layer. Existing full-attack routines may use ranged attacks and select targets for each strike. Prone defenders gain +4 AC vs ranged attacks instead of the -4 applicable vs melee attacks.
- Limits: automatic arrow/ammunition consumption, projectile interception/soft cover, point-blank AoO provocation, reload/crossbow action costs, firing into grapple, exact line-of-sight over partial-square obstacles, many combat feats, specialized ray spell effects, and composite bow constraints are not completely automated. GM may resolve exceptions via existing adjudication commands. Importer does not derive TWF penalties or combinations of primary/secondary natural attacks; published attack sequences are authoritative.

## Validation and build

`node attack_completion_tests.mjs`, `python test_browser_v3_18.py`, all existing `*tests.mjs` suites, and historical browser scripts V3.10–V3.17. Run `python build_demos.py` to regenerate `index.html`, `tests.html` and the standalone demos. `AttackCompletionGame extends TimeGame`, retaining the V3.17 clock and all earlier systems; `attack_completion_rules.mjs` contains validated attack/dice vocabulary.
