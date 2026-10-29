# V3.45 Ubuntu/WSLg distribution

Replaces the blocked Windows executable delivery path with a Linux Python/Tk
launcher and WSLg Start-menu entry. The engine/player viewer remain **3.43.0**.

The window starts/stops its own calculator and official Linux tunnel, opens the
player map in the Windows default browser, and reconnects the tunnel independently.
It preserves the existing Windows encounter path, imports non-secret launcher
settings, and keeps the API key session-only. It explicitly explains secret-key
versus Tracking ID entry and rejects Windows .exe files as Linux program choices.

Install with `launcher/install-ubuntu.sh` from Ubuntu after extracting the whole
ZIP. See `UBUNTU_LAUNCHER_V3_45.md` and `START_HERE_WINDOWS.txt`.

No game rules, MCP tool schemas, encounter persistence, player projection, map
rendering or plugin identity changes are included. No website plugin upload is
needed for this distribution update. Existing manually running processes must be
stopped before starting the new launcher, using their own windows with Ctrl+C.

The old unsigned Windows binary and bundled Windows Node binary are omitted from
this distribution. Historical C# source/docs remain; they are not the startup path.
Node/tunnel Linux downloads, when needed, are pinned and checksum verified.

The existing manual Ubuntu route was successfully verified against the saved
30x40 development test encounter before this release. The new GUI's native WSLg/Windows
integration still needs a local acceptance check; Linux tests use disposable saves.
