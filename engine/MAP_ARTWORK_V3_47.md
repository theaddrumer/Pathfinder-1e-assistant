# Map artwork — updated for V3.51

The live player map supports a background image beneath its grid, public features and tokens. The image is presentation only: it cannot create walls, move creatures, reveal squares, or change mechanics. Trace the mechanical terrain/features separately. A fresh AI should inspect `gm_get_map_artwork` and `gm_get_player_visibility` before changing presentation.

## Calibrate before tracing

**Map setup order:** import the background, calibrate its printed grid, and check a third intersection before tracing walls, doors, terrain, hazards or placing encounter tokens. Once the artwork is aligned, build the mechanical features against that alignment. Later background adjustments do not move existing features or tokens; review any affected boundaries separately. For a new scene, confirm the printed square scale and choose sufficient map dimensions first. Do not begin cell-by-cell terrain work while the image is still being fitted.

## Keep mechanical setup sparse

The image supplies appearance. Ordinary open squares need no feature, fill or individual tool call. Author only geometry that changes play: walls/doors, cover, meaningful movement costs, hazards and elevation. Group equivalent cells into regions and connected boundaries into paths; `gm_set_map_features` accepts related features in one batch. Keep independently changeable doors/objects separate and respect command limits. Do not redraw decorative textures or trace every pixel.

Keep mechanical features on the GM layer when the background already depicts them; they still enforce their rules without covering the artwork. Publish an overlay only for useful player information or an intentional visible change. Fog/reveals are independent: blocking movement does not mean a square should be hidden. Use adventure context to distinguish a visible roof from a cutaway interior. Verify scale/alignment, key boundaries and the player preview, then refine uncertain details as needed instead of inspecting every empty square repeatedly.

## Local file import

Start the Ubuntu launcher and select **Map artwork**, or open `http://127.0.0.1:8787/artwork` on the host computer. This is a GM-only local page on the private engine listener, separate from the read-only player page on port 8788. Nothing is uploaded to an external image service. The existing player page still has only viewing controls.

Choose a PNG, JPEG or WebP image. Adjust Left, Top, Width, Height and Rotation against the grid preview. Fit whole image inside map preserves aspect ratio as a starting point; borders and printed margins usually need offsets. The fields use grid squares, and rotation is clockwise in degrees around the image's top-left corner. Independent width/height scaling is supported. Map dimensions do not change. The source preview below the alignment preview is useful for covering labels.

Use a player-safe map when possible. Otherwise enable the cover tool and drag rectangles over printed room numbers, secret-door markings or other spoilers on the source preview. Cover colors can approximate the surrounding floor. Check the review box and click Apply artwork. Changes remain a draft until Apply; accepted changes persist to the existing encounter file. Reload discards drafts after confirmation. If the encounter changes during editing, Apply rejects the stale revision; reload and review again. Network failures retain the exact request for an idempotent retry.

Replacing the image clears old covers unless new ones are supplied. Removing the background leaves all terrain, features, tokens and reveal settings intact. The browser file picker normalizes images to PNG at their original resolution. If limits would be exceeded, it rejects without changing the current artwork. Check **Allow resizing** before choosing the file only when a reduced copy is acceptable. The status reports original and imported dimensions; no silent downscaling occurs. The original file is not modified. Reopen the file picker to use another original.

The editor displays the private full image, so keep that tab on the GM's screen. The player viewer never links to it. This is a local host tool, not an account-based permission boundary against other people using the same computer. If a manually configured server requires TABLETOP_API_TOKEN, its existing authentication also protects the editor; the normal Ubuntu launcher uses loopback access without that optional token. The editor is not available through non-local proxy hosts or stdio mode.

## Uploaded PDFs and AI import (clarified in V3.48)

Inspect the uploaded PDF page. Extract an embedded map image when suitable; maps can also live in interactive button appearances, not just ordinary page images. Prefer a label-free/player-safe appearance when available. Otherwise render the relevant page and crop its map region. Inspect the result for titles, neighboring maps, room labels and secret-door markings before importing. Extraction does not require image generation and the original PDF stays unchanged.

Normalize the real crop to the supported PNG format/limits below, then supply its actual base64 bytes in `gm_set_map_artwork.image`. Record scale and crop offsets; align the printed grid to the calculator’s fixed five-foot cells rather than forcing the image edges to match the map bounds. One printed ten-foot square spans two calculator cells in each direction. Preserve the source resolution; rendering a low-resolution embedded raster at higher DPI cannot create missing detail. Check the complete crop at its native size before importing. Image rotation does not rotate the calculator's coordinate labels. Trace walls, terrain and other mechanics independently. A map-only PDF cannot establish encounter creatures, water depth or trap rules; use AP text or explicit adjudication.

Before replacing a scene, save the current map if requested and verify the bookmark. After import, inspect `gm_get_map_artwork`, the public preview and intended reveal mask; save the new bookmark after artwork is applied. Do not put user artwork or encounters in software releases. PDF/file processing is performed by the AI's environment, not by a built-in PDF parser in the calculator.

## AI commands

Use the existing kernel_gm envelope with reason, expectedRevision and a unique requestId. An AI with file-processing tools can import the actual image bytes; use the file picker when those tools or byte transfer are unavailable. Never invent base64, source paths or URLs. Once imported, adjust alignment/covers without resending the image.

```json
{"op":"gm_get_map_artwork"}
```

This query returns configured status, source pixel dimensions, encoded size, placement and redaction rectangles, without the image bytes.

