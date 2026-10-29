# V3.49 — Player token HP and conditions

Click a player token's square to read current/max HP and tracked condition names in the bottom bar. Live damage, healing and condition changes update the readout. Temporary HP and nonlethal damage appear separately when present. Selection stays on the chosen square; click the new square after movement. Escape clears selection. Large and overlapping tokens are supported.

The GM must enable `showVitals:true` in the token's player display. This is available through the existing spawn/display commands and documented in `PLAYER_VIEW_V3_43.md`, `AI_START_HERE.md` and `AI_WORKFLOWS.md`. Existing saves keep their privacy defaults. Enemy/GM-layer information stays private unless explicitly published; all viewers share the same published data. Numerical buffs such as deflection bonuses are not included in the condition-name list.

## Install

Stop the launcher, extract `tabletop_kernel_v3_49_player_vitals.zip`, and run `bash launcher/install-ubuntu.sh` from that extracted folder in Ubuntu. Keep the existing encounter path. Start the calculator and refresh the player browser. Engine version is `3.49.0`; prior supported saves, maps and artwork are retained. Once connected, have the AI enable vitals for your existing player token. No encounter is bundled or reset.

The matching website update is `pathfinder_1e_assistant_plugin_v1_2_0.zip`. It preserves the existing internal plugin name and app mapping, with an updated bundled local installer. Website upload alone does not upgrade the calculator on the PC.

## Scope

This release adds presentation only, reusing native HP, temporary HP, nonlethal and condition stores. It adds no player-side editing controls or combat rule changes. Larger image limits, source-grid calibration improvements, and swarm/troop mechanics remain pending.
