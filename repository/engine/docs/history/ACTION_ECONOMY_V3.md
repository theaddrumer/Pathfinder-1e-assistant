> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

> **Historical V3 specification:** V3.3 adds a limited working `full_attack` sequence. See `CHANGES_V3_3.md`. References below to missing full-attack resolution describe V3, not the current build.

# Tabletop Kernel V3 — Action economy and command separation

**Status: executable prototype, October 12, 2026.** This phase builds on the V2 automatic-rule engine; it does not implement complete Pathfinder 1e action timing, spellcasting, or every special action. `core.mjs`, `automation.mjs`, and `scenarios.mjs` remain the central engine. No AI or live rules database is connected.

## What changed

Previously the kernel had `actions.standard` and `actions.move` Boolean flags, and prevented all second movements. However, PF1e explicitly lets a character substitute a move action for a standard action, so an ordinary character could not double-move. Nor could a choker's extra move action be represented without creature-specific logic. Now each turn begins with **`actions.resources = {standard:1, move:1, swift:1}`**. An action spends an available resource, and automatic rules can grant additional resources to the active creature.

- **`move`** spends one remaining move resource; if none remain, spends one standard. This works for actual movement and nonmovement move-equivalent actions.
- **`attack`** spends one standard and resolves the current single-attack model. The AoO resolver still spends an AoO resource, **not** the interrupting creature's normal action resources.
- **`use_action`** validates and spends an action for a rules-adjudicated activity not yet implemented as a mechanical operation. Supported types are `move`, `standard`, `swift`, `full_round`. This is an *action ledger only*: it does not cast a spell, draw a weapon, grapple or resolve a full attack by itself.
- **`full_round`** uses one standard and one move resource. Remaining extra move resources (e.g. choker) and swift resources are still spendable. Special full-round limitations are not modeled.
- **Five-foot step** consumes neither a move nor a standard resource, may occur before/after nonmoving move-equivalent actions, and is not allowed in a turn containing other actual movement. AoOs are still skipped for a step. The existing partial path and terrain restrictions remain.
- `end_turn` resets the action resources and then emits `turn_start`; enabled automatic abilities can grant the new active creature additional actions. Grant sources are recorded in `actions.grants`, and undo restores both ledger and RNG.

## Generic action grants and Choker Quickness

The automation vocabulary gained one new operation, `grant_action`. It works for **any** registered rule, not only the choker. Its data fields are `target`, `type` (`standard`, `move`, `swift`) and optional positive `count` (1–4); the resource pool is capped for safety. Currently a grant is confined to the *active* creature, so this is not yet an off-turn scheduling mechanism.

The new declarative rule in `scenarios.mjs` is:

```js
export const chokerQuickness={
  id:'choker-quickness',owner:'warden',on:'turn_start',
  when:[{op:'eq',left:{ref:'event.actor'},right:{ref:'rule.owner'}}],
  actions:[{op:'grant_action',target:{ref:'rule.owner'},type:'move',count:1}]
};
```

On the choker's turn, it receives standard **1**, move **2**, swift **1**. It may execute three move actions (spending its standard as the third), or expend a standard and both moves, or expend a full-round action and still have one additional move. The rule is installed as event data: the kernel has no `if (creature.type==='choker')` logic.

**Edition-specific:** PF1e Choker Quickness grants one **move action**; the 3.5 version offered a standard *or* move action. Sources:
- PF1e monster: https://pathfinder.d20srd.org/bestiary/choker.html
- 3.5 monster: https://www.d20srd.org/srd/monsters/choker.htm
- PF1e action types: https://www.aonprd.com/Rules.aspx?ID=129

## Capability/authorization boundary

Commands that represent ordinary game actions are **action-budget checked** even when executed by a GM:

| Command | What it does | `actor` / `player` role | `gm` role |
| --- | --- | --- | --- |
| `move`, `attack`, `use_action` | Spend legal gameplay actions | Allowed | Allowed |
| `end_turn`, `resolve_interrupt` | Advance turn / resolve a permitted reaction | Allowed (player restricted to Explorer) | Allowed |
| `admin_damage` | Apply typed direct damage, invoke subscribed triggers; **no turn action expenditure** | Denied | Allowed |
| `admin_attack` | Out-of-turn/no-resource single attack override | Denied | Allowed |
| `admin_grant_action` | Grant resources with logged source | Denied | Allowed |
| `apply_effect`, `remove_effect`, `save`, `teleport`, `random_teleport`, undo controls | Existing privileged test/GM operations | Denied | Allowed |

`actor` is the default role if no role argument is supplied, and is the intended **AI creature-action role**: it can act for the currently active creature but cannot perform administrative effects. `player` is the earlier hard-coded single-Explorer demo role. **`gm` is a privileged adjudicator role**; an AI GM should submit ordinary choices through `actor`, and use `gm` only for explicit overrides or administrative resolution. Proper multiplayer permission identities are still future work.

The former `deal_damage` command remains as a **GM-only backwards compatibility alias**; the V3 demo uses `admin_damage` so the distinction is visible. V2's Split/terrain demonstrations remain direct-event tests, not simulated weapon attacks or spellcasts. Automatic `deal_damage` actions registered inside rules are automatic effects, also not free creature choices.

## How to test

Open `automation-demo.html` directly in a desktop browser. Choose **Choker — Quickness**, activate, then end the Explorer's turn. The display should show `standard 1, move 2, swift 1`. Click *Choker: move 5 feet* three times; the fourth click should be rejected. Alternatively reset, start its turn, expend a full-round action, and verify one move still remains. The original Archon, Black Pudding and Vienna fixtures remain available.

With Node.js 22+ run:

```bash
node tests.mjs
node vocabulary_probe_tests.mjs
node automation_tests.mjs
node action_economy_tests.mjs
```

The action tests check ordinary/double-move, standard-for-move substitutions, additional move grants, movement after a full-round action, a step after nonmovement move-equivalent actions, action rollback, strict GM versus AI actor rights, AoO usage, repeated grants on later turns, and Choker Quickness in actual movement.

The standalone HTML demos are generated from the current modules by `python build_demos.py`. Python is **only a developer build tool**: the finished HTML demos do not require Python, Node, hosting, or internet access.

## What remains missing

This phase is a **bounded action-resource ledger**, not a complete scheduler. It does **not** yet implement immediate actions or the next-turn swift cost, free-action moderation, partial/special full-round actions, surprise rounds, delay/ready, attacks of opportunity for spellcasting and standing, multi-attack/full-attack resolution, or nested/competing reactions. Generic `offer_interrupt` remains limited to safe start-of-turn or test-event boundaries; the V2 tests continue to reject damage-time optional offers.

More importantly, `use_action` cannot automatically apply arbitrary spell/maneuver/item effects: those require the later rules interpreter to express the underlying ability with validated operations. New extra-action sources need to be adjudicated for timing and restrictions before their rule data is registered. Future work should combine the action ledger with resumable event/interrupt transactions before allowing an LLM to run real combat.
