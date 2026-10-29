> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# Pathfinder 1e Tabletop Kernel — V3.22 Handoff

## Working release

Start with `tabletop_kernel_v3_22/`, `MAGIC_AND_AREA_GEOMETRY_V3_22.md` and historical V3.21 handoff. `MagicGame extends PendingEventsGame` in `magic.mjs`, and `scenarios.mjs` instantiates it. The pure geometry helper is in `spell_geometry.mjs`, inserted before `magic.mjs` in `build_demos.py` bundles. Previous functionality from V3.1 through V3.21 and existing GM command interface remain intact.

V3.22 supports **area preview** (`gm_preview_spell_area`), GM-only resolution of declarative spells without action cost (`gm_resolve_spell`), ordinary active-actor action-costed casting (`cast_spell`), and GM resumption of provoking casts (`gm_continue_spell`), plus optional `gm_check_concentration`. These new mechanics cover 2D spheres/bursts/emanations/spreads, cones, octant lines; typed damage, saving throws, SR, healing, temporary modifiers, defensive concentration and a casting-AoO checkpoint.

For complete command shapes and limitations, consult `MAGIC_AND_AREA_GEOMETRY_V3_22.md`. Particularly note that the GM must decide what a declared spell or target means and provide spell level, CL, save DC, SR applicability, target/origin and components. Use `role='actor'` for `cast_spell`, `role='gm'` for GM-only operations. Non-defensive casts provoked by hostile melee threats **pause** for a GM-resolved AoO decision; supply actual casting-interruption damage to `gm_continue_spell`. They do not invoke every interrupt autonomously. `Pending Events` continues to govern conditional/delayed events. The workbench clusters spell controls, preview and execution in its Magic & Area section.

## Verify / release

`node magic_tests.mjs`, iterate all `*tests.mjs`, `python test_browser_v3_22.py`, and sample historical browser tests; `python build_demos.py` rebuilds standalone HTML. Node tests use seed/reversible test rolls and preserve existing state snapshots.

## Roadmap

1. **Spellcasting completion**: automatic multi-reactor casting AoOs, touch/ray targeting, defensive casting with components/restrictions and arcane spell failure, counterspell/dispel and spell-slot accounting, maintained spell zones. Wider area geometries (cylinder, height, unusual shapes, partial walls, shapeable areas) with explicit GM overrides.
2. **Basic templates**: Advanced, Celestial, Fiendish with printed-statblock delta logic; exotic templates are AI GM/Free Mode adjudications. Summoning should use runtime creature spawn with dismissal, duration, number limits and control bookkeeping rather than a new creature engine.
3. General PF1e: dying/stabilization, flanking, lighting and terrain, richer transformation and skills, optional improved wall geometry, class-specific abilities.
4. Host-neutral tool/plugin interface and persisted campaign/adventure/statblock ingestion. The kernel is **not** an autonomous AI GM or full Pathfinder rules engine.

**Preserve principles:** GM makes narrative and tactical decisions, imported totals are authoritative, developer/test harness has rollback, do not hardcode individual monsters or an exhaustive spell library, avoid bloating the calculator with partial geometry/corner-case automation. Keep related magic and timing controls together within their local workbench sections; this is a project UI decision, not a general user preference.
