# V3.46 — Map saves and Ubuntu installation polish

This release adds named map-only saves, encounter cleanup that preserves the map, and automatic Windows shortcuts for the Ubuntu launcher. The existing MCP connection and website plugin remain compatible; no website plugin ZIP upload is required.

## Install over V3.45

1. Close the running Pathfinder Assistant. Keep a backup copy of your encounter JSON before upgrading.
2. Extract the entire new ZIP into its own folder.
3. In Ubuntu, run `bash launcher/install-ubuntu.sh` from that extracted folder, without sudo. You can instead pass the full `/mnt/c/.../launcher/install-ubuntu.sh` path.
4. Check the existing encounter path in the launcher, enter your API secret key, and click Start.

The installer preserves existing settings and encounter data. It creates Pathfinder Assistant shortcuts on the Windows Desktop and Start menu, targeting a stable launcher path that follows future updates. Replace an older pinned shortcut if it still opens an older release. If Windows shortcut creation fails, installation continues and provides a manual fallback; see `UBUNTU_LAUNCHER_V3_46.md`.

Engine 3.46 accepts the existing 3.43 encounter format. Once a new mutation saves it as 3.46, an older engine may reject that file; use the pre-upgrade backup when reverting.

## Map workflows

- `gm_save_map`, `gm_list_maps`, `gm_load_map`, and `gm_delete_map` manage named bookmarks inside the existing encounter save. They retain static geometry, doors, damaged or destroyed objects, elevation, and player visibility. Characters, active spell areas, timers, and combat histories are excluded.
- `gm_preview_encounter_clear` and `gm_clear_encounter` end the fight while preserving the current map and its objects. Explicitly retained characters keep their HP, resources, and ongoing effects. Unresolved interruptions and active casting must be resolved first.
- Loading a map requires explicit confirmation and an empty character roster. It preserves the world clock. Saving does not reveal hidden content or advance mechanics.
- The offline workbench now exposes Save/List/Load/Delete and Preview/Clear encounter controls. Its state still needs the existing full-state export to survive closing the page. The live MCP server persists bookmarks automatically in its encounter file.
- `gm_get_player_visibility` and encounter status report GM-only reveal counts and layer counts, making a blank player view easier to diagnose. The player page distinguishes an unrevealed map from a disconnected server.

See `MAP_LIBRARY_V3_46.md` for exact contracts, limits, and examples.

## Validation and limits

All 100 engine/browser regression suites passed across the full run and one targeted rerun after correcting an ambiguous browser-test selector. The new map suite covers 17 groups. Launcher and shortcut tests add 17 passing tests. See `TEST_RESULTS_V3_46.txt`.

Automatic Windows shortcut creation was checked with mocked Windows calls and a real Linux stable-launcher test. It still needs confirmation on the user's Windows/WSL installation; this environment cannot execute Windows COM. No live encounter was modified during these tests.

The previously inspected development test state still contained its 30×40 map and 17 features, but its player projection had zero revealed cells. This release does not automatically reveal that map or publish GM-layer content. Reveal the intended region and publish only the intended features when ready.
