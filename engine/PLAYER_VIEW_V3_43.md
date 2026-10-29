# Live player map and GM layer — V3.43

The player viewer is a read-only browser page connected to the running MCP encounter. It has pan, zoom, fit, grid and label controls. It does not load the GM workbench, engine, command catalog, creature editor or other calculator panels. Its data is filtered on the server before reaching the browser.

## Open the live map (Windows / Firefox)

From the extracted release folder, run `node mcp_server.mjs --http` as before. The same process now starts the private MCP endpoint on port 8787 and a separate local player listener on port 8788. Keep your existing MCP tunnel connected to **8787**, not the player port.

Open **http://127.0.0.1:8788/player** in Firefox on the computer running Node. Leave this tab open while playing. It refreshes automatically, normally within about one second of an accepted AI command, without creating image files or rerolling anything. The console prints the actual address at startup.

If upgrading, stop the old Node server with Ctrl+C before starting this release from its new extracted folder. Use the same `TABLETOP_STATE_PATH` if you previously customized it. Existing saved encounters load privately: the player map starts covered and all previously unconfigured tokens/features start on the GM layer. Ask the GM AI to configure the reveal region and public tokens. An empty view is not a lost map.

`TABLETOP_PLAYER_PORT` changes the player port; `TABLETOP_PLAYER_VIEW=off` disables the player listener. These are optional environment settings. If the chosen port is occupied, startup fails clearly; choose a free player port and restart. The default stdio launch does not start this viewer.

`index.html` remains a separate offline GM sandbox. Opening it does not connect it to the live encounter. Open the URL above for live player viewing; do not open `player.html` directly as a local file.

The viewer is currently loopback-only: other computers cannot use this localhost address. Remote hosting, access-controlled sharing and individual player views are separate future work. Anyone with access to the host computer can open its local player page; this is not an account-based permissions system. Keep the private GM endpoint/tunnel credentials private.

## Visibility contract

Two independent decisions control player output: whether a map square is revealed, and whether a creature or feature is on the `map` or `gm` layer.

- The reveal mask starts fully covered. Reveals are GM decisions, not automatic lighting, line-of-sight, awareness or movement-based exploration.
- Creature tokens and features default to the **GM layer**, including new spawns. Revealing a room does not reveal its hidden occupants or traps.
- GM-layer entries still exist mechanically, occupy space and participate normally. Hiding does not grant invisibility, disable a trap, alter targeting, stop AoOs or change collision. Apply actual conditions/rulings separately.
- A map-layer creature appears only when its whole footprint is revealed. A large token crossing the fog boundary is omitted until all its cells are revealed. Overlapping visible tokens receive small display offsets without changing their positions.
- Map-layer feature cells and paths are clipped on the server to revealed squares/boundaries. No original full path, hidden endpoints, object links, feature IDs, internal names or notes are transmitted.
- Public labels are explicit, independent of internal names. Omitted creature labels show `Creature`; feature labels are blank. Public colors are explicit and do not infer allegiance or HP.
- The player never receives creature IDs, private names, general stats, effect records, initiative, pending events, source notes, GM logs, private map titles or the engine revision. V3.49 allows the GM to explicitly share a visible token's HP and condition names with `showVitals:true`; all other tokens retain the original privacy default. A public content hash changes only when the public projection changes.
- Revealed legacy floor/wall/force-wall/difficult tiles are rendered. Legacy `hazard` tiles look like ordinary floor so revealing terrain does not announce hidden traps. Use an explicitly public feature/label if a hazard should be visible. GM-layer features are the preferred representation for secret traps; their mechanical triggers still use existing systems.
- Open public doors render as dashed outlines. Destroyed linked-object barriers disappear according to existing feature activation rules. A public graphic can intentionally differ from mechanical properties: it does not establish cover or movement cost.

## AI reminder: update visibility during play

After movement, teleportation, forced movement, a door opening or another change that exposes new surroundings, check whether the player's view needs updating before narrating the result and requesting their next action. Do not wait for the player to report that their destination is still covered. Movement updates positions automatically; it does not reveal fog.

Use the actual resolved position. If movement pauses for an interrupt, reveal only what the character can perceive from the reached position, then check again after continuation; never reveal an unreached destination just because it was requested. Adjudicate visibility from the scene, including elevation, walls and relevant senses, and use `gm_set_player_view` to reveal the appropriate region or grouped cells. For an intended public token, check its whole footprint: a partly concealed footprint hides the entire token in this viewer.

Revealing terrain does not publish GM-layer occupants or traps. Use `gm_set_player_display` separately only for entries the players should now see. Check the relevant part of `gm_preview_player_view` when changing visibility; avoid repeated whole-map queries when the view is already correct. This is an AI GM workflow, not automatic vision or a rule that every traversed square must be revealed.

## AI commands

Use `kernel_gm` with the current revision, unique request ID and reason, as usual. The examples below are inner command objects. Substitute real creature/feature IDs; the public label is chosen separately.

Reveal a room rectangle (grid cells, top-left origin):

```json
{"op":"gm_set_player_view","title":"The storehouse","rect":{"x":2,"y":3,"width":6,"height":4},"revealed":true,"reason":"The party can now see this room"}
```

