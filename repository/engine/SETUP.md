# Pathfinder 1e Assistant — first-time setup (GitHub testing package, engine V3.51)

This guide is available before the calculator connects. The website plugin supplies AI instructions and a connection; your PC runs the calculator, saved encounters, map server and tunnel. Keep the launcher running even when nobody opens the player map. Firefox displays that already-running map.

## Get the complete package

Download **pathfinder-ubuntu-v3.51.0-github.1.zip** from this repository's Releases page. Use that attached asset, not GitHub's automatic Source code ZIP: the source checkout deliberately excludes installed JavaScript dependencies. Extract it into a folder named `pathfinder-ubuntu` for the example below. No website plugin ZIP is required for this route; each tester creates their own private custom MCP connection.

Use Windows **Extract All** on the local ZIP. The extracted folder must contain `launcher`, `node_modules` and `mcp_server.mjs`. Website manifests alone cannot run the calculator. No Adventure Path artwork, encounter, personal settings or secret is shipped.

This launcher supports x64 Windows with WSL 2, Ubuntu and GUI support (WSLg). Other platforms and remote multiplayer are not tested by this release. Before installing, check that your ChatGPT account/workspace allows custom MCP connections and your Platform organization allows tunnels. The package cannot grant those permissions.

## Prepare Windows and Ubuntu once

Skip this section when Ubuntu already works with WSL 2. Open **Windows PowerShell as Administrator**:

```powershell
wsl --install -d Ubuntu
```

Complete the requested reboot, open **Ubuntu** from Start, and create its username/password. Password typing may show no characters. These are Linux credentials, not your OpenAI secret. In Windows PowerShell, `wsl --list --verbose` should list Ubuntu with version 2. An existing WSL installation can be updated with `wsl --update`.

GUI support requires Windows 11 or Windows 10 build 19044+ and WSL 2. For missing features/error `0x80370114`, check **Turn Windows features on or off** for **Windows Subsystem for Linux** and **Virtual Machine Platform**, then reboot. Follow Microsoft's linked guides for virtualization/older installations. Keep Smart App Control enabled; do not use the retired Windows launcher executable.

## Install the calculator

Close an existing launcher before updating; stop old manually started server/tunnel processes too. Keep the encounter JSON. In **Ubuntu**, run `bash` followed by the quoted Linux path to `launcher/install-ubuntu.sh` in the extracted folder. Example:

```bash
bash "/mnt/c/Users/YOUR_WINDOWS_NAME/Downloads/pathfinder-ubuntu/launcher/install-ubuntu.sh"
```

Substitute your actual extraction path, including nested folders. Windows `C:\` becomes `/mnt/c/`. Run as your normal Ubuntu user, **without sudo**. The installer asks for your Ubuntu password only if it needs Tk. It downloads pinned Linux Node/tunnel runtimes from official sources, verifies published hashes, installs the calculator, creates **Pathfinder Assistant** shortcuts and opens the launcher.

If no window opens, inspect the Ubuntu error before retrying. A GUI error concerns WSLg, not your API key. See `UBUNTU_LAUNCHER_V3_48.md` for shortcut recovery. The stable shortcut targets `launch.py`, not a version-specific executable.

## Create your own tunnel and credential

Open [Platform tunnel settings](https://platform.openai.com/settings/organization/tunnels) in the intended organization. Create a tunnel associated with the ChatGPT workspace that will use it. Save its `tunnel_…` ID. Creating/editing needs Tunnels Read + Manage; running/selecting needs Read + Use.

Create a runtime API secret in that organization using [API keys](https://platform.openai.com/api-keys), with the required tunnel access. Keep the full secret in a password manager when created. The Tracking ID and masked `sk-…` text cannot authenticate. Replace a lost secret. Paste it only into the launcher's secret field, never into chat or a package; revoke a secret accidentally shared.

Tunnel ID, API secret, organization ID and workspace ID are separate values. The launcher takes the tunnel ID and secret; its optional organization field takes the Platform organization, not the workspace ID. If access/association fails, consult the official tunnel guide or the relevant administrator.

## Select a save and start

For an update, verify the existing encounter path in **Files & settings** and keep it. Installation reuses settings/saves and never replaces a map with a demonstration.

For a first run with no save, use **New empty encounter…** and choose a new `.json` filename in a folder you control. Start will create that fresh session. This control refuses an existing filename. If a previous save is missing, locate it with the chooser rather than replacing it with an empty encounter.

Enter the tunnel ID and full secret; click **Start**. The launcher starts the calculator and tunnel and opens the player map. Keep the launcher open during play. Secrets last only for that launcher session; paste again after closing. **Reconnect tunnel** retains the local map.

## Connect ChatGPT and verify

With the launcher running, use ChatGPT **Plugins → Add custom MCP server → Tunnel**, select or enter your tunnel ID, and finish connection setup. UI wording can change; use the official guide below. The default local calculator has no separate MCP OAuth login: select the corresponding no-auth option if asked. Its tunnel runtime secret belongs in the launcher. A deliberately configured `TABLETOP_API_TOKEN` is a separate advanced server credential.

Enable the resulting connection in the chat. Ask the AI to call `kernel_status`, report the engine version/current map dimensions, and leave the scene unchanged. This release reports `3.51.0`. A launcher message that the tunnel registered does not prove an AI tool call worked.

Use **Open player map**, or open `http://127.0.0.1:8788/player` in Firefox on that PC. A live blank view can be deliberate fog or an empty encounter. Ask the GM to inspect visibility and reveal only the intended area, not the entire map as a troubleshooting shortcut. Private artwork editor: `http://127.0.0.1:8787/artwork`. MCP endpoint: `http://127.0.0.1:8787/mcp`.

