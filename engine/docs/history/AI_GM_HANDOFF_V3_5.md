> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# AI GM / Tabletop Kernel — V3.5 handoff (October 13, 2026)

## Project objective and design boundary

User is building a flexible Pathfinder 1e AI GM capable eventually of accepting a published Adventure Path and PC sheets and running a tabletop campaign. The AI GM interprets the story, rules, NPC tactics and morale, and imports reusable monster/ability data. The **deterministic engine** is a mechanical memory/calculator: combat state, movement, actions, stats, modifiers, durations, mandatory triggers. Do **not** turn the engine into an NPC tactician or scripted adventure. AI makes choices; engine validates/calculates and optionally warns of contextual mismatches.

User is experienced in PF1e, not programming. Explain tradeoffs through PF1 use cases; do not ask them to code. Maintain a concise practical style. Significant refactoring is welcome. Preserve historical test encounters in a dedicated test suite, not in the primary encounter-building interface. Flexible adjudication is important, including allowing a GM to override context-dependent warnings rather than overconstraining AI behavior.

## What V3.5 changed

Complete source and offline browser deliverable in `tabletop_kernel_v3_5_stat_vocabulary.zip`; open `index.html`. Historical test encounters have moved to `tests.html` (also `automation-demo.html` for old links). `demo.html` is V1 legacy. The main interface has editable creature/effect JSON, a battlefield, and a separate GM adjudication panel.

`stats.mjs` defines a **shared** recognized vocabulary instead of separately repeating stat names in core, runtime registration, and automatic-rule validation. Supports three AC totals (`ac`, `touchAc`, `flatFootedAc`), initiative, attacks/damage/CMB/CMD, saves, ability scores, skill snapshot totals, and generic modifier families. All three *printed* AC totals must be present together if any printed defense is supplied. This is a deliberate schema break from V3.4's AC-only Marsh Raider. Core has limited AC calculations from declared components when printed values absent; imported totals are authoritative. Explicit ability links update their totals by change in ability modifier, not by reconstructing feats/ranks. A skill defaults to the usual PF ability if known; `skillAbilityLinks` can override (e.g. Cha-based Perception). The engine now updates skill checks and inspection consistently.

GM-only operations: `gm_roll` rolls bounded dice, optionally applies damage through the existing damage-trigger pipeline or healing capped at max HP; `gm_modifier` creates a named typed temporary/permanent numeric effect; `remove_effect` removes it. `ac_all` explicitly affects normal/touch/flatfooted AC, whereas `ac` affects normal only; `skill:Perception`, `skill_checks`, and `saves` also work. Attack resolution accepts a GM-specified AC defense; creature/actor role cannot declare arbitrary touch or flat-footed attacks. See `STATS_AND_ADJUDICATION_V3_5.md` and `CHANGES_V3_5.md` for schema and sample commands.

## Testing and files

Run `node tests.mjs`, `node vocabulary_probe_tests.mjs`, `node automation_tests.mjs`, `node action_economy_tests.mjs`, `node aoo_ui_regression_tests.mjs`, `node choker_movement_regression_tests.mjs`, `node full_attack_tests.mjs`, `node registry_tests.mjs`, and `node stat_vocabulary_v3_5_tests.mjs`. **115 named Node tests** pass. `python test_browser_v3_5.py` plus the V3.2, V3.3, V3.4 Chromium smoke scripts pass, including the historical Choker/Quickness/interrupt fixture. `python build_demos.py` rebuilds standalone HTML without a server. No need for network access.

## Important unsolved work / recommended next iteration

1. Standard PF1 conditions library, as **data**, now that the statistical vocabulary supports numeric condition penalties. Audit conditions whose effects are not numerical. Separate automatic arithmetic, hard mechanical constraints, and **contextual advisories**. For example Frightened may warn on suspicious movement toward the fear source but must allow the GM to interpret dead ends, unusual exits, and context; AI chooses flight path, not engine.
2. Complete more general action restrictions, contextual AC and attack permissions, dependencies/stacking exceptions, triggers/interrupt scheduling. The current system **does not** auto-detect flat-footed or touch attacks from narrative circumstances; choosing a different defense is GM-authorized. Imported skills are totals with deltas, not a full character creation tool.
3. Eventually controller command interface and encounter/adventure content repository; import official and configurable 3PP/homebrew source packs once stat/effect vocabulary is mature. Dynamic definition registration already exists.

Still NOT PF-complete: grab/constrict, complete conditions, spellcasting, immunity, resistance, general damage reduction, all statblock metadata, temporary HP, exact duration scheduling, RNG policy for genuine rerolls, nested interrupts, procedural AP ingestion, LLM connector, or autonomous GM behavior. Avoid claiming finished functionality simply because a label is accepted. Retain the strict validation approach: never silently import an unknown field as a working mechanic.

## Context for recent discussion

User asked whether calculating skill ranks when importing an existing statblock was wasteful. Agreed: printed values are authoritative, and only relevant dependency deltas need to be declared. User also suggested a character-sheet-like permanent stats plus temporary modifiers architecture (already the basic design), GM direct arbitrary damage/healing/bonus/penalty for improvised cases (now implemented), and explicit normal/touch/flat-footed AC rather than forcing AI to manually subtract Dex each turn (now imported and selectable). They explicitly authorized refactoring if appropriate and requested that fixture accumulation not clutter the eventual campaign UI (fixture gallery separated in V3.5).
