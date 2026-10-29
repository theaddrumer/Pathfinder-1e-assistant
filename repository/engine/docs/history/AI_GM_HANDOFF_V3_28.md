> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# Pathfinder 1e Tabletop Kernel — V3.28 handoff

Resume from `tabletop_kernel_v3_28/`. Read `SUMMONS_V3_28.md` for the public API and limitations. Preserve V3.27 resource invariants and V3.26/V3.25 spell behavior.

## Architecture

Active inheritance: `MagicGame extends SummonsGame extends SpellResourcesGame extends PendingEventsGame`. Scenarios and controllers still instantiate `MagicGame`. `summons.mjs` supplies lifecycle behavior, not a second time owner. One `s.pendingEvents` record stores `kind:'summon'`, creature ID in `actor`, payload `{source}`, automatic expiration, and existing `time`/`initiative` duration representation.

The creature's subtype array contains `summon`, which supplies no defenses. `gm_mark_summon` or `spawn_creature.summon` requires duration; direct generic registration of the mechanical event rejects. Inspection derives its view from native events. Cancelling the event dismisses its creature; generic trigger is blocked.

Expiry/death concludes the event and temporarily marks the creature with `summonDeparture`. Its owned automation rules immediately stop. `MagicGame.dispatch` finishes atomic resolution then `flushSummons` clears references and deletes departing instances. Failed commands restore state and undo snapshots. During Fast Forward, cleanup runs at the native deadline callback; during turn advancement, the native cursor processes crossed counts. The transitional marker is not another timer and is absent from successfully committed surviving creatures.

Owned Ready/held events, casting, spell resources, target effects/conditions/ailments and grapples are cleared using native owners where applicable. Effects whose `spellSource.actor` is the departing summon expire, including initiative deadlines. Instant results are not reversed. Other non-spell effects/afflictions already caused on survivors remain; dead source references are detached where native resolvers otherwise dereference them. Living full attackers retain remaining strikes. The duplicate hook copies the exact deadline rather than resetting lifetime.

`InitiativeGame.finishInitiative` is the existing encounter-end migration, shared by the GM command and last-participant departure. Summon-only timers do not request Fast Forward trigger confirmation; ordinary conditional events still do.

## Verification

Build: `python3 build_demos.py`. Regressions: `python3 run_regressions.py --browser` (Playwright/Chromium). See `TEST_RESULTS_V3_28.txt`. New suites: `summon_tests.mjs`, `test_browser_v3_28.py`. The bundle includes `SUMMONS` after `SPELL_RESOURCES` and before `MAGIC`.

Use `dispatch` for public mutations; direct resolver calls can precede the atomic removal boundary. The workbench supports an empty encounter and replacement spawning. Exclude internal screenshots and runtime caches from releases.

## User requirements and next work

AI GM: imagination, tactics and adjudication. Engine: mechanics and authoritative state. Reuse owners instead of overlapping systems. Summon was requested as a small creature marker plus timer, not a complete summoning framework. Creature choice, duration, placement/control and exceptional permissions remain GM decisions. Spawning does not infer/spend a spell slot. Dispel/banishment adjudication can use explicit dismissal; automatic summon targeting by the spell-dispel resolver is separate work.

Keep **daily slot totals frozen**. Imported totals include bonus spells. Derived capacity uses an explicit daily score once. Live ability changes, time advancement, cleanup and refresh must never resize/refill existing allotments. Only explicit GM replacement recalculates them.

The user's latest scope supersedes broad suggestions in older handoffs: prioritize maintained concentration, integration with existing conditions and persistent effects. Creature components are assumed available; player inventories are tracked elsewhere. Do not add component inventories, comprehensive rest qualification or exhaustive spell-specific adjudication without a new request. Do not expand Summon into class progression, a full spell database, equipment simulation or off-board identity/re-summoning tracking.
