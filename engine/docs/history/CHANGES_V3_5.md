> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# V3.5 changes — October 13, 2026

- Added `stats.mjs` as a **shared** stat vocabulary for creature definitions, direct modifiers, and automation validation.
- Extended imported authoritative totals to normal/touch/flat-footed AC and initiative. Supports optional capped Dexterity for AC adjustments and optional shield/deflection/dodge components for calculated legacy defenses.
- Registered creatures must provide all three printed AC totals together; this catches silently fabricated touch/flat-footed totals. Published numbers remain authoritative rather than reconstructing skill ranks or build choices.
- Added standard skill-to-ability dependency updates, optional per-skill overrides, and direct `skill:Name` bonuses/penalties. Unified the skill calculation used by GM checks and controller inspection.
- GM-only `gm_roll`: roll bounded dice with optional damage through existing triggers or capped healing; standalone rolls also supported.
- GM-only `gm_modifier`: apply a typed, persistent or timed arbitrary numeric effect and remove using existing `remove_effect`. `ac_all` explicitly reaches all three AC variants; it is not assumed for an ordinary `ac` modifier.
- GM-authorized explicit attack target defenses; ordinary actor cannot unilaterally attack against touch/flat-footed AC.
- Replaced default fixture selector with a cleaner `index.html` GM workbench. The complete old fixture gallery remains in `tests.html` and `automation-demo.html` for regression/debugging.
- Updated standalone browser UI and added 14 new tests. **115 named Node tests pass** across nine suites; four Chromium smoke scripts pass.

**Not in V3.5:** full PF1 condition rules, skill-rank reconstruction, automatic flat-footed detection, dynamic defense-selection based on attack properties, full damage reduction/resistance/healing exceptions, spells, nested interrupt scheduler, AI/controller API, and adventure ingestion. All are still deliberate future work.
