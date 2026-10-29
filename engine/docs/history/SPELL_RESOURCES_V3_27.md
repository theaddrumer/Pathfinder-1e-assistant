> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# V3.27 — Fixed daily spell resources

Daily slot capacity and current ability statistics are deliberately separate. An allotment is either imported as an authoritative total or calculated once from an explicit eligible daily ability score. No score buff, damage, drain, item change, stat inspection, clock advancement or daily refresh adds/removes/refills slots. To recalculate maxima, the GM explicitly replaces the book's setup with a reason. Current ability requirements for casting/preparing are checked independently and never edit those stored capacities.

## Configure a prepared caster

```json
{"op":"gm_set_spellcasting","actor":"hero","reason":"Import the wizard's daily spellcasting","book":{
  "id":"wizard","name":"Wizard spells","mode":"prepared","ability":"int","casterLevel":5,
  "pools":[{"id":"general","allotment":{"type":"imported","totals":{"0":3,"1":4,"2":3,"3":1}}}],
  "spells":[
    {"id":"bolt","name":"Synthetic bolt","level":1},
    {"id":"spark","name":"Synthetic spark","level":0},
    {"id":"dispel","name":"Dispel magic","level":3}
  ],
  "preparations":[
    {"id":"bolt_a","spell":"bolt","slotLevel":1},
    {"id":"bolt_b","spell":"bolt","slotLevel":1},
    {"id":"spark_a","spell":"spark","slotLevel":0},
    {"id":"dispel_a","spell":"dispel","slotLevel":3}
  ]
}}
```

Each actor may have multiple independent books, supporting multiclass/resource separation without merging progressions or guessing which class supplied an imported spell. `casterLevel` is the configured ceiling, not a class-level progression calculator. The GM supplies valid accessible spells and base slots. Imported setup begins with fresh usage; state exports/undo retain the live spent flags and counters thereafter.

A prepared slot is one exact preparation record. It stays occupied after casting, with `spent:true`; spending it does not create a new empty slot that can be filled mid-day. Copies can use different slot levels. Fill higher slots with lower-level spells by declaring the higher `slotLevel` at preparation. Extra unfilled capacity remains open until explicitly prepared.

Imported totals are not augmented with ability bonuses. Their definition accepts no base/ability fields, preventing accidental double counting. The examples are synthetic setup data, not calculated legal class progressions.

## Derive a daily allotment once

For the general pool, replace its allotment definition with:

```json
{"type":"derived","abilityScore":18,"base":{"0":3,"1":2,"2":1,"3":0,"4":null}}
```

The engine stores the base, ability modifier, bonus counts and final totals. For a positive spell level L and an ability modifier M at least L, the bonus is `1 + floor((M - L) / 4)`; otherwise it is zero. Level 0 never gets ability bonus slots. A missing level or `null` marks class-inaccessible slots and receives no bonus; a numeric zero means access exists but only bonus slots may be available. A high score therefore cannot unlock absent spell levels. The caller supplies the eligible daily score, not a pointer to the live ability statistic.

`gm_preview_spell_allotment {allotment}` returns this breakdown without changing state. At most one pool per book can derive ability bonuses. Fixed extras such as domain/specialist slots use separate imported pool totals. Never add these extras again to an imported total that already contains them; split that total correctly when separating restrictions.

Replacing an existing setup requires the same book ID plus `replace:true` and a reason. This is an explicit rebuild of its allotment and fresh usage/preparations. It is not triggered by changing an ability score, leveling a statistic, starting a turn or reaching a calendar boundary.

## Cast using a prepared copy

```json
{"op":"cast_spell","actor":"hero","spell":{
  "name":"Synthetic bolt","level":1,"casterLevel":5,"targets":["warden"],
  "components":[{"damageType":"force","amount":4}],
  "resource":{"book":"wizard","preparation":"bolt_a"}
}}
```

The resource must match a ready preparation's registered identity/level and source kind. The book supplies its governing ability; a conflicting explicit ability or excessive caster level rejects. A spell may voluntarily use a lower supplied caster level; class-specific minimum caster levels are not inferred. A current ability below 10 + effective spell level prevents ordinary casting but does not erase or resize slots.

Known-access entries register id/name/level and optional canonical `spellId`, minimum `slotLevel`, `sourceKind` and `atWill`. Canonical identity can preserve base-spell identity for metamagic variants. A variant can have effective level 1 but minimum slot cost 3; resource checks never reduce that configured cost. General metamagic feat legality and timing still use supplied/adjudicated spell definitions.

The resource catalogue limits access and expenditure; the spell's damage, saves, healing and modifiers remain the existing GM-authored payload format. It does not claim to verify every published spell's content.

## Spontaneous casting

Use `mode:"spontaneous"`, omit preparations, and list the spells known/available in `spells`. Casting selects:

```json
{"book":"sorcerer","spell":"bolt","pool":"general","slotLevel":2}
```

Here `slotLevel:2` explicitly spends a higher slot on the lower-level spell. Omit it to use the entry's minimum slot cost. Default pool ID is `general`; use an explicit ID for another pool. Spontaneous usage is one spent count per pool/slot level, with remaining amounts derived from the fixed total. There is no second counter specific to ordinary casting, counterspells or a spell's individual name.

Exhaustion blocks the cast before effects, RNG or action spending become committed. Unknown spells, missing resource selectors on configured casters, wrong identities/levels/source kinds, and changing a prepared copy's pool/level reject atomically. An actor with no configured books retains the historical untracked path for compatibility; configure all casters intended for enforcement.

