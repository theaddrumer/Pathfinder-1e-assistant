> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# V3.26 — Counterspells and dispels

Added `ready_counterspell` and GM `gm_resolve_counterspell`, backed by native Ready Pending Events. Casting pauses for declared counterspell opportunities before producing damage, healing, held charges, rays or ongoing effects. Matching spells use the existing Spellcraft check; dispel counters use a caster-level check. Ready supplies action cost, expiry, initiative movement, cancellation and history. Counterspell casting uses the existing concentration/AoO continuation, including a counterspell against another counterspell.

Added `spell.dispel` for targeted creature dispels or a selected tracked effect. Basic dispel rolls once, checks spells from highest caster level downward, and removes at most one. Greater targeted spell removal uses one result and a one-per-four-caster-level success limit. Greater counterspelling adds +4. Both use the original casting's caster level, with no natural-1/20 override; a caster automatically dispels their own eligible spell.

Spell modifiers now retain `spellSource` metadata on their existing effect records. Held charges and rays carry the same source through their existing Pending Event/ranged-action records. Inspection derives the ongoing spell index. There is no duplicate spell-effect registry, reaction queue, timer engine or held-charge store. Dispelling removes the chosen recipient's linked effects and existing deadlines; it preserves other recipients and independently cast overlapping spells.

The workbench adds counterspell controls in Time & Events beside Ready and dispel controls beside spellcasting. Existing casting, touch and ray controls remain. New coverage: 47 engine test groups and five browser scenarios, plus the complete historical regression suite. See `TEST_RESULTS_V3_26.txt` for observed results.

Spell slots/access remain GM-managed. Area dispels, persistent area sources, item suppression, summoned entities, curse-specific greater-dispel exceptions, spontaneous metamagic timing, and general arbitrary nested events are not implemented by these spell-interaction commands. See the current handoff and mechanics notes for exact boundaries.
