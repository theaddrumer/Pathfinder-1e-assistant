> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# Tabletop Kernel v2 — Automatic rules and event subscriptions

**Status:** Runnable experimental kernel, not a complete PF1e implementation, not connected to an LLM or Archives of Nethys. This document describes what is *currently implemented*, not a promise of later features.

## Why this version exists

The previous prototype already knew how to manipulate game state, but an AI or a test button had to tell it when to apply most special effects. Version 2 introduces registered **event subscriptions**: the engine detects an occurrence (entering a radius, being hit, an impending damage event, entering a terrain square, or a turn boundary) and evaluates small validated sets of declarative instructions. Once a rule is registered, the AI does **not** need to be called every time it triggers.

There are four boundaries:

1. **Ordinary event**: movement into a square, an attack that hits, a request to deal damage, or a turn transition.
2. **Subscription detection**: `zone_enter`, `tile_enter`, `damage_before`, `hit`, `turn_start`, or `round_start`.
3. **Small rules language**: conditions on event data and operations like saving throw, stat modifier, marker, teleport, or entity creation.
4. **State manager**: applies changes, handles basic modifier stacking, records rolls/events, and preserves undo snapshots.

No rule consists of arbitrary JavaScript supplied by the AI. Rules must pass operation validation. There is a bounded recursion depth and operation budget. Errors in direct GM commands or detected triggers restore the previous state, rather than leaving half-applied effects.

## Runnable demonstrations

Open `automation-demo.html` in a browser. The document is self-contained (no internet or local server needed). Choose one of the three fixtures and click **Activate automatic effects**.

### Archon: Aura of Menace

- Explorer begins outside the 20-foot zone. Move to (1,4) to enter it.
- A registered rule checks that Explorer is hostile, hasn't acquired immunity to *this* archon's aura, and doesn't already have the penalty.
- The engine automatically rolls a Will save against **fixture DC 16** (the real DC depends on the archon). Success adds a per-source 24-hour immunity marker. Failure applies -2 to attack rolls, AC, and saves, with a nominal 24-hour duration.
- A later hit by that particular affected creature against the specific archon removes the effect and grants the same per-source 24-hour immunity.
- A different environmental subscription deals 1d4 fire damage when a creature enters orange square (1,5). The hazard isn't coded into the terrain loop by name; it is a `tile_enter` rule.
- This fixture assumes the archon is actively fighting/angry; it does not implement all archon special abilities or model the conditions for starting/stopping the aura.

### Black Pudding: Split

- A **weapon** damage event with slashing or piercing type and pudding HP over 10 triggers the declarative Split rule.
- It cancels that damage, halves the original's current HP (round down), duplicates the pudding and seeks the nearest available footprint for the copy. Copied subscriptions allow the copy to split again when eligible.
- A separate fire-spell control test deals damage normally.
- The example does **not** cover all ooze-specific traits, equipment damage, arbitrary damage-type mixes, grapples, or exact initiative treatment of newly created creatures. It does demonstrate that the engine does not contain a hard-coded `blackPuddingSplit()` function.

### Vienna: Alien Presence

- Vienna's supplied homebrew text gives a 360-foot aura (72 squares), Fortitude DC 34, and a random jaunt of **1d20 × 10 feet**.
- On starting the encounter, Explorer is already within range. The engine automatically makes the Fortitude save. On failure it chooses one of eight grid directions, rolls a d20, converts the distance into squares, and picks the nearest legal square to the proposed location.
- The board is only 50 × 40 feet and the Vienna fixture is deliberately scaled to 2×2 squares, not her actual Gargantuan 6×6 footprint. Thus the demonstration tests event registration, saving throws, randomization, and safe placement—not the precise geometry of a 360-foot battlefield. If a destination would be outside the board, the nearest legal square **on this small map** substitutes for the nearest safe square in the full aura.
- The interpretation of "random direction" as one of eight equally likely grid bearings is a test ruling, not a claim that the homebrew specifies eight directions.

## Implemented event and action vocabulary

