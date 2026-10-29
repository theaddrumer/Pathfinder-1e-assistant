> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# AI GM / Tabletop Kernel — V3.8 Handoff (October 14, 2026)

## Long-term mission

Construct a PF1e deterministic rules-and-state engine operated by a creative AI GM. In the ultimate workflow players upload an Adventure Path and their characters, the AI imports/retrieves needed rules and creatures, runs the narrative/encounters and controls NPCs; the engine handles validated mechanical consequences and persists state. **Never turn the engine into a second tactical GM.** The user knows PF1e well but is not a programmer. Explain rules implications concretely and get user adjudication only when truly needed. Legacy fixture encounters are regression tools and should remain separate from the main workbench.

## Current files

Complete source, tests, standalone demos in `tabletop_kernel_v3_8_effect_packets.zip`. Open `index.html` (editable GM workbench) or `tests.html` (old Choker/Archon/Black Pudding/etc.). Standalone `tabletop_kernel_v3_8_demo.html` is also exported. `trait_library.mjs` owns damage, alignment, DR and subtype vocabulary; `foundations.mjs` owns defense, DC and new packet resolution; `registry.mjs` supports dynamic monster import; `automation-demo-ui.js` wires the main test UI. Build by `python build_demos.py`. See `EFFECT_PACKETS_V3_8.md` for commands and current limitations; older documents are historical references.

## V3.8 additions

1. Canonical damage classes: bludgeoning, piercing, slashing, acid, cold, electricity, fire, sonic, force, untyped, divine, holy, unholy, good, evil, lawful, chaotic. No universal alignment immunities or multipliers: those must be sourced from the specific effect. `magic` and `epic` are bypass properties, NOT damage classes. Both browser dropdowns now use one engine-owned list.
2. GM-only `gm_resolve_packet` takes `target`, optional `source`, `cause`, `metadata`, and `components:[{damageType,amount}]` or bounded `dice`. Each portion resolves immunity and energy resistance separately. Physical DR is applied once to one weapon hit. Source-specific alignment factors can be expressed explicitly (`alignmentMultipliers`, `defaultMultiplier`). Emits one `damage_before` event and is atomic on invalid data. Returns a detailed component breakdown. Useful demos: Flame Strike fire/divine, Hellfire Ray fire/unholy (no automatic Evil immunity), environmental Hellfire with authored Evil immunity and Good vulnerability.
3. Subtype offensive DR-bypass alignment is inherited by natural and wielded weapon attacks. Added Good, Evil, Lawful and Chaotic subtype definitions; Devil grants Lawful+Evil, Demon grants Chaotic+Evil. An actual Evil outsider with no subtype does not gain aligned-weapon DR bypass. No extra damage without separate weapon property. Import optional actual alignment separately (`alignment:"NE"`, etc.). Conflicting actual and subtype alignments need GM decision when packet multipliers disagree.
4. Metadata can carry +N enhancement and equivalent bonus; threshold shortcuts for +3/+4/+5 versus selected DR tags, and Epic inferred at +6 effective equivalence. Magic weapons against incorporeal targets count as magical by +1 enhancement.

## Coverage/verification

18 new named packet tests plus an extra ordinary attack integration assertion; previous 198 named suites remain. Browser V3.8 plus old eight acceptance/regression suites passed. Tests check stacking/bypass, alignment-specific source effects, atomic errors, dice, and non-GM permission rejection.

## Limitations and next steps

Current subtype/type inheritance remains selective. Full spell resistance, vulnerabilities, regeneration, complete incorporeality, hardness, all monster rules, attack riders/automatic poisons, full nested interrupts, creature-source ingestion and Adventure Path import remain future work. Generic packets currently need the GM to provide pre-split amounts or independently rolled portions; they do not automatically distribute a shared dice roll among components. The packet trigger's `damageType` becomes `mixed` for multiple components, so legacy specific-type automation subscriptions may not match without explicit future work. No tactical NPC AI is embedded.

Suggested next step: cautiously expand effect packets with per-target save rules, area geometry and rider delivery, then add remaining defensive mechanics from real encounter fixtures. Preserve explicit partial/advisory coverage instead of assuming complete rules.
