# Desktop package notice

For installation, map links and runtime behavior, read DESKTOP.md. Older installation instructions below describe the private tunnel edition.

# Pathfinder 1e Assistant — V3.51 map resolution and alignment

**Map artwork:** original-resolution import and masked player display, plus two-point printed-grid calibration. See [MAP_ARTWORK_V3_47.md](MAP_ARTWORK_V3_47.md) for current limits and examples. Existing scenes and bookmarks remain compatible.

**Map setup order:** import the background, calibrate its printed grid, and check a third intersection before tracing walls, doors, terrain, hazards or placing encounter tokens. Once the artwork is aligned, build the mechanical features against that alignment. Later background adjustments do not move existing features or tokens; review any affected boundaries separately.

**Swarms and troops:** native defenses, shared occupancy, configured automatic damage and troop AoOs now reuse the existing combat engine. Read [COLLECTIVES_V3_50.md](COLLECTIVES_V3_50.md) before importing or operating one; component size is separate from footprint, and irregular formations remain GM-adjudicated.

**First installation:** read [SETUP.md](SETUP.md), available before the calculator connects. It covers WSL, the local installer, credentials, tunnel connection, a new empty encounter and verification. The website plugin bundles a setup skill plus the local installer ZIP.

**Player HP:** click a published player token’s square to inspect current/max HP and tracked conditions in the bottom bar. The GM enables `showVitals:true` for intended player tokens; enemy statistics remain private by default. Existing saves require this explicit opt-in. See [PLAYER_VIEW_V3_43.md](PLAYER_VIEW_V3_43.md).

**Player coordinates:** A1-style rulers and hover/click readout are implemented in the live viewer. Read [MAP_COORDINATES_V3_48.md](MAP_COORDINATES_V3_48.md); engine commands retain numeric X/Y.

**Windows + Ubuntu launcher:** extract the whole ZIP and run `bash launcher/install-ubuntu.sh` from Ubuntu in the extracted folder. The installer opens a small graphical launcher and creates **Pathfinder Assistant** shortcuts on the Windows Desktop and Start menu directly (with an Ubuntu menu entry as a fallback). Read [START_HERE_WINDOWS.txt](START_HERE_WINDOWS.txt) and [UBUNTU_LAUNCHER_V3_48.md](UBUNTU_LAUNCHER_V3_48.md) for the exact first-run steps. Existing Windows encounter saves are reused; API secrets remain session-only. Stop the old manual server/tunnel before clicking Start. This package runs engine **3.51.0** and accepts existing 3.43 and 3.46 encounter saves. The shortcut follows the installed release across updates.

**Map saves and cleanup:** named map-only Save/Load and map-preserving encounter cleanup are implemented. Read [MAP_LIBRARY_V3_46.md](MAP_LIBRARY_V3_46.md), or `kernel_reference` topic `map_library`. Player-visibility diagnostics explain covered maps without publishing hidden content.

**Live player map:** with `node mcp_server.mjs --http` running, open **http://127.0.0.1:8788/player** in Firefox on that computer. The page updates from the MCP encounter and contains no GM tools. It starts hidden until the AI configures reveals and public tokens. Read [PLAYER_VIEW_V3_43.md](PLAYER_VIEW_V3_43.md). Background artwork now supports local PNG/JPEG/WebP import, grid alignment, printed-secret covers and server-masked fog. Click **Map artwork** in the Ubuntu launcher and read [MAP_ARTWORK_V3_47.md](MAP_ARTWORK_V3_47.md). Remote sharing remains deferred.

Creature imports: read [CREATURE_IMPORT_V3_42.md](CREATURE_IMPORT_V3_42.md), also served by `kernel_reference` topic `registry`. Errors now identify invalid field paths and distinguish missing ammunition stores from incorrect attack modes.


