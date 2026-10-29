> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# Framework proposal: AI GM + generic mechanical engine

## Goal

Build a Pathfinder First Edition GM that behaves like a referee at a tabletop, not a video game AI. It may improvise and rule on unusual actions, but standard calculations are delegated to deterministic code. Every persistent rule interpretation is attributable, auditable, replaceable, and reversible within the campaign's permitted undo window.

**Primary design constraint:** do not implement every feat, spell, and monster as bespoke engine source code. Implement a reasonably small *mechanical vocabulary*, then represent abilities as declarative combinations of those operations. Treat the natural-language rule interpretation as an *AI compilation step*; during play, prefer the already-approved compiled behavior.

## Five components

1. **Battlefield state and scheduler (deterministic).** Stores creatures, tiles/regions, heights, HP/resources, positions/footprints, temporal effects, initiative, current action, interrupt stack, and RNG state. Validates operations. Calculates derived stats and performs transactions.
2. **Rules registry (data, not code).** Each rule has an ID, source title/URL, text excerpt or permissible reference, version, origin (`paizo`, `third_party`, `campaign_homebrew`), dependencies, typed conditions/operations, confidence level and test status. Campaign rules choose eligible sources and explicit overrides.
3. **Rules interpreter/compiler (LLM + verification).** Reads source rules on demand, identifies conditions, effects, action permissions, duration and exception clauses, and proposes structured definitions. Definitions must pass schema validation and examples. Ambiguities or unsafe unsupported operations are flagged to the GM/admin.
4. **Tactical/narrative GM (LLM).** Queries engine for current *legal* options, ranks plausible candidates with respect to creature knowledge, objectives and personality, chooses a permitted action, narrates the resolved result. It cannot bypass the engine through persuasion or fabricated authority.
5. **Human-facing interface.** Displays map, roll breakdowns, rules citations, effect sources, interruption prompts, GM adjudications, dispute process, and the two undo controls. Supports campaign administrators and players with distinct permissions.

## Rule priority and consent

An explicit campaign manifest records source versions and exceptions:

- Official baseline: enabled by default.
- Named third-party packages: individually enabled, and their mechanical compatibility tracked.
- House rules: selected preset and version or uploaded written rule; explicit precedence over conflicting base rules.
- Improvised GM ruling: logged with encounter and subject; temporary unless the campaign administrator makes it permanent.

A request by an ordinary player to change a rule is *not* a privileged engine instruction. The model may explain the applicable sources, reconsider genuine counterevidence and correct a mistake, but unauthorized prompts may not modify source priority, mechanics, or permissions. Single-player can intentionally grant the player override authority.

## Proposed mechanical vocabulary

Rather than hundreds of ability-specific handlers, the rules layer uses combinations of primitives:

| Domain | Primitives (examples) |
|---|---|
| Stats | `grant_modifier`, `suppress_modifier`, `modify_ability`, `modify_resource`, `recalculate_derived` |
| Rolls | `roll`, `save`, `attack_check`, `opposed_check`, `set_DC`, `roll_with_advantage_like_exception` |
| Positions | `step_path`, `teleport`, `forced_move`, `swap`, `create_area`, `occupy_space` |
| Effects | `apply_condition`, `expire_on_timer`, `end_on_event`, `suppress_while`, `resume_if_valid` |
| Turns | `spend_action`, `grant_action`, `replace_action`, `delay`, `ready`, `queue_interrupt` |
| Creatures | `summon_entity`, `remove_entity`, `change_size`, `change_controller`, `modify_body_capability` |
| Targeting | `filter_entities`, `test_range`, `test_reach`, `test_line_of_effect`, `test_area_intersection` |
| Choice/logic | `roll_table`, `choose_target`, `if/else`, `repeat_limited`, `subscribe_event` |
| Authority | `propose_ruling`, `submit_rule_definition`, `request_override`, `undo_turn`, `undo_round` |

**Important:** These are *proposed contracts*, not implementations claimed to exist in prototype 0.1. Avoid general-purpose generated Python/JS in the active rules layer; use a typed expression tree and bounded actions so generated definitions can be inspected and tested. A pure scripting escape hatch, if ever allowed, should run in a separately sandboxed extension process with explicit consent and version pinning.

