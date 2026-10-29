> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# V3.27 — Daily spell resources

Added a single authoritative `SpellResourcesGame` between `PendingEventsGame` and `MagicGame`. Its `s.spellResources` profiles own prepared copies or spontaneous level-pool expenditure for each caster/book. Inspection derives remaining counts; no counterspell-specific pool or daily timer was added.

Daily allotments are fixed snapshots. Imported totals are used exactly, with no ability bonus added. Derived allotments require an explicit eligible daily ability score and store a visible base/bonus/total breakdown. Live buffs, penalties, damage, drain, permanent score changes, encounter changes, clock advancement and daily refresh never recalculate maxima. Recalculation requires explicit GM setup replacement with a reason and `replace:true`. Only one pool per book may derive ability bonuses; fixed restricted extras use imported totals.

Casting selects a registered resource. Prepared copies expend individually; spontaneous casting spends the selected level/pool. Minimum slot cost can exceed effective spell level, and a lower-level spell may use an explicitly selected higher slot. Cantrips are reusable by default at level 0. Restricted pool access, declared prepared-spell conversions, separate multiclass books and explicitly registered at-will access are supported.

Resource commitment happens at ordinary casting initiation or actual counterspell casting, before concentration/failure resolution. Readying, declining and failed identification spend no slot. Long-cast continuation/completion, ray volleys and held-touch delivery do not spend again. Invalid requests restore actions, resources, RNG and state atomically. GM effect-only spell resolution remains the explicit no-resource override.

Added GM configure/replace, allotment preview, daily refresh, fill-open-slot and restore-one-use commands, plus workbench controls. No rest or automatic refill is inferred. Unconfigured historical fixtures keep their prior definition-based casting behavior; configured casters require valid resource selection.

New validation: 37 engine groups and six browser scenarios, including fixed allotments after ability changes. See `TEST_RESULTS_V3_27.txt` for the complete regression run. Class progression, spell database/import parsing, rest/recent-casting eligibility, finite SLA uses, arcanist-style hybrid preparation and remaining casting restrictions stay explicit follow-ups.
