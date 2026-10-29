> Superseded import contract: use [CREATURE_IMPORT_V3_42.md](../../CREATURE_IMPORT_V3_42.md). Historical examples below are not current executable import recipes.

> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# V3.4 — GM-supplied runtime definitions

This milestone tests whether the *GM/rules interpreter* can provide unfamiliar mechanical data once and then use the deterministic rules engine for the rest of the encounter. There is **no autonomous AI, web/AoN retrieval, Adventure Path parser, or tactical decision code** in this version. JSON is the communication contract; the test browser form stands in for an AI caller.

## Mechanics that work

- Register a reusable creature definition with `register_creature` (GM only), then place independent instances with `spawn_creature` (GM only). The registry stores templates inside exported game state and preserves them through save/reload.
- Define printed combat totals (`statTotals`) such as `ac`, `attack`, `damage`, and Fort/Ref/Will. These are treated as authoritative **snapshots**, not recomputed from scratch and accidentally double-counted. Optional `abilityLinks` provide explicitly declared ability-modifier deltas for ability damage and buffs. Without such links the engine does not infer dependencies.
- Store raw ability scores, size, reach, speed, HP, typed modifiers, skills, and individual attack slots. Stats not supplied via `statTotals` use the earlier basic derivations. Printed `skills` bonuses are snapshots; advanced skill-specific effects remain limited.
- Attach the existing validated declarative trigger subscriptions to reusable creatures in a `rules` array. Rules are installed with per-instance owner IDs when a creature is spawned. This is how a Quickness-style extra move action can be supplied by the GM without modifying source code. Not all PF1 monster abilities can yet be represented.
- Register a reusable effect definition with `register_effect`, then apply or refresh it through `apply_registered_effect`. Same definition + same target refreshes duration rather than duplicating its modifiers. Expiration is currently implemented at the **end of the affected creature's turn**; this is a narrow scheduler policy, not a guarantee that every PF1 duration uses this precise timing.
- Import an effect such as *shaken* with `attack −2`, `saves −2`, `skill_checks −2`, and `ability_checks −2`. The six ability **scores** remain unchanged. Skill and ability d20 checks use imported bonuses plus active conditions, without natural-1/20 automatic results.
- Reject unknown creature fields, effect targets, invalid stat values, invalid grid spawn positions, unauthorized GM commands, and duplicate IDs. Invalid commands restore game state atomically.
- `inspect` returns a compact, read-only encounter view intended for AI/controller use. Actor and GM roles may inspect; the player role cannot retrieve the hidden GM view. `exportState()` contains definitions and active state for save files.
- Definition registration survives combat undo; creatures spawned during a turn, including their attached automatic rules, are rolled back with the turn when appropriate.

## Structured command contract

Call these on `RegistryGame`, which extends `AutomationGame` and preserves existing `dispatch` commands:

```js
const game = new RegistryGame(initialState());

game.dispatch({op:'register_creature',definition:{
  id:'marsh-raider-v1',name:'Marsh Raider',
  stats:{maxHp:26,str:16,dex:12,con:14,wis:10,bab:3,damageDie:6,
    statTotals:{ac:18,attack:7,damage:4,fort:5,ref:2,will:1},
    abilityLinks:{attack:['str'],damage:['str'],fort:['con'],ref:['dex'],will:['wis'],ac:['dex']},
    skills:{Perception:6},attacks:[{label:'Club',attackOffset:0,damageDie:6}]}
}},'gm');

game.dispatch({op:'spawn_creature',definition:'marsh-raider-v1',
  id:'raider_1',team:'enemy',x:4,y:4},'gm');

game.dispatch({op:'register_effect',definition:{
  id:'shaken',name:'Shaken',mods:[
    {stat:'attack',value:-2},{stat:'saves',value:-2},
    {stat:'skill_checks',value:-2},{stat:'ability_checks',value:-2}]
}},'gm');

game.dispatch({op:'apply_registered_effect',definition:'shaken',target:'raider_1',rounds:2},'gm');
const after = game.dispatch({op:'inspect'},'actor');
// after.creatures includes raider_1 with attack +5; Will −1.
const check = game.dispatch({op:'check',target:'raider_1',kind:'skill',
  subject:'Perception',dc:15},'gm');
```

This fictional Marsh Raider is a **test sample**, not an imported published Pathfinder creature.

## Browser test

Open `index.html` (same as `automation-demo.html`). Select **V3.4 — Import creature & shaken**, then:

1. Click **Activate automatic effects**.
2. Click **Register creature**, then **Spawn instance from definition**.
3. Click **Register effect** and **Apply / refresh effect**.
4. Inspect the combat card (Attack +7 becomes +5; Perception +6 becomes +4), and try the Perception check.
5. End turns until the affected creature has ended two turns, and observe the penalty expire.

The two JSON editors may be replaced with other supported data without modifying JS files. The Choker, Black Pudding, Archon, and Vienna demonstration fixtures remain selectable; `demo.html` is still the V1 legacy demonstration.

## Limits that matter architecturally

**Not a complete statblock translator.** An AI would still have to read the source, map it into supported numeric fields, identify rules that can be represented, and flag unsupported mechanics. The engine does not silently claim it understands an unknown monster ability.

**Not a complete Pathfinder rules engine.** No full feat/spell vocabulary, general regeneration, immunity/resistance system, complex ability damage recalculation, temporary HP, grappling, Grab/Constrict, nested reactions, detailed skill rank/ability synergies, damage reduction, nor full treatment of bonus stacking/source interactions. The engine cannot yet model every printed spell/attack dice expression. Imported AC ability links do not model maximum Dexterity caps, flat-footed/touch categories, or condition-dependent removal of Dex.

**Effect interaction limits.** Refreshing the same effect template on a target is supported; different fear conditions, fear escalation, suppression, immunity, replacement rules, and distinct sources must be interpreted outside this module. A `rounds` value is counted at the affected creature's turn end, and the GM must choose this approximation knowingly.

**No source integrity layer yet.** Definitions can include a `source` note, but no provenance verification, conflicting-source reconciliation, content indexing, or persistent external repository service exists. Definition IDs are immutable; use explicit IDs like `my-ap-troll-v2` for corrected versions.

The next useful increment is **source-to-schema validation and richer effect vocabulary**, then the full controller-facing interrupt/continuation protocol. These systems should not encode NPC tactics or morale.
