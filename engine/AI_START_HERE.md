# Operating Tabletop Kernel — V3.51

Swarms/troops: read `kernel_reference` topic `collectives`. Supply a top-level `collective` profile with component size and printed automatic damage; use the real subtype. The footprint is not the individuals’ size. Legacy subtype-only imports need configuration before taking turns.

Creature imports: read [CREATURE_IMPORT_V3_42.md](CREATURE_IMPORT_V3_42.md), also served by `kernel_reference` topic `registry`. Errors now identify invalid field paths and distinguish missing ammunition stores from incorrect attack modes.


For common combat modes, planar flanking, prone/helpless handling and source-specific immunity, read `COMBAT_MECHANICS_V3_40.md` (`kernel_reference` topic `combat`). Read `kernel_reference` topic `readme` for the scope table before importing a statblock. For subtype classification, read topic `subtypes`: recognized labels and automated trait rules have distinct coverage. `kernel_status(target)` exposes the current type/subtypes; recognition does not automatically implement Bane or other matching effects.
The AI GM decides tactics, fiction, sourcebook interpretation and missing cases. The kernel calculates and enforces its configured mechanics. It does not read an Adventure Path, recognize a spell by name, or reconstruct an entire statblock from prose.

## Setup and coordinates

For installation/troubleshooting, read topic `setup` (also bundled in the plugin for offline setup). Read topic `launcher` for runtime details. Player square labels such as G12 convert to numeric (6,11); read topic `coordinates`. Do not send A1 strings to numeric engine commands.

**Map setup order:** import the background, calibrate its printed grid, and check a third intersection before tracing walls, doors, terrain, hazards or placing encounter tokens. Once the artwork is aligned, build the mechanical features against that alignment. Later background adjustments do not move existing features or tokens; review any affected boundaries separately. Read topic `artwork` for calibration payloads. Keep ordinary open squares implicit.

## First contact

Call `kernel_status` to inspect this encounter, its version and revision. Read the returned warnings and continuations before changing anything. Do not reset an existing scene merely because this is a fresh chat.

Use `kernel_catalog` with a family/channel to find commands; follow `nextOffset` to see further pages. Then request a specific `op` for its input hints, example, changes/costs, limitations and `referenceTopic`. Call `kernel_reference` with that topic for the fuller contract. `guidanceCoverage:"reference_only"` means the short entry is not an operating recipe. `required:null` means the field list has not been catalogued, not that no fields are needed. Even non-null lists cover only top-level inputs, not every conditional/nested requirement.

The names are case-sensitive: use `gm_roll`, not `GM_Roll`. Examples contain fictional IDs and assume relevant setup; substitute IDs obtained from current state. `definition` identifies a reusable template; `actor`/`target` usually identify live instances. These are not interchangeable.

## Pick the correct tool

| Need | Tool and contract |
|---|---|
| Current state, active actor, budget, continuation choices | `kernel_status`; optional `target` or `view:"continuations"` |
| Discover a command or its limitations | `kernel_catalog`; examples are inner command objects |
| Inspect/preview without dice or changes | `kernel_query` with a catalogued query command |
| Normal attack, movement, casting or offered actor continuation | `kernel_action` with `command`, current `expectedRevision`, unique `requestId` |
| Import/setup, standalone roll, declared adjudication or offered GM continuation | `kernel_gm` with the same envelope plus `reason` |
| Inspect the latest accepted result without repeating it | `kernel_result` with its `requestId`, optional JSON-pointer `path` and paging |
| Read operating guidance | `kernel_reference`; `start`, `workflows`, or the catalog's `referenceTopic` |

GM authority is not a retry strategy for rejected gameplay. Correct the input/state or explicitly adjudicate a real rules exception. `admin_attack`, `gm_resolve_spell`, direct damage and Free Mode do not replace ordinary attacks/casts.

A targeted status reports derived combat totals and `stats.speed` as **configured base speed in feet**. It is not a promise that every movement is currently legal. Conditions, terrain, posture, elevation and explicit rulings still matter.

## Interpret outcomes correctly

An accepted mutation advances revision, even when its result is a miss, lost spell, warning or pause. Read the newest state rather than assuming the action completed. In particular, a time-warning response may advance no time; a deadline can advance only part of the requested interval.

A rejected command preserves state/RNG/resources. Fix the request and use a new requestId. If the response was lost and acceptance is uncertain, retry with the **identical command, revision, reason and requestId**. Do not mint another ID for that uncertain intent. For a known stale revision, inspect state and reconsider before submitting a new intent.

`result.data` holds bounded mutation output; query/result pages use `data`. Follow `nextOffset` and `omittedPaths` instead of repeating the mutation for a fuller answer. Only the latest accepted command has full `kernel_result` details. Status has its own creature page and continuation page; use `view:"continuations"` to page all offered choices. Native log/history and retry receipts are bounded.

A paused action has already paid any recorded costs. Follow the returned continuation's `owner` (`action` or `gm`) and `choices`, fill any explicit placeholder, then inspect again. One choice may reveal another. Do not assume every AoO pause uses the same command, and do not repeat the initiating move or cast. Long casting's `continue_spell` differs from reaction-paused casting's `gm_continue_spell`.

## Automatic versus adjudicated

