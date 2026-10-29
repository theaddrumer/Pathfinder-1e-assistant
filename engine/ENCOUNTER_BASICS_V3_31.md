# V3.31 — HP, recovery, small timers and objects

This release implements the agreed next calculator milestone. Open `index.html` for the offline workbench. Its complete engine is still `Kernel` from `kernel.mjs`. See `AI_GM_HANDOFF.md` for the project boundary and `COMMAND_REFERENCE.md` for the public command map.

## Shared owners

`encounter_basics.mjs` composes the existing persistent-area engine and is inherited by `MagicGame`. `object_rules.mjs` supplies the small material table and hardness arithmetic, also used by equipment Sunder. Existing HP damage/healing methods call shared hooks; attack and spell resolution have not been copied into another engine.

Creature `hp` remains the single HP total. `creature.vitality` stores facts that cannot be derived from HP: stabilization/conscious recovery, persistent death, aid, an explicit continuous-damage flag, and the next recovery deadline. `healthState()` derives the visible status. It does not install a second set of condition effects. `hasCondition()` and action policies recognize derived statuses. Use `gm_stabilize` for stabilization, rather than a separately applied `stable` condition.

Fast healing and regeneration are configured in `creature.recovery`. Recovery deadlines are indexed by the existing `clockDeadlines()` function; native recovery resolves them. Combat uses the shared turn-start path. Fast Forward processes only relevant deadlines and stops scheduling recovery pulses when nothing remains to recover. A long interval with more than the existing event-processing bound must be advanced in smaller pieces.

The new native Pending Event kinds are `cooldown`, `immediate`, and `regeneration_suppressed`. They share existing expiry/history/cancellation and initiative-to-clock migration. They do not create GM trigger checkpoints or generic conditional-event warnings. Their creation requires the dedicated command; generic triggering is rejected.

## HP and recovery contract

The complete Kernel now preserves negative HP. Living Constitution-bearing creatures become disabled at zero, then dying or stable below zero; reaching their death threshold latches death. Creatures with no Constitution are destroyed at zero. Existing Summon behavior still removes a summon at zero. Constitution loss and Energy Drain death integrate with the same status; restoration of a stat or ordinary HP healing does not silently restore life.

Stabilization runs on the creature's next turn or the next elapsed-round recovery deadline. It uses the existing Constitution-check modifier plus the negative HP penalty, with the specific natural-20 exception. A failed check costs one HP. Active DOT ailments, or a GM-declared continuous-damage flag, prevent stabilization checks from succeeding. Healing that restores actual HP stabilizes a dying creature. Aided and unaided hourly consciousness checks use the same clock; unaided failure loses HP. Rest qualification and subsequent natural healing are explicitly GM-managed.

Disabled creatures have restricted actions and movement. A standard action records a strain receipt; the one-HP cost is applied after its continuations finish unless the action increased HP. Other strenuous activities are supplied as GM damage/adjudication. Existing unconscious/helpless defensive exceptions and imported AC decomposition remain the established GM defense-input boundary.

```js
game.dispatch({op:'gm_get_health'}, 'gm');
game.dispatch({op:'gm_stabilize', target:'hero', aided:true}, 'gm');
game.dispatch({op:'gm_set_continuous_damage', target:'hero', active:true}, 'gm');
game.dispatch({op:'gm_set_recovery', target:'hero', recovery:{
  fastHealing:0,
  regeneration:{amount:2, bypass:['acid','fire']},
  disabled:false,
  excludedDamage:0
}}, 'gm');
```

The recovery command replaces the profile. Omitting regeneration removes that configured ability. The same `recovery` object can be a top-level creature-definition field. `disabled:true` turns off configured recovery and regeneration's protection. `excludedDamage` is a GM-maintained amount of missing HP that automatic recovery may not restore, for circumstances such as suffocation. Ordinary healing does not modify this declaration. Separate configured fast-healing and regeneration amounts add; the GM must supply only abilities that actually function together.

Matching damage that penetrates protection (including damage absorbed by temporary HP) suppresses regeneration using a one-round Pending Event anchored to the current initiative count, or elapsed time outside initiative. It can remove death protection immediately. A later matching hit refreshes the interval without shortening a longer declared suppression. The GM can supply a longer duration or manually cancel the event for a special rule. Packet component tags, weapon bypass tags and damage types are supported; arbitrary prose shutdown conditions are GM-managed. Regeneration does not convert lethal damage to nonlethal. Its existing nonlethal-overflow exception is enforced.

```js
game.dispatch({op:'gm_suppress_regeneration', target:'hero', rounds:2,
  reason:'GM confirms the special attack suppresses regeneration for two rounds'}, 'gm');
game.dispatch({op:'gm_adjudicate', kind:'health', target:'hero', hp:10,
  revive:true, reason:'GM resolved the restoration effect and its costs'}, 'gm');
```

Free Mode `kind:'health'` accepts `hp`, optional `revive`, `stable`, and `conscious`, with the existing required reason and override log. `revive:true` is the explicit life-restoration override; it does not resolve a resurrection spell, components, eligibility or side effects. Remaining lethal conditions still apply. Ordinary healing cannot repair objects; use their repair command.

## Immediate actions and cooldowns