Remote players cannot use your localhost address: their `127.0.0.1` points to their own PC. Remote sharing remains outside this release.

## Routine use, maps and updates

Use the shortcut, paste the secret and press Start. Stop/Close ends the launcher's own processes and preserves the encounter. Back up the encounter JSON while stopped; it includes saved maps and artwork. Use an external notes tool of your choice for campaign history.

An AI with file-processing tools can extract a map from an uploaded PDF and import actual PNG bytes; otherwise use **Map artwork** with a PNG/JPEG/WebP. Alignment, printed-secret review and mechanical tracing remain GM work. See `MAP_ARTWORK_V3_47.md`. Save a named map after setup when it will be revisited or substantially changed.

The viewer uses A1 at the upper-left, continuing through Z to AA. Hover identifies a square, click pins it, Escape clears it. Drag pans, scroll zooms, and Fit map resets the view. These controls never issue game actions. See `MAP_COORDINATES_V3_48.md` for AI conversion to numeric X/Y.

For local updates, stop the launcher and run the new full package's installer. It retains your save and updates the stable shortcut. Website plugin uploads update instructions/connection metadata; they do not patch the PC. Local installation does not upload a website package.

## Troubleshooting

| Symptom | Next check |
| --- | --- |
| 401 Unauthorized | Full secret and correct organization; replace invalid/lost secret, then reconnect. |
| 403 / tunnel missing | Tunnel permissions and target workspace association. |
| Already open / port in use | Close earlier launcher or manual server/tunnel; don't start duplicates. |
| Missing encounter | Locate existing save, or deliberately choose New empty encounter for a first run. |
| Map opens, AI cannot connect | Check tunnel and chat connection; map proves only local server availability. |
| AI connects, map blank | Inspect fog and GM-layer visibility. |
| Old engine version | Stop old process, open stable shortcut, check status again. |
| Ubuntu/GUI error | Complete WSL prerequisites/reboot using Microsoft's guides. |

## Distribution checkpoint

This download runs a local prototype. It does not install an approved public ChatGPT plugin, grant account permissions, or connect to the developer's calculator. Each tester creates their own tunnel-backed connection as described above. Independent-account installation remains a test to perform; report where setup fails rather than assuming every account has access.

After connecting, give the assistant this instruction:

> Use this calculator for Pathfinder 1e encounter mechanics. Call kernel_status first without changing the scene. Read kernel_reference with topic=start, then topic=readme. Use kernel_catalog before unfamiliar commands. Follow ordinary actions and offered continuations; use GM operations for setup and explicit adjudication. Keep hidden map regions and GM-layer tokens private. Never reset a saved encounter merely because this is a new chat.

Secure MCP Tunnel is for private connections and testing, not public plugin-directory distribution. Sharing these source/download files on GitHub does not change that distinction.

## Official references

Connection guidance checked 2026-10-28. The launcher uses a tested pinned runtime; current upstream CLI examples can differ. Use the launcher rather than mixing flags from different runtime releases.

- WSL: https://learn.microsoft.com/en-us/windows/wsl/install
- GUI support: https://learn.microsoft.com/en-us/windows/wsl/tutorials/gui-apps
- Tunnel permissions/connection: https://developers.openai.com/api/docs/guides/secure-mcp-tunnels
- Plugin setup skills: https://developers.openai.com/plugins/build/plugins
- Public submission: https://developers.openai.com/plugins/deploy/submission
