> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# V3.13 changes

- Executable critical threats and confirmation in normal weapon attacks, charge and AoOs through the shared attack resolver. Expanded threat ranges (Keen or Improved Critical, nonstacking); broken/improvised 20/x2; x2–x5 multipliers.
- Weapon damage is rerolled and usual static modifiers reapplied on a confirmed critical. Optional nonmultiplying elemental/force/other additional damage dice and GM-qualified precision dice are tracked distinctly.
- Fortification percentages may come from a creature protection, a worn armor item, or an innate critical/precision negation ability. Same hit uses a shared d% roll and prevents only the appropriate extra damage.
- Existing traits `critical` and `precision` immunity are now executable in the attack pipeline. Precision shares the attack's damage type and one DR deduction.
- GM effect packets can supply precision dice on an existing typed component (including spells), preserving energy resistance or weapon DR once per component/hit.
- Interactive workbench: imported critical/precision example, GM-verifiable precision checkbox, and weapon inspector showing active critical profile.
- Prior deterministic attack fixtures with natural 20s now include their mandatory confirmation roll. All historical tests retained.
- Added `critical_rules.mjs`, `critical.mjs`, `critical_precision_tests.mjs`, `test_browser_v3_13.py`, and this documentation.
