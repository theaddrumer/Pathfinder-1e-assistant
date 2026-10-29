# Short AI operating workflows — V3.40

Common combat options and source-aware immunity: `kernel_reference` topic `combat`. README distinguishes working fields from GM context and unsupported mechanics.
Read `start` first. JSON below is the inner `command`; queries go to `kernel_query`, normal actions to `kernel_action`, and setup/adjudication to `kernel_gm`. Every mutation uses the current revision and a fresh requestId plus a reason for GM calls. Examples assume the named live instances/definitions and legal locations exist. Catalog examples are exercised against the current engine in `clarity_tests.mjs`.

## Import and inspect

Discover `register_creature`, read `kernel_reference` topic `registry` (the current import contract), verify the source statblock, and register its definition. Import all three published AC totals (`ac`, `touchAc`, `flatFootedAc`) together. Printed bonuses are already totals; `abilityLinks` explicitly declare supported ability changes rather than reconstructing hidden bonuses. Attack names alone do not supply damage types, range, riders or weapon-specific exceptions.

```json
{"op":"spawn_creature","definition":"guard_v1","id":"guard_1","x":3,"y":4,"team":"enemy"}
```

`team` is exactly `party`, `enemy` or `neutral`; omission defaults to `enemy`. `ally` is not a valid value. Read `kernel_status(target:"guard_1")`, inspect its attack with `gm_describe_attack`, and use `list_trait_library` / `list_conditions` to check relevant coverage. If combat is already active, use `gm_set_initiative` for the new actor; spawning does not grant a turn.

## Assemble an unfamiliar save/condition/timer ability

GM first verifies eligibility, range/sight, descriptors and prior exposure against the actual rules. This illustrative pattern applies only when the ability calls for these separate operations; it is not a hard-coded mummy implementation.

```json
{"op":"gm_evaluate_effect","target":"guard_1","tags":["fear","mind_affecting"]}
```

This is a read-only classification check. Include every relevant supported descriptor; if blocked, do not proceed as if the ability affected the target. For source-specific immunity, include source and ability in the preflight, or inspect `gm_get_combat`. Descriptive reminders still require manual checking.

```json
{"op":"save","target":"guard_1","save":"will","dc":16}
```

Read the actual success result. Only when the consequence applies, roll its duration:

```json
{"op":"gm_roll","kind":"plain","count":1,"sides":4,"label":"Condition duration in rounds"}
```

If the returned total is 4, apply the specified condition with `rounds:4`; choose the condition from verified rules and inspect its coverage first. `apply_condition` checks native condition immunities, but does not roll another ability save or infer extra descriptors from the ability's name. Some condition consequences remain advisory.

If the rules grant immunity to this individual source after either save outcome, apply any initial consequences first, then record immunity for each qualifying recipient:

```json
{"op":"gm_grant_source_immunity","target":"guard_1","source":"foe","ability":"despair","count":24,"unit":"hour"}
```

On later exposure, use `save` with the same source/ability, or `gm_evaluate_effect` as preflight. A matching immunity returns skipped/blocked without dice. Do not apply consequences after a skipped save. `apply_condition` can also carry source/ability to enforce the check. For other spell/ailment/damage paths, perform the preflight explicitly. The timer expires automatically; prose labels are never interpreted as immunity rules. Do not use the healing roller to obtain duration dice.

For recurring poison/disease/DoT, prefer `register_ailment` / `expose_ailment`: their configured saves, ticks and cure counters own that lifecycle. For an actual spell, prefer `cast_spell` with its supported condition/effect payload. Do not duplicate either subsystem's saves or timers manually.

## Move, attack and resume

Submit `move` with every adjacent traversed cell. If it pauses, use the returned `resolve_interrupt` choice; the native continuation resumes the paid path or stops it if the mover becomes unable to continue. Do not send the original path again or subtract a second move action.

`full_attack` pays once and starts the first strike. Continue with `full_attack_next` and a chosen legal target, or `finish_full_attack` to forfeit the remainder. Resolve intermediate opportunity/rider choices first. Ordinary attacks, full attacks and charges permit same-team targets; the GM still chooses appropriate targets. Select combatOptions when starting the action, never by repeating its continuation.

## Cast under pressure

Call `cast_spell` with declared mechanics and configured resource selector, if applicable. A casting reaction pause may offer `gm_resolve_casting_aoo`; its `actor` is the reacting creature. Resolve each offered AoO/counterspell decision, then use `gm_continue_spell` when offered. Failed concentration may produce `lost`; the paid slot/action remains spent.

`continue_spell` is for a long casting on a later turn. `complete_spell` finishes a ready long cast. Held touch delivery uses `deliver_touch_spell`. Read the native choices rather than inferring the right command from its name. `gm_resolve_spell` is an explicit effect-only override, not the normal continuation.

## Advance time and end the scene

End initiative before Fast Forward. Inspect `gm_get_lifecycle` and `gm_get_pending_events` first. Submit `gm_advance_time` with count/unit; a `pending_events_warning` requires reviewing the outstanding reminders before repeating with `confirmPendingEvents:true`. A timed decision may stop partway. Resolve the offered event, then advance only the remaining interval. Use a new requestId for a deliberate new/confirmed request, not the ID of an already accepted warning.

