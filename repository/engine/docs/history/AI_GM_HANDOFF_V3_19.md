> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# Tabletop Kernel / Pathfinder 1e AI GM — V3.19 Development Handoff

## Current working version

Start from `tabletop_kernel_v3_19/`. Base V3.18 (ordinary ranged/thrown attack resolution, nonlethal, weapon-size dice) is **preserved**. The newest work, V3.19, closes the immediate deferred **Attack Completion** milestone by implementing opt-in dual-wield/mixed natural attack plans, tracked ammo/drawn/loaded rounds, declared reload action costs, melee-threatened ranged/reloading AoO checkpoints, GM replenishment, and full-attack cursor correctness. Read `ATTACK_ROUTINES_AND_AMMUNITION_V3_19.md` for exact schemas and supported/unsupported behaviors. Historical handoffs V3.1–V3.18 are kept.

## Architecture and technical decisions

- `AttackRoutinesGame extends AttackCompletionGame` in `attack_routines.mjs`; `scenarios.mjs` instantiates it; `attack_routine_rules.mjs` is a separately flattened validator to avoid registry import cycles. `build_demos.py` bundles the new code into the offline HTML.
- Keep imported `creature.attacks` **authoritative and unmodified**, as these typically reproduce the book's entire manufactured/natural routine. Only create derived iteratives/TWF and primary/secondary adjustments with an explicit `creature.attackPlan` declaration.
- All inventory and pending AoO state lives in serialized game state for undo. The AI GM chooses whether to take AoOs, which weapon attack to select, whether to reload, and how to adjudicate unusual rules. No autonomous tactical planning.
- A small prepared-AoO queue handles ranged fire and reload independently of the proposed **future** generalized nested interrupt scheduler. On-hit rider decisions on an AoO can delay resumption of the original shot. The ray attack roll is exempt from additional ranged-weapon provocation; casting-provocation needs spell rules later.
- `reload_weapon`, `draw_ammunition` gameplay ops and GM `gm_set_ammunition` op. Workbench controls for these live together in the attack-completion area, next to the attack-plan preview.

## Validation

`node attack_routines_tests.mjs` — 20 targeted assertions. All `*tests.mjs` — 27 Node suites passing. `test_browser_v3_10.py` through `test_browser_v3_19.py` with V3.16.1 included — 11 browser suites. All tests are offline Chromium/Node. Run `python build_demos.py` before browser tests. Entry pages: `index.html` GM workbench, `tests.html` historical fixtures, `automation-demo.html` demo fixtures, `demo.html` original simple scenario. Standalone root `tabletop_kernel_v3_19_demo.html` is copied from `index.html`.

## Next planned work (do not confuse with implemented features)

1. **Pending Events / Readied Action bookkeeping**: conditional declarations without interpreting arbitrary trigger prose; lifetimes by clock, turns, encounter or indefinite; warnings adjacent to existing Fast Forward in a single Time & Events group. Simple expiration and initiative shifts for formal readying are calculator bookkeeping, while the GM decides when the trigger occurs. General nested interrupts and Delay/immediate-action timing should grow from this rather than creature tactical AI.
2. **Magic and effect resolution**: casting actions, spell targeting/areas, saving throws, spell resistance, concentration, counterspelling, dispelling, durations, transformation operations. Summoning can reuse the existing creature import/spawn systems but needs spell duration/dismissal/control rules; start with reusable basic templates **Advanced, Celestial and Fiendish**. Do not try to hardcode every exotic template or creature; use declarative transforms or GM overrides.
3. **Broader rules coverage**: difficult terrain and lighting, flanking, full death/dying/stabilization, selected status interactions, skills, class abilities, special ranged feats/complex conditions. Advanced wall geometry, partial cover and squeezing are intentionally a later separate map task.
4. **AI GM / Plugin bridge**: expose validated command schemas through an adapter (such as a provider-specific tool protocol or service). The rules kernel does not need to embed an AI; it will be called by an AI GM supplied separately. Each host needs its own adapter. Then ingest real Pathfinder encounter/statblock data and test end-to-end persistence and AP behavior.

The main design constraint remains **small deterministic rules operations subordinate to AI GM authority**, not decision-making NPC agents, nor a homebrew simplification of PF1e. GM Free Mode always remains available for exceptions.
