> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# Pathfinder 1e Tabletop Kernel — V3.27 handoff

Resume from `tabletop_kernel_v3_27/`. Active inheritance is `MagicGame extends SpellResourcesGame extends PendingEventsGame`; `scenarios.mjs` still instantiates `MagicGame`. Read `SPELL_RESOURCES_V3_27.md` and retain V3.26 counter/dispel and V3.25 touch/ray notes as applicable. Their older “slots not implemented” limitations are superseded for configured profiles.

## Non-negotiable project requirements

The AI GM supplies imagination, tactics and adjudication. The engine owns authoritative mechanics and repeated arithmetic; ordinary commands enforce configured rules. Keep targeted changes and shared owners. Held touch charges still live only in Pending Events; Ready still owns counterspell timing/initiative.

**Daily slot totals must never be a live formula over current ability scores.** The user explicitly required that buffs and other on-the-fly score changes not alter spells/day. Import totals exactly or calculate once from an explicit eligible daily score. Store the result. Neither refresh nor inspection may call live ability statistics to recalculate capacity. Permanent score changes also wait for explicit allotment replacement. Casting/preparation eligibility can still check a current minimum ability score without modifying slots.

## Resource state and API

`spell_resources.mjs` is the sole resource owner. `s.spellResources` is an array of caster/book profiles. Each profile has id/name/mode/ability/casterLevel, registered spell access entries, slot pools, optional prepared conversions, prepared records, and bounded history. Profiles are separate per actor and casting book. Pools retain one fixed allotment; prepared usage lives in individual `preparations[].spent`, spontaneous usage in `pools[].spent[level]`. Remaining counts are derived. Resource receipts in native casting contexts are provenance, not another count authority.

`calculateSpellAllotment` is pure. Imported definitions accept totals only. Derived definitions accept base counts and an explicit `abilityScore`; they store the base, bonus, modifier and totals snapshot. Missing/null levels are inaccessible; a base count of zero can receive ability bonus slots. Level 0 receives no ability bonus. Only one pool per book may derive ability bonuses; domain/specialist extras should use separate fixed imported totals, avoiding another application of the bonus table.

GM commands: `gm_get_spell_resources`, `gm_preview_spell_allotment`, `gm_set_spellcasting`, `gm_refresh_spellcasting`, `gm_prepare_spell`, `gm_restore_spell_resource`. Mutations require reasons. Replacing an existing book also requires `replace:true`. Refresh resets expenditure using the stored maxima, optionally replacing daily preparations; it never reads live ability scores or advances time. Fill-open-slot cannot reuse a slot still occupied by an expended preparation. Restoration is bounded by actual expenditure. Updates to a caster's book are blocked while that caster has an unfinished casting. Histories/logs identify explicit GM changes.

Normal spells select `resource:{book,preparation}` for prepared copies, or `resource:{book,spell,pool?,slotLevel?}` for spontaneous use. Prepared conversions optionally provide `spell` alongside the preparation ID; they require the book's explicit conversion permission and pool policy. Higher slot costs are catalogued separately from effective spell level. The book supplies governing ability; caster level cannot exceed its configured value. Canonical identity, level, source kind, access and available resources are validated. Known spell payloads remain GM-authored; this is not a complete spell database or character builder.

Once an actor has profiles, casting cannot silently fall back to the old untracked path. Missing/unknown resources, identity/level/source-kind spoofing and exhausted pools reject. Unconfigured historical casters retain existing behavior for backwards compatibility. Explicit `gm_resolve_spell` remains an effect-only bypass and does not spend slots. Configure all intended tracked NPCs as well as PCs.

## Casting integration

`MagicGame.startCasting` validates and binds resources before costs. `payCastingAction` commits once after action payment, before defensive/entangled/continuous concentration. Failures and cancellation do not refund. A provoking cast keeps its receipt in `pendingSpellCast`; the same receipt passes to a long casting. Continuing a cast or completing a held/ray payload does not debit again.

Native Ready payloads retain their resource selector. Actual counterspell availability is checked before identification RNG; Ready declaration does not reserve or expend a spell. A successful identification/match commits the selected resource just before the counterspell's own casting checks. Failed identification, mismatch or decline leaves slots alone. Counterspell failure still consumes its committed resource. Each nested casting spends its own actor/book, never the interrupted actor's action or slot pool. Existing snapshots/undo preserve all changes atomically.

Inspection and lifecycle expose `spellResources` once as a derived view. The workbench has setup examples, imported/derived previews, current books, known/prepared choices, resource-selector insertion, daily refresh, explicit replacement, restoration and open-slot preparation. Matching counter Ready copies the spell JSON resource selector.

## Verification and next work

Build with `python3 build_demos.py`; run `python3 run_regressions.py --browser` with Python Playwright/Chromium (`BROWSER_EXECUTABLE` optional). New suites: `spell_resources_tests.mjs` (37 groups) and `test_browser_v3_27.py` (six scenarios). Exact results are in `TEST_RESULTS_V3_27.txt`. Exclude internal screenshots and runtime caches from releases.

Next magic milestone: concentration maintained after resolution and remaining components/silence/grapple/pinning/armor/metamagic/class-delivery rules. Maintain the frozen-allotment invariant during all future work. Do not connect stat recalculation or elapsed time directly to slot capacities.

Rest eligibility, divine prayer timing, recent-casting deductions, class progression/spell-list verification, finite SLA-use pools, extracts/psychic pools and arcanist-style hybrid casting are not silently inferred. GM resource administration is explicit adjudication, not a fully implemented rest subsystem. Explicit imported setup initializes fresh usage; existing saves reconstruct current spent state. Future import can add spent-at-import data without creating another slot counter.

Persistent independent area sources/footprints, duration/stacking and antimagic alerts should reuse geometry/lifecycle owners, followed by area dispels and item suppression. Templates, summoning via spawn/duration/control/dismissal, broader PF1e coverage and eventual AI/AP integration retain the existing roadmap. General arbitrary nested events and encounter/downtime retiming of active long casts remain separate work.