```json
{"op":"gm_set_map_artwork","placement":{"x":-0.5,"y":-1,"width":31,"height":42,"rotation":0}}
```

Omitted image retains the current image. Omitted placement and redactions retain their values, except that replacing an image resets redactions to an empty list. New images default to fitting the current map unless placement is supplied.

```json
{"op":"gm_set_map_artwork","redactions":[{"x":120,"y":80,"width":30,"height":20,"color":"#283640"}]}
```

Redactions replace the entire list and use integer **source pixels**, not grid coordinates. Read the image dimensions first. Up to 100 in-bounds rectangles are allowed. Later rectangles take precedence. To clear artwork:

```json
{"op":"gm_set_map_artwork","image":null}
```

For a trusted importer, image may be a base64 PNG string without a data-URI prefix. Maximum 16 MiB compressed, 8192 pixels per side and 16,777,216 total pixels; 8-bit non-interlaced RGB/RGBA. The server decodes and re-encodes it, stripping source metadata. PNG decoding uses bundled pngjs 7.0.0; no native executable or new service is required. The local picker accepts source files up to 25 MiB, normalizes them without resizing unless the user selects Allow resizing. Tool/editor request limits allow 23 MiB of JSON for base64 PNGs; ordinary tool arguments retain their 2 MiB bound. A host/tunnel may impose its own smaller payload limit: use the local file picker if a valid large image cannot cross that transport. Do not repeatedly shrink a good source to work around a missing importer.

## Grid calibration (V3.51)

Use two well-separated printed grid intersections and their intended calculator intersections. Prefer a long horizontal or vertical span, then check a third point elsewhere to catch measurement error, a skewed scan or unequal source scaling. Coordinates are zero-based **grid intersections**: (0,0) is the top-left corner of A1, while (1,1) is the top-left corner of B2. They are not cell centers. Partial edge squares belong in the image offset, not in distorted grid spacing.

```json
{"op":"gm_set_map_artwork","calibration":{"points":[{"source":{"x":13,"y":17},"grid":{"x":1,"y":1}},{"source":{"x":213,"y":17},"grid":{"x":21,"y":1}}]}}
```

This example spans ten printed 10-ft squares at twenty source pixels each: twenty native 5-ft cells. The first intersection is offset from the image edge. Calibration derives uniform scale, rotation and top-left offset and stores only the existing `placement`. It changes neither mechanical cells nor existing features. Use `calibration` OR `placement` in one command; an optional image can be supplied in the same command. Read back `gm_get_map_artwork` afterward. Existing covers remain in source coordinates. Manual placement still supports independent width/height when a source is genuinely stretched.

The local editor offers source-point buttons and matching grid coordinates, then **Calibrate preview**. The draft remains local until Apply. No automatic grid recognition or wall tracing is implied. For an existing mechanical map, align against its established coordinates; if the earlier tracing was wrong, review those features separately rather than expecting image calibration to move them.

## Fog and privacy

The server builds a fresh raster containing only revealed pixels, with hidden pixels' RGB and alpha set to zero. Redactions are applied before publication. The player receives a content-addressed PNG URL and that masked PNG, never the original source file, embedded source metadata or redaction coordinates. The public descriptor includes the masked image dimensions and placement needed to align it. Old raster URLs stop working when the public image changes. Re-hiding cannot erase an image someone has already seen or captured.

GM-layer features and tokens remain independent of artwork. If a crate or secret door is printed in the source, hiding its engine feature cannot erase the printed pixels. Use a source redaction or a player-safe source. An ordinary visible floor feature can cover artwork on screen but is not a privacy redaction: its underlying revealed pixels have already been sent.

The masked PNG retains the source dimensions and surviving source pixels: there is no 2048-pixel player output cap and no map-sized raster allocation. Each source pixel’s entire transformed footprint must lie in revealed cells. A conservative boundary around rotated pixels can hide a narrow edge of artwork, but never reveals a partially hidden pixel. Very coarse source pixels spanning several cells remain hidden until all those cells are revealed. The viewer clips to revealed cells and uses nearest-pixel display to avoid blurring adjacent source pixels. Grid, pan, zoom and public overlays continue to work. Terrain colors remain the fallback outside the image or through transparent pixels.

The public image hash depends only on the masked result. A change wholly inside fog does not change that hash. kernel_query gm_preview_player_view includes the same public raster descriptor as the live viewer. The portable offline engine projection returns geometry only; offline HTML has no server to generate masked PNGs.

## Saving and lifecycle

Artwork, alignment and redactions live in scene.artwork and are included in named map saves. Save your bookmark after applying artwork. gm_clear_encounter preserves them; gm_close_scene removes the current scene's artwork; loading a map restores its artwork. Undo follows existing presentation checkpoints. The normal atomic session store remains the sole persistence owner, so moving/backing up the encounter JSON includes the artwork without sidecar files.

Map saves permit 32 MiB per map, 64 MiB combined and 100 maps. The full encounter file permits 384 MiB, including undo checkpoints. These budgets count serialized JSON/base64, not just original JPEG file size. High-resolution images can substantially increase autosave size and work during reveals; combat turns that do not change artwork or fog reuse the cached public raster. Images are much larger than geometry alone; this release does not promise an unlimited illustrated campaign archive. Oversized saves reject atomically with the existing limits.

This is background import/alignment and safe fog support. Automatic wall tracing, pixel-perfect reconstruction, arbitrary artwork painting, background object extraction/movement, individual-player vision and remote multiplayer sharing remain outside this release. Existing public feature edits can represent visible scene changes above the background.
