# Pathfinder 1e Assistant

An encounter calculator and live player map for an AI Game Master. The AI supplies imagination, tactics and adjudication; the calculator tracks supported mechanics, positions, HP, actions, conditions and resources.

**Testing prototype — engine 3.51.0, GitHub package 1.** This is not an approved public ChatGPT plugin or a complete Pathfinder rules database. See [intentional limits](engine/README.md#ai-gm-what-to-import-what-to-adjudicate).

## Start here

For the Windows + Ubuntu route used during development, download **pathfinder-ubuntu-v3.51.0-github.1.zip** from this repository's **Releases** page, extract it, and follow [the setup guide](engine/SETUP.md). Use the attached ZIP, not the automatically generated Source code download. The release includes JavaScript dependencies; the installer downloads pinned Node and tunnel runtimes from their official sources.

Each tester needs their own permitted ChatGPT custom MCP connection, Platform tunnel and runtime secret. The download does not grant these permissions. Keep the launcher running during play. No developer credentials, personal connection mapping, encounter saves or Adventure Path maps are included. Windows x64 with WSL 2, Ubuntu and WSLg is the current launcher target; a fresh independent-account installation remains to be verified.

The separate **pathfinder-desktop-v1.5.0-beta.1-EXPERIMENTAL.zip** is for local stdio MCP host experiments. It requires Node.js 22.12+ on PATH. It does not need Ubuntu or a tunnel, but installation through ChatGPT desktop has not been verified. Do not assume uploading it to ChatGPT on the web starts a local program. Read [desktop testing](docs/DESKTOP_TESTING.md) before using it.

## What you see

The player map shows revealed terrain and published tokens without the GM's tool controls. The separate GM artwork editor supports importing and aligning your own map image. Keep that editor off a player-facing display. Artwork, saves and installed dependencies remain on your computer; supported tool requests and responses travel to the connected AI service. Local storage does not mean the entire workflow is offline. Remote multiplayer is outside this release.

## Report a problem

Use this repository's Issues tab with the download/version, OS, steps, expected behavior and actual result. Redact secrets and personal information. Use a disposable scene for reproduction; do not upload purchased map PDFs or your campaign save. See [testing](docs/TESTING.md) and [data boundaries](docs/DATA_AND_SECURITY.md).

## Source and builds

`engine/` contains the calculator and Ubuntu launcher. `desktop/` contains the desktop package metadata and four runtime overrides; the release builder reuses the engine rather than maintaining another full copy. `scripts/build_release.py` produces both download assets and checksums. See [building](docs/BUILDING.md).

## Licensing status

No project-wide open-source license has been selected. Do not describe this as MIT, Apache, GPL or otherwise open source. See [LICENSE_STATUS.md](LICENSE_STATUS.md). Dependency licenses remain separate and are retained in release downloads. This independent project is not affiliated with or endorsed by Paizo or OpenAI.
