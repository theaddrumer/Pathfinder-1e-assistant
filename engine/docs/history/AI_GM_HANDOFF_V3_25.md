> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# Pathfinder 1e Tabletop Kernel — V3.25 handoff

Resume from `tabletop_kernel_v3_25/`. Read `TOUCH_AND_RAY_DELIVERY_V3_25.md` for schema/API examples, exact mechanics and limitations. `MagicGame extends PendingEventsGame` remains the active engine; V3.24 casting/lifecycle source and historical handoffs/tests are preserved.

## Project boundary

The AI GM supplies imagination, tactics, choices and unusual adjudication. The kernel owns mechanical state, enforces ordinary action rules and performs repeated arithmetic. Explicit GM overrides remain logged and distinct. Reuse existing subsystems; do not add redundant effect/timer/attack trackers or replace the working calculator wholesale.

## What changed

- Held charges are native `held_spell` records inside the existing `pendingEvents` registry, with indefinite duration. Their single payload owns the spell, remaining charges, initial free touch and target SR cache. No separate held-charge array or timer exists. Shared `concludePendingEvent` records cancellation/expiry/resolution/discharge.
- Optional `spell.delivery` selects `touch` or `ray`. Touch casting creates its Pending Event; `deliver_touch_spell` uses the free initial attempt or pays a standard action. Misses retain charges. Contact discharges even when SR/save blocks the payload. Another ordinary casting cancels the old charge. `gm_discharge_touch_spell` handles explicitly adjudicated other contact. Ordinary actors cannot assert another creature's willing contact.
- `AutomationGame.resolveAttackCheck` is shared by normal attacks and spell delivery, preserving existing touch AC, range, cover, concealment, critical/precision/fortification behavior. Spell damage/healing/effects reuse the Magic payload resolver. Spell criticals repeat base spell damage; no weapon damage/Strength or doubled precision is invented.
- `onAttackHit` connects ordinary natural/unarmed contact to the held spell without a new attack or action. Ordinary manufactured hits do not count as skin/body contact. Specialized class delivery remains future work.
- Ray lists allow repeated targets, independent attack/damage per ray, one SR result per casting/creature, and separate per-hit mitigation. They reuse `pendingRangedAction`/`resolve_interrupt` for one delivery-AoO phase per volley. Ray delivery provokes even after defensive casting. The old ray-no-delivery-AoO assertion was incorrect and is replaced, with official FAQ support.
- Pre-turn long-cast completion remains paused through a pending ray opportunity, then resumes ordinary start-of-turn effects/actions. Long casting now provokes only on initiation, and casters do not threaten during unfinished casting.

## Commands and storage

Existing magic commands remain. New ordinary `deliver_touch_spell` takes `{actor,target,willing?}`; another creature's `willing:true` needs GM authority. New GM `gm_discharge_touch_spell` takes `{actor,target?,reason}`. A missing target spends a charge on an unmodeled object without inventing damage. Inspection adds a derived `held` view to `gm_get_spellcasting`; the canonical records remain Pending Events. Generic GM Pending Event cancellation works on them, but generic trigger activation requires their mechanical delivery command.

`delivery.type` is `touch` or `ray`. Rays require positive `rangeFeet` and a target list; touches may omit targets, optionally declare `charges`, and optionally use `attemptOnCast:true` with one provisional subject. Attack ability/offset and critical profile fields follow existing attack conventions. Preserve printed statblock baselines and supply appropriate spell offsets/ability links; do not infer weapon enhancements from a published total.

The common attack checker is read-only apart from RNG/log, never spends actions or weapon damage. Native attacks retain their damage/rider pipeline. A ray opportunity occurs after casting completes: damage does not require another casting concentration roll, but incapacitation stops delivery. Blocked live rays do not refund casting. Generic nested/simultaneous event execution is still unimplemented.

## Validation and next work

Run `python3 build_demos.py`, then `python3 run_regressions.py --browser` (Node plus Python Playwright/Chromium). Optional `BROWSER_EXECUTABLE` / JSON `BROWSER_ARGS` make the browser tests portable. New coverage: `spell_delivery_tests.mjs` (47 groups) and `test_browser_v3_25.py` (five UI scenarios). Exact final results are bundled in `TEST_RESULTS_V3_25.txt`.

Next: counterspell/dispel using current cast/effect lifecycle and Pending Ready records, then prepared/spontaneous slot use; later maintained concentration, components/silence/grapple/armor failure/metamagic and class-specific spell attacks. Long-cast failure still records loss without spending a slot because slots are not implemented. Effects will need explicit casting-instance metadata for robust dispel grouping; do not infer source equivalence from spell names alone.

Persistent areas remain planned as independent sources with footprints, duration and stacking policies (terrain, concealment, hazards, antimagic alerts) through the existing geometry/time index. Templates (Advanced/Celestial/Fiendish), summoning through current creature spawn plus duration/control/dismissal, wider PF1e coverage and eventual host-neutral AI/AP integration follow the existing roadmap. Encounter/downtime retiming of active long casts and a general nested-interruption executor remain separate targeted work.