## Cantrips, restrictions and conversions

At level 0, cantrips/orisons are reusable by default but still require known/prepared access. Prepared cantrips occupy a preparation slot without expending it on each cast. A level-0 spell occupying a higher slot is normally expended. Set `cantripsAtWill:false` for a deliberately finite rule. An explicit catalogue `atWill:true` can declare a GM-authorized at-will ability. Registered at-will `sourceKind:"spell_like"` entries bypass spell-slot expenditure and ordinary spell ability minimums; finite SLA uses are not represented by this release. Merely changing a payload's source kind cannot make a registered ordinary spell free.

Each pool may declare `allowedSpells:["catalogue_id", ...]`. This restricts both preparation and casting. Domain/specialist slots can therefore remain distinct from general slots instead of becoming freely interchangeable. No restriction is inferred solely from the pool's name.

Prepared books may declare `conversions:["cure_id", ...]` for explicitly supported spontaneous conversions. Supply `resource.spell` with the consumed preparation ID to select that replacement. The replacement must fit the original slot and be permitted by the pool. General unrestricted pools allow conversions by default; restricted pools default to `allowConversion:false`. This models declared cure/inflict/summon conversions without inventing access or spending another pool.

## Commitment, failure and counterspells

An ordinary cast spends its slot when casting begins, after a valid action is paid and before concentration checks. A failed defensive check, injury interruption, cancellation or successful enemy counterspell does not refund it. Invalid input/range/action requests roll back state and RNG. One long cast pays once, with the receipt retained in its native casting continuation. Subsequent continuation/completion, independent rays in a volley and held-touch delivery do not spend again.

Ready retains the resource selector inside its existing Pending Event payload. Ready declaration, expiration, decline, failed identification and a nonmatching identified spell spend no slot and reserve none. Actual counterspell resource availability is checked before identification RNG; once a valid counter begins casting it spends its own caster's resource even if that casting later fails or is countered. The suspended incoming cast retains its original payment. Normal casts and nested counters share exactly the same resource owner.

Explicit `gm_resolve_spell` continues to apply a delayed/adjudicated effect without action or slot cost. It is a logged GM override, not a normal casting option for an actor to bypass resource checks.

## Explicit GM updates

All updates require GM authority and a nonempty reason. They do not advance time or grant turn actions. They are blocked while the affected caster is still casting.

```json
{"op":"gm_refresh_spellcasting","actor":"hero","book":"wizard","reason":"GM confirms daily preparation"}
{"op":"gm_prepare_spell","actor":"hero","book":"wizard","preparation":{"id":"later_copy","spell":"bolt","slotLevel":2},"reason":"GM confirms preparation into an open slot"}
{"op":"gm_restore_spell_resource","actor":"hero","book":"wizard","preparation":"bolt_a","reason":"Prepared use restored by adjudicated effect"}
{"op":"gm_restore_spell_resource","actor":"hero","book":"sorcerer","pool":"general","slotLevel":1,"amount":1,"reason":"One spent slot restored"}
```

Refresh resets usage against the stored daily maxima, keeping existing choices unless an explicit replacement `preparations` array is supplied. It does **not** recalculate ability bonuses, even if an underlying permanent score changed. Filling an open slot counts all existing preparations, including expended ones, against capacity; it cannot overwrite or recycle a spent slot. Restoration cannot exceed actual expenditure. Replacing daily maxima uses `gm_set_spellcasting` with `replace:true`, not refresh.

These commands record GM adjudication; they do not certify rest duration, interrupted rest, divine prayer time, preparation environment/time, spellbook availability or the recent-eight-hours casting deduction. Clock advancement, midnight and encounter end never perform these updates implicitly. A fuller rest/recovery subsystem must retain the frozen-allotment policy.

## Inspection, workbench and verification

`gm_get_spell_resources {actor?}` returns books and derived level counts with imported totals or base/bonus breakdowns. `inspect` and `gm_get_lifecycle` expose the same derived resource view. Snapshots, undo, state reconstruction and atomic error recovery include the authoritative profiles; bounded book histories record updates and expenditure without introducing scheduled daily events.

Daily spell resources in the workbench provides prepared/spontaneous setup examples, allotment previews, explicit replacement, selection of a known spell/prepared copy, resource-selector insertion into the spell JSON, refresh, restoration and open-slot preparation. Counterspell Ready carries the current spell JSON's selector. Sample caster definitions use Wisdom so the default Explorer can exercise the demonstration; they do not claim a specific class build.

New verification: `spell_resources_tests.mjs` (37 groups) and `test_browser_v3_27.py` (six scenarios), plus historical engine/browser suites. Run `python3 build_demos.py` and `python3 run_regressions.py --browser`; observed results are recorded in `TEST_RESULTS_V3_27.txt`.

Primary references checked 2026-10-17: [Ability modifiers and bonus spells](https://legacy.aonprd.com/corerulebook/gettingStarted.html), [Magic: preparation, slots, counterspells and recent casting](https://legacy.aonprd.com/coreRulebook/magic.html), [Sorcerer](https://legacy.aonprd.com/coreRuleBook/classes/sorcerer.html), [Cleric](https://legacy.aonprd.com/coreRuleBook/classes/cleric.html) and [ability-score changes](https://www.aonprd.com/Rules.aspx?ID=414). Fixed maxima and explicit recalculation are also an explicit user requirement for this project; the engine does not infer a later recalculation from temporary/permanent stat-change rules.
