> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# Pathfinder 1e Tabletop Kernel — V3.23 Handoff

## Current stable base

Start with `tabletop_kernel_v3_23/` and `LIFECYCLE_CLEANUP_V3_23.md`. Full previous release history, including `AI_GM_HANDOFF_V3_22.md` and `MAGIC_AND_AREA_GEOMETRY_V3_22.md`, remains bundled. `MagicGame extends PendingEventsGame` remains the active engine instantiated through `scenarios.mjs`.

V3.23 is a **targeted cleanup**; it does not add spell content or rewrite the existing damage/maneuver/initiative math. A pure `lifecycle.mjs` module now indexes chronological deadlines, shares the initiative crossing condition, consolidates checks for suspended actions/GM decisions, and unlinks expiration events when timed modifiers are removed. Both browser templates place `LIFECYCLE` before `CORE`, while all ES modules import it ordinarily. Rebuild with `python build_demos.py`.

New GM-only, read-only command: `{"op":"gm_get_lifecycle"}`. The unified view exposes `clock`, `combatRound`, `initiativeActive`, `deadlines`, `initiativeDeadlines`, `pendingEvents`, `unresolvedActions`, `unresolvedDecisions`, and `orphanInitiativeExpiries`. The Time & Events workbench contains the corresponding inspect control. Existing API calls are unchanged.

**Important:** This is one chronological *index*, not a single replacement lifecycle queue. The native ailment, condition, time, initiative, and Pending Event resolvers still apply their own correct mechanical effects. Automatic mechanics resolve without GM approval; GM decision checkpoints only pause genuine adjudication. A general-purpose nested interrupt executor and declarative map-property environmental layers have NOT been implemented yet. GM may continue to edit initiative during interrupted actions. Removal of a timed modifier cleans its linked expiry; natural turn-start expiry does not consume an action.

## Validation

Run all `*tests.mjs`, `python build_demos.py`, `python test_browser_v3_23.py`, and earlier browser regressions. New tests are in `lifecycle_tests.mjs` (7 groups) and `test_browser_v3_23.py`. Keep the archive and standalone HTML demo together with this handoff.

## Next work

1. Continue with the magic milestone: variable casting times (1 round and longer), touch/ray casting, multiple AoO resolutions and concentration, counterspell/dispel, spell-slot use; keep offbeat mechanics for GM adjudication rather than guessing rules.
2. Implement persistent area overlays as a collection of generic square properties (terrain cost, visibility, hazardous triggers, antimagic alerts), with independent duration/source/stacking policies, using the new index and existing area geometry. A property affecting multiple squares should be stored as one independent effect with a footprint, so overlapping sources can be dispelled independently.
3. Basic Advanced, Celestial and Fiendish templates with explicit statblock delta handling; summoning as spawn + duration/command/dismissal, not a separate creature engine.
4. Targeted later refactors: a generalized pause/resume execution stack and common effect application semantics where supported by regression evidence. Do not replace the working calculator wholesale.
5. Wider PF1e coverage: dying/stabilization, flanking/illumination/terrain, transformations, skills, more complete geometry, plus eventual host-neutral AI tool/plugin API and persistent Adventure Path data ingestion.

Design principles: AI GM owns narrative, tactics and unusual adjudications; native printed statblock results override inferred calculations; deterministic kernel stores and calculates mechanical consequences; use explicit override/Free Mode for exceptional cases; avoid exhaustive monster-by-monster source code.
