# Prone attacks and standalone dice — V3.38

Current V3.40 combat guidance: read `COMBAT_MECHANICS_V3_40.md` (`kernel_reference` topic `combat`). It supersedes older notes about same-team full attacks, purely manual flanking, prone movement, helpless defenses and advisory-only source immunity. Generic descriptive timers remain advisory.
## Dice without applying anything

To roll 1d4 for a duration, use this **command** inside `kernel_gm`:

```json
{"op":"gm_roll","kind":"plain","count":1,"sides":4,"label":"Duration in rounds"}
```

The tool envelope also needs `reason`, the current `expectedRevision`, and a unique `requestId`. Read `kernel_status` first. The native result contains `kind`, individual `rolls`, `bonus`, `total`, and `applied:0`; the MCP wrapper exposes it under `result.data`. A result of 4 does not itself apply a condition or advance four rounds. Make that separate adjudicated request when appropriate.

- `kind`: `plain` (default), `damage`, or `healing`.
- `count`: integer 1–100, default 1.
- `sides`: integer 2–1000, default 6.
- `bonus`: integer -10000–10000, default 0; a plain total may be negative.
- `label`: 1–120 characters, optional.

Use integer fields, not a `dice:"1d4"` string or a nested dice object. Plain rolls do not accept `target`, `source`, damage metadata or other effect fields. Unknown fields and invalid kinds reject with an example, without consuming RNG.

Plain rolls change RNG, bounded logs and ordinary undo/transport bookkeeping, including the turn activity marker used by undo. They do not spend standard/move/swift resources, heal, damage, apply effects or advance the clock. They remain GM mutations, subject to existing pending-action guards. Repeating a request after a transport failure must use the **same ID and arguments**, so it returns the stored result rather than rerolling.

`damage` and `healing` intentionally apply their roll to `target` through existing damage/healing logic. Never use either merely to obtain dice. The existing Free Mode damage/healing commands remain supported.

## Prone attack behavior

| Situation | Engine behavior |
|---|---|
| Prone attacker, melee or melee touch | -4 attack, including critical confirmation |
| Prone attacker, ordinary ranged weapon | Rejected before ammunition, action or AoO expenditure |
| Prone attacker, explicitly permitted ranged weapon | No Prone attack penalty; other modifiers still apply |
| Prone caster, ray delivery | Allowed; no Prone attack penalty |
| Prone defender, melee or melee touch | -4 applicable AC |
| Prone defender, ranged or ranged touch | +4 applicable AC |

The GM verifies weapon rules during import. Put `usableWhileProne:true` on a specific ranged attack entry for crossbows, firearms, shuriken, or another verified exception:

```json
{
  "label":"Light crossbow",
  "attackKind":"manufactured",
  "attackMode":"ranged",
  "rangedKind":"projectile",
  "rangeIncrementFeet":80,
  "damageDie":8,
  "damageType":"piercing",
  "usableWhileProne":true
}
```

This belongs in `definition.stats.attacks[]`, alongside the creature's actual printed attack/damage offsets and other applicable fields. It is a mechanical permission, not an inferred weapon name or a new creature-wide feat. Omitted/false means no exception. It must be a boolean on a ranged-mode entry. Do not add it to a standing-only bow merely to bypass a rejected action. Existing imports are not rewritten or guessed from labels.

Ray profiles explicitly use `attackMode:"ranged_touch", rangedKind:"ray"`; native spell delivery supplies these fields. Ranged-touch weapon attacks are not automatically rays. Melee touch spells retain the melee penalty.

A ranged action that becomes prohibited during an AoO stops with the action already paid but ammunition unspent. Existing continuation state owns this; there is no second reaction queue.

**Remaining boundary:** this release does not automate standing up, crawling, or posture movement restrictions. Standing normally requires a move action and provokes; crawling is 5 feet per move action and provokes. GM adjudication must account for those costs/opportunities and condition changes. Ordinary `move` is not a crawl command. The condition remains labeled partial, with this limitation explicit in `list_conditions`.

## Rule sources

- [PF1e Combat: Attack Roll/Armor Class Modifiers and Move Actions](https://legacy.aonprd.com/coreRulebook/combat.html)
- [PF1e Firearms: Fire while Prone](https://legacy.aonprd.com/ultimateCombat/combat/firearms.html)
