> Historical audit of V3.29. V3.30 implements the fixed persistent-area work listed here as future scope. Use the current handoff and PERSISTENT_AREAS_V3_30.md for present coverage.

# Foundation audit — V3.29

Audited against the intended division of work: the AI GM selects actions, supplies verified rules and adjudicates exceptions; the calculator owns supported mechanical state, arithmetic and legal-action enforcement. This release repairs and consolidates existing foundations rather than adding the next magic feature or rebuilding the project.

## Findings and changes

| Finding | Correction | Verification |
|---|---|---|
| The full dispatcher, specialized dispatchers and event handlers repeatedly copied the same encounter for rollback | One synchronous `Game.transaction`; nested owners join it, with whole-operation rollback including RNG and undo checkpoints | Nested failures, caught-inner-error abort, snapshot-copy count |
| Core and automation maintained separate movement loops | Core owns continuation; automation supplies the entered-square hook | Existing movement/AoO suites plus nonlethal incapacitation during an AoO |
| Suspended movement checked HP but could continue while unconscious from nonlethal damage | Resume checks current movement/action policies; queued movement/ranged reactors are revalidated | Mover stays in its departure square and the pending move clears |
| Normal/deferred turn-start mechanics were copied across several layers; clock callbacks observed the old world time | One `beginTurnEffects`/`finishTurnStart` chain, with clock/deadline processing before new-turn effects | Updated clock in callbacks, deferred ticks exactly once, checkpoint HP, same-time decisions |
| A scheduled world-time decision could appear after automatic turn effects, without consistently blocking new gameplay | Due time events defer the turn; acknowledgements resume through the shared path | Engine and workbench scenarios |
| Checkpoint allowlists blocked useful lifecycle/library queries | One exact read-only command classification; queries remain pure and available | Controller/lifecycle inspection during world-time and initiative decisions |
| Effect-removal wrappers dropped `countAsAction:false` | Forward options through condition/maneuver layers; automatic expiry preserves intent | Activity/undo regression |
| Some manual state adjustments did not mark the current turn for undo | Successful public mutations mark activity when they have not established a new checkpoint; read-only/time-only operations retain their intended behavior | Healing undo, historical resource/initiative/counterspell suites |
| General/specific skill pools and attack/CMB or AC/CMD pools stacked independently | Stack contributing live modifiers together | Same-type bonuses use the correct shared result |
| Ability checks had duplicated roll implementations with different stacking behavior | Core rolls once using an overridable bonus calculation; condition/negative-level layers only contribute their adjustments | Condition layer and complete kernel agree |
| Ranged/Tiny-CMB ability substitution replaced score modifiers but retained the wrong ability-damage penalty | Swap the governing damage dependency as well | STR/DEX damage combinations; authoritative imported totals preserved |
| Derived mental spell DCs omitted ability-damage penalties | Apply mental damage to the declared spell-DC formula; fixed DCs stay fixed | Derived versus fixed DC regression |
| Offhand/multiplied-Strength formulas scaled a negative modifier as though it were a positive bonus | Shared pure Strength contribution helper preserves the full penalty | Actual attacks with derived/imported plans, positive-case historical tests |
| Rolled GM healing changed HP directly and skipped the existing nonlethal-healing path | Shared HP healing for rolled/direct/spell healing, with native nonlethal extension | Equal lethal/nonlethal outcomes; existing healing tests |
| Spawn entry effects ran before type/subtype protections were attached | Registry initialization hooks attach traits before placement/entry processing | Newly spawned devil resists the fire zone immediately |
| Spawned summons received their timer after entry effects, so immediate defeat could reject and undo the spawn | Register native summon lifecycle before entry effects | Arrival followed by defeat/removal, recorded in native event history |
| A surviving frightened condition could retain a removed summon's source ID and crash inspection/movement warnings | Detach the source while preserving the surviving condition | Dismissal followed by condition query/controller view |
| Attack and spell geometry duplicated the same ray/tile intersection routine | Shared pure primitive in `spell_geometry.mjs` | Existing wall and spell-area regressions |
| Architecture/handoff files described old proposals or contradicted later features | Current stable entry point, owner map, command map and handoff; historical docs explicitly labeled and grouped | Documentation links and complete JSON command examples checked |
| Capability/UI text still claimed implemented mechanics were absent | Correct armor/material, ammunition and critical-resolution descriptions | Source review and rebuilt browser suites |

