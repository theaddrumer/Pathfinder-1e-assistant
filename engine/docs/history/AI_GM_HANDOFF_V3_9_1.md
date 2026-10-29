> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# AI GM/Tabletop Kernel — V3.9.1 handoff (October 14, 2026)

## Ultimate target
A PF1e AI GM able to import an Adventure Path and character data, operate a deterministic mechanical referee through validated commands, and adjudicate novel rules without programming creature tactics in the engine. Maintain the authoritative statblock totals + dependency model; AI decides behavior, the engine calculates. Preserve selectable PF1/3PP/homebrew source packs in future.

## New V3.9.1 work
Narrow patch over V3.9 attack foundation. Added `weapon_materials.mjs` containing a small typed material library (steel, alchemical silver, cold iron, adamantine, mithral) and the Broken item condition. `attackKind:'improvised'` gives -4 to-hit by default; `improvisedProficient:true` permits a rules exception. `itemCondition:'broken'` independently gives -2 hit and -2 damage. Both combine. All improvised/broken profiles have 20/x2 crit **described but not executed** (crit engine pending). Materials supply DR-bypass tags automatically, without doubling subtype alignment tags. Alchemical silver imposes -1 damage only for qualifying slash/pierce weapon hits. Creature attack definitions and GM packet metadata can specify `weaponMaterial`. Masterwork bonus is not added to imported authoritative attack totals.

New `weapon_quality_tests.mjs` verifies import/inspection, penalties, combined traits, material DR, alignment combinations and metadata validation; `test_browser_v3_9_1.py` tests the workbench. All existing V3.9 Node suites and V3.8-V3.9 browser regressions pass. `index.html` now has **Load material / broken / improvised examples** with five weapons. The old historical fixtures remain in `tests.html`.

`WEAPON_QUALITIES_V3_9_1.md` is the authoritative coverage description. Not yet implemented: critical confirmation, actual equipment/item HP inventory and live broken-state changes, ranged/thrown geometry and improvised 10-foot range increment, object hardness 20 exception, material price/weight/armor restrictions and uncommon materials, broken armor/shield/tool effects. `gm_resolve_packet` assumes GM-supplied component amounts already include equipment-based damage penalties; material metadata only supplies bypass.

## Next architecture target
Reusable combat maneuvers (CMB/CMD, grapple, escape, ongoing grapple conditions), then optional Grab/Constrict attack riders with controller decision interrupts. Avoid hardcoding monster tactics. Keep tests and honest coverage/advisory flags. Consider item inventory and live item condition state before broad equipment implementation, and fix critical-hit resolution before treating improvised/broken crit profiles as fully automated.

## Files
Complete archive `tabletop_kernel_v3_9_1_weapon_qualities.zip`; stand-alone page `tabletop_kernel_v3_9_1_demo.html`. Rebuild demos with `python build_demos.py`. Run `node weapon_quality_tests.mjs` and historical `*tests.mjs`. Core modules `core.mjs`, `automation.mjs`, `foundations.mjs`, `registry.mjs`, `attack_library.mjs`, `weapon_materials.mjs`.
