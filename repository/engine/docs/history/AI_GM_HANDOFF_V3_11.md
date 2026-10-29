> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# Pathfinder 1e AI GM / Tabletop Kernel — V3.11 handoff (October 14, 2026)

## Purpose
Build a deterministic, flexible PF1e rules calculator that an AI GM controls. The GM interprets an uploaded Adventure Path, imports creature stats/ability data once, makes narrative/tactical choices, and supplies exceptions. The engine validates mechanical operations and preserves ongoing state. Do not turn the rules engine into a separate tactical AI. User knows Pathfinder 1e well but does not program; explain rulings and limitations in plain language.

## Current artifacts
- Complete source ZIP: `tabletop_kernel_v3_11_maneuvers_free_mode.zip`
- Standalone workbench: `tabletop_kernel_v3_11_demo.html` (equivalent to bundled `index.html`)
- Separate historical test-fixture gallery: `tests.html` in ZIP
- New code in `maneuvers.mjs`, `core.mjs` (`gm_free` movement mode), `automation-demo-template.html`, `automation-demo-ui.js`; `build_demos.py` regenerates standalone HTML
- Main new reference: `COMBAT_MANEUVERS_AND_OVERRIDES_V3_11.md`. Older docs and tests remain preserved.

## V3.11 additions
1. `maneuver` supports `dirty_trick` (six parameterized options), `drag`, `reposition`, `steal`, and a restricted adjacent `overrun` in addition to V3.10 Trip/Disarm/Sunder/Bull Rush/Grapple.
2. Six flat human-facing Dirty Trick dropdown entries map onto **one** operation; target can remove a tracked Dirty Trick by spending a move action, or standard action with Greater Dirty Trick. Duration standard 1 round +1 per 5 margin; Greater 1d4 instead of 1. `stats.greaterManeuvers` is imported/validated.
3. Overrun is two-stage: defender's AoO first (if available), then a separate `overrun_avoid` decision. The controller chooses to avoid or stand ground. Improved Overrun flag suppresses both AoO and avoidance. Presently only one-square pass-through, not an ongoing move or charge.
4. Reposition requires GM/AI-chosen path; Drag is straight-line backwards with a speed cap. Steal requires equipment item with `accessible:true` and optional `fastened:true` (+5 CMD), and transfers item on success. More complex terrain, cover, AoOs and spatial exceptions are explicitly limited.
5. `gm_adjudicate` (GM role only, requires reason) consolidates existing condition/modifier/damage/healing/action-grant/relocation commands and adds `move_free` (path movement without spending actions, retaining AoOs and entered-square triggers). Audit entries are stored in state and undone with existing snapshots. Not a general code execution feature.
6. `index.html` now includes a Free Mode group **inside the GM adjudication card**, as well as new maneuver choices and a removable Dirty Trick selector. Existing `tests.html` and old scenarios remain for regression.

## Verification
- `node tests.mjs` (16 base tests) passed.
- All 17 `*_tests.mjs` files passed, including 22 new V3.11 maneuver/GM adjudication tests. Run each individually or via a shell loop.
- All 13 `test_browser_v3_*.py` scripts passed under Playwright/Chromium, including V3.11 UI flows and older versions.
- The historical V3.2 browser regression required restoring a specific explanatory phrase; it is preserved.

## Important limitations / next priorities
- Full attack/AoO **attack replacement** by maneuvers remains undone. Attach Grab to Bite only after resolving the optional CMB reaction pathway; Constrict remains distinct.
- Complete Drag, Overrun-with-movement/charge, Greater maneuver AoOs, positional corner cases, and multi-grappler mechanics remain incomplete. The current implementation returns advisories and explicitly documents the supported subset.
- `speed` is **not** presently a legal generic `gm_modifier` target. Use `gm_adjudicate.kind:"move_free"` for explicitly granted path movement. A reusable persistent speed-modifier field should eventually be added.
- Conditions library includes 34 entries but many have partial/advisory coverage; the six Dirty Trick conditions inherit that coverage. Don't claim all consequences automated.
- Creature types/subtypes, damage defenses, disease/poison, ability damage/drain, material bypass, and action economy remain inherited from V3.10 and earlier.
- General nested interrupt scheduler, critical hits, full ranged rules, spell resolution, AI interface, and Adventure Path import are still future milestones.

## Design preferences
- Favor composable, validated operations over special-case hardcoding.
- Avoid counting imported printed totals and inherited modifiers twice.
- AI chooses what a frightened NPC does or whether it avoids an overrun; calculator reports consequences and can advise.
- GM can adjudicate exceptional published mechanics and record *why* an override happened; preserve action validation for ordinary actors.
- Retain test fixtures for automated regression, not on the main workbench.
- When a mechanic remains unsupported, emit a clear error/advisory instead of pretending it worked.
