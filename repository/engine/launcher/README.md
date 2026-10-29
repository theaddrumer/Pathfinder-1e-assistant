V3.47 adds a **Map artwork** button opening the local GM editor on the engine port. Its importer and masked player raster use bundled JavaScript; no additional Windows executable is installed.

# Current launcher: Ubuntu / WSLg (V3.46)

Use `install-ubuntu.sh`, `ubuntu_launcher.py` and `ubuntu_core.py`. Read
[UBUNTU_LAUNCHER_V3_47.md](../UBUNTU_LAUNCHER_V3_47.md) for setup and lifecycle.
`process_guard.py` owns child termination on parent death; `install_ubuntu.py`
installs a private copy and Start-menu entry. The Node `launcher_host.mjs` lifecycle
wrapper is reused unchanged. The C# files below are historical source only; no
Windows executable is included in this distribution.

---

# Windows launcher 1.0 (distribution V3.44)

`Tabletop Launcher.exe` is a native C# WinForms x64 .NET Framework application.
The existing MCP tool envelopes and encounter save format
are unchanged. Distribution V3.44 adds a launcher, not a new rules-engine version.
Start with `../START_HERE_WINDOWS.txt` for normal use.

## Ownership and persistence

The UI launches bundled `runtime/node.exe launcher/launcher_host.mjs`. That
wrapper calls the existing `main(['--http'])`. A ready marker is emitted only
after both HTTP listeners are established. A private stdin `shutdown` message
or stdin EOF invokes the engine's existing shutdown handler. A bounded deadline
provides recovery from connections that do not close. There is no new network
administration endpoint. Every accepted mutation still uses the original atomic
session store and lock.

The tunnel is launched only after the calculator is ready. Both children are
hidden, directly executed without a command shell, and assigned to one Windows
kill-on-close job owned by this launcher run. Startup failures roll back owned
children. Stop terminates the tunnel first, then asks the calculator to drain and
close normally; the job is the final process cleanup. The launcher does not attach
to, kill, or adopt manually started instances. A named mutex prevents duplicate
launcher windows. The server's own exclusive lock remains authoritative.

Tunnel status distinguishes process startup, a metadata-registration message,
reported errors, and process exit. It is not an end-to-end ChatGPT health check.
There is no guarantee of network connectivity simply because a process is alive.
OAuth discovery warnings from a non-OAuth local engine are shown as diagnostic
messages, not treated alone as proof the tunnel failed. Raw message storage is
bounded and in memory. Credentials are redacted before logs reach the UI.

## Credentials and settings

Settings are atomically replaced in `%LOCALAPPDATA%/TabletopKernel/Launcher`.
Only the API-key field is encrypted, using `ProtectedData` with CurrentUser DPAPI.
Session-only mode never writes the key; forgetting it replaces the persisted field
with an empty string and clears the textbox. This is local deletion, not provider
revocation. Windows accounts able to run code as the same user can decrypt DPAPI
data; the launcher makes no stronger promise. Keys necessarily exist in process
memory while used. They are passed only to the tunnel's environment, not argv.

Inherited TABLETOP, NODE, CONTROL_PLANE, MCP, HARPOON, HEALTH, LOG and
TUNNEL_CLIENT configuration, OPENAI_API_KEY and CA_BUNDLE are cleared before
launching either child. The GUI supplies the supported configuration explicitly.
Ordinary system proxy environment remains available. Custom mTLS, CA bundles,
advanced routing and authentication headers remain command-line-only configurations
in this first launcher. The optional organization ID is supported. There are no
workspace/user-ID fields because the supplied runtime CLI does not require them.

The existing `%USERPROFILE%/.tabletop-kernel/encounter.json` is the default; a custom
save may be selected. Save files are never migrated or cleared by the launcher.
Selected saves are loaded/written by the original engine. No live user encounter
was accessed during development.

## Rebuilding

Full source is included: `LauncherCore.cs`, `LauncherForm.cs`, `app.manifest`,
`launcher_host.mjs`. Build from the package root with Mono 6.8+ and its WinForms,
Drawing, Security and Web.Extensions reference assemblies:

```sh
mcs -target:winexe -platform:x64 -optimize+ \
  -win32manifest:launcher/app.manifest \
  -r:System.Windows.Forms -r:System.Drawing -r:System.Security -r:System.Web.Extensions \
  -out:"Tabletop Launcher.exe" launcher/LauncherCore.cs launcher/LauncherForm.cs
```

On Windows a modern Visual Studio C# compiler with .NET Framework 4.8 targeting
assemblies can compile the same source with those references and flags. The legacy
Windows Framework csc may be too old for the source's C# 6 syntax. End users do not
need a compiler or Mono. Keep `Tabletop Launcher.exe.config` beside the executable.

`runtime/PROVENANCE.txt` records the official Node Windows archive and verified
SHA-256. Only node.exe and its LICENSE are bundled. The tunnel executable is not
redistributed; use the official runtime previously downloaded for your account.
No certificates, API credentials, encounter files or tunnel profiles are bundled.

## Validation

`LauncherTests.cs` exercises validation, Windows argument escaping, redaction,
environment isolation, port collisions and settings replacement. Compile it with
LauncherCore.cs as a console executable and System.Security/System.Web.Extensions
references. Windows adds real DPAPI round-trip/forget tests; non-Windows explicitly
skips those assertions. `../launcher_host_tests.mjs` runs real SDK connections,
state mutation/restart, EOF shutdown, duplicate writers, port failure, crash-lock
recovery and malformed-save preservation against disposable temporary saves.

The WinForms window was rendered and inspected under Mono/Xvfb. This does not
validate native Windows rendering, DPAPI or job objects. The delivery report
explicitly distinguishes those outstanding Windows checks from completed checks.
No code-signing certificate or automatic installer/updater is included.

Authoritative platform references:
- https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects
- https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.protecteddata
- https://learn.microsoft.com/en-us/dotnet/api/system.diagnostics.processstartinfo
- https://learn.microsoft.com/en-us/dotnet/framework/install/on-windows-10

V3.46 adds windows_shortcuts.py and launch_installed.py. Desktop/Start shortcuts target the stable installed bootstrap and remember distribution/user; the bootstrap selects the release from settings. Windows shortcut failure is nonfatal and does not alter Windows security settings. Native Windows creation remains a PC verification step.
