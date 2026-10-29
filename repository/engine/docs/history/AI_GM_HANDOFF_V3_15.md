> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# AI GM / Tabletop Kernel — V3.15 handoff (October 15, 2026)

## Goal

Deterministic, reusable Pathfinder 1e rules/state calculator beneath a creative AI GM. AI chooses tactics/targets/rulings/interpretations and imports creatures, Adventure Paths and unusual effect definitions. Calculator handles action economy, dice, numeric rules, afflictions, effects, relationships, and rollback. Keep imported printed stat totals authoritative. Offline source remains dependency-free browser JS modules; no autonomous GM.

## Source of truth / upgrade

Start from `tabletop_kernel_v3_15/` (supersedes V3.14). `final_offense.mjs` extends `CriticalGame` -> `RiderGame` -> `ManeuverGame` -> Foundations, and `scenarios.mjs` now instantiates `FinalOffenseGame`. `build_demos.py` bundles `final_offense.mjs` **after** `critical.mjs` and **before** `scenarios.mjs`; template includes `/*__FINAL_OFFENSE__*/` in that location. `index.html` is primary workbench, `tests.html` historical fixtures, `demo.html` legacy. Read `FINAL_OFFENSE_RIDERS_V3_15.md`, `CHANGES_V3_15.md` and inherited `AI_GM_HANDOFF_V3_14.md`.

## Supported V3.15 mechanics

Pull, Push are optional after a hit, fixed imported number of feet, controller decisions, free CMB checks (independent of normal Bull Rush/Reposition feat modifiers), size limit equal-or-smaller, no forced-movement AoOs, obstacle stops, tile triggers. They queue alongside optional Grab/Trip. V3.14 direct Poison, Bleed, Paralysis and V3.12 Grab/Constrict continue to work.

Energy Drain: automatic on hit, doubles levels on confirmed non-negated critical. `energyDrainLevels`, `energyDrainDC`, optional `energyDrainTempHp`. Each negative level is stored in `s.negativeLevels` and reduces attacks, CMB, CMD, saves, skills and ability checks by –1 and current/max HP by 5. If levels >= imported HD, target dies. Separate Fortitude saves after 24h; successes remove, failures become permanent. Undead and other immunity tags handled by preexisting trait layer. Energy Drain grants 5 temporary HP per inflicted negative level for up to 1 hour; repeated uses of same ability do not stack (Paizo FAQ). New `absorbTemporaryHp` hook is consumed after defenses by `damage` or `resolvePacket`. GM commands `gm_apply_negative_levels`, `gm_restore_negative_levels` support exceptional intervention.

## Verification

All 22 Node test suites passing, including 16 named new V3.15 cases. All 24 versioned Chromium browser test suites have passed individually after updating the two obsolete page-version assertions. New `test_browser_v3_15.py` validates imported example, Pull/Push controller flow and Energy Drain HP/level effects. Run `node final_offense_tests.mjs`, `node *_tests.mjs`, `node tests.mjs`, `python test_browser_v3_15.py`, or each `test_browser_*.py` / `compat_test_browser_*.py`. Chromium: `/usr/bin/chromium`. The massive parallel browser sweep may exhaust runtime resources; run in small batches/individually.

## Explicit boundaries and next priority

The common named riders **Grab, Constrict, Trip, Poison, Bleed, Paralysis, Pull, Push, Energy Drain** now have executable basic paths, but the offensive network as a whole isn't finished: nonlethal damage, weapon-size damage scaling, ranged/thrown attack resolution, corner-case rider interactions and nested interrupt scheduling remain. Negative levels don't automatically recompute spellcaster level or other level-dependent variables. Forced movement interrupted by a complicated entered-square ability may require GM adjudication. The negative-level death threshold requires `hitDiceCount` or a warning is shown; restoration alone is not resurrection.

User explicitly asked to complete offensive mechanics **before** defensive redesign: next normal attack completeness, then armor/shield equipment bonuses and materials, hardness/broken defenses, cover/visibility, concealment and miss chances. GM Free Mode remains available for rare exceptions. Do not recode tactics or hardcode individual monsters. Retain comprehensive regression fixtures without crowding primary workbench. User prefers coherent brief prose, minimal listicles and no extra offers.
