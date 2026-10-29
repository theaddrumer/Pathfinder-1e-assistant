# Map saves and encounter cleanup — V3.46

These are GM operations through the existing kernel_query / kernel_gm tools.
The engine validates them; no second map server or campaign-history store exists.
Examples below are command objects. Wrap mutations with kernel_gm's reason,
current expectedRevision and a unique requestId. Retry an uncertain accepted
request with exactly the same envelope. Query previews through kernel_query.

## Save and revisit a map

Save the current layout under a stable ID:

```json
{"op":"gm_save_map","id":"storehouse_original","name":"Storehouse — original"}
```

When a map has destructible or movable objects, saving an original copy after
construction can be useful. It is optional, not a requirement to duplicate every
map or save after every action. Automatic full-encounter saving still handles
ordinary play. To deliberately update a bookmark, supply `overwrite:true`.
A duplicate ID without that flag is rejected unchanged.

Saved maps contain dimensions, name, established flag, terrain cells, elevation
annotations, map features and their doors/object links, and player title/reveal
mask/layers. Inanimate object tokens retain IDs, names, positions, size, base
object profile (hardness, AC, material, etc.), maximum/current HP, elevation and
public display. Broken/destroyed objects stay broken/destroyed. Object attendants
are cleared. No repair, reroll, time advance or rest occurs when saving/loading.

Map saves exclude non-object creatures, creature definitions, current effects,
ailments, active spells/areas, generic automation rules, event timers, world clock,
combat/undo history and actor-specific geometry/traversal rulings. They are layout
bookmarks, not full encounter backups. Custom trap/effect automation must be set
up again for a loaded encounter; saved terrain hazard tags alone do not recreate
an authored automation rule. Summoned/temporary objects are not captured; a
feature linked to an absent/temporary object must be repaired before saving.

```json
{"op":"gm_list_maps"}
{"op":"gm_preview_encounter_clear","keep":[]}
{"op":"gm_clear_encounter","keep":[]}
{"op":"gm_load_map","id":"storehouse_original","confirm":true}
```

`gm_list_maps` returns IDs, names, dimensions, counts and byte sizes without
returning full map geometry. Load requires no non-object characters, active
initiative, unresolved decisions/reactions or ongoing casting. It replaces the
current layout and objects, so save any wanted edits first. `confirm:true` is
required. Loading uses existing scene/object/geometry validators and rolls back
completely on error, including checkpoints and RNG. The bookmark remains reusable.
Saved player visibility is restored exactly; unknown rooms and GM-layer secrets
are never automatically revealed by loading.

To delete only a bookmark, use `{"op":"gm_delete_map","id":"storehouse_original"}`.
The current scene is not changed. Map-save/delete operations persist through
combat undo, so undoing a turn cannot remove a saved layout or resurrect a deleted
bookmark. A loaded scene establishes new undo checkpoints.

## Clear a fight without deleting its map

Query `gm_preview_encounter_clear` first. The optional `keep` list defaults to
`[]` (no characters). Map object tokens are retained automatically. The preview
reports removed/retained IDs, object IDs, pending blockers and preserved schedules.

Use `gm_clear_encounter` with the same keep list. It ends initiative if needed
and reuses native scene cleanup. It removes departing creatures, their supported
mechanical state, active areas, unused definitions and old combat history/undo.
Map dimensions, terrain, features, door states, object HP, reveal mask and layers
remain unchanged. Retained characters keep their positions, elevation/display,
HP, spent spell slots/resources, ongoing ailments/effects and applicable deadlines.
Valid survivor geometry/traversal rulings remain; references to departed actors
are removed. Readied actions and encounter-duration events end through the normal
initiative lifecycle. Existing world-clock schedules remain; inspect/cancel them
explicitly if no longer relevant. Cleanup is not healing, rest or time advancement.

Unresolved actions/decisions and ongoing casting block cleanup. Resolve or cancel
those through their normal tools first; cleanup never bypasses a pending AoO.
If you retain a summon whose source would depart, native summon rules may require
you to revise the keep list. No partial cleanup commits on a rejection.

`gm_end_initiative` still merely ends initiative while retaining the roster.
`gm_close_scene` still discards the old map and takes explicit survivor placements.
Do not confuse either operation with map-preserving `gm_clear_encounter`.

## Storage and human controls

Named maps live in `state.savedMaps` inside the existing local encounter save,
which is atomically persisted after accepted MCP mutations. They survive restarts,
scene closure and calculator upgrades. There is no external filesystem path input
and no map images or campaign narrative stored here. Limits: 100 bookmarks,
64 MiB combined, 32 MiB and 100 objects per map (since V3.51); the encounter file has an
overall 384 MiB limit including undo checkpoints. Illustrated maps are substantially larger than geometry-only maps. Deleting an entire encounter file also deletes its
saved maps, so back up that file when moving computers.

The offline GM workbench has Save/List/Load/Delete and one-button Clear encounter,
keep map controls grouped in Map & scene management. It remains a separate sandbox;
its bookmarks must be retained through the existing full-state Export/Import before
closing it. These controls are not on the read-only player page. For the live
encounter, the AI uses the commands above and automatic persistence applies.

## A blank player map

`kernel_status.map.playerVisibility` and `gm_get_player_visibility` report GM-only
revealed/visible/hidden counts. A fully covered map is not a lost map or broken
connection. Reveal the intended cells using `gm_set_player_view`, then publish
intended feature/token IDs with `gm_set_player_display`. These are independent:
revealing a room does not expose its GM-layer traps or creatures. Inspect
`gm_preview_player_view` to check the actual player payload. The player page says
it is connected but awaiting a reveal when there are no public cells. None of
these diagnostics automatically reveal anything or change game mechanics.

V3.47 also captures background artwork, alignment and source-pixel redactions. Apply artwork before saving the bookmark. Map-preserving cleanup keeps it; scene closure removes the current image. Read MAP_ARTWORK_V3_47.md.