| Area | Engine owns | GM supplies or checks |
|---|---|---|
| Creature import | Validated data, derived/imported totals, independent instances | Verified statblock; implicit feats/components already included; no double counting |
| Attacks/actions | Supported action budgets, rolls, damage, configured range/ammo/riders | Tactics, explicit attack metadata, unsupported exceptions |
| Conditions | Listed modifiers/policies and native expiry | `list_conditions` coverage/advisories; partial does not mean fully enforced |
| Spells | Declared save/SR/delivery/effect/resource paths | Actual spell payload, eligibility/descriptors; configured books are required for slot enforcement |
| Generic Pending Events | Event state and declared timer expiry | Prose triggers/consequences; a temporary-immunity reminder is not an automatic save filter |
| Cooldowns | Named reminder and expiry | Respect ability unavailability; no universal ability-use blocker |
| Immediate actions / generic Ready | Supported bookkeeping/timing | Declared ability effects and general trigger decisions |
| Map | Configured cells/features, independent movement/sight/effect/cover properties | Trace uploaded art, verify scale and ambiguous geometry; preset names do not fill all details |
| Elevation | Height/contact/layer annotations, declared terrain transitions and rulings | Full 3D targeting, exceptional reach/AoOs/exposure; not all airborne creatures ignore all areas |
| Time/recovery | Configured deadlines, recurring effects and recovery | Rest eligibility; spell refresh is explicit, never inferred from elapsed time |
| Encounter end | Initiative ending, map-preserving cleanup, named map saves and explicit scene discard | Choose whether to retain this map; closure clears terrain and unused definitions |

For an unfamiliar ability, combine existing tools only for consequences they actually implement. A `save` rolls the save; it does not apply the failed-save consequence. A native spell or ailment with a configured save already rolls that save: do not add another. Tags classify effects; names and arbitrary notes do not install mechanics.

Prone attacks, stand_up/crawl action costs and AoOs are enforced in the complete Kernel. Paralysis/helplessness includes effective abilities and attack defenses; mental actions and other listed exceptions remain adjudicated. Read topic `combat` and actual condition coverage rather than relying on the label.

Daily spell allotments are fixed snapshots. Imported totals usually include ability bonuses. Live ability changes never resize/refill daily capacity; refresh restores use against existing maxima. Component/inventory management and long-term campaign notes belong with the GM or an interchangeable companion tool.

## End an encounter deliberately

`gm_end_initiative` retains the scene/map and roster while processing encounter timing. `gm_preview_scene_close` shows destructive scene cleanup; `gm_close_scene` discards terrain/features, departing actors, unused definitions and old undo/history. Survivor resources and the world clock are not reset as a rest.

For map-preserving cleanup, query `gm_preview_encounter_clear`, then use `gm_clear_encounter` with an explicit keep list (empty removes characters but retains map objects). Named map-only bookmarks use `gm_save_map`, `gm_list_maps`, `gm_load_map` and `gm_delete_map`; read topic `map_library`. Loading requires no non-object characters, idle initiative/casting and confirm:true. Bookmark operations do not replace automatic encounter persistence. World-clock schedules and retained actors’ ongoing effects/resources remain; cleanup is not a rest.

The live player map is http://127.0.0.1:8788/player on the host computer when launched with --http. Read topic `player_view` before revealing cells or moving tokens/features to the map layer. Old and new entries default to the private GM layer. Public labels are explicit; showing a token and applying an invisibility condition are independent. The offline `index.html` remains a separate GM sandbox. Background images are supported: read topic `artwork` and query `gm_get_map_artwork`. When file-processing tools are available, the AI can extract/crop an uploaded image or PDF and import its actual PNG bytes with `gm_set_map_artwork`. Otherwise the human can use the launcher’s Map artwork button. Alignment and redactions use the same command. Never invent image bytes or assume hiding a feature erases something printed in the artwork. Remote sharing and Roll20 integration remain outside the tool.

Keep map setup sparse: ordinary open squares need no authored features. Let artwork supply appearance, group mechanically relevant cells/boundaries with supported batch commands, and keep duplicate traces on the GM layer. Do not repaint or individually inspect hundreds of empty squares. Fog controls disclosure separately from terrain mechanics. Read `workflows` for the map setup sequence and targeted verification.

Read `workflows` for concrete sequences. `AI_GM_HANDOFF.md` and `ARCHITECTURE.md` provide deeper implementation context. Historical guides provide detailed payloads but their old roadmaps/coverage statements are superseded by current contracts. Unsupported work should be stated plainly, not disguised as a successful generic operation.

When publishing a player-controlled token, set `display.showVitals:true` through `gm_set_player_display` (or `playerDisplay.showVitals:true` at spawn). Existing saves do not enable it automatically. Clicking its visible footprint shows live HP and tracked conditions in the bottom bar. Keep this off for private enemy stats; all viewers share the same published data. Read `player_view` for the exact fields and limits.

During play, check reveals after movement, its interrupt/continuation, or other visibility-changing events before asking for the next player action. Movement does not clear fog. Reveal only surroundings the GM judges visible from the actual reached position, and check the full footprint of intended public tokens. Do not wait for the player to request the reveal; keep hidden occupants/traps separate. Read `player_view` for the workflow.

A blank player view may be deliberate fog. Check `kernel_status.map.playerVisibility` or `gm_get_player_visibility`, then `gm_preview_player_view`. Reveal intended cells AND publish intended feature/token IDs; do not reveal all secrets merely to troubleshoot a blank page.
