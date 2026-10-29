> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# V3.6 — Core conditions and generic ailments

## Architecture and responsibility

The AI GM decides what caused a condition, whether exposure happens, and whether a situational exception applies. The deterministic engine owns validation, modifiers, ordinary action restrictions, ticking saves, recurring damage, cure counts, removal, checkpoints, and a structured state view.

**This version does not attach riders to attacks.** Invoke `expose_ailment` explicitly after the GM determines that a hit or other exposure qualifies. This prevents hardcoding combat tactics or sources of injuries into the engine.

The Core Rulebook condition glossary and affliction rules are the reference used for the default catalog and interval model:

- https://legacy.aonprd.com/coreRuleBook/glossary.html
- https://aonprd.com/Rules.aspx?ID=417

### Standard conditions

`conditions.mjs` defines **34 named conditions** in data. Each entry has a coverage declaration (`automatic`, `partial`, `advisory`, `external`), an array of mechanical modifiers, narrow action restrictions, and prose advisories for the AI GM. Do not assume a partially supported effect is fully simulated. The current breakdown is 2 automatic, 24 partial, 7 advisory, and 1 external/item-based. The classification is conservative.

**Automatically supported:** Shaken's numerical penalties; Dazed's inability to take actions. Other conditions combine supported effects with missing special mechanics. Examples: Nauseated limits the controller to one move; Staggered limits move/standard; Fatigued and Exhausted adjust ability modifiers and disallow charge; Frightened attaches fear penalties and a proximity advisory; Prone applies melee AC and attack adjustments during a melee attack; Flat-footed chooses the published flat-footed defense against ordinary melee attacks and blocks AoOs. Nontrivial exceptions remain explicitly marked.

`list_conditions` is available for controller discovery. `apply_condition`, `remove_condition` are GM-only. An effect instance is not a rewrite of creature base stats. An identical condition reapplied refreshes its duration; fear escalation supersedes weaker fear rather than stacking duplicate -2 penalties. Applying fatigue while already fatigued escalates to exhaustion. These are basic normalizations, not an exhaustive Pathfinder condition-combination resolver.

Example:

```json
{"op":"apply_condition","condition":"frightened","target":"goblin_1","source":"hero","rounds":3}
```

A subsequent `move` or `double_move` that reduces distance to `hero` still works mechanically, but returns an `advisories` array. The GM decides whether it is a legitimate escape route.

## Generic ailment data schema

`ailments.mjs` validates reusable definitions. These require no per-poison or per-disease JavaScript. Definitions contain:

- `id`, `name`, `kind` (`poison`, `disease`, `dot`) and optional source/delivery labels;
- `save:{type:"fort", dc:15, initial:true, periodic:true}` (both booleans optional, default true when a save exists);
- optional `onset:{count:1,unit:"day"}`;
- optional `frequency:{every:{count:1,unit:"round"},maxTicks:6}` (unbounded when maxTicks absent);
- optional `cure:{successes:2,consecutive:true}` (false allows nonconsecutive successes);
- `effects`: `hp` dice + damage type; `ability_damage` dice + one ability; or a named `condition` (optionally with its own duration);
- optional `initialEffect:false` to avoid damage immediately upon failed exposure (for example, for a recurring bleed).

All intervals use explicit **rounds, minutes, hours, or days**. One minute = 10 combat rounds, one hour = 600, one day = 14,400. Variable onset expressions, such as 1d3 days, should be rolled by the GM and passed as a resolved interval for that instance; this version does not roll duration expressions internally.

### Sample reusable definition: fictitious injury poison

```json
{
  "id":"sample_venom_v1", "name":"Sample venom", "kind":"poison", "delivery":"injury",
  "save":{"type":"fort","dc":15},
  "frequency":{"every":{"count":1,"unit":"round"},"maxTicks":6},
  "cure":{"successes":2,"consecutive":true},
  "effects":[{"kind":"ability_damage","ability":"str","dice":{"count":1,"sides":4}}]
}
```

To use:

```json
{"op":"register_ailment","definition":{ "id":"sample_venom_v1", "name":"Sample venom", "kind":"poison", "save":{"type":"fort","dc":15}, "frequency":{"every":{"count":1,"unit":"round"},"maxTicks":6}, "cure":{"successes":2,"consecutive":true}, "effects":[{"kind":"ability_damage","ability":"str","dice":{"count":1,"sides":4}}] }}
{"op":"expose_ailment","definition":"sample_venom_v1","target":"hero"}
{"op":"gm_advance_time","count":2,"unit":"round"}
```

An initial successful save avoids the affliction. An initial failure contracts it and (if no onset) usually deals the first effect immediately. Further scheduled saves avoid each tick's effect; enough successes can cure the affliction. Cure and duration expiry stop additional ticks but **do not heal already dealt HP or ability damage**. `heal_ability_damage` is a separate GM-only operation.

The GM may use `gm_advance_time` to run downtime checks without manually playing thousands of combat turns. This only advances the separate elapsed-time clock for ailments; it does not simulate every character turn or decay every spell/effect duration. The browser exposes this intentionally limited control.

### Bleed or unsaved damage-over-time example

```json
{
 "id":"bleed_1d4","name":"Bleed 1d4","kind":"dot","initialEffect":false,
 "frequency":{"every":{"count":1,"unit":"round"}},
 "effects":[{"kind":"hp","damageType":"untyped","dice":{"count":1,"sides":4}}]
}
```

The engine schedules ongoing damage, but **does not yet automatically implement the PF1e rule that healing or a successful Heal check ends bleed**. GM uses `cure_ailment` when that happens. Likewise, poison dosing/stacking, immunities/resistances, multi-stage variant affliction tracks, uncertain trigger conditions, ability-drain/negative-level mechanics, variable onset dice, equipment dropping, concealment, and complete grapple rules are not implemented.

## Ability damage and ordinary scores

`ability_damage` is a **separate accumulated damage pool**, not a negative adjustment to the displayed base ability score. It applies -1 to relevant stat modifiers per 2 points of ability damage and affects imported skills and totals whose ability dependencies were declared. Ability damage to Con does not yet recalculate HP by HD, because imported monster definitions do not reliably contain all needed information; the engine logs a warning when damage reaches an ability score. The GM must adjudicate unconsciousness/death and restoration when needed.

## Controller commands

| Command | Role | Result |
|---|---|---|
| `list_conditions` | Any | List definitions with explicit coverage and advisory information |
| `apply_condition` / `remove_condition` | GM | Set, refresh or clear a named standard status |
| `register_ailment` | GM | Store reusable validated ailment definition |
| `expose_ailment` | GM | Make initial save and start ailment clock |
| `cure_ailment` | GM | Stop recurring affliction, keep prior damage |
| `gm_advance_time` | GM | Advance ailment clock; resolve due checks |
| `heal_ability_damage` | GM | Restore existing ability damage |
| `inspect` | AI actor / GM | Receive active conditions, ailments, clocks, ability damage, catalog IDs |

All new GM commands are validated and transactional: invalid inputs do not partially mutate the game state. Commands are not available as free creature actions. The source files may be imported by a Node-based controller, and the browser demonstrates the same commands without an LLM connection.

## Validation

Run `node condition_ailment_tests.mjs` for V3.6 regression coverage, and all the earlier `*.mjs` suites for backward compatibility. `python build_demos.py` rebuilds offline `index.html`, `tests.html`, and other HTML outputs; `python test_browser_v3_6.py` verifies the workbench.
