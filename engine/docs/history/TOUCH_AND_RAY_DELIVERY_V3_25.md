> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# V3.25 — Touch spells and rays

This release adds spell attack delivery to V3.24. Held charges reuse the Pending Events registry beneath Ready. Spell attacks reuse the existing weapon attack checks, defenses, range calculations and damage packets. There is no second held-charge store, timer queue, hit/critical calculator, or tactical decision maker.

## Touch delivery

Add `"delivery":{"type":"touch"}` to the existing spell definition. An ordinary `cast_spell` pays casting costs and handles casting concentration/opportunities, then creates one indefinite Pending Event of native kind `held_spell`. Casting does not apply its payload yet. Initial targets may be omitted, or supplied as an empty list; at most one provisional target is accepted.

```json
{"op":"cast_spell","actor":"hero","spell":{
  "name":"Synthetic touch effect","level":1,"casterLevel":5,
  "delivery":{"type":"touch"},
  "components":[{"damageType":"force","dice":{"count":1,"sides":6,"bonus":2}}]
}}
```

The caster can move before touching. Deliver using `{"op":"deliver_touch_spell","actor":"hero","target":"warden"}`. One attempt is free during the casting turn, and a miss keeps the charge but uses that free attempt. A later attempt pays a standard action. Range/solid-wall errors reject atomically before the attempt/action is spent. The pure melee touch delivery does not provoke. The charge itself is not ongoing casting and needs no injury concentration. Free delivery still obeys condition restrictions; nauseated cannot turn it into a permitted attack. Pending rays share the ordinary ranged-action condition gate.

A hit discharges its payload even when SR or a saving throw prevents its effect. Ordinary touch spells have one charge. For a printed ability that expressly allows repeated touches, supply `"charges":N` inside `delivery`; remaining charges live in that same Pending Event. This does not infer how many charges any published spell should have. General multi-target touch spells that require all subjects in one casting are not represented by this repeat-charge option.

Self-touch is automatic. A GM can confirm another subject's willing contact with `willing:true`; ordinary actors cannot assert another creature's willingness. Willingness here concerns contact and does not itself waive a defined saving throw or lower SR. Optional `"attemptOnCast":true` in touch delivery attempts its single supplied target as part of casting completion, including the pre-turn completion of a long cast. Omit it to preserve movement/target selection after casting.

Starting another ordinary casting dissipates an existing held charge after valid action payment, including when the new defensive concentration check fails. An invalid request that never starts casting leaves it intact. `gm_resolve_spell` remains an explicit effect-resolution override: applying a delayed effect does not imply a new casting and does not erase an unrelated held charge. Resolving a new held-touch effect does replace an older charge from the same caster.

Natural/unarmed hits discharge a held touch payload through the existing attack-hit hook, adding it after ordinary strike damage with no second action. A critical with that natural/unarmed strike does not automatically multiply the separately delivered spell. Manufactured weapon hits do not establish the caster's physical contact. Class-specific Spellstrike/Spell Combat and new unarmed-provocation mechanics have not been added.

For GM-adjudicated unintended contact, use:

```json
{"op":"gm_discharge_touch_spell","actor":"hero","target":"warden","reason":"The creature brushed the caster"}
```

Omit `target` for contact with an unmodeled object; a reason is required and the charge is spent without inventing an object damage result. Creature contact checks reach/solid barriers. Generic GM Pending Event cancellation removes the same record and writes the same shared history. Generic text-trigger activation cannot silently discharge a held spell without the delivery/contact mechanics.

## Ray delivery

Use `"delivery":{"type":"ray","rangeFeet":60}` plus a nonempty `targets` list. Each entry is one ray; repeated creature IDs are allowed for multiple rays aimed at one subject. Rays resolve as part of casting with no extra attack action and cannot be held for a later turn.

```json
{"op":"cast_spell","actor":"hero","spell":{
  "name":"Synthetic two-ray effect","level":2,"casterLevel":7,
  "delivery":{"type":"ray","rangeFeet":60},
  "targets":["warden","warden"],"spellResistance":true,
  "components":[{"damageType":"fire","dice":{"count":2,"sides":6}}]
}}
```

Every ray rolls its own attack and damage, and each hit receives its own protections/resistance. One SR check is cached per target for that casting, including failure. Repeated-touch charges keep their SR cache in their Pending Event. A target reduced to 0 HP by an earlier ray does not roll back an already-declared volley.

Casting and firing a ranged touch spell are distinct provocation events. Defensive casting suppresses the casting opportunity, but the ray attack still provokes. One volley offers one delivery opportunity per eligible enemy, rather than one for each ray. Real AoO budgets apply across casting and delivery; taking both requires sufficient opportunities. Ray delivery uses the existing `pendingRangedAction` and `resolve_interrupt` path. No new spell-attack interrupt queue was added.

