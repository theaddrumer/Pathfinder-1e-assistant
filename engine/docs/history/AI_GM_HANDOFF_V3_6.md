> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# AI GM / Tabletop Kernel — V3.6 handoff (October 13, 2026)

## User's real goal and development principles

Build an autonomous, flexible Pathfinder 1e GM into which players eventually upload Adventure Paths and character sheets. A GPT GM interprets scenario information, supplies registered creature and mechanical definitions, portrays NPCs, decides tactics and handles context. The deterministic engine is a reusable mechanical memory/referee, not a separately programmed tactical AI. Ordinary mechanics use validated named commands; GM-only overrides and creative, contextual rulings remain available. User is knowledgeable about Pathfinder 1e but not coding; discuss game rules rather than requiring user implementation. Avoid overengineering, and be explicit about partial coverage.

## Source archive

`tabletop_kernel_v3_6_conditions_ailments.zip` contains all source `.mjs`, tests, offline browser demos, previous handoffs and docs. Open `index.html` for the GM workbench, `tests.html` for historical fixtures. The main workbench has editable statblock/effect JSON, generic GM damage and modifiers, plus new condition/ailment controls. `python build_demos.py` builds the offline HTML from sources.

## This release

- `conditions.mjs` contains 34 PF1e Core Rulebook condition definitions, explicitly tagged by coverage: **2 automatic, 24 partial, 7 advisory, 1 external**. This is a **complete named baseline library**, not a claim that all consequences of 34 conditions are fully implemented. Standard Shaken, Dazed, fatigue/exhaustion, frightened advisories, flat-footed/prone melee defense, some immobilizing conditions, nauseated and staggered action restrictions are supported; complicated exceptions remain advisories. Fear-source approach warnings are bypassable; AI decides escape route.
- `ailments.mjs` and `condition_ailment_game.mjs` provide reusable, validated definitions for poison, disease, DOT: initial and periodic saving throws, onset, timed recurrence (rounds/minutes/hours/days), limited ticks, consecutive or total successes to cure, recurring HP/ability damage or application of named conditions, manual cures and downtime advance. Separate ability-damage pool recalculates declared dependencies without corrupting base scores. Damage remains after cure.
- Ailments/rider effects are **not wired to attacks** yet, by user's explicit request. Expose them using GM commands after adjudication, then add generic attack rider event integration in a future version.
- All definition/condition/ailment injection is GM-only and validated. Base gameplay command roles do not receive damage or condition cheat operations.

## Known caveats

- Only 2 conditions are fully automatic by conservative accounting; rest require GM judgment or additional generic mechanics (per-source concealment, grapple, helplessness, critical/death, special equipment, spellcasting, mobility exceptions).
- Generic melee attack posture handling added for Prone/Flat-footed, not ranged or all concealment exceptions.
- Ailment saves/ticks are deterministic; `gm_advance_time` advances only the separate ailment clock, not every spell effect or every creature turn. Ability-damage to Con does not update HP per HD without Hit Dice structure. Bleed termination on healing and poison multiple-dose stacking are not automatic. Ailment effects do not integrate into attacks yet.
- All explicit imported creature AC totals remain authoritative; ability dependencies are explicit. Full AoO/nested interrupt scheduler remains future work.

## Validation

V3.6 new Node suite `condition_ailment_tests.mjs` passes **31** named tests; all prior Node test files pass. Six Chromium scripts pass, including the historical movement, Choker, full-attack, registry, workbench, and V3.5.1 charge checks and the new V3.6 UI. Older browser title version assertions were generalized because old demos now run in the V3.6 page.

## Next

Mechanics vocabulary audit and practical encounter tests for conditions/ailments, particularly automatic condition clear triggers, nuanced action resources, accurate contextual defenses, duration clocks, generalized resistance, and rider effects after status mechanics are stable. Before expanding, allow the user to run the workbench and identify anomalies. Do not silently invent support for complex PF conditions; this catalog deliberately exposes coverage limits.
