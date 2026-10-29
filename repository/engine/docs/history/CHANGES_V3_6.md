> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# V3.6 — Standard Conditions & Generic Ailments

Introduced `conditions.mjs` (34 tagged standard conditions), `ailments.mjs` (strict data-only schema and time units), and `condition_ailment_game.mjs` (runtime execution layer extending the V3.5.1 registry). Existing default browser GM workbench adds selectors for applying/removing conditions, importing ailment JSON, exposure, curing, and advancing the ailment clock. Historical fixtures remain in `tests.html` and are still regression tested.

Condition entries separate numeric modifiers and well-defined action restrictions from advisory-only game semantics. Frightened/panicked movement toward a known fear source generates a GM-facing warning but is not blocked. Fatigue escalation and fear severity are normalized. Shaken and Dazed are the only entries presently classified as completely automatic; the other entries document incomplete or contextual mechanics rather than silently claiming them.

Ailment definitions support initial Fort/Ref/Will saves, onset, periodic saves, limited/unlimited frequency, total or consecutive successful-save cure conditions, HP dice damage, cumulative ability damage, condition results, timed expiry, and after-the-fact removal. All defined afflictions are reusable; all applied instances track independent timing and save streaks. Damage does not disappear when an ailment ends. GM manual healing of ability damage is separate.

V3.6 includes a new ability-damage pool (not a rewritten ability score), with dependency-aware recalculation where available. Limited melee contextual defenses for Prone and Flat-footed are now resolved by ordinary attacks. Save/reload and undo tests cover new objects. Runtime injection commands remain GM-authorized only.

Not included: automatic rider delivery from hits; broad attack/save/concealment/caster action scheduler; full immunity/resistance; full poison dose-stacking and alternate Unchained affliction tracks; Con-damage-to-HP dependencies, negative-level tracking, automatic bleed removal by healing, and complete special-condition exceptions.

Reference: PF1e Core Rulebook glossary and affliction rules (https://legacy.aonprd.com/coreRuleBook/glossary.html ; https://aonprd.com/Rules.aspx?ID=417).
