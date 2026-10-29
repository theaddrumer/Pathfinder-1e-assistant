> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# V3.5.1 — Named movement and Charge (October 13, 2026)

This is a **focused action/geometry update** to V3.5, not the planned conditions library. Source is still an experimental deterministic engine operated by a GM/AI controller. A move/charge is a gameplay action, not a GM damage override.

## Commands

All examples are authorized ordinary creature commands (`role='actor'`) during that creature's turn:

```json
{"op":"move","actor":"hero","path":[{"x":1,"y":3}],"asStandard":true}
```

This explicitly spends a standard action to move at most one normal speed, leaving the ordinary move resource available. Ordinary `move` without `asStandard` still spends a move resource first and substitutes a standard if no move remains. A 5-foot step is not a standard-action move.

```json
{"op":"double_move","actor":"hero","path":[{"x":1,"y":3},{"x":2,"y":3},{"x":3,"y":3}]}
```

This consumes **two move actions** (substituting a standard action if needed), permits up to twice the actor's speed over the supplied path, and preserves the existing square-by-square movement interruptions. It does not consume a *full-round-action* flag: creatures granted more actions can still spend remaining resources as normal. The UI provides one-click double-movement convenience; individual move commands are equally valid.

```json
{"op":"charge","actor":"hero","target":"warden"}
```

The engine chooses a straight path to a **closest attacking square** within reach; the controller supplies no route and does not enter bonuses manually. The charge must move at least 10 feet, at most twice speed, and cannot pass through blocked, occupied, or difficult spaces. The charger spends the normal full-round action (one standard and one move), automatically makes **one** melee attack at +2, and receives a temporary −2 AC modifier on normal, touch, and flat-footed AC **until the start of its next turn**. This penalty is a separately tracked effect, not a modification of imported AC totals.

A charge uses the existing pending-movement/AoO interrupt system. The charge attack happens *after* movement successfully finishes, even when an AoO decision pauses the route; it resolves **once**. An incapacitated charger never makes that attack. Extra move resources such as Choker Quickness remain usable after the full-round action if unspent.

## Deliberate limitations

- Pathfinding uses straight lines across a square grid (Bresenham-style centerline with stricter corner-blocking). It does **not** yet solve all exact PF1e geometry, line of sight/cover, lighting, mounts, flying, unusual movement modes, or creatures/abilities modifying charge rules. The normal GM override is the escape hatch for those encounters; a rejected charge does not silently downgrade into an illegal move.
- No charge-based special attacks such as pounce, spirited charge, lance multipliers, or bull rush are built in. No automatic choice of maneuvers/targets by AI.
- The special PF1e short charge **when restricted to only a standard action** is not yet represented by the generic action-resource system's restrictions. The implemented `charge` command is the ordinary full-round charge only.
- The demo only knows cardinal/diagonal square movement and a limited local visibility check. A legal diagonal route in unusual map geometry may need GM adjudication.
- The charge action's +2 is scoped to the single attack (it is not a lasting general attack buff); the AC effect expires on **turn start**, unlike V3.5's end-of-affected-turn duration approximation for ordinary timed effects.

## Correction found during implementation

A pre-existing movement bug incorrectly charged 10 feet for an orthogonal square if the *preceding* move had an even diagonal-step counter. `moveCost` now receives whether the **current** step is diagonal. The movement cost and both offline UI route-planners were corrected consistently.

## Testing

`charge_and_double_move_tests.mjs` adds **22** deterministic tests (including transactional rejection, reaction pause/resume, natural-attack routine, printed AC snapshots, Choker extra movement, duration expiry and undo). `test_browser_v3_5_1.py` tests the new buttons and real charge from the GM workbench. The nine V3.5 Node suites and its four browser acceptance scripts remain unchanged and passing. Current total: **137 named Node tests** plus five Chromium scripts.

## Interface

Open **`index.html`**. Choose **Move (move action)**, **Move (standard action)**, **Double move**, **Charge**, **5-foot step**, **Attack**, or **Full attack**. Click an empty destination for the movement modes; click an enemy token for Charge, Attack, or Full attack. The engine (not the UI) resolves charge movement, the attack bonus, the AC penalty, and turn-start expiration. `tests.html` remains the historical encounter fixture gallery.