Use exactly one of `rect`, `cells:[{"x":2,"y":3}]`, or `all:true`. `revealed:false` covers the selected squares again. `title` alone changes only the public title. Nothing in these operations decides mechanical vision.

Show an existing token:

```json
{"op":"gm_set_player_display","kind":"creature","ids":["hero"],"display":{"layer":"map","label":"Explorer","color":"#75c6bf","showVitals":true},"reason":"Show the player character and their vitals"}
```

Move it back to the GM layer without changing combat conditions:

```json
{"op":"gm_set_player_display","kind":"creature","ids":["hero"],"display":{"layer":"gm"},"reason":"The GM determines the token is no longer visible to players"}
```

Existing display fields are preserved when omitted. A batch gives each listed entry the same supplied display fields; use separate commands for different labels. `ids` accepts 1–1000 unique existing IDs. Choose `kind:"feature"` for map features. `display.style` can be `marker`, `wall`, `door`, `water`, `terrain` or `floor`; these are drawing styles, not mechanical presets.

`spawn_creature` optionally accepts `playerDisplay` with the same display object. `gm_set_map_features` accepts `playerDisplay` on each feature; new entries default to GM, while updating an existing feature preserves its display settings unless replaced explicitly. These allow creation and display in one accepted transaction. Removing a feature and recreating its ID does not inherit its former public visibility.

Use `kernel_query` with `{"op":"gm_preview_player_view"}` to inspect the filtered projection. Large results require `path`, `offset` and `limit` paging as usual (for example `/tokens` or `/features`); one default page is not the whole map. Use `gm_get_map` or `inspect` for GM-only full data. New commands are discoverable in the `map` family and point to this guide.

## Selected player token: HP and conditions (V3.49)

When publishing a player-controlled token, set `playerDisplay.showVitals:true` through `spawn_creature` or `gm_set_player_display`. It is an explicit publication choice, not inferred from team, name or allegiance. Existing tokens default to no shared vitals; configure the player's existing token after upgrading. Set `showVitals:false` to revoke sharing. Omitted fields retain existing settings.

Click any square in the visible token's footprint to show its public label, current/max HP and tracked condition names in the bottom bar. Temporary HP and nonlethal damage appear separately when present. Damage, healing and condition additions/removals update through the existing live feed. Negative HP is displayed as stored. Hovering elsewhere or panning does not change the pinned square; Escape clears it. The selection belongs to the square: if the token moves away, select its new square. Multiple opted-in tokens occupying that square each get a line.

Only fully revealed, map-layer tokens can publish these values. Hiding a token, covering part of its footprint or revoking `showVitals` removes its vitals from both the public feed and readout. The shared viewer has no per-player accounts: everyone viewing it can read opted-in vitals, including through `/state` before clicking. Do not enable this for secret enemy statistics. There are no HP editing controls or GM commands in the player page.

Conditions are the names of native condition records, without source IDs, notes or hidden effect descriptions. This is not a character sheet or a complete buff list: a numerical modifier such as a deflection bonus is not itself a condition, and is not shown here. The readout does not infer ailments or health-state labels; HP, temporary HP and nonlethal damage come directly from their existing stores.

## Persistence, undo and lifecycle

Display settings are stored on native creature/feature records; the mask/public title live in the existing scene. There is no duplicate roster, mechanics engine or independent encounter database. Accepted commands use normal persistence and retry protection.

Display edits spend no action resources, roll no dice, advance no time and do not resolve pending combat. They mark the existing undo bookkeeping as edited, so undo selects the current turn correctly. Native undo/round restore includes presentation settings, and the player page follows the restored state. Undo or re-hiding cannot erase information a player already saw.

Resizing preserves valid reveal cells, drops cells outside a smaller map and leaves expanded space hidden. Scene closure clears the mask/title and resets surviving tokens to the GM layer along with normal scene cleanup. A newly reused creature ID gets no display state from a removed creature.

## Delivery and current limits

The player listener serves only fixed viewer assets and GET/HEAD `/state`. No mutation or MCP routes are mounted there. Requests use a public-content ETag; unchanged views return no new map body, including when hidden creatures move. There is no GM revision or change history in this response. Reconnecting gets the latest full public view; it does not replay missed GM actions. The page shows a stale-map notice if it loses the connection.

The viewer renders the calculator grid, terrain, public features and tokens. V3.47 adds original-map backgrounds and alignment: see MAP_ARTWORK_V3_47.md / topic `artwork`. The server sends a redacted, fog-masked PNG rather than hiding the source image with a client overlay. Named map Save/Load is supported (MAP_LIBRARY_V3_46.md). Arbitrary artwork painting, extracting objects from a background, and remote sharing remain unfinished.

There is one shared player view, no per-character vision, automatic fog exploration, token dragging, player commands, Roll20 connection or in-chat embedded viewer. Players describe actions in chat; the AI uses the existing mechanics, and the separate Firefox map tab updates.

## V3.46 visibility diagnostics

A blank page can be a connected, fully covered map. Query `gm_get_player_visibility` or inspect `kernel_status.map.playerVisibility` for revealed cells, visible features/tokens and GM-layer counts. These counts are private GM diagnostics and are never sent to players. Reveal only intended regions; then explicitly move intended features/tokens to the map layer. Loading a saved map restores its saved visibility, never reveals everything by default.
