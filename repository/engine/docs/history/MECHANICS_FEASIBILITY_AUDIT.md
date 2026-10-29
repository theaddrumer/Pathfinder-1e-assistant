> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# Mechanical vocabulary feasibility audit — PF1e

**Status:** exploratory engineering audit, October 2026. This is *not* a claim to implement complete published Pathfinder 1e mechanics. Eight new automated tests check a limited data-driven event interpreter (`vocabulary_probe.mjs`). The 16 V1 kernel tests are unchanged and still pass.

## Research question

Can an AI referee express unusual published abilities by submitting combinations of **general-purpose engine instructions** instead of requiring a newly coded handler for every named feat, spell, or monster?

**Initial finding:** Yes for three limited examples in an executable probe, and architecturally plausible for the other examples below. But expressing a rule as data does **not** eliminate the need to program each *category* of general-purpose operation. Correct event timing, control of bodies, persistence, area geometry and multi-object transactions are significant work.

| Target ability | Needed reusable operations | Probe status / omitted complexities |
|---|---|---|
| **Archon Aura of Menace** | Event filter (`save_failed`), apply multiple typed/untyped penalties, listen for `hit` to remove effect | **Tested in probe:** applies penalties and removes them on affected creature hitting source. **Not tested:** actual Will save, 24-hour expiration, 24-hour per-source immunity, frightened/fear interactions, exact Aura of Menace RAW. |
| **Vienna's Alien Presence** (user homebrew) | Area membership + trigger, Fort save, random vector/distance, find safe destination, teleport | **Conceptually mappable.** V1 sample random teleport is explicitly *not* this ability; needs proper radius, `1d20 × 10 ft`, closest-safe-square algorithm and agreed random-direction policy. |
| **Black Pudding Split** | Before-damage hook, filter on damage category and minimum HP, prevent original damage, halve HP, clone entity | **Tested in probe** with rules expressed solely as data. **Not tested:** placement of the new Huge creature, copied conditional behaviors, initiative timing, ownership, effects/spells on the copies. |
| **Contingent Action** | Event subscription with a condition, interrupt offer, optional/declinable execution, one-shot discharge | **Tested in probe:** a qualifying event creates one optional pending action and discharges rule. **Not tested:** movement legality, timing/initiative, restrictions on permitted actions, spellcasting restrictions. |
| **Antimagic Field** | Moving area membership, effect tags (`spell`/`SLA`/`Su`/`Ex`), suppression without deletion, durations ticking through suppression, exemptions | **Requires new reusable primitives.** Not implementable as mere numerical modifiers; summoned-creature disappearance/reappearance and unusual exemptions compound the problem. |
| **Possession** | Separate controllers from bodies, compose physical/mental stat sources, lock out host's actions, store original body; return/ejection/death transitions | **Requires new reusable entity/control model.** Not a new function per spell, but a major extension to ordinary character state. |
| **Time Stop** | Separate apparent-turn schedule, targeting and interaction restrictions, deferred external effects, temporal duration ledger | **Requires new scheduling primitives.** An especially good stress test for off-turn state and order-of-events correctness. |
| **Wall of Stone** | Create persistent custom-shaped terrain object, 3D geometry, collision/support, hardness and HP for sections | **Requires geometry and persistent-world object primitives.** A numeric AC/HP adjustment cannot faithfully represent player-chosen wall shapes or ramps. |
| **Gunpowder Ooze** | On-damage trigger, query attack origin/direction, cone-or-burst fallback, saves/typed damage, split; timed residue triggers when attacked/using firearm/catching fire | **Potentially composable**, but demands reliable event chains, spatial templates and source-direction information. Excellent stress test for recursive triggers and event queues. |

### Sources consulted

- PF1e [Aura of Menace, see Archon traits](https://aonprd.com/UMR.aspx?ItemName=Aura%20of%20Menace) (the precise sources and ability versions must be checked before treating the probe as published-rule compliant)
- PF1e [Split UMR](https://aonprd.com/UMR.aspx?ItemName=Split), [Black Pudding](https://aonprd.com/MonsterDisplay.aspx?ItemName=Black+Pudding)
- PF1e [Contingent Action](https://legacy.aonprd.com/advancedClassGuide/spells/contingentAction.html)
- PF1e [Antimagic Field](https://aonprd.com/SpellDisplay.aspx?ItemName=Antimagic+Field)
- PF1e [Possession](https://legacy.aonprd.com/occultAdventures/spells/possession.html)
- PF1e [Time Stop](https://aonprd.com/SpellDisplay.aspx?ItemName=Time+Stop)
- PF1e [Wall of Stone](https://legacy.aonprd.com/corerulebook/spells/wallOfStone.html)
- PF1e [Gunpowder Ooze](https://aonprd.com/MonsterDisplay.aspx?ItemName=Gunpowder+Ooze)
- Vienna's Cosmic Dragon sheet supplied in conversation

## Actual executable mini-experiment

`vocabulary_probe.mjs` deliberately knows **zero named abilities**. It supports only:

- Trigger rule on a named event and evaluate bounded, data-only predicates (`eq`, `gt`, `one_of`).
- Resolve values from event/rule/entity references and perform limited arithmetic (`floor_div`, `add`, `multiply`).
- Execute a tiny operation whitelist: `apply_effect`, `cancel_event`, `set_hp`, `duplicate_entity`, `offer_action`.
- Remove an effect on a matching event; discharge one-shot triggers.
- Roll back all mutations from an event if any instruction fails.

The separate `sampleDefinitions()` function supplies *data* that composes these operators to model portions of **three different published abilities**. Run `node vocabulary_probe_tests.mjs` for eight checks. The original kernel remains in `core.mjs`; this is an isolated feasibility spike, not yet integrated into the HTML UI.

**Important weakness:** a cloned creature is initially an unplaced logical entity. That is intentional: the event processor must not silently invent a legal battle-map placement or claim to know the clone's initiative. The next phase must connect entity creation to the spatial engine and scheduler.

## What the investigation changes

The strongest version of the original hypothesis is *not* “90% of abilities are merely stat bonuses.” We haven't measured that. Rather:

> Most named abilities may be representable as a small combination of reusable, typed operations, **provided the engine already supplies robust geometry, objects, action scheduling, controllers, events, and effect lifecycles**.

Those primitives are a manageable finite engineering target, but certainly not trivial. Programming an `offer_action` control is straightforward; programming all the timing rules that make the offered action legal is not.

## Next validation gate

Before bringing an LLM into the loop, integrate three broad facilities into one kernel:

1. **Event stages:** `before`/`after` damage, save, movement, spellcasting, with explicit cancellation and bounded re-entrant interrupts.
2. **Entity creation + placement:** instantiate/remove/copy entities with a 2D or 3D footprint and turn-order registration.
3. **Rule compilation diagnostics:** given an ability, report exactly which operators or timing contracts are missing rather than silently approximate it.

Then retest *Black Pudding* and *Contingent Action* end-to-end, alongside *Vienna's Alien Presence*. If all three run using **unchanged interpreter source** plus three different rule-data files, that's much stronger evidence than a larger number of hand-coded demonstrations.

## UI layout defect from V1

The original HTML specified 10 responsive columns and a board-wide 10:8 aspect ratio but omitted explicit row tracks. Browser auto-sizing could allow content-bearing rows to stretch. The patched HTML declares `grid-template-rows:repeat(8,minmax(0,1fr))` and a zero-minimum tile size; this isolates token display size from tile geometry. The fix has been applied to `demo-template.html` and rebuilt into `demo.html`. **The updated code and tests were checked, but a successful interactive browser screenshot validation was not available in this runtime.**