| Event | Meaning |
| --- | --- |
| `zone_enter` | A target enters an active circular/Chebyshev-distance subscription zone, including when the zone is first activated |
| `tile_enter` | A moving actor enters an individual map square |
| `damage_before` | Before damage is committed, permitting cancellation or a change in state |
| `hit` | Attack successfully hits, regardless of whether damage is subsequently canceled |
| `turn_start`, `round_start` | Turn/round boundaries |

Supported actions: `save` (success/failure branches), `apply_effect` (typed modifiers and expiration event), `remove_effect`, `mark` (source-target identity and round expiry), `cancel_event`, `set_hp`, `duplicate_entity`, `random_relocate`, `deal_damage`, and a limited `offer_interrupt`.

Supported conditions include equality/inequality, comparisons, membership, absence of an existing effect, and absence of a source-specific immunity marker. References must use a restricted set of documented event, owner, rule, or effect fields. Arithmetic expressions currently offer addition, multiplication, and floored division.

These are **not** general purpose scripts: there are no unrestricted loops, function definitions, or user-authored code execution. Rules that require something outside this vocabulary must be deferred to manual adjudication or added to the engine with tests.

## Optional effects and interrupts

- Standard AoOs still use the previous explicit, decision-based, pause-before-movement system.
- A generic `offer_interrupt` can currently be subscribed only to **safe scheduler boundaries** (`turn_start` and the test event `ping`), and the owner may accept or decline. The implementation intentionally rejects an optional offer during `damage_before` because that would require **suspending the damage transaction itself** until the decision is made.
- General nested interrupts, multiple competing reactions, readied actions, concentration checks, and full PF1e priority/timing rules are **not implemented yet**. Treat this as a limitation, not a silent successful implementation.

## Persistence, undo and RNG

- Rules, source-specific immunity history, zone-exposure history, creature copies, pending interrupts, and modifier effects are part of the state snapshot.
- `undo_turn` and `undo_round` restore this state to the selected checkpoint. A replay currently repeats identical rolls because the same seeded xorshift32 RNG state is also restored; a future system should distinguish *correct a ruling with preserved rolls* from *take a new action with new rolls*.
- This demonstration's `startScenario()` treats initial aura exposure resolution as encounter setup, meaning it establishes the initial rollback anchor after handling the first automatic saves. Gameplay changes made after that point can be undone.

## Tests and how to run them

Node 22+: `node tests.mjs`, `node vocabulary_probe_tests.mjs`, `node automation_tests.mjs`.

The V2 tests cover: entering and staying inside an aura; source-specific saves and immunities; hit-based expiration; Split and its HP threshold; qualified weapon versus spell damage; legal cloned footprints and inherited rules; Vienna relocation; terrain-trigger damage; rollback of trigger state; rejection of unauthorized/unsupported operations; atomic rollback on an impossible clone; and optional interrupt acceptance/decline.

The browser demo was also exercised in Chromium using Playwright across all three fixtures, with no JavaScript exceptions observed. This is **not** a full PF1e correctness certification.

## Remaining architectural work (highest priority first)

1. **Resumable action/effect scheduler**: interruptions nested inside an attack, spellcast, or damage resolution; explicit event precedence; multiple reactions; action ownership; and resumable pending transactions.
2. **Reliable general rule expression**: data-driven range/shape/line-of-effect tests, target predicates, movement/teleport constraints, duration clocks (minutes/hours rather than only rounds), and typed stacking rules.
3. **Rules package loader and provenance**: import authoritative PF1e source text for an AI to interpret, review the resulting rule definition, and version it per campaign.
4. **AI interpretation layer**: ask a model to propose an ability definition in the supported schema, validate it, run fixtures against it, and allow an administrator to approve it. No such AI link exists yet.
5. **Broader acceptance corpus**: more distinct PF1e abilities, especially those involving possession, suppression, polymorph, timing/initiative alteration, multi-target areas, and object creation.

The important result is narrow but real: in this version a creature's aura and a piece of terrain can both fire registered commands automatically. The game engine receives events; it does not ask an AI to remember to apply either effect.
