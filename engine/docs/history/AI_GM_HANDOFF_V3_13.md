> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# AI GM / Tabletop Kernel — V3.13 handoff (October 15, 2026)

## Goal and architecture

A reusable, small, deterministic Pathfinder 1e rules/state engine serving a creative AI GM. The GM chooses monsters' actions, tactics, interpretations, source material, custom exceptions and eligibility for conditional damage. The engine handles the dice, state, stats, action costs, defenses, and event consequences. Import creature profiles at runtime; don't hardcode individual Bestiary entries or tactical decision-making. Historical fixtures live in `tests.html`, not in the main `index.html` workbench.

## Current release files

- Complete source/archive: `tabletop_kernel_v3_13_critical_precision.zip`.
- Offline browser workbench: `tabletop_kernel_v3_13_demo.html` (`index.html` within ZIP).
- Primary reference: `CRITICAL_PRECISION_V3_13.md`; `CHANGES_V3_13.md`.
- `critical_rules.mjs` houses validated critical/precision/fortification definitions, and `critical.mjs` provides `CriticalGame extends RiderGame` for per-attack precision eligibility. `scenarios.mjs` creates `CriticalGame`; `build_demos.py` bundles both new modules, preserving ordering and all older modules.

## V3.13 additions

1. Every executed ordinary attack now calculates a threat (default 20) and confirms when applicable. Weapon damage dice and normal flat modifiers reroll at x2/x3/x4/x5; precision and independent added elemental dice do not multiply. Broken/improvised weapon 20/x2 now operates, not merely advisory. Keen/Improved Critical double threat breadth and do not stack.
2. The GM/controller explicitly passes `precisionEligible:true` on each attack/full-attack strike. Imported attack entry may declare `precision:{count,sides,bonus}`; a GM-confirmed precision attack inherits the attack's physical damage types, and DR applies once to combined damage. An optional `extraDamage` list is resolved as independent damage components, never multiplied.
3. Target-side `protections.fortification` or worn equipment `fortification`, plus separate `criticalNegationChance` / `precisionNegationChance` properties, use validated percentages; best applicable chance rather than adding. A single d% roll can suppress both critical and precision contributions from the same hit. The underlying hit survives. Inherited Ooze/Elemental/Incorporeal critical and precision immunities now act on attacks automatically. PF1e Undead do not receive these immunities by default.
4. `gm_resolve_packet` supports optional `precision:{count,sides,bonus}` on a component, inheriting that component's fire, cold, physical, or other type and using shared DR/resistance once. GM supplies precision eligibility for spell damage; packet spell targeting and saves remain future work.
5. UI adds a per-strike precision toggle and `Load Critical + Precision example` in the source inspector. All previous Grab, Constrict, CMB, maneuver, ailment and GM override features remain.

## Commands/examples

`{"op":"attack","actor":"hero","target":"warden","index":0,"precisionEligible":true}` (actor/controller action).

Weapon data: `{"label":"Keen rapier","damageTypes":["piercing"],"criticalThreat":18,"criticalMultiplier":2,"keen":true,"precision":{"count":2,"sides":6},"extraDamage":[{"damageType":"fire","count":1,"sides":6}]}`.

Target defense, as creature top-level: `"protections":{"fortification":50}`; as equipped item: `"equipment":[{"id":"mail","name":"Mail","location":"worn","fortification":75}]` within the creature's `stats` object.

Spell packet component: `{"damageType":"fire","amount":12,"precision":{"count":2,"sides":6}}` within `gm_resolve_packet` GM command.

## Testing and limits

Run `node tests.mjs`, loop `node *_tests.mjs` for all Node suites including `critical_precision_tests.mjs`, and all `python test_browser_v3_*.py`. `python build_demos.py` regenerates offline HTML and default main workbench. Confirm browser uses Chromium at `/usr/bin/chromium`.

Remaining milestones: nested interrupt scheduler, conditional/attack-on-hit rider integration (Trip-on-hit, Poison, Bleed, Paralysis etc), automatic flanking/concealment/cover, ranged attack execution, complete spell targeting/saving throw/SR mechanics, nonlethal damage, multi-die base weapon damage, broad creature trait/import catalogs. Precision eligibility is a GM decision and **must not** be inferred from a weapon simply having sneak attack dice.

### User preferences

User is expert in PF1e mechanics and not a programmer. Prefer concise prose, avoid parroting their reasoning or flattery. No tactical AI inside mechanical kernel. Test novel mechanics against existing combat regression suites before releasing. GM adjudication remains authoritative; allow concise, source-recorded overrides.
