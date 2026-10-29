# V3.43 — Live player map and GM layer

The HTTP launch now provides a separate read-only player map at `http://127.0.0.1:8788/player`, driven by the same encounter as the MCP server. It updates automatically and exposes only pan, zoom, fit, grid and label controls. The private MCP endpoint remains on port 8787.

New GM commands reveal/hide map cells, set a public title, and move existing creatures/features between GM and map layers. All entries and terrain start hidden until explicitly configured. Public labels are independent of internal names. Layer changes do not apply invisibility or change game rules.

Player payloads are built from an explicit allowlist: hidden entries, unrevealed geometry, internal IDs, HP, stats, notes, logs and GM revision data never enter the player response. Partial paths are clipped before transfer. Unchanged public views retain their content hash even when private state changes. The player listener has no engine files, command endpoint or write route.

Settings reuse native scene/creature/feature storage and existing save/undo transactions. Old saves load hidden by default; resized maps retain valid reveal cells, and scene closure resets presentation. The offline GM sandbox has companion visibility controls and GM-layer token indicators but remains separate from the live server.

This is the first live grid-view milestone. Original artwork/alignment, image editing, map-only save/load and remote-player hosting are still pending. All viewers currently share the same GM-authored view. Read `PLAYER_VIEW_V3_43.md` for startup, examples, privacy boundaries and limitations.

V3.43 accepts saved V3.37–V3.42 sessions. Keep a pre-upgrade backup for downgrade. Replace the extracted bundle as a unit; restart the Node server, keeping the existing MCP tunnel pointed to 8787. No new runtime dependencies are required.

Validation: 53/53 Node suites passed, including 10 player-view groups and 4 player transport groups. The live-browser integration test passed in Chromium, covering privacy, movement/hide updates, controls, reconnect and GM sandbox controls. Firefox was not separately automated.
