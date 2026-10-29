# V3.40 — Common combat mechanics and explicit AI scope

This release adds reusable combat calculations while preserving the existing action, damage, interruption, modifier and Pending Event systems. It does not add a second scheduler or a creature-specific ability library.

## Changes

- Automatic planar flanking, its attack bonus, and eligibility for configured precision dice. Threat, reach, walls, incapacitation and large footprints are checked per strike. Relevant elevation annotations defer the geometry to the GM; explicit rulings remain available.
- Verified combat profiles for Power Attack, Deadly Aim, Piranha Strike, Combat Expertise, Rapid Shot, Point-Blank Shot, the Vital Strike chain, Furious Focus and Critical Focus. Fighting defensively and total defense use native modifiers and deadlines. Importers must verify feat ownership and supply totals that do not already contain the automated adjustments.
- Stand-up and crawl actions with native AoO pauses, continuation and single action expenditure. Ordinary movement while prone rejects. Helpless/paralyzed defenses and effective ability scores now have expanded native coverage without overwriting imported base statistics.
- Consistent same-faction targeting across normal attacks, full attacks and charges; faction still affects automatic threat relationships.
- Source-specific temporary immunity backed by existing timed records. Identified saves and condition applications can skip immune targets without rolling; other generalized ability paths use the documented preflight check.
- Browser controls for combat profiles, options, inspection, standing, crawling and total defense. The AI catalog includes the new commands, a combat reference topic and executable examples.
- README guidance explicitly separates enforced mechanics, partial support and deliberate GM responsibilities. It covers lighting/awareness, senses, inventories, prose abilities, tactics, elevation and importing unsupported statblock information without silently losing it.

Read **COMBAT_MECHANICS_V3_40.md** for payloads, exact behavior, prerequisites and limitations. **AI_START_HERE.md** and **AI_WORKFLOWS.md** remain the operating entry points.

## Boundaries and follow-up

This is not complete PF1e feat or condition automation. Manyshot, purely mental actions while paralyzed, coup de grace, exceptional movement and unusual feat interactions remain explicit adjudications. Source immunity requires stable source/ability identifiers; an unidentified save or arbitrary GM damage is not automatically linked to it. No complete lighting, awareness, inventory, build validator or 3-D simulator was added.

Map-preserving cleanup, named map storage and the hybrid player-facing map/hidden overlay work remain separate follow-up work. No live encounter is changed by this archive.

## Upgrade

Use the same server/tunnel setup. Stop the Node server and retain a backup of the saved encounter (`%USERPROFILE%\.tabletop-kernel\encounter.json` by default, or the configured `TABLETOP_STATE_PATH`). Extract this archive into a new folder and run `node mcp_server.mjs --http` there with your existing environment settings. Dependencies are included. The existing port 8787 tunnel can be reused.

V3.40 accepts 3.37.0, 3.38.0, 3.39.0 and 3.40.0 session headers. The next accepted mutation writes a 3.40.0 header; downgrading requires the pre-upgrade backup. Existing retry receipts may retain their original versioned responses. Verify the running version with a fresh status request.

## Validation

All **49 Node suites** passed. The new combat suite contains **21 focused test groups**, including interrupted Rapid Shot/Vital Strike, ammunition, timer expiry, rollback, undo and prior-save compatibility. The catalog suite executes **58 command examples** through the integration boundary.

Four selected headless Chromium browser suites passed: V3.40 combat controls/standing/friendly targeting, V3.38 dice/prone checks, V3.13 critical/precision controls and V3.5 general workbench/gallery checks. These are targeted regression checks, not exhaustive browser or PF1e coverage. See **TEST_RESULTS_V3_40.txt** for the recorded results.
