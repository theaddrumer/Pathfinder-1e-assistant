# Release preparation — not ready to submit

Completed: recovered V3.51 engine and latest documentation changes; separate
desktop stdio entry; local player and GM artwork controls; clean package without
registered app references, tunnel dependencies, private maps or secrets; icon;
draft listing, prompts and five positive/three negative review cases.

Intended publisher: Thead Drumer, using an individual identity. The author and
developerName fields are populated. Identity verification remains unconfirmed;
confirm that the selected verified identity permits this exact public name.
Optional dark icons and brand colors are omitted; they are not release blockers.

Before submission, complete in order:
1. Confirm local-MCP submission eligibility with OpenAI and verify the publisher.
2. Supply and verify the plugin website, support page, privacy policy and terms
   URLs. Confirm actual data practices before drafting policy commitments.
3. Confirm intended countries and whether any purchases/payments are involved.
4. Test a clean ChatGPT desktop installation on the intended user OS, including
   Node discovery, map file selection, alignment controls and save/restart.
5. Run the drafted AI review cases in that host. They are NOT RUN in this draft.
6. Record the actual desktop flow, verify playback and host a reviewer-accessible
   demo recording. A script or the old tunnel demonstration is not that evidence.
7. Add the confirmed metadata, rebuild the ZIP, validate the final archive, then
   upload only when authorized. Complete required scans and legal attestations.

Suggested demo after a clean install: show encounter/map links; import and align
a user-owned or public-domain map; reveal a small region and show the player
view; roll 2d6+3 without damage; save the map and restart to show persistence.
Keep GM secrets and account credentials out of the recording. Use the existing
development connection only to rehearse calculator behavior; desktop-specific
launch behavior must be demonstrated in the desktop host being submitted.

The localhost editor is for the GM and shows unrevealed art. The player listener
has only read-only filtered state and revealed pixels. Both listeners close
when the desktop MCP session closes. No public Internet hosting is configured.

Source recovery: the latest V3.51 download contains complete local ZIP entries
but lacks the central directory. Runtime was restored from the intact original
V3.51 archive and all six later documentation/build-script changes recovered
with decompression, size and CRC checks. This package has a rebuilt, verified
central directory. No working installation or existing plugin was replaced.