## State model

An eventual state model:

```json
{
  "campaign": {"ruleset": "pf1", "rulesManifestVersion": 4},
  "combat": {"round": 5, "activeActor": "c17", "phase": "declare"},
  "entities": {"c17": {"position": [6,4,0], "size": "Large", "baseStats": {}, "resources": {}}},
  "effects": [{"id": "fx72", "target": "c17", "source": "c9", "originRuleId": "rule:123", "remaining": 2}],
  "pending": [{"kind": "aao_decision", "actor": "c9", "interruptedActionId": "act23"}],
  "randomState": {"streamId": "combat-1", "cursor": 138}
}
```

Coordinates, source IDs, modifiers, derived values, timing, and action results should be authoritative in *one* database. Descriptions in the LLM's prose are not game state. Roll breakdowns reference the actual effect IDs that contributed to the final number. Persist a transaction/event log and periodic snapshots.

## Transaction and interruption model

A full action should pass through these phases:

`declare → validate → reserve action cost → before-action event → reaction window → execute atomic substep → after-event → next substep → commit`.

Example: Explorer walks from square A through the Warden's threatened region.

- The engine computes the intended path and recognizes that movement **out of** a threatened square may provoke.
- It pauses *before leaving* the provoking square, records exactly what action is suspended and who may respond, and asks for an AoO decision.
- Attack is resolved, including any event effects and possible incapacitation. The engine checks whether the suspended movement is still legal, resumes or cancels appropriately.
- Ordinary movement checks are quick deterministic geometry calculations. The AI is only needed for uncertain rules interpretation, NPC decisions or narration—not for every tile.

A full implementation requires an **interrupt stack and priority policy** (especially readied actions, multiple simultaneous opportunities, immediate actions, concentration and re-entrant event chains). Prototype 0.1 contains just one kind of interrupt, paused AoO during movement.

## Declarative rule example: menace-style aura

Illustrative instruction format (not a literal published-rule transcription):

```json
{
  "ruleId": "sample:menace",
  "event": "failed_will_save_vs_aura",
  "targetSelector": "failing_hostile_creature",
  "operations": [
    {"op":"grant_modifier", "stat":"attack", "type":"untyped", "value":-2},
    {"op":"grant_modifier", "stat":"ac", "type":"untyped", "value":-2},
    {"op":"grant_modifier", "stat":"all_saves", "type":"untyped", "value":-2}
  ],
  "until": [{"kind":"hit", "attacker":"affected", "defender":"aura_source"}]
}
```

The **engine** knows about penalties, saving throws and event subscriptions. It has no hard-coded `aura_of_menace` function. Its source registry would additionally preserve the exact 24-hour timing and the source-specific immunity clause required by the real ability; the prototype demonstration does **not** do so.

## Vienna's Alien Presence as a trial compilation target

The uploaded statblock supplies: Fort DC 34; a failed save produces a random-direction teleport up to `1d20 × 10 ft`; an invalid placement inside a creature/object or outside aura range uses the nearest safe square. That is a good stress test of the generic rule model, because it needs geometry, RNG, safe-square policy, area bounds and forced relocation, not a dedicated `vienna_teleport()` function.

Open adjudication policies to settle at campaign setup or via GM ruling: how a *random direction* is sampled on the grid (8 compass directions vs continuous angles), how the optional maximum displacement is chosen, how the nearest valid square is selected when there are ties, what happens if there is no valid square, and when the aura triggers against each creature. The rules engine should not silently invent one of these policies and present it as RAW.

## Rollback and table culture

Keep two visible control points: **start of last actor's turn** and **start of current round**. Internally retain sufficient event records for crash recovery and debugging. A campaign setting can enforce the user's preferred norm: errors discovered after more than one turn are ordinarily corrected for future calculations without replaying old turns. Administrator override is possible.

