# Pathfinder Assistant — Ubuntu launcher (V3.45 distribution)

This release adds a small Python/Tk window running through WSLg. The calculator,
MCP server, player viewer and encounter format remain version 3.43.0. It uses the
same Linux Node and official OpenAI tunnel runtime that were verified in the
manual Ubuntu connection test. No additional relay provider is involved.

## First installation on Windows

You need working **WSL 2 + Ubuntu with GUI support**. Launching Ubuntu and creating
its username/password must already have succeeded. Windows Subsystem for Linux
and Virtual Machine Platform must be enabled, with their required restart completed.
Keep Smart App Control enabled. This package is currently for x64 Ubuntu.

1. Extract the **whole ZIP** to a folder. Keep the old version as a backup.
2. In each of the two manual Ubuntu windows running the calculator and tunnel,
   press **Ctrl+C**. Stop/close the old Windows launcher too, if it is running.
3. In Ubuntu, run `bash` followed by the path to `launcher/install-ubuntu.sh`.
   For the established example download location:

   ```bash
   bash "/mnt/c/Users/YOUR_WINDOWS_NAME/Downloads/Tabletop_GPT/tabletop_kernel_v3_45_ubuntu_launcher/launcher/install-ubuntu.sh"
   ```

   If you extracted somewhere else, substitute that folder. A Windows C: path
   begins `/mnt/c/` in Ubuntu. Run as your normal Ubuntu user, **without sudo**.
   The installer asks for sudo only if Ubuntu's `python3-tk` window package is
   missing. This is your Ubuntu password, not your OpenAI API secret.
4. The installer opens the new launcher. Check the encounter path in **Files &
   settings**, enter the tunnel ID if it was not imported, and paste your full
   OpenAI **secret key** into the password field. The Tracking ID and masked
   `sk-...` display from the API Keys table cannot authenticate. Click **Start**.
5. Open **Pathfinder Assistant** from Windows Start on subsequent runs. It may
   appear under Ubuntu; you can pin the new running application to the taskbar.
   Remove the old pinned Windows launcher shortcut to avoid confusing them.

The default Windows browser opens the player map; if Firefox is your default,
it opens there. The **Open player map** button opens it again. If Windows browser
launch fails, the diagnostics give the same `http://127.0.0.1:8788/player` address
to open manually. The launcher's own window must remain open during play.

The one-time installer remains in its Ubuntu terminal until you close the newly
opened launcher. Subsequent Start-menu launches use `Terminal=false` and do not
need the two manual command windows. If the Start entry has not appeared yet,
search Windows Start for the full name, or restart Ubuntu after closing the
launcher; do not shut down WSL during an active game.

## What is installed and remembered

The installer copies the complete extracted calculator into a new directory
under `~/.local/share/pathfinder-assistant/releases/`. The source extraction can
then be moved without breaking the Start entry. Updates install a new copy;
previous installed releases are retained and no encounter is deleted or migrated.

Settings live in `~/.config/pathfinder-assistant/settings.json` with mode 0600.
The launcher remembers the tunnel ID, optional organization ID, program locations
and encounter path. It imports non-secret settings from the old Windows launcher
when available, including a custom encounter path. Otherwise it selects the
Windows user's existing `%USERPROFILE%\.tabletop-kernel\encounter.json`. If that
file is missing, Start stops and asks you to choose it. It never silently switches
to a new Linux save. **New empty encounter** explicitly selects an unused filename;
an existing file cannot be overwritten with an empty encounter by that button.

**API keys are session-only in this version.** The field is masked, with an
optional Show checkbox. The key is passed only in the tunnel child's environment,
never in arguments, settings, the calculator process environment, or diagnostics.
There is no unencrypted "Remember key" option and no attempt to decrypt the old
Windows launcher's DPAPI data. Keep the original secret in your password manager
and paste it once when opening the launcher. Stop leaves the masked field available
for restarting during that window's session; closing clears it with the process.

The tested Linux executables in `~/pathfinder-tunnel/` are reused. If absent, the
installer downloads pinned Node 24.22.0 and tunnel runtime 0.0.17 from their official
sources and verifies the published SHA-256 hashes before extraction. Only the
named binaries/licenses are extracted. No API key is used during installation.
Provenance is saved alongside any installed runtimes.

## Running and troubleshooting

- **Start** validates the Linux executables, key shape, save location and local
  ports before starting the calculator, then the tunnel.
- **Reconnect tunnel** replaces only this launcher's tunnel process. It retains
  the calculator, encounter and map. You can edit the key, tunnel ID or organization
  before reconnecting. Changing the encounter or calculator needs Stop/Start.
- **Stop** stops the owned tunnel and asks the calculator to shut down normally,
  releasing its encounter lock. Closing the window performs the same shutdown.
- An unexpected tunnel exit leaves the local map available. An unexpected calculator
  exit stops its tunnel. A Linux parent-death guard terminates owned children if
  the launcher process is killed. No `pkill`, global WSL shutdown, or unrelated
  process termination is used.
- Another running launcher produces an existing-window message. An occupied
  calculator/player port produces instructions to stop the manual process.
- **401**: enter the full secret key, not the Tracking ID or masked display. Check
  its organization if it still fails. **403**: check the organization and Tunnels
  Read + Use permissions. Correct the field and press Reconnect tunnel.
- A "Tunnel registered" status reports an observed runtime log. It is **not**
  proof that a ChatGPT tool call succeeded; perform a read-only `kernel_status`
  check from the connected chat to confirm the complete path.
- Troubleshooting output is bounded and redacted before it enters the window.
  The Copy button copies those redacted diagnostics. Full raw HTTP logging is
  deliberately unavailable.

## Limits and verification

The existing player view remains local to this PC. This release adds no original
map artwork, remote player sharing, map library, mechanics changes, automatic
updater or public plugin listing. The old Windows `.exe` is not used or bundled;
its C# source and historical release notes remain for reference.

Linux integration tests exercise the real calculator and player servers with
temporary saves and a synthetic, non-network tunnel fixture. They cover reconnect,
401 recovery, graceful shutdown/restart, malformed-save preservation, duplicate
writers, occupied ports, settings migration, secret isolation, and parent-death
cleanup. GUI tests exercise actual Tk widgets on a virtual Linux display. See
`TEST_RESULTS_LAUNCHER_V3_45.txt` for results and unverified platform boundaries.

Actual Windows WSLg presentation, Start-menu indexing/taskbar pinning, default
browser launching and authenticated connectivity through this **new GUI** must
still be checked on the Windows PC. The manual Ubuntu/Firefox/OpenAI connection
was successfully verified before this release. No live user encounter is modified
by the release tests.

References:
- https://learn.microsoft.com/en-us/windows/wsl/tutorials/gui-apps
- https://learn.microsoft.com/en-us/windows/wsl/filesystems
- https://learn.microsoft.com/en-us/windows/wsl/networking
- https://github.com/openai/tunnel-client/releases/tag/v0.0.17
- https://nodejs.org/dist/v24.22.0/SHASUMS256.txt

Developer entry point: `python3 launcher/ubuntu_launcher.py` after installation.
Run the portable suite with `python3 launcher/test_ubuntu_launcher.py` (Linux, Node).
The GUI suite additionally requires a display and Tk. No extra Python packages
are required by the launcher.
