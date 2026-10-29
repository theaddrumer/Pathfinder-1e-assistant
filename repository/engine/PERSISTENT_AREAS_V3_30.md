# Fixed persistent areas — V3.30

This extends the existing generalized area system. Geometry, spell payload resolution, action costs, spell resources, initiative and Pending Events remain their existing owners. The only canonical region record is a `pendingEvents` entry with `kind:'persistent_area'`; no second timer or area-state collection is introduced.

## Example

All numbers and the spell below are fictional. Supply actual mechanics from the intended spell or hazard. The actor and creature IDs must exist.

```js
const result = game.dispatch({
  op: 'cast_spell',
  actor: 'hero',
  spell: {
    name: 'Synthetic lingering region', level: 2, casterLevel: 5,
    area: {shape:'sphere', mode:'spread', origin:{x:5,y:3}, sizeFeet:10},
    components: [{damageType:'fire', amount:2}],
    save: {type:'ref', dc:15, onSuccess:'half'},
    spellResistance: true,
    persistent: {
      duration: {count:3, unit:'round'},
      triggers: ['create','enter','turn_start'],
      frequency: 'once_per_round', affects: 'all', effectScope: 'inside'
    }
  }
}, 'actor');
// If casting pauses for AoOs or counters, finish its existing continuation.
// Once resolved: result.resolution.areaId identifies the native area event.
const areas = game.dispatch({op:'gm_get_persistent_areas'}, 'gm');
```

Configured casters still need their normal `resource` selector. The original casting commits its action and slot once. Repeated exposure is not another casting and never spends another slot, grants an action, clears a held charge, or provokes a new casting AoO. Normal casting/counterspell/long-cast completion paths create the region only when the spell actually resolves. `gm_resolve_spell` remains the logged no-action/no-slot override.

## Payload contract

| Setting | Default | Meaning |
|---|---|---|
| `duration:{count,unit,atScore?}` | Required | 1–100000 rounds after unit conversion. Existing initiative timing in combat; world-clock timing otherwise. Explicit `atScore` requires active initiative. |
| `triggers` | `['create','enter','turn_start']` | Choose one or more. `create` affects initial occupants. `enter` detects new occupancy from movement, teleport destinations or spawn. `turn_start` affects that occupant when its turn begins. |
| `frequency` | `'once_per_round'` | One exposure per recipient per `worldRounds` value, across all selected triggers. `'each_trigger'` permits every selected trigger, including repeated re-entry. |
| `affects` | `'all'` | `'allies'` or `'enemies'` filters against the caster's team snapshot at creation. Everyone includes the caster if inside. |
| `effectScope` | `'inside'` | Applies to numeric `spell.effect` modifiers. `'inside'` removes them on exit/area termination. `'duration'` uses each effect's existing individual duration. |
| `dispellable` | Existing spell/effect default | Explicit boolean override for the region's spell-source metadata. |

Use a supported sphere/cone/line and burst/emanation/spread template. It remains at the declared origin. Geometry is recomputed with the existing wall and footprint rules; changing the caster's position does not move the region. A large creature overlapping several cells is still one recipient. Independent casts have independent IDs and cooldowns. Native stacking rules resolve their numeric modifiers.

Without `create`, initial occupants are recorded without an initial hit. Movement between cells already inside does not trigger another entry. Teleport resolves destination occupancy, not squares along a nonexistent traversal. A successful inside-only modifier is restored on same-round re-entry without repeating its already-paid damage/save/SR exposure. Save-negated modifiers are not restored. Repeated exposures do not accumulate copies of the same area's modifier on one creature. The existing `effect.rounds` field is still supplied; it is used by `effectScope:'duration'`, while inside-only lifetime belongs to the region.

Damage/healing dice are shared across recipients of one simultaneous exposure, then rerolled for later exposures. Saves and individual mitigation use the ordinary spell resolver. SR retains one check result per region/recipient. This release does not infer special save-once, escalating-save, condition, wind, or terrain rules from a spell name.

## Timing and termination

Native Pending Events own the only expiry deadline. Combat exposure uses the existing turn-start event; initiative expiry processes crossed counts even when no creature acts there. Ending initiative migrates the same native event to the world clock. Outside combat, Fast Forward repeats selected turn-start exposures once per elapsed round for current occupants. Empty regions add no per-round exposure deadlines. Large occupied intervals retain the existing Fast Forward event limit and may need smaller advances.

Expiration happens before a recurrence at the same timestamp. Due inside-only modifiers are also removed before same-time downtime ailment/recovery saves. Scheduled GM decisions continue to pause time normally; region inspection remains available. Ordinary conditional Pending Events keep their existing warning behavior; automatic area timers require no prose-trigger acknowledgement.

Caster movement, defeat or token removal does not terminate a fixed region. Its original caster level, team and spell-source identity remain in the event payload. Damage and exposure effects can still resolve after the source token has departed. Save/export/restore preserve occupancy, cooldown, SR history and the original expiry; undo uses the normal command transaction/checkpoints.

To remove a region directly:

```js
game.dispatch({op:'gm_cancel_pending_event', id:areas[0].id,
  reason:'GM ends this region'}, 'gm');
```

To dispel it through normal casting, use the existing dispel spell with `targets:[areaId]`. Its origin is the range/line-of-effect target. The existing caster-level check and dispellability metadata apply. Own spells use the existing automatic self-dispel behavior. Area IDs are available in the workbench's existing dispel selector. A region that expires during a long dispel casting resolves as an absent target.

Removing/expiring/dispelling the region clears its inside-only modifiers. Instantaneous damage/healing stays applied. Effects explicitly declared with independent `effectScope:'duration'` keep their own timer; dispelling a creature's exposure effect does not erase the region. Target the region to end its future exposures. The same distinction applies to deliberate GM cancellation.

## Workbench and boundaries

Lingering settings sit beside the existing area preview and attach to the editable spell JSON. Casting uses the existing buttons. Active footprints remain highlighted after clearing a preview. Region countdowns/removal are together in Time & Events and the ordinary Pending Events view.

This release supports fixed, two-dimensional regions with the existing numeric/damage/healing/save/SR payloads. It does not add moving or growing areas, automatic wind/drift, terrain changes, native condition spell payloads, post-resolution concentration, suppression/antimagic, or a spell database. Unsupported consequences remain explicit GM adjudication. Up to 64 active regions are accepted.

Verification: `persistent_area_tests.mjs` has 30 integration groups; `test_browser_v3_30.py` exercises configuration/casting/expiry, direct removal and existing dispel controls. The complete regression report is `TEST_RESULTS_V3_30.txt`.
