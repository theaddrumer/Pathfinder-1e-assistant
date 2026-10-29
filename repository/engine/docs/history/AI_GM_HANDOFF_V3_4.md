> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# Tabletop Kernel / PF1 AI GM — V3.4 handoff (October 13, 2026)

## Ultimate objective

Build an autonomous AI GM able to accept uploaded Pathfinder 1e Adventure Path material and character data, interpret encounters and campaign content, run NPCs and the narrative, while a deterministic engine handles state, bonuses, positioning, action resources, mandatory rules, and validates commands. The engine is a mechanical referee/calculator — **not** a separate tactical or narrative AI. AI decides morale, tactics, reactions, story outcomes; engine resolves consequences. An AI must be able to look up/import creatures once, keep a reusable definition, instantiate copies, and supply unfamiliar effects as mechanical deltas at runtime.

## Latest delivery

`tabletop_kernel_v3_4_runtime_registry.zip` is the complete V3.4 source and demos. Open `index.html` or standalone `tabletop_kernel_v3_4_demo.html`. `RUNTIME_REGISTRY_V3_4.md` and `CHANGES_V3_4.md` explain command schema and limits. This work continues V3.3 (full attacks), V3.2 (clear AoO UI), V3.1 (active-creature movement), and V3 (action resources). Earlier handoffs remain included in archive.

## New capabilities

`registry.mjs` introduces `RegistryGame extends AutomationGame`. GM-authorized JSON commands `register_creature`, `spawn_creature`, `register_effect`, and `apply_registered_effect` let an interpreter supply data; `inspect` returns current compact controller state. Definitions persist in JSON game state and survive save/reload. Printed `statTotals` avoid double counting; optional `abilityLinks` explicitly describe deltas. Attack routines/skills can be supplied. Declarative `rules` arrays on a template are cloned and bound to each spawned instance. Effects such as Shaken use `attack`, `saves`, `skill_checks`, `ability_checks` modifiers and expiration. Same effect definition/target refreshes duration. Generic skill/ability checks work; skill/ability checks do not auto-succeed on 20 or fail on 1. Data validation rejects unknown mechanics instead of silently supporting them.

The standalone browser UI has an **Import creature & shaken** fixture with editable JSON. Fictional Marsh Raider is an illustration, not an AoN import. Existing monster fixtures still work.

## Limitations and follow-on

Still no LLM integration, network retrieval from AoN, AP ingestion, source indexing, general automatic source translation, PF-complete spell/feat vocabulary, regeneration framework, nested interrupts, or NPC behavioral logic. Imported printed stats are snapshots; only declared ability links recalculate. Turn-end duration expiry is a narrow approximation. Fear precedence and stacking beyond identical effect refresh are not implemented. Preserve these distinctions and resist automating morale/tactics.

**Recommended next effort:** broaden the mechanical effect vocabulary with representative unfamiliar abilities and test interpretation of an independently sourced encounter, then implement controller-facing interrupt continuation. A complete AP reader and campaign repository come later, once numeric and triggered effects can be expressed robustly.

## Testing and working style

Run `node tests.mjs`, `node vocabulary_probe_tests.mjs`, `node automation_tests.mjs`, `node action_economy_tests.mjs`, `node aoo_ui_regression_tests.mjs`, `node choker_movement_regression_tests.mjs`, `node full_attack_tests.mjs`, and `node registry_tests.mjs`. Run `python test_browser_v3_4.py` for Chromium smoke coverage. Rebuild offline browser HTML with `python build_demos.py`. Preserve earlier tests and downloadable complete ZIP/handoff. User knows Pathfinder 1e mechanics deeply, is not a programmer, prefers concise practical discussion and minimally overengineered GM-facing UI.
