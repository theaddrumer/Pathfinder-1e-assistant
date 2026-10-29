> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# AI GM / Tabletop Kernel — V3.10 handoff (October 14, 2026)

## Goal
Autonomous, flexible Pathfinder 1e GM operating a stable deterministic calculator. AI imports creatures and campaign content, supplies effects and tactical/narrative decisions, engine resolves mechanical interactions. End goal is player-uploaded Adventure Path GM, not pre-scripted encounters.

## Artifacts
- Complete ZIP: `tabletop_kernel_v3_10_combat_maneuvers.zip`.
- Offline default workbench: `index.html` (standalone export also available).
- Debug fixture gallery: `tests.html`.
- Source modules: `core.mjs`, `automation.mjs`, `registry.mjs`, `condition_ailment_game.mjs`, `foundations.mjs`, **new** `maneuvers.mjs`, `scenarios.mjs`, etc.
- Documentation: `COMBAT_MANEUVERS_V3_10.md`, `CHANGES_V3_10.md`, earlier version docs.

## Current capabilities
Previous V3.9.1 foundations continue to work: action economy, AoO movement, full attacks, charge, flexible import, conditions/ailments and ability loss, defenses/DC/creature traits, multi-component damage, attack definitions/weapon materials.

V3.10 introduces standard-action maneuver execution, special-size CMB/CMD, contextual CMD, item inventory, Trip/Disarm/Sunder/Bull Rush, persistent one-on-one grapple with maintain/escape/release/pin/basic damage, and maneuver AoO pauses. Imported statblocks can declare size category, legs, inventory, improvements, and bonuses. Broken/dropped linked weapons affect attacks.

Targeted Node tests cover 24 new cases; all 17 named suites pass. Five relevant browser suites including new maneuver flow pass. No AI/model integration has been added yet.

## Boundaries
The authoritative details are in `COMBAT_MANEUVERS_V3_10.md`. IMPORTANT: Grab **rider** is still definition-only. Direct Grapple combat maneuver is implemented; these are different features. Trip/Disarm/Sunder attack replacement in a full attack, bull rush as part of charge, multiple grapplers, tie-up and −20 Grab holds are deferred. Advanced maneuvers are registered as unsupported, not pretend-executed. Neither cover geometry nor nested general interrupt scheduler is complete.

## Next architectural choices
1. Add combat maneuvers as replacements for melee attacks/AoOs/full-attack slots. Preserve interrupted/resumable actions.
2. Connect optional Grab to a qualifying hit and use proper hold modes; add Constrict as a distinct rider.
3. Expand item consequences and geometry/multi-creature maneuvers as encounter testing requires.
4. Return to critical hits, attack completeness, spells, and Adventure Path import eventually.

## Design preferences
Keep engine as calculator and mechanics memory, AI as GM/tactician. Predefined commands are faster/safer than inputting every modifier manually. Don't hardcode tactical intentions; preserve GM overrides, advisory exceptions, deterministic tests and historical fixtures outside the main UI. User understands PF1e deeply but does not program, so explain architecture tradeoffs plainly.