At delivery, casting has already finished, so damage from the ray opportunity does not retroactively require a casting concentration check. Incapacitation prevents firing. If a barrier or range change makes a declared ray illegal during interruption, that ray is blocked with no damage and no casting refund. Long-cast completion retains the existing pre-turn checkpoint until the ray opportunity and volley finish, then grants normal turn actions.

## Shared attack behavior

`AutomationGame.resolveAttackCheck` was extracted from the old attack method. Both ordinary weapon damage and spell payload delivery use its attack roll, natural-1/20 handling, confirmation, touch AC, range, firing-into-melee penalty, cover, concealment, Blind-Fight and fortification behavior. The spell profile is standalone so the caster's equipped weapon does not accidentally confer a broken/keen weapon profile or physical damage on the spell.

Touch defaults to Strength, rays to Dexterity, following the existing attack-bonus resolver. Optional delivery fields `attackAbility` (`str`, `dex`, `none`) and `attackOffset` use the same GM-authored profile contract as existing attacks. Imported printed attack totals remain authoritative; supply appropriate spell offsets/ability links instead of guessing which weapon modifiers are embedded in a statblock total.

Damaging touch/ray spells default to 20/x2. Optional `criticalThreat`, `criticalMultiplier`, and `improvedCritical` reuse the shared critical-profile validator. Healing-only or modifier-only delivery does not roll a damage critical. A confirmed spell critical repeats only the spell's base damage, with its flat bonus; it does not add weapon damage/Strength or multiply precision dice. Attached precision uses the existing explicit-definition eligibility convention, shared critical/precision immunity and one fortification roll, and is suppressed by concealment.

The payload owner still handles saves, SR, healing, mitigation and timed modifiers. Non-attack spells retain their existing shared damage roll. Volleys resolve the declared ray entries in order; a full general-purpose simultaneous/nested trigger executor remains future work.

Two existing long-casting issues were corrected alongside this integration: only initiation offers casting AoOs, not each subsequent full-round continuation, and an unfinished caster does not threaten squares. These do not apply to a completed held charge.

## Persistence and controls

Only `pendingEvents` owns held spells. The event payload contains the immutable spell definition, remaining charges, initial free-attempt eligibility and per-target SR results. `concludePendingEvent` supplies common history/removal for cancellation, expiry, resolution and discharge. Inspection derives held-spell views rather than storing another copy as a second authoritative subsystem. Existing export/undo snapshots include these records and RNG.

The workbench has touch/ray examples, a held-spell/target chooser, willing-contact confirmation and explicit GM contact controls. Held charges appear in Pending Events and beside Time & Events. Existing Fast Forward warning/confirmation applies to unknown contact triggers. Elapsed downtime ends the initial free attempt and refreshes the active charged caster's out-of-combat action budget; holding itself does not create a countdown.

## Scope and next work

This remains a GM-authored definition engine. It does not certify spell access, slots, material/somatic/verbal requirements, spell-specific eligible target types, or every class feature. Specialized multi-target touch casting, Spellstrike, new unarmed opportunity policies, touch delivery as a selected full-attack slot/AoO, object spell payloads, unusual ranged spells and general nested interruption ordering need dedicated follow-ups. Natural/unarmed contact through existing attack routines is supported. Use explicit adjudication for unsupported cases.

Next magic work is counterspell/dispel and prepared/spontaneous slot expenditure, followed by concentration-maintained resolved effects and remaining casting restrictions. Persistent independent map properties, templates and summoning remain on the existing roadmap.

## References and verification

Rules checked on 2026-10-16 against the [Core Rulebook PRD: Combat](https://legacy.aonprd.com/coreRuleBook/COMBAT.html), [Magic](https://legacy.aonprd.com/coreRulebook/magic.html), and the [Paizo Core Rulebook FAQ](https://paizo.com/paizo/faq/v5748nruor1fm), particularly its ranged-touch provocation entry. Examples are synthetic.

`python3 build_demos.py` rebuilds the offline workbench. `python3 run_regressions.py --browser` runs all engine and browser suites; browser checks require Python Playwright and Chromium (optionally selected with `BROWSER_EXECUTABLE`). New engine coverage is `spell_delivery_tests.mjs` (47 groups), and `test_browser_v3_25.py` exercises five workbench scenarios. Final observed results are in `TEST_RESULTS_V3_25.txt`. The earlier ray-no-AoO assertion in `attack_routines_tests.mjs` was replaced with the corrected rule.
