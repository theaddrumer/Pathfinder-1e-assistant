> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# Summon marker and removal — V3.28

## GM/controller use

Summon is a calculator instance marker displayed alongside ordinary subtypes. It is not a replacement creature type and grants no defenses. The JSON vocabulary is `summon`; the UI label is **Summon**. No summon-specific statblock or second creature registry is needed.

Mark an already instantiated creature:

```json
{
  "op": "gm_mark_summon",
  "target": "wolf_1",
  "source": "hero",
  "duration": {"count": 5, "unit": "round"},
  "reason": "GM confirms a five-round summoning duration"
}
```

Or use the ordinary spawn command with per-instance summoning data:

```json
{
  "op": "spawn_creature",
  "definition": "registered_wolf",
  "id": "wolf_1",
  "x": 3,
  "y": 4,
  "team": "party",
  "summon": {
    "source": "hero",
    "duration": {"count": 5, "unit": "round"}
  }
}
```

The definition must already be registered. Its existing type and subtypes are preserved. A definition may include `"subtypes":["summon"]` alongside other supported subtypes; every spawn of that definition then requires `summon.duration`. This prevents a tagged creature silently appearing without a timer. Ordinary definitions can also spawn summoned instances through the optional `summon` argument.

`source` is optional and records the summoner. Duration units are `round`, `minute`, `hour`, `day`; total duration must be 1–100000 rounds. Invalid setup, blocked spawning and duplicate timers roll back atomically. Only the GM can administer summons. Marking/dismissal requires a reason and completion of unresolved actions first.

Inspect with `{"op":"gm_get_summons"}`. The same derived view appears in `inspect` and `gm_get_lifecycle`, while the native timer appears in `gm_get_pending_events`. There is only one countdown record.

Dismiss early, including after the GM adjudicates a successful dispel or banishment:

```json
{"op":"gm_dismiss_summon","target":"wolf_1","reason":"GM resolves successful banishment"}
```

Cancelling the native Pending Event also dismisses the creature; it cannot make the summon permanent. Generic manual triggering is prohibited because the timer has a specific mechanical outcome. Applying a second marker rejects rather than silently extending the duration.

## Timing

During initiative, expiry uses the summoner's current initiative score, or the active actor's score when `source` is omitted. `duration.atScore` can explicitly supply a GM-adjudicated expiry count. The count is fixed when marked; later Delay/Ready changes do not move it. Initiative requires a ranked source or an explicit count.

Native interval crossing handles expiry, including empty initiative counts. `remainingRounds:0` can mean expiry is later in the current round at the displayed score. A removed active creature passes to the next turn through the existing cursor. Use ordinary `gm_set_initiative` to rank a newly spawned creature; summoning does not grant a free turn or infer a score.

Outside initiative, the same Pending Event uses the world clock. Fast Forward and advance-to-next-event include it automatically. Summon timers alone do not ask for narrative-trigger confirmation; unrelated conditional events retain their warning. Calendar display changes do not advance/reset durations.

Ending initiative migrates unfinished timers to the existing six-second world clock, preserving remaining whole rounds. A world timer continues as such if combat starts. If every ranked creature departs, the existing encounter-end migration preserves remaining deadlines, including when an unranked creature remains.

## Removal

Expiry, 0 HP, an actually applied dead condition or dismissal removes the encounter instance. Nonlethal unconsciousness alone does not dismiss it. Ordinary defeated creatures retain their historical behavior. Healing cannot revive a token that has already left.

Cleanup removes initiative membership, the timer, owned Ready/held-charge events, active casting, conditions, afflictions and spell resource profiles. Grapples release through the existing owner. Supported ongoing spells cast by the departed summon expire through their native removal path, including linked deadlines. Instant damage/healing is not undone; non-spell afflictions already inflicted on survivors remain. Removing the summoner does not itself cancel a different creature's summon timer.

The current atomic hit/packet finishes before target deletion. A living full attacker retains remaining strikes and can select a new target. Defeat during an AoO terminates the departed creature's action. Automatic duplicate/split instances inherit the original deadline rather than becoming permanent.

Save reconstruction and undo include the marker and timer. Use `dispatch` as the public mutation boundary; direct low-level methods are internal operations.

## Scope

The GM selects the creature, number, allowed placement, faction/control, initiative and duration. This release does not infer summoning lists, language-based commands, class exceptions, components, inventories or off-board identity/re-summoning restrictions. GM spawning does not automatically spend a summoning spell: use the existing casting/resource flow as appropriate. Automatic targeting of summons by the spell-dispel resolver remains separate; explicit dismissal supplies the mechanical removal after adjudication.

Rules reference: [PF1e PRD — Magic, Conjuration (Summoning)](https://legacy.aonprd.com/coreRulebook/magic.html). Removal conditions and expiry of spells cast by a departed summon follow that rule; the marker/API and deferred cleanup are calculator implementation choices.
