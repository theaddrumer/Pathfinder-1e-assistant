> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# V3.26 — Counterspell and dispel API

This release extends the existing GM-authored spell-definition engine. It does not provide a spell database or certify class access. The engine computes checks, costs, interruption, timing, source ownership and removal from supplied definitions. Spell slots are the next milestone and are currently managed by the GM.

## Ready a counterspell

Use this ordinary command during the actor's turn with initiative enabled:

```json
{"op":"ready_counterspell","actor":"hero","id":"counter_watch_1","spell":{
  "name":"Fireball","spellId":"fireball","level":3,"casterLevel":7,
  "rangeFeet":680,"targets":["warden"],"counterspell":{"mode":"same"}
}}
```

Supply the chosen counterspell's identity, level, caster level and printed range. Counter definitions use a standard-action spell and contain no damage, healing, delivery, area, save or modifier payload. Optional `ability`, `concentrationBonus` and `defensive` retain their existing meanings. For a printed specific exception, `counterspell.matches` can list the canonical IDs it counters. The GM supplies valid exceptions; the engine does not invent elemental or school-based counters. Optional `spellId` normalizes identity independently of a descriptive/metamagic name. Without it, the trimmed, case-normalized name is used. Use the effective spell level for checks, with metamagic identity supplied correctly; general metamagic casting rules are not added here.

Readying costs one standard action and creates an existing native Ready Pending Event, expiring at the actor's next turn. The event ID must be unique, including against recorded history. Ready does not cast or expend the counterspell yet and does not dissipate a held touch charge. It also does not reserve a future spell slot.

When the selected opponent begins casting, its ordinary `cast_spell` pauses in the existing `pendingSpellCast` continuation. No incoming spell payload is resolved while the counterspell decision remains open. Inspect `gm_get_spellcasting` for `counterspells` and `provoking`.

```json
{"op":"gm_resolve_counterspell","id":"counter_watch_1","take":true,"perceived":true}
```

The GM must confirm that the casting is perceived. Registered walls, total cover, range, incapacitation, nausea and visibility still constrain the reaction. Matching identification also requires sight and a registered usable Spellcraft total. The existing skill checker uses DC 15 + incoming level + one per full 10 feet of distance. Optional integer `identificationModifier` adds other circumstance adjustments to that DC; distance is already included. No automatic natural-1/20 result applies. A failed identification cannot be retried for that casting. A nonmatching declared counter fails after identification. Neither case commits the spell or changes initiative; Ready can remain until its normal expiry or another casting. A `take:false` decision similarly retains Ready but closes its opportunity against this casting.

When a valid matching counter is cast, the spells negate each other automatically if its casting succeeds. Ready's existing machinery changes initiative immediately before the interrupted caster and marks the readied action used, without granting a full turn or spending the interrupted creature's action resources. Counterspell casting dissipates the countercaster's held touch charge and uses ordinary defensive, entangled and continuous-damage concentration checks.

Counterspells can provoke their own AoOs. Those use the same `gm_resolve_casting_aoo` and `gm_continue_spell` commands as ordinary casting. The suspended parent is retained inside `pendingSpellCast.parentCasting`; injuries still find their actual caster. Another native Ready may counter this counterspell through the same mechanism. Each child must finish before the parent continues. The GM chooses ordering among available opportunities; the calculator does not choose tactics or implement a general arbitrary event executor. Casting nesting is bounded at 30.

After a counter is resolved, use `gm_continue_spell` to finish that casting checkpoint. Its original AoOs must also be handled or explicitly confirmed through the existing `aooResolved:true` override. That confirmation does not bypass unresolved native counterspell choices. If countered, the incoming spell returns `status:'lost'`; otherwise it proceeds normally. An unspent Readied Action or held charge on another creature is preserved.

Generic Pending Event inspect, cancellation of untriggered Ready, expiration and history remain applicable. Generic text activation or resolution cannot bypass a native counterspell reaction. Actor authority can Ready its own counter on its turn; reaction adjudication uses the GM command.

## Use dispel magic as a counter

```json
{"op":"ready_counterspell","actor":"hero","id":"dispel_watch_1","spell":{
  "name":"Dispel magic","level":3,"casterLevel":7,"targets":["warden"],
  "counterspell":{"mode":"dispel"}
}}
```

No Spellcraft identification is needed. The shared dispel check is d20 + countercaster level against 11 + incoming spell's caster level. Optional `counterspell.bonus` is an explicitly supplied adjustment. `counterspell.greater:true` adds the greater dispel counterspell's +4. Natural 1/20 are ordinary results. Range defaults to medium, 100 + 10 feet per caster level; optional top-level `rangeFeet` supplies an explicit range. Counterspell effects never spill into the incoming spell's targets as damage or buffs.

An incoming `sourceKind:'spell_like'` activation cannot be counterspelled; its eligible ongoing effects can later be dispelled. Ordinary definitions default to `sourceKind:'spell'`. Supernatural and mundane generic modifiers are not automatically treated as spells.

