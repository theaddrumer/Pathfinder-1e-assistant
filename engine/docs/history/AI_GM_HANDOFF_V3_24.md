> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# Pathfinder 1e Tabletop Kernel — V3.24 handoff

## Resume here

Use `tabletop_kernel_v3_24/`, `README.md`, and `CASTING_TIMES_AND_INTERRUPTION_V3_24.md`. The stable base is V3.23's shared lifecycle cleanup. `MagicGame extends PendingEventsGame` remains the scenario engine; all earlier source modules and handoffs are retained.

The project's purpose is both workload reduction and mechanical enforcement: the AI GM supplies imagination, tactics, choices and adjudication; the kernel owns authoritative mechanical state and validates normal gameplay. Explicit GM overrides remain distinct and logged. Do not introduce a tactical/narrative AI or replace the working calculator wholesale.

## Completed in this release

Long casting accepts `castingTime:"1_round"` or `{count,unit}` for round/minute/hour/day. `full_round` remains an immediate full-round action. Every required casting turn pays a real full-round action; skipped continuation loses the spell. `continue_spell` pays an intermediate turn, `complete_spell` resolves at its eligible pre-turn/clock checkpoint and can choose final targets/area, and `cancel_spell` stops it. Completion precedes ordinary turn-start effects and does not spend the next turn's actions.

Native damage automatically checks concentration. Each attack is distinct, while all weapon damage from one hit is grouped. Registered ongoing damage uses its native ailment instance's last damage and appropriate half-damage concentration. `gm_interrupt_spell` handles explicit non-native distractions. `gm_resolve_casting_aoo` resolves each chosen casting opportunity through existing attacks and budgets; `gm_continue_spell` then resumes. The old `aooResolved:true` / external `damageTaken` confirmation is retained as GM adjudication, and is not an ordinary actor bypass.

Casting progress/history is serializable in `activeSpellCasts`, `pendingSpellCast`, and bounded `spellCastHistory`. These are distinct execution phases, not independent timer queues. Clock deadlines are derived in `lifecycle.mjs`; `gm_get_lifecycle` includes casting state. Native packet/modifier validators provide shared preflight. The attack damage-group hook lives in `automation.mjs`, covering resumed ranged attacks as well as direct ones. No generic interrupt executor was claimed.

## Validation

`python3 build_demos.py` regenerates standalone `index.html`, `automation-demo.html`, `tests.html`, and the legacy demo. `python3 run_regressions.py --browser` runs every `*tests.mjs` and historical `test_browser*.py`. Python Playwright/Chromium are needed for browser tests; `BROWSER_EXECUTABLE` and JSON `BROWSER_ARGS` allow runtime overrides. See `TEST_RESULTS_V3_24.txt` for the final observed run. New behavior is in `casting_tests.mjs` (36 groups) and `test_browser_v3_24.py`.

## Next work

Continue magic with touch/ray delivery using the existing attack/defense machinery, then counterspell/dispel and prepared/spontaneous slot expenditure. Long-cast failures currently record loss but do not spend a slot because slot tracking is not implemented. Components, silence, pinned/grappled casting, armor failure, spontaneous metamagic, and maintaining an already-resolved concentration spell remain separate follow-ups.

Persistent area overlays remain the next larger environmental feature: one independent source/effect with a square footprint, duration and stacking policy; terrain cost, concealment/visibility, hazard triggers and antimagic alerts can overlap without one dispel deleting unrelated layers. Reuse the time index and spell geometry. Afterwards: Advanced/Celestial/Fiendish templates; summoning through existing runtime creature spawning plus duration/control/dismissal; broader rules and eventual host-neutral AI integration/AP ingestion.

Delay and switching into/out of initiative are conservatively blocked during unfinished casting; a proper encounter/downtime transition is future work. Authoritative GM initiative edits remain possible, with unusual retiming adjudicated. Casting AoOs use the existing default attack rather than a new selectable attack-profile scheduler. Imported historical continuous damage without a recorded last amount needs GM input. General nested execution remains unimplemented. Never silently guess unsupported mechanics.