A day of elapsed time does not refill spells. `gm_set_game_clock` only changes the displayed date/time and cannot undo elapsed expiry. Native events, ordinary condition rounds and precise initiative-count expiry have distinct contracts; select the appropriate timing owner.

To end initiative without roster cleanup, use `gm_end_initiative`. To clear combatants while preserving the map, preview `gm_preview_encounter_clear` and run `gm_clear_encounter` with the intended `keep` list. Map objects remain automatically. To discard terrain too, use `gm_preview_scene_close` followed by `gm_close_scene` with matching survivor placements. These operations do not refill resources or advance time. For named map saves, read topic `map_library`: save with `gm_save_map`, list with `gm_list_maps`, clear non-object characters before `gm_load_map` with confirm:true. Save an original map copy before destructive edits when useful.

## Preserve creature classifications

Use top-level definition.creatureType and definition.subtypes. Read topic `subtypes` for the current catalog and coverage. Query list_trait_library at /subtypes for accepted IDs and /subtypeCoverage/<id> for automation. Keep racial labels such as goblinoid/reptilian even when they grant no automatic modifiers. Check kernel_status(target).classification before adjudicating a type-dependent effect; configure its actual effects separately. Do not infer subtype abilities or double-count published totals.

## Build only the map mechanics that matter

Treat map setup as a sparse mechanical description, not a square-by-square drawing exercise. Leave ordinary open ground unconfigured. Use the supplied artwork for floor colors, roof textures, bridge planks and decoration; these do not need individual terrain records. Consult adventure text for meaningful obstacles, hazards and heights rather than inferring rules from decorative pixels.

Establish scale and align the artwork first. Then author relevant walls/doors, cover, movement costs and elevation. Read topic `map`: `gm_set_map_features` accepts a `features` array, each feature can group equivalent `cells` or use a connected `points` path. Use these supported groups and batches instead of one tool call per square. Preserve separate IDs for independently operated doors or destructible objects, obey payload limits, and inspect each accepted result/revision before dependent edits. Do not approximate away a mechanically significant opening just to reduce the number of features.

Keep mechanical traces on the GM layer when the artwork already depicts them. Their mechanics still apply. Use public overlays for useful annotations or actual visible changes, not to paint over the source image. Choose fog/reveals separately: an impassable roof or wall is not automatically hidden. Distinguish visible exteriors from cutaway interiors using the adventure context.

Verify scale, representative routes, important boundaries and the filtered player preview. Refine ambiguous areas as play requires; do not exhaustively query or annotate every empty cell. If useful, save a map-only baseline after setup.

## Share the live player map

Read `player_view`, reveal only the intended region with `gm_set_player_view`, then put intended creature/feature IDs on the map layer with `gm_set_player_display`. Give public labels explicitly. Check the filtered `gm_preview_player_view` (page large results). The user opens http://127.0.0.1:8788/player on the server computer; subsequent ordinary movement/map edits update that page automatically. GM-layer traps/creatures remain hidden when their room is revealed, and keep their mechanical effects. All players currently share one view. Background artwork is supported; read topic `artwork` for import and alignment.

When publishing a player-controlled token, set `display.showVitals:true` through `gm_set_player_display` (or `playerDisplay.showVitals:true` at spawn). Existing saves do not enable it automatically. Clicking its visible footprint shows live HP and tracked conditions in the bottom bar. Keep this off for private enemy stats; all viewers share the same published data. Read `player_view` for the exact fields and limits.

After movement or another change that exposes new surroundings, update the player view before the next player decision without waiting for a reminder. Movement itself does not reveal fog. Use the actual reached position, including an interrupt stop, and check again after continuation; do not reveal an unreached destination. Adjudicate what is visible, then reveal the appropriate region/grouped cells with `gm_set_player_view`. Check the full footprint of intended public tokens and publish newly visible entries separately with `gm_set_player_display`; terrain reveals must not expose hidden traps or occupants automatically. Inspect the relevant player preview after a visibility change. See `player_view` for details.

If the player reports a blank map, query `gm_get_player_visibility`. Zero revealed cells means the reveal mask is still closed. Reveal only the intended region and publish its intended feature IDs separately; never automatically publish GM-layer traps/creatures.

## Swarm or troop turn

Read `collectives` and inspect traits before resolving damage. Ordinary completed movement resolves the configured automatic attack; resolve any offered AoO and resume the original move rather than issuing another attack. For a stationary unit, use `collective_attack` or end its turn. Never simulate its melee attack with an attack roll. The engine prevents ordinary automatic damage from repeating within one turn. Troop AoOs are offered through the same existing reaction commands. Use explicit area metadata on generic splash/area packets; do not pre-multiply the damage.

## Align a printed map without rebuilding its cells

Read `kernel_reference` topic `artwork`. Import the complete source at available resolution; do not lower quality by default. Calibrate from two well-separated printed intersections with `gm_set_map_artwork.calibration`, then check a third point and the player preview. Complete this alignment before tracing walls, doors, terrain or hazards and before placing encounter tokens. If the background is adjusted afterward, review the existing mechanical features separately: changing the image does not reposition them or the tokens. A printed 10-ft cell spans 2×2 native cells. Keep ordinary empty squares implicit and mechanical features on the GM layer when artwork already depicts them. Save the named map after alignment and review; update reveals during play as usual.