## Efficiency evidence

In the default complete-engine fixture, instrumenting full encounter serialization during `use_action` counted **9 copies in V3.28 and 3 in V3.29**. The three are the populated rollback states; the previous-turn checkpoint is null in this fixture. `gm_get_lifecycle` fell from **6 full encounter copies to 0**. The regression checks this specific boundary. These are copy counts, not a claim of a threefold overall speedup.

No speculative indexes or long-lived statistic caches were added. No separate summon timer, slot store, held-charge registry, Ready queue or second turn-start implementation was introduced. Attack-specific continuation records remain with their owners because they represent different pending work.

## Verification

`python3 build_demos.py` rebuilt the offline pages from source. `python3 run_regressions.py --browser` runs the complete existing suite plus this release's coverage. The final captured output is **`TEST_RESULTS_V3_29.txt`**: **69/69 suites**, comprising 37 Node suites and 32 browser suites.

`architecture_audit_tests.mjs` adds **22 integration/regression groups**. `test_browser_v3_29.py` adds two workbench scenarios covering world-time/initiative checkpoints, inspection, blocked gameplay and a single resumed turn start. Existing casting, counterspell, slot, summon, undo, movement, maneuver and offline-workbench suites remain intact.

The initial 21 audit groups were also applied to V3.28: 20 did not satisfy the new assertions and one rollback-preservation case passed. This is not a count of 20 independent bugs: some cases cover the same boundary, and two assert the new shared-transaction/performance contract. The final additional group covers negative Strength damage scaling. The comparison confirms that the assertions distinguish previous behavior from the corrected release rather than merely exercising new code.

The current command guide's three complete JSON examples were executed successfully through the stable `Kernel` entry point. Historical documents are preserved for provenance, with a current-guide banner, rather than presented as competing current instructions.

## Boundaries retained deliberately

The complete engine still uses a long inheritance chain. This audit maps it and reduces duplicate resolution paths without replacing it wholesale. There is no evidence here that moving everything into a new framework would improve the user's workflow enough to justify that risk.

Imported printed totals remain opaque snapshots. Live modifiers can be stacked consistently, but hidden base bonus components cannot be reconstructed from a single published number. Explicit ability links and informed importer/GM adjustments remain necessary. Spell payloads likewise remain GM-authored; a valid schema cannot certify spellbook accuracy.

Daily spell capacity is unchanged by live ability scores and elapsed time. Explicit refresh/restoration can restore expenditure; explicit setup replacement can recalculate maxima. The existing resource suite still verifies this separation. Unconfigured legacy casters remain untracked until a book is configured.

Several mechanics remain deliberately limited or advisory: full dying/stabilization, some ability-loss incapacitation consequences, unusual weapon/class exceptions, unsupported maneuver geometry, arbitrary nested interrupts, detailed source/stacking interactions hidden inside imports, full spell/class/feat rules and three-dimensional geometry. A GM must resolve unsupported consequences explicitly; passing tests is not a certification of complete PF1e rules coverage.

Maintained concentration after a spell resolves, applying native conditions through spell payloads, and independent persistent area effects remain future magic work. Summon dispel targeting, antimagic/suppression, possession/body ownership and AP/AI/VTT integration were not added. Creature components and player inventory bookkeeping remain outside the agreed GM-calculator scope.

## Rules checked for the corrected arithmetic

The primary [PF1e ability-damage rules](https://www.aonprd.com/Rules.aspx?ID=414) were checked for STR/DEX-dependent statistics, Tiny CMB and mental spell DC penalties. The primary [PF1e combat rules](https://legacy.aonprd.com/coreRuleBook/COMBAT.html) were checked for nonlethal healing and for full negative Strength penalties on offhand/two-handed damage. These checks support the narrow arithmetic corrections; they do not expand the engine's declared coverage.
