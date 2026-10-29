> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# Pathfinder 1e Tabletop Kernel — V3.20 Handoff

## Current working version

Start from **`tabletop_kernel_v3_20/`**. V3.19 attack completion (TWF/mixed natural attacks, ranged ammo/reload, ranged action AoOs), V3.17 Fast Forward, earlier maneuvers, conditions, defensive mechanics and automation are preserved. **V3.20 adds the encounter initiative system and GM-authored initiative deadlines.** Read `INITIATIVE_AND_COMBAT_TIMING_V3_20.md` for exact commands, intended semantics and known limits. Previous handoffs remain for version history.

## Code architecture and constraints

- `InitiativeGame extends AttackRoutinesGame` in `initiative.mjs`; `scenarios.mjs` now returns it. `Game.endTurn` calls the subclass's `advanceInitiativeCursor` only if the initiative roster is enabled. The prior array-index ordering remains active otherwise. `automation.mjs` and `condition_ailment_game.mjs` identify round changes from the round number rather than the array index, preserving auras, timed ailments and the six-second clock. World clock code in `time_engine.mjs` has not been rewritten.
- GM may roll or provide initiative, change counts, reorder ties and explicitly resume Delay at a turn boundary without resetting action budgets or elapsed time. No interpretation of creature tactics or arbitrary triggers occurs in the kernel. Live effects may be assigned opt-in initiative-count expirations.
- Fast Forward rejects active initiative. Ending an encounter migrates its unfinished scheduled expirations to the existing world-clock system; the rest of the game remains controlled by ordinary GM commands. All state and rollback are serialized.
- Pending Events (conditional arbitrary triggers, Readied Actions, encounter/turn/indefinite expiration) is **next**, not part of this release. Build on these initiative and clock anchors and group its controls with the existing **Time & Events** panel. More general nested interruption precedence and queued mid-action adjudication belongs to that milestone.

## Validation

Run `node initiative_tests.mjs` and `python test_browser_v3_20.py`; also all `*tests.mjs` and the historical browser tests. Source is bundled into an offline browser via `python build_demos.py`. Workbench `index.html`, stand-alone archive HTML and `automation-demo.html` use the same core module. GM command interface is `instance.dispatch(command,'gm')` and role-limited actor commands use `instance.dispatch(command,'actor')`.

## Long-term docket

1. **Pending Events**, Readied Action bookkeeping, turn-based/encounter-based/indefinite deadlines, warnings before Fast Forward, Delay refinements, general interrupt scheduling.
2. **Magic and effects**: spellcasting actions/concentration/provocation, spell resistance, saves, area geometry, dispel and counterspell, duration and targeting. Summoning should reuse the existing creature spawning operations. Begin reusable template transforms with **Advanced**, **Celestial** and **Fiendish**, leaving rare templates to AI/GM adjudication.
3. General PF1e gaps: dying/death/stabilization; flanking, lighting, terrain; many class abilities, rare maneuvers and complex monster interactions; richer map geometry and squeezing separately.
4. **AI GM tool/plugin adapters**, validation schemas for user-selected host, statblock/AP ingestion, persistent campaign state and real encounter trials. The kernel remains a deterministic calculator, not an AI tactical agent.

## Important limitations

Not every legacy timed effect has initiative-count timing; only explicitly scheduled events do. Initiative interrupts are not yet a fully generalized nested-interruption queue; alert checkpoints are GM controlled. New combatants added during initiative need explicit GM counts. Tie roll-offs, exceptional PF1e Delay timing, and some pre-turn pending-event ordering still require the GM (see the detailed V3.20 document). Do not claim rules-complete PF1e or autonomous AP running.
