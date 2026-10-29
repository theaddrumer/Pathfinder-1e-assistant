> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# V3.14 — Offensive rider integration

- Executable, reusable **Trip-on-hit**: special monster maneuver has optional controller choice, no AoO, no failure counter-trip, ordinary CMD, size and trip immunity checks. Full-attack sequencing resumes without another action cost.
- Executable **injury Poison-on-hit**: links to registered ailment, applies only when weapon damage penetrates DR, uses native poison immunity and existing affliction saving throw / recurrence / cure logic.
- Executable **fixed HP Bleed-on-hit**: applies generic recurring ailment and condition, rolls at victim turn start, retains stronger same-kind bleed, supports cure via the existing ailment/condition APIs.
- Executable **Paralysis-on-hit**: explicit DC and duration, inherited immunities, Fort save and existing timed Paralyzed condition.
- Consecutive **Trip and Grab** optional decisions queue after one hit without re-rolling damage or spending another attack; controller ownership is retained.
- Strict validation for new attack fields and referenced affliction definitions; regression-tested rollback.
- Browser inspector/sample importer displays the new attack definitions and the Trip response instead of incorrectly offering Grab buttons.
- Deliberately does not attempt Pull/Push, negative levels, full arbitrary nested interrupts, or armor/concealment work in this release.
