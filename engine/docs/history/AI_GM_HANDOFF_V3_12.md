> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# AI GM / Tabletop Kernel — V3.12 handoff (October 15, 2026)

## Objective

Maintain a small deterministic Pathfinder 1e state and calculation engine directed by an AI GM, ultimately able to run an uploaded Adventure Path. The AI chooses NPC tactics, interprets unusual rules, and dynamically supplies monster/effect definitions. The kernel owns validated actions, state, dice, modifiers, durations, defenses, and recurring effects. No strategic decision-maker belongs in the kernel.

## Files

- Complete ZIP `tabletop_kernel_v3_12_attack_riders.zip` with `.mjs` sources, tests, standalone HTML, historical fixture gallery, and docs.
- Standalone UI: `tabletop_kernel_v3_12_demo.html` (same build as `index.html`).
- New rules code: `riders.mjs` (`RiderGame extends ManeuverGame`). `scenarios.mjs` uses RiderGame; `build_demos.py` now includes Riders in the offline HTML build.
- Documentation: `ATTACK_RIDERS_V3_12.md`; `CHANGES_V3_12.md`. Historical docs retained.

## V3.12 specifics

1. A successful hit by an attack profile carrying `grab` offers a player/AI-controlled choice. Accept/decline via `resolve_interrupt`; `resolve_rider` supports explicit normal/appendage/decline choice. The original hit and damage are not repeated.
2. Grab is a free CMB check, +4, no AoO. Limb-only hold incurs an additional -20 CMB but doesn't grapple the holder. Grapple size restrictions apply with an optional profile-level `grabSizeAllowance` exception.
3. Constrict is supported on Grab checks where the attack explicitly specifies `constrictDie` and `constrictBonus`. Separate bludgeoning damage fires on a successful establishing or maintenance check. A successful maintenance check also deals the establishing attack's damage (subject to the standard damage resolution).
4. A normal Grappled holder cannot proceed through additional full attacks; a limb-only holder can. `replace_attack` permits Trip/Disarm/Sunder to replace a melee full-attack slot without spending extra action resources, and resumes after the maneuver's AoO decision.
5. Fixed older Grappled CMB double-counting. Protected player role prevents a player from deciding an NPC's Grab reaction.
6. Interactive workbench now offers Grab normal/decline/appendage decisions, an editable Bite+Grab+Constrict example and attack-replacement dropdown. `tests.html` preserves previous encounter fixtures.

## Testing

Run `node tests.mjs`, all `*_tests.mjs` including `rider_integration_tests.mjs`, and `python test_browser_v3_12.py`. Historical `test_browser_v3_*.py` scripts remain; only expectations about Grab's 'definition_only' status were updated because it now executes. Record exact results at release time.

## Remaining priorities

- AoO/charge maneuver substitution; generalized nested interruption scheduling.
- Trip-on-hit, Poison/Bleed delivery, Pull/Push, Paralysis, Energy Drain and other existing riders.
- Complex grapples and multiple holds; Constrict with non-Grab grapples.
- Critical hits, ranged combat, spell resolution, AI structured controller interface and full Adventure Path import remain later milestones.

## User preferences

User is a knowledgeable PF1e GM, not a programmer. Prefer short practical descriptions over technical details. Treat their rulings as substantive and allow GM-only exceptional overrides with recorded reasons. Do not put NPC tactics or narrative decisions into the engine. Favor reusable data definitions over one-off hardcoding, and retain regression tests outside the primary UI.