```js
game.dispatch({op:'use_immediate', actor:'warden', label:'Declared response'}, 'gm');
game.dispatch({op:'gm_set_cooldown', target:'warden', ability:'Breath weapon', rounds:3}, 'gm');
game.dispatch({op:'gm_get_cooldowns'}, 'gm');
```

`use_immediate` is also available to the ordinary actor role, including the selected off-turn reactor. On the active creature's turn it spends the current swift resource. Off-turn it creates a debt lasting through the end of that creature's coming turn, consumes that turn's swift, and blocks another immediate until then. Explicit flat-footed and incapacitation policies apply. Initiative setup, undo, restoration and encounter-end migration preserve the debt. Elapsed time clears a remaining debt after a round.

This control is bookkeeping at a clear command boundary. It does not insert an arbitrary nested interruption into an already suspended attack or cast. The GM adjudicates the actual effect using the existing tools.

A cooldown is a named unavailable notice, with 1–100000 rounds supplied by the GM. Duplicate active names on the same creature are rejected. It clears automatically and logs a readiness notice; the existing Pending Events cancel control can clear it early. No effect is imposed on the creature's stats, and the reminder does not prevent the GM from using generic cone, damage or spell tools. A dragon's breath weapon still uses those existing tools.

## Objects

```js
game.dispatch({op:'gm_preview_object', material:'stone', thicknessInches:2}, 'gm');
game.dispatch({op:'gm_spawn_object', id:'stone_panel', name:'Stone panel', x:2, y:1,
  material:'stone', thicknessInches:2, size:1, sizeCategory:'medium'}, 'gm');
game.dispatch({op:'gm_spawn_object', id:'published_wall', name:'Published wall section', x:3, y:1,
  material:'stone', maxHp:90, hardness:8, size:1, sizeCategory:'large'}, 'gm');
game.dispatch({op:'gm_repair_object', target:'stone_panel', amount:5}, 'gm');
```

The helper creates an ordinary registry/map instance with an `objectProfile`; there is no separate object map or HP registry. `size` is its square footprint, while `sizeCategory` supplies the object AC modifier. Optional explicit `ac` overrides the estimate. Stone defaults to hardness 8 and 15 HP per inch. Other presets are glass, paper, cloth, rope, ice, leather, wood, steel, mithral and adamantine. Fractional estimates round down to at least one HP. Published `maxHp` and `hardness` take precedence. Large structures can be separate instances per section.

Objects take no turns and cannot act or threaten. Normal attacks, spell packets, persistent areas and GM damage target their existing token ID. They share protection and damage handling, with a hardness deduction after object scaling. Multi-component packets and a weapon's base/extra damage share one hardness deduction. Broken/destroyed state is derived from HP; surviving objects can be repaired explicitly. Critical and nonlethal defenses are automatic. Adamantine weapon hardness bypass is supported.

Unattended mundane objects fail saves without rolling. Optional `magicCasterLevel` and `attendedBy` supply magic/attended saves. The GM must still establish whether a spell or weapon can affect the object. Optional profile `energyMultiplier` and `rangedMultiplier` configure exceptional object responses. Per-damage GM metadata `objectMultiplier`, `ignoreHardness`, and `rangedWeapon` declare contextual exceptions; ordinary weapon attacks supply their own ranged classification. Do not infer siege engines, vulnerabilities, magical equipment enhancement or wall destruction from an object name.

Object tokens block placement through the existing occupancy checks. They do not automatically become opaque walls, create difficult terrain, collapse a building or remove other terrain tiles. Use the existing tile/defense controls for those GM decisions. Animated objects remain creature definitions, rather than this inanimate-object helper.

## UI, compatibility and validation

HP/recovery controls are with conditions; cooldowns and immediate bookkeeping are in Time & Events; object setup is beside creature imports. The grid retains living downed creatures, and stat cards show derived HP status. Free Mode includes explicit HP/life adjudication.

Old saved encounters gain vitality metadata when reconstructed by the complete Kernel. No old negative HP can be recovered from a save that already clamped it to zero. Three historical test expectations were updated: incapacitated casting now uses negative HP, while area/volley damage asserts actual negative HP. Lower-layer historical fixtures keep their original simplified HP defaults through the new hooks.

`encounter_basics_tests.mjs` covers 30 focused integration groups, including timer ownership, undo, death persistence, negative-HP areas, object packet/weapon damage, and rejection rollback. `test_browser_v3_31.py` covers four control workflows. The complete regression results are in `TEST_RESULTS_V3_31.txt`.

Rules references used for the implementation: [Injury and Death](https://aonprd.com/Rules.aspx?ID=164), [Regeneration](https://aonprd.com/UMR.aspx?ItemName=Regeneration), [Fast Healing](https://aonprd.com/UMR.aspx?ItemName=Fast%20Healing), [Immediate Actions](https://aonprd.com/Rules.aspx?ID=159), and [Smashing an Object](https://aonprd.com/Rules.aspx?ID=126).

Spell-to-condition convenience linking remains later work. Spell-specific interpretation, components/inventory, limb restoration, maintained concentration, antimagic adjudication, campaign rest and environmental consequences remain GM responsibilities. No comprehensive spell/feat/class database or AI integration is added.
