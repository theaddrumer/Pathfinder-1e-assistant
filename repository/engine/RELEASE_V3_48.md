# V3.48.2 — Existing-save compatibility repair

V3.48.0/.1 rejected valid V3.47 saves despite no save-format change. The loader now explicitly retains all supported published writer versions, including V3.47 and both V3.48 releases. An isolated restart test uses a fixture produced by the actual V3.47 code and verifies its artwork, reveal mask, two saved maps, creatures, clock, revision, retry receipts and undo checkpoints survive. Unknown future versions/formats are still rejected without altering files.

Close the launcher, extract the corrected local ZIP, and run its Ubuntu installer. Keep the existing encounter path; do not edit the JSON or choose New empty encounter. The engine reports 3.48.2. Upload the matching website plugin ZIP to replace its bundled installer too. The V3.48.1 dependency packaging fix remains in place.

# V3.48.1 packaging correction

V3.48.0 omitted dependency directories named runtime from the ZIP, including AJV's required validation_error.js. V3.48.1 preserves every bundled dependency file and limits the top-level runtime exclusion to the application's own directory. The release builder now verifies the complete dependency inventory and exact bytes, then starts/tests MCP and player servers plus the launcher from a freshly extracted archive before publishing either ZIP.

Close the launcher, extract the corrected local ZIP to a new folder, and run its Ubuntu installer. Keep your existing encounter path; no New empty encounter is needed. Re-upload the corrected website ZIP too, because its bundled installer asset has also been replaced. Your plugin identity/app mapping remain unchanged. No gameplay or map-save schema changes were made.

# V3.48 — Setup checkpoint and player coordinates

The live player map now has A1-style column/row rulers, a hover readout and click-to-pin reference squares. Rulers follow pan and zoom; columns continue after Z. Coordinates are viewing aids only and do not change fog, targeting or token positions. Gameplay commands still use numeric zero-based X/Y. See MAP_COORDINATES_V3_48.md.

SETUP.md covers the complete Windows/Ubuntu path, credentials, first empty encounter, tunnel connection and end-to-end verification. The AI can read it before connecting through the website package's setup skill, or after connecting through kernel_reference. README, launcher and coordinate guides are also exposed there. Artwork guidance now covers extracting real images from uploaded PDFs as well as the local file picker.

## Install this checkpoint

For the local calculator: close the current launcher, back up the encounter JSON, extract the entire `tabletop_kernel_v3_48_2_setup_coordinates.zip`, then run `bash launcher/install-ubuntu.sh` from that folder in Ubuntu without sudo. Use the existing encounter path and stable shortcut. Start and reload the player browser. The engine reports 3.48.1. No save schema or combat mechanics changed.

For the existing website plugin: upload `pathfinder_1e_assistant_plugin_v1_1_2.zip` as its new version. It preserves the existing internal name and registered app mapping, while adding a setup skill, guide copies and the local installer ZIP as an asset. The human-facing name stays Pathfinder 1e Assistant. There are no credentials or encounter saves in either download. Updating one side does not automatically install the other.

## What is and is not verified

See TEST_RESULTS_V3_48.txt. Local regression checks use synthetic scenes and disposable saves. The owner's active map and bookmarks are not changed by this release work. Browser tests are separate from live Windows/Firefox verification, and the website must still accept and activate the uploaded version before its setup entry can be verified there.

The existing registered app belongs to its current profile. A package upload does not create a separate tunnel for another user. Independent testers need their own tunnel-backed custom connection. Public listing, per-account connection onboarding and remote multiplayer remain outside this checkpoint. The bundled installer avoids requiring a public file host, but asset download support must be tested in the target ChatGPT surface; the separate local ZIP remains the fallback.