Snapshot: entity state, pending actions/interrupts, source-rule versions, RNG state, conditions, duration clocks, resource expenditure and event sequence ID. A rewind cannot merely reverse the last numeric modifier: its downstream effects (HP, targeting, positions, triggers) must also be restored. Keep or reroll dice is a campaign policy; prototype 0.1 preserves the RNG state and will normally repeat the same rolls.

## Correctness and safety contracts

- Accept only schema-valid operations, with a whitelist of stat names, effect fields and bounded magnitudes.
- A rejected operation must be atomic: no partial state changes, no accidental consumed action.
- The original character data and effects are separate; derived numbers are recomputed from authoritative sources.
- Every applied effect carries `source`, `rule ID`, `version`, `start`, `end`, and a human-readable explanation.
- No LLM may execute arbitrary code or change campaign rules directly during combat.
- The engine can refuse a proposed ruling and ask for admin adjudication if its vocabulary cannot express the effect.
- Rule interpretations are testable and reusable; interpretation confidence is not a substitute for a test.
- Detect circular triggers, recursion, infinite interrupts and incompatible rules packages through execution limits and dependency validation.
- Client UI is not trusted with authoritative combat state in multiplayer; deploy a server state authority before multiplayer.

## Work order and milestones

**Milestone A — current demonstrator:** raw stats, typed bonus samples, simple movement, pause/resume AoO, direct effect registration, rollback. Done in prototype form. Not PF1-rules complete.

**Milestone B — reliable tabletop kernel:** conditions, typed stacking tested against PF1, all action types, formal interrupt scheduler, area geometries, height/line of sight, source-tagged modifiers, full turn accounting, explicit states for unconscious/disabled, robust persistence and test suite. This is the hardest architectural checkpoint.

**Milestone C — rules vocabulary:** schema for triggers, predicates and bounded operation sequences; dry-run interpreter; diagnostics when operations can't represent a rule; human approval. Compile a curated sample: Aura of Menace, Pounce, Spring Attack, regeneration, poison, polymorph, Grab/Swallow Whole, Antimagic Field, and Vienna's aura.

**Milestone D — source library and campaign config:** AoN/PFSRD references, source identity, third-party opt-ins, Elephant in the Room package choices, ABP, house HP rules, user-supplied Champion system, document provenance, conflict resolution and permissions. Respect content licenses, citation/attribution, and third-party redistribution rights before publishing.

**Milestone E — AI pilot:** tool-calling GM that asks the engine for legal options, makes tactical choices and narrates outcomes; queries authoritative rules only when needed; declines social pressure unsupported by rules; accepts legitimate challenges and uses explicit rollback controls. Compare against logged human-adjudicated PF1 scenarios.

**Milestone F — multiplayer / VTT:** server authority, role controls, Roll20/Foundry adapter, multi-client sync, campaign persistence and human override workflows. Roll20 API capabilities are plan- and integration-dependent.

## Known open choices for human GM adjudication

- Tie-break policies for randomly displaced or nearest-safe placements (Vienna).
- How rule ambiguity and "rule of cool" should be labeled versus persistent precedent.
- Simultaneous off-turn choices: order, consent, timeout policy and hidden information.
- Whether rollback should keep initial dice values or draw fresh dice.
- Who may change source versions or house-rule packages during a live encounter.

These require decisions **eventually**, but do not block the current engine prototype.

## Licensing and sources

The prototype includes synthetic combatants and short descriptions of mechanics; it does not redistribute a bulk Pathfinder rules database, Paizo art or the submitted Vienna page. For any public tool, content ingestion and distribution must be reviewed against the applicable OGL/ORC licenses, Paizo's trademark/compatibility guidance, and the rights of third-party publishers. Public readability on AoN/d20PFSRD is not equivalent to unrestricted redistribution rights.

Official background used for the architecture:
- AoN: https://www.aonprd.com/Rules.aspx?ID=102 (attacks of opportunity)
- AoN: https://www.aonprd.com/Rules.aspx?ID=129 (action types)
- AoN: https://aonprd.com/Rules.aspx?ID=119 (tactical movement)
- Paizo: https://paizo.com/licenses (licenses and compatibility)