**AI connection:** [INTEGRATION_V3_37.md](INTEGRATION_V3_37.md) covers the runnable MCP server, private local/HTTP setup, tool workflow and saved encounters. The included server connects through your configured MCP client. The standalone HTML is a separate sandbox.

A local Pathfinder 1e mechanics workbench. The GM supplies decisions and verified rule inputs; the kernel validates supported actions, performs the math, and owns encounter state. V3.40 adds common combat options, automatic planar flanking, improved prone/helpless handling, source-specific immunity helpers and consistent attack targeting. Start with [AI_START_HERE.md](AI_START_HERE.md), then [AI_WORKFLOWS.md](AI_WORKFLOWS.md). V3.41 expands subtype recognition and exposes classification-versus-automation coverage; see [SUBTYPES_V3_41.md](SUBTYPES_V3_41.md). See [RELEASE_V3_51.md](RELEASE_V3_51.md) for changes and upgrade instructions.

Extract the archive and open **`index.html`**. It is a complete offline workbench; no server or network is needed. `tests.html` exposes the historical scenario gallery. `demo.html` is the original limited demonstration, not the current engine.

For operating examples, use the starting guide and workflows above. For deeper developer context, read **[AI_GM_HANDOFF.md](AI_GM_HANDOFF.md)**, then **[ARCHITECTURE.md](ARCHITECTURE.md)** and **[COMMAND_REFERENCE.md](COMMAND_REFERENCE.md)**. These are the current orientation documents. Older handoffs and test reports are retained under `docs/history/` and do not define the current scope.

For JavaScript integration, import `Kernel` from `kernel.mjs` and call `dispatch(command, role)`. `Kernel` is an alias of the complete `MagicGame`, not another engine. Use `inspect()` for a controller view and `exportState()` for serializable encounter state. The browser workbench uses the same modules, bundled by `build_demos.py`.

Build with `python3 build_demos.py`. Run `python3 run_regressions.py` for all Node suites, or `python3 run_regressions.py --browser` for Node and browser regressions. Browser tests need Python Playwright and Chromium; `BROWSER_EXECUTABLE` optionally selects an installed browser. The release report is `TEST_RESULTS_V3_51.txt`; subsequent local runs write `TEST_RESULTS_CURRENT.txt`.

See **[AUDIT_V3_29.md](AUDIT_V3_29.md)** for findings, changes, measured snapshot-copy reductions, and remaining boundaries. Daily spell capacities remain fixed snapshots: live ability changes never resize or refill them. An explicit GM refresh restores expenditure against stored capacity; only explicit book replacement recalculates capacity.

See **[PERSISTENT_AREAS_V3_30.md](PERSISTENT_AREAS_V3_30.md)** for the new payload settings, trigger semantics, dispel targeting and limits. Active regions appear on the grid and in Time & Events.

See **[ENCOUNTER_BASICS_V3_31.md](ENCOUNTER_BASICS_V3_31.md)** for the current HP, recovery, cooldown and object contracts and examples.

See **[SPELL_CONDITIONS_V3_32.md](SPELL_CONDITIONS_V3_32.md)** for the spell condition payload, overlapping sources and GM adjudication boundaries.

See **[CONCENTRATION_V3_33.md](CONCENTRATION_V3_33.md)** for maintained spells, lingering durations and downtime declarations.

See **[MAP_AND_ELEVATION_V3_34.md](MAP_AND_ELEVATION_V3_34.md)** for map lifecycle, elevation, shared occupancy and scene cleanup. Campaign notes and long-term archives belong in a separate companion tool; no specific product is required.

See **[MAP_FEATURES_V3_35.md](MAP_FEATURES_V3_35.md)** for eight-way barriers, general terrain properties, doors, object links, cover, and explicit reversible elevation transitions. Full source and offline workbench are included.

See **[FALLING_V3_36.md](FALLING_V3_36.md)** for explicit fall previews/resolution, landing contact, water/diving, and GM overrides. The MCP integration is described in INTEGRATION_V3_37.md.

