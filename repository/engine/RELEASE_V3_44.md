# V3.44 Windows distribution

Adds a native Windows launcher around the existing Tabletop Kernel 3.43.0 server.
No rules-engine commands, mechanics, save formats, GM/player visibility boundaries
or player-map behavior change. The engine continues reporting 3.43.0 intentionally.

The launcher provides setup fields, a masked API key with optional Windows DPAPI
storage, Start/Stop, clear process/registration/error states, Open player map,
optional organization and encounter-file settings, and bounded redacted diagnostic
messages. Node 24.22.0 Windows x64 and its license are included. The user selects
their existing official tunnel-client-runtime.exe through a file dialog.

The player map opens in the default browser. Server/tunnel processes run without
console windows, owned by the launcher. Stop requests normal calculator shutdown;
closing or crashing the launcher also closes its Windows process job. Existing
manual servers are detected, never terminated. Existing saves stay outside the
application folder; launcher settings likewise persist between package upgrades.

This is a compiled unsigned Windows executable, not an installer or a code-signed
release. The Linux validation host can compile it, run portable launcher tests,
exercise the real Node wrapper, and inspect WinForms via Mono. Windows DPAPI,
Windows process-job behavior and the user's authenticated tunnel require an actual
Windows end-to-end check. See TEST_RESULTS_LAUNCHER_V3_44.txt.

Start with START_HERE_WINDOWS.txt. Do not run the old command-window processes
and the launcher simultaneously. The unchanged command-line workflow remains
available for advanced configurations. Remote sharing, original-art backgrounds
and automatic updates remain outside this release.
