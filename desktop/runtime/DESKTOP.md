# Desktop edition — preparation draft

This edition uses a local stdio MCP process launched by the ChatGPT desktop app.
It does not use a tunnel, OpenAI API key, Ubuntu launcher, or public server.
Node.js 22.12 or newer must already be installed and available as `node`.
The Node runtime is not bundled. Automatic runtime provisioning is not claimed.

## Player map and GM artwork controls

Call kernel_status. Its desktopViews contains playerMapUrl, mapArtworkUrl and
controlPanelUrl. Give the user clickable links using the returned addresses.
These addresses use automatically selected local ports and change on restart;
do not hard-code the old 8787/8788 addresses or assume another server owns them.
The control panel has links for the player map and GM map artwork editor.
The existing image picker, alignment, resolution controls and redactions remain.
The editor can show unrevealed map details: it is a GM view, not a player view.
Only the player map applies the player visibility mask.
The GM and player pages and MCP tools share one adapter and one encounter save.
The editor listener does not expose an HTTP MCP endpoint.

Import artwork, align its printed grid, then trace only necessary mechanics.
Check a third grid intersection before adding features or tokens.
Keep ordinary open squares implicit. Revealing terrain and revealing GM-layer
tokens are separate actions; update the player view when appropriate.

## Saves and shutdown

The default save is ~/.pathfinder-assistant-desktop/encounter.json. It is separate
from the Ubuntu installation. TABLETOP_DESKTOP_STATE_PATH can select a test save.
Never point both editions at one save simultaneously. The normal single-writer
lock, atomic saves, retries and session validation remain in force.
No AP maps, imported creatures or personal encounter saves are distributed.
Closing the desktop MCP connection closes its local viewer listeners. Reconnect
and get fresh links from kernel_status when resuming.

## AI operation

Read kernel_reference topic=start, then topic=readme for the intentional limits.
For this edition, this desktop guide supersedes older Ubuntu/tunnel installation
instructions in historical engine documents. Never ask a desktop user for an
OpenAI API key or tunnel ID. Do not reset an existing scene on a new conversation.
Use normal actions for gameplay, GM operations only for setup or explicit
adjudication, and resume offered continuations without repeating paid actions.

## Verification status

Official SDK stdio tests verify tools, shared editor state, real PNG upload and
pixel preservation, local access checks, persistence, restart, durable retries,
and closing viewer listeners. Existing transport and integration tests pass.
Actual installation through ChatGPT desktop, Windows startup/PATH/security policy,
image-picker interaction and public submission eligibility remain unverified.
This draft is not approved or ready for public submission.
