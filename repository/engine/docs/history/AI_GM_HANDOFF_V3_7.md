> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# AI GM / Tabletop Kernel — V3.7 Handoff (October 14, 2026)

## Project purpose

Create a deterministic Pathfinder 1e mechanical referee operated by an interpreting AI GM, ultimately capable of running an uploaded Adventure Path. The AI imports creature definitions/abilities, plans NPC actions, adjudicates ambiguous situations and roleplays; the engine remembers state, applies reproducible arithmetic, checks action legality, tracks ongoing effects, and runs declarative mandatory triggers. The user is a PF1e expert but not a programmer. Keep explanations concrete; don't let the code become a second tactical AI. Prototype changes may refactor earlier stages freely; retain regression fixtures outside the main interface.

## Current archive

`tabletop_kernel_v3_7_foundations.zip`; open `index.html` (offline GM workbench) or the separately exported `tabletop_kernel_v3_7_demo.html`. `tests.html` contains the older Choker, Black Pudding, Archon, and Vienna fixtures. Source files include `core.mjs`, `automation.mjs`, `registry.mjs`, `conditions.mjs`, `ailments.mjs`, `condition_ailment_game.mjs`, **new** `trait_library.mjs`, **new** `foundations.mjs`, `scenarios.mjs`, the HTML templates and build script. `FOUNDATIONS_V3_7.md` documents new command schema and limitations.

## Features added in V3.7

- Imported definitions can specify `creatureType`, `subtypes`, `protections`, `traitExceptions`, `dcDefinitions`, `progression`, and `mindless`. Baseline type names are all accepted; subtype library is deliberately limited. A type does NOT modify already-published AC/attack/saves a second time.
- Per-event damage resolution handles explicit typed immunity, strongest energy resistance, highest applicable DR with simple OR-bypass tags, and limited incorporeal damage distinctions (mundane weapon none, magical corporeal half, force/ghost touch full). Ordinary attacks, GM rolls and GM damage commands share the central method. Magic/weapon descriptors must be supplied—no guessing.
- Standard ailments poison/disease and selected tagged conditions check inherited immunities before exposure/application. GM can probe other descriptor immunities with `gm_evaluate_effect`.
- Ability DC formulas (half total HD, half racial HD, configurable class level or BAB fractions, spell level, fixed) automatically use effective ability modifiers and report mismatches with imported published DC. Undead use Cha in place of Con-based DCs; constructs with no Con use modifier 0. Unknown prerequisites fail clearly.
- Separate UI panel for a **fictional** Devil stress test. The historical fixtures remain regression tools.
- Three new dedicated foundation tests were added after the original 14 to test intelligent/mindless ooze exceptions, Fortitude object/harmless exceptions, and ordinary weapon metadata (17 in total).

## Verification

17 new tests + previous 181 = **198 named automated tests passing**. Eight browser acceptance/regression scenarios passed (new V3.7 plus seven prior suites with only stale version string checks updated). Tested basic UI and source-level invariants.

## Important omissions / avoid overstating

- This is not a full type/subtype library or Adventure Path ingestion. 13 basic type names are defined, but many type traits are advisory only. Seven subtypes (including `mindless` as a helper trait) are recognized, not all PF1e subtypes.
- No full implementation of creature no-ability-score fields: prior code still uses numeric placeholders for missing Con/Int. Don't claim undead HP/Fort recalculation is fully correct; inherited exceptions and printed totals need deliberate registration.
- Complex DR bypass requirements, magic enhancement material equivalence, corporeal/incorporeal movement and AC, line of effect, senses, SR, regeneration, hardness, vulnerabilities, crit/sneak exceptions, and comprehensive trait-spell/condition interactions remain incomplete.
- Existing condition entries are predominantly partial/advisory. No autonomous AI agent or AoN source retrieval or campaign file ingestion yet. No full general-purpose nested interrupt scheduler.

## Next recommended focus

Before adding every subtype, make **effect packets/defense metadata** more general (tags for attack/spell origin, harmless/object exemption, damage components, distinct target defenses, mitigation history); extend defensive vocabulary (hardness, SR, regeneration, vulnerability, negative-energy/positive-energy), and add targeted tests to catch wrong assumption when a creature has inherited/explicit overrides. Then add subtypes in priority order from imported encounter samples, followed by wider combat geometry and the controller/interrupt pipeline. Preserve GM warnings for unsupported cases. Do not implement NPC tactics in the engine.
