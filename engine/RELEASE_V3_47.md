# V3.47 — Original map artwork in the live player view

The player map can now show an imported background image beneath the existing grid, public features and tokens. Use the new **Map artwork** button in the Ubuntu launcher to choose a PNG, JPEG or WebP file, align it to the grid, cover printed secrets, and apply it. The player page updates automatically using its existing reveal mask.

## Upgrade

Close the current launcher, keep a backup of the encounter JSON, and extract the entire ZIP to its own folder. In Ubuntu run `bash launcher/install-ubuntu.sh` from that folder, without sudo. The stable Windows shortcut follows the installed release. Start the calculator and click Map artwork. No website plugin re-upload, new Windows executable, additional server service or security-setting change is needed.

Engine 3.47 reads previous 3.43 and 3.46 encounter saves, preserving their current map and visibility. Once saved by this version, use the pre-upgrade backup if reverting to an older engine.

## Behavior

Placement supports fractional-square offsets, independent width/height scaling and rotation. It changes the artwork only; mechanical walls and terrain still come from the calculator's existing map definitions. The preview has the full private image and grid. Draft changes require Apply, and stale revisions are rejected rather than overwriting a newer scene.

The server removes fogged pixels before delivering the player image. Source-pixel cover rectangles also remove printed secrets from that delivered image. The raw source is never served on the player listener. Hiding an engine feature cannot hide something printed in the image; use the covers or a player-safe original.

Artwork is stored with the encounter and included in named map saves. Map-preserving encounter cleanup retains it, scene closure removes the current image, and map loading restores it. Save a new bookmark after importing if an existing bookmark should include the artwork. No image-generation tool or repeated manual JPEG export is involved.

The importer reduces large images to keep the encounter bounded (1 MiB normalized PNG, up to 4 megapixels). Player output is up to 2048 pixels per side. Named map saves permit 4 MiB each and 8 MiB combined. Arbitrary image painting, extracting movable furniture from a source image, automatic wall tracing, remote multiplayer and per-player vision remain deferred.

Read MAP_ARTWORK_V3_47.md for exact commands and operating limits, and TEST_RESULTS_V3_47.txt for validation. All testing used disposable scenes; the user's live development test map was not changed.
