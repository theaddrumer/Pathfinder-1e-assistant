# V3.51 — map resolution and grid alignment

Map artwork now retains its imported resolution all the way to the masked player image. Import no longer silently shrinks a source to 2048 pixels or a 1 MiB PNG. The local editor reports original/imported dimensions and asks for an explicit Allow resizing selection when the original exceeds limits. The engine never invents missing source detail.

Two-point calibration is available in the GM editor and `gm_set_map_artwork.calibration`. Supply two image-pixel/grid-intersection pairs to derive uniform scale, rotation and offset, including partial squares at image edges. Existing manual placement remains available. A printed 10-ft square spans 2×2 of the unchanged 5-ft mechanical cells. Check a third intersection before tracing terrain.

The server masks source pixels directly instead of allocating a grid-sized image. Every published pixel lies entirely in revealed cells; hidden RGBA is zero, printed-secret covers are applied first, and the original image never reaches the player listener. Rotation uses conservative boundary masking. Existing overlays and player vitals remain above the artwork.

## Capacity and compatibility

Image limits are 16 MiB normalized PNG, 8192 pixels per side and 16,777,216 total pixels. The existing 256×256 map limit is unchanged. Synthetic validation covers the agreed 160×170-cell large-map baseline and maximum grid with 3200×3400 artwork. Neither test downsamples the source. Images can still look pixelated beyond their actual source resolution.

Artwork requests allow 23 MiB of JSON; ordinary requests keep their 2 MiB bound. The local editor avoids remote transport limits when a host cannot carry a larger upload. Map bookmarks permit 32 MiB each, 64 MiB combined and 100 entries. The session permits 384 MiB including undo checkpoints. These are serialized/base64 budgets; image-heavy saves cost more disk space and time than geometry-only maps. No dependencies, image server, campaign archive or separate map geometry system were added.

Existing published encounter versions through V3.50 remain accepted. Current and saved maps stay in the existing local encounter file. Low-resolution images saved by older releases are not automatically replaced; reimport the better source to recover available detail. Replacing an image resets source-pixel redactions unless explicitly supplied, so review them again.

## Update

Stop the launcher’s running services. Extract the complete `tabletop_kernel_v3_51_map_resolution.zip` into a new folder and run `bash launcher/install-ubuntu.sh` in Ubuntu from that extracted folder. The installed shortcut follows the new release; start it normally. Existing saves remain separate from program files. Refresh already-open player/editor tabs so they load the new display code.

Upload `pathfinder_1e_assistant_plugin_v1_4_1.zip` as the new version of the existing website plugin. Its internal plugin name and registered app mapping are unchanged. The ZIP contains the same companion installer and updated setup/artwork instructions. Installing the plugin alone does not update the local server.

This release contains no user encounter, AP map, personal configuration or credentials. The live encounter was not altered during development. Independent fresh-user installation testing and multiplayer remain future work.

## Validation

See TEST_RESULTS_V3_51.txt for engine regressions, high-resolution/calibration/visibility tests, browser import/display checks, installer tests and checks run from the extracted distribution.

Documentation follow-up: map setup instructions now explicitly require background calibration before tracing mechanical features or placing tokens. Later image alignment changes require a separate review of existing geometry. Engine version and runtime code remain 3.51.0; website plugin packaging is 1.4.1.
