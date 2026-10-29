# Experimental desktop edition

This is an experimental local MCP package, not a verified one-click ChatGPT installation. Review `desktop/PREPARATION.md`; marketplace submission and eligibility are separate work. Do not install it over the developer's working private plugin.

Extract the desktop release ZIP and install Node.js 22.12 or newer. A compatible MCP host can launch `node` with the absolute path to `runtime/desktop_server.mjs` and working directory `runtime/`. The portable plugin uses `${PLUGIN_ROOT}`; a host that does not expand that variable needs actual absolute paths. Configure it only through the host's supported local MCP settings; no universal ChatGPT import menu is assumed here.

The host owns the stdin/stdout connection and process lifetime. Double-clicking a JavaScript file or opening the ZIP on the web is not a test. The AI should call `kernel_status` and use its `desktopViews` links; ports are assigned dynamically.

For an isolated test, set `TABLETOP_DESKTOP_STATE_PATH` in the host's child-process environment to a new absolute filename outside the checkout. The default is `~/.pathfinder-assistant-desktop/encounter.json`. Do not share a save between two running processes. See the bundled `runtime/DESKTOP.md` for persistence and viewer behavior.

Check tool discovery, a new empty encounter, player view, GM artwork import/alignment, save/restart, and listener shutdown. Automated SDK tests are useful but do not establish that ChatGPT desktop installs this package successfully.