## AI GM: keep map setup simple

Use the background artwork for appearance and the calculator for mechanically meaningful geometry. Ordinary open squares already work without authored features: do not inspect and fill every empty square, repaint a bridge plank by plank, or reproduce decorative details with colored tiles. Add walls, doors, cover, movement costs, hazards and elevation only where they affect play.

Group cells with the same properties into a region, trace connected boundaries as paths, and submit related features in supported batches. Keep separate IDs where a door or object must change independently. With background artwork, keep duplicate mechanical traces on the GM layer so they do not obscure the image; publish overlays only when they add useful visible information or represent a scene change. Fog is a separate decision about what players may see, not a way to mark impassable terrain.

Check scale/alignment, important boundaries and the player preview, then refine uncertain details when relevant. Avoid exhaustive square-by-square reconstruction or repeated whole-map inspection. See `AI_WORKFLOWS.md` and `MAP_ARTWORK_V3_47.md` for the setup workflow.

## AI GM: what to import, what to adjudicate

The calculator enforces its declared mechanical inputs. It is not a complete creature database, adventure reader or tactical GM. Read `AI_START_HERE.md` and inspect the current command catalog before importing an unfamiliar statblock; a rejected key is not evidence that its underlying mechanic is absent. Use supported names/nested fields from the reference, not a transcription of every printed heading.

| Statblock/adventure information | Responsibility |
|---|---|
| HP, supplied AC/save/attack/skill totals, damage, action resources, configured traits, supported conditions and timers | Import through validated fields. The engine performs supported arithmetic and state changes. Preserve published totals; do not add preincluded feats or ability bonuses again. |
| Creature type and subtypes | Preserve the declared classifications. `list_trait_library` provides IDs and `subtypeCoverage`; newly recognized labels do not automatically grant abilities. See `SUBTYPES_V3_41.md`. |
| Supported combat feats/modes | Explicit combatProfile and attack metadata; see `COMBAT_MECHANICS_V3_40.md`. Ownership and prerequisites are verified by the GM/importer; configured calculations are enforced. |
| Light levels, noticing an encounter, stealth versus observers, what a creature knows, sight/sound-dependent aura exposure | GM adjudication. There is no lighting, perception or awareness simulator. Supply the resulting supported visibility/defense/exposure rulings. |
| Senses and vision types | Preserve them as GM context. The schema supports selected vision fields, and blindsight has limited attack-concealment handling. It does not implement a universal vision model; darkvision/blindsense values do not automatically simulate seeing, detection or targeting. |
| Special abilities and spells not implemented by name | Compose verified saves, damage packets, conditions, resources and timers. Look up the ability as needed. Names alone do not execute its rules. Consult source-specific immunity before repeat exposure. |
| Tactics, morale thresholds, alignment behavior, ecology, description, languages and campaign relationships | GM context/companion notes. The calculator does not choose tactics or parse prose into behavior. |
| Inventories, components, exploration/downtime consequences, long-term NPC history | Managed externally unless a supported encounter resource specifically needs tracking. No exhaustive inventory, crafting, rest or campaign-history simulation. |
| Elevation, higher ground, squeezing and unusual geometry | Use the supported annotations and explicit GM rulings. The engine has no full 3-D solver. Flanking is automatic only where supported planar geometry is sufficient. |
| Rare feat chains, special exceptions, unmodeled condition consequences | Explicitly unsupported or partial, rather than silently approximated. Use a justified GM adjudication and preserve the limitation in notes. |

On import rejection, check the exact error and current schema, then correct the payload. Do not invent missing totals, strip mechanically relevant information without acknowledging it, or replace a real statblock with a convenient approximation. Map unsupported information to an existing generic mechanism where possible; otherwise preserve it in GM notes and identify the manual step. `source` is a bounded provenance note, not an unlimited alternate statblock store. Ordinary actions must still use their normal command instead of GM damage/overrides to bypass a rejected action.