## Cast a targeted dispel

```json
{"op":"cast_spell","actor":"hero","spell":{
  "name":"Dispel magic","level":3,"casterLevel":7,
  "targets":["warden"],"dispel":{}
}}
```

The ordinary cast pays its normal action and handles casting AoOs/concentration. `gm_resolve_spell` remains the explicit action-free override. The spell must have exactly one creature target and no ordinary payload. There is no save or SR. Range defaults to medium, with direct line of effect and a perceptible target. Optional top-level `rangeFeet` applies only to dispel/counterspell interaction definitions; attack delivery retains `delivery.rangeFeet`. Interaction range and identification distance use the existing 5/10/5 spell-grid helper and minimum occupied-square distance.

The engine derives eligible ongoing spell groups from the target's native modifier effects and held-charge events. Each group retains the original casting's caster level. Basic dispel rolls once and checks groups from highest caster level down, stopping after one success. Equal caster levels use a stable source-ID order. The caster automatically succeeds against their own eligible spell. Original caster level is a casting snapshot, not a newly read current creature statistic.

For one specific effect, supply its exact native effect/event ID:

```json
{"op":"cast_spell","actor":"hero","spell":{
  "name":"Dispel magic","level":3,"casterLevel":7,
  "targets":["warden"],"dispel":{"effectId":"magic_1_warden"}
}}
```

The ID is an example; inspect the live state to obtain one. A specific failed check does not fall through to other spells. Invalid target/effect/range requests reject before paying an ordinary casting action. If the selected effect expires while casting, completion has nothing to remove; if the target becomes blocked/out of range, the completed casting has no effect and receives no refund.

`dispel.greater:true` enables greater targeted spell removal: one d20 result, at most floor(caster level / 4) successful removals, checking highest caster levels first. Optional `dispel.bonus` supplies an explicit caster-level-check adjustment. Selecting one specific effect still selects only that spell. This mode does not implement greater dispel's curse-specific exceptions or area form.

## Ownership, removal and persistence

Each resolved casting receives a unique `spellSource.id`, original caster ID/name/level/caster level and dispellability. Metadata stays on the existing effects and held/ray records. Repeated rays and touches retain their original source. No second active-spell array or timer queue exists. `gm_get_spellcasting.effects` is a derived recipient/source index, also visible through lifecycle inspection and the workbench.

Removing one group removes its linked modifier records and held event only on the selected recipient. Existing `removeEffect` unlinks initiative-expiration events; existing `concludePendingEvent` records a held charge's `dispelled` history. Another recipient of a multi-target spell remains affected. Independently cast spells stay independent even when their names/casters match. If the strongest stacked modifier ends, the existing stacking calculator exposes whatever remaining modifier applies.

Set `effect.dispellable:false` for an explicitly undispellable ongoing modifier spell. Old generic modifier records without casting provenance are excluded rather than assigned invented caster levels. Existing pre-V3.26 held charges already contain an authoritative spell definition and can be indexed without creating a duplicate store. Instantaneous damage/healing has no active magic to undo.

Snapshots/undo and ordinary state reconstruction preserve metadata, Pending Events, nested casting continuations and RNG. Clock and initiative expiration still belong to their existing owners. Counterspells appear beside Ready in Time & Events; dispel target/effect selection appears beside spellcasting.

## Scope and verification

Supported removal owners are ongoing spell modifiers and held touch charges. There is no object/item target model for these commands, temporary equipment-magic suppression, persistent area origin/overlap dispel, summoned-creature dismissal, or curse-specific greater-dispel handling. Spell access, slots, component restrictions, general metamagic timing and maintained-concentration effects remain dedicated follow-ups. These limits are explicit rather than approximated by erasing arbitrary state.

Rules checked 2026-10-16 against the primary [PRD Magic](https://legacy.aonprd.com/coreRulebook/magic.html), [Dispel Magic and Greater Dispel Magic](https://legacy.aonprd.com/coreRulebook/spells/dispelMagic.html), [Spellcraft](https://legacy.aonprd.com/coreRulebook/skills/spellcraft.html), [Combat: Ready](https://legacy.aonprd.com/coreRuleBook/COMBAT.html) and [Paizo Core FAQ](https://paizo.com/paizo/faq/v5748nruor1fm). Examples besides named core spells are synthetic. Free identification preceding actual Ready commitment is the implementation's reading of the identification-then-casting sequence; no failed identification is retried against the same casting. Recipient-scoped removal follows targeted dispelling; it does not treat a multi-recipient casting as a removable global buff on all creatures.

New validation: `spell_interaction_tests.mjs` (47 groups) and `test_browser_v3_26.py` (five UI scenarios). The complete release run is recorded in `TEST_RESULTS_V3_26.txt`. Build with `python3 build_demos.py`, then run `python3 run_regressions.py --browser` with Python Playwright and Chromium available.
