# V3.50 — Swarms and troops

Swarms and troops now have distinct native defenses, shared occupancy, zero-HP/nonlethal dispersal, and configured automatic damage. Troop attacks of opportunity use the existing reaction workflow. Swarms do not make AoOs. Native area spells apply vulnerability automatically; native fixed-count targeted spells respect collective immunity. Optional swarm distraction and collective caster-level checks reuse saves, conditions and casting expenditure.

Read `COLLECTIVES_V3_50.md` or reference topic `collectives`. Configure printed damage through the creature's `collective` profile or `gm_set_collective`. Component size and map footprint are separate. Older subtype-only imports remain readable but need their attack profile before taking turns. Imported totals are preserved.

Automatic ordinary damage resolves once per turn after completed movement, at an explicit stationary `collective_attack`, or at stationary turn end. This documented conservative timing policy prevents path fragments and retries from creating extra attacks. Troop AoOs have their separate existing allowance. Irregular formations, narrow gaps, wind and special creature-specific riders remain GM adjudication.

## Update

Stop the launcher, extract `tabletop_kernel_v3_50_collectives.zip`, and run `bash launcher/install-ubuntu.sh` in the extracted folder through Ubuntu. Keep the current encounter path. Restart and refresh the player page. Compatible prior saves, maps, artwork and the V3.49 HP readout are retained. No live encounter was edited or bundled into this release.

The matching website ZIP is `pathfinder_1e_assistant_plugin_v1_3_0.zip`, with the same registered internal plugin name and app mapping. Updating the website package does not update the local calculator.

## Remaining work

Higher-resolution artwork and improved source-grid calibration are still pending. No dependency or tunnel changes were needed for this mechanics release. Validation is recorded in `TEST_RESULTS_V3_50.txt`.
