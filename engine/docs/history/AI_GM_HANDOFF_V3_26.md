> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# Pathfinder 1e Tabletop Kernel — V3.26 handoff

Resume from `tabletop_kernel_v3_26/`. `MagicGame extends PendingEventsGame` is still the active engine, instantiated by `scenarios.mjs`. Read `COUNTERSPELL_AND_DISPEL_V3_26.md` for API examples and boundaries. V3.25 touch/ray and V3.24 long-casting behavior remains supported; earlier handoffs are historical.

## Project boundary

The AI GM supplies imagination, tactics, choices and unusual adjudication. The calculator owns mechanical state and repeated arithmetic and constrains ordinary commands. Explicit GM overrides remain logged and separate. Make targeted changes, preserve working mechanics, and reuse existing owners instead of introducing redundant trackers.

## Current implementation

`ready_counterspell {actor,id,spell}` creates an ordinary `kind:'ready'` Pending Event with a validated native `payload.counterspell`. Its target is the spell's single target. It pays Ready's standard action and expires at that actor's next turn. Generic activation cannot execute this payload; GM `gm_resolve_counterspell {id,take,perceived,identificationModifier?}` handles an opportunity associated with the current `pendingSpellCast`. Declining preserves Ready; failed free identification or a nonmatching declared spell also leaves it uncommitted, with no retry against that casting. A valid counter activates Ready through its existing initiative/decision/history machinery and begins casting without spending the interrupted actor's action budget.

Matching counters use `check(actor,'skill','Spellcraft',dc)` with 15 + incoming spell level, automatic grid distance penalty, and an explicit GM circumstance adjustment. Imported Spellcraft totals and existing skill modifiers apply. Registered Spellcraft represents usable/trained Spellcraft; there is no new rank subsystem. Canonical `spellId` handles metamagic identity; optional explicit `counterspell.matches` is a GM-authored list of specific rule exceptions, not an inferred school or damage-type rule. Dispel counters need no identification and use the shared dispel check. Greater dispel counters add +4.

Initial casting checks are shared in `initialCastingChecks`. Counterspells can provoke; `pendingSpellCast.parentCasting` preserves a suspended casting within the same continuation owner. `castingFor` traverses that chain so injuries affect the right caster. Nested counters use the same native Ready path, anchored to the caster they interrupt. The generic Ready view is restored when a child finishes. `gm_continue_spell` requires all native counterspell choices, even with external AoO confirmation. Parent casting remains suspended until its own opportunities are confirmed. General nested traps, arbitrary event scripts and simultaneous-choice ordering are still outside this narrow casting path.

`spell.dispel` performs a targeted creature dispel or selects an effect by `effectId`. It uses one d20 result, original caster-level DCs, highest-level-first ordering, at most one ordinary success, or floor(CL/4) successes for greater targeted spell removal. Own-spell success is automatic. Neither SR nor a saving throw is rolled. A dispel's ordinary cast pays normal actions and concentration/AoO checks; `gm_resolve_spell` remains the explicit effect-only override.

`spellInstanceSerial` supplies a unique source ID per resolved casting. Metadata resides on native modifier records as `spellSource`, in held-spell payloads, or in the existing pending ray action. Each ray/touch payload retains its original source. `ongoingSpellEffects()` derives recipient/source groups from these records; no persistent registry mirrors them. Dispel removal calls `removeEffect(...,{countAsAction:false})` and `concludePendingEvent` and thus unlinks existing initiative deadlines. A recipient-targeted dispel preserves other recipients. Separate castings never merge by name or caster alone. Old generic effects without provenance remain excluded; old held charges have authoritative spell definitions and can derive their source from the event.

`gm_get_spellcasting`, `gm_get_lifecycle` and `inspect` expose derived ongoing spell effects and current counterspell opportunities. Workbench counter controls are beside Ready in Time & Events; dispel targeting is beside spellcasting.

## Validation

Build with `python3 build_demos.py`. Run `python3 run_regressions.py --browser`; use `BROWSER_EXECUTABLE` if needed. New files: `spell_interaction_tests.mjs` (47 groups), `test_browser_v3_26.py` (five scenarios). Current release results: `TEST_RESULTS_V3_26.txt`. Preserve historical suites and reports. Internal screenshots are not release artifacts.

## Next work and remaining limits

Next is prepared/spontaneous spell access and slot expenditure. Casting loss and counterspell commitment are currently recorded mechanically but do not debit slots. Add resource validation at actual casting commitment, not at Ready declaration; a failed free identification must not spend a slot. Reaction casts need their own caster's resources, not the active actor's. An unused Ready does not reserve a slot.

Later: maintained concentration on resolved effects; components, silence, grappling/pinning, arcane armor failure, metamagic timing and class-specific delivery. Persistent area sources need independent footprints, duration and stacking through existing geometry/lifecycle owners. Only then extend dispels to area origins/overlaps and antimagic suppression. Magic-item suppression requires an actual temporary equipment-magic state and restoration; do not strip items or erase printed baselines. Summoning should use creature spawn plus duration/control/dismissal. Greater dispel's curse exceptions require explicit curse provenance/DCs. These are not silently approximated here.

Continue with Advanced/Celestial/Fiendish templates, broader PF1e coverage, host-neutral AI tools and AP ingestion on the existing roadmap. Encounter/downtime retiming of ongoing long casts remains blocked; general arbitrary nested interruption execution remains separate.
