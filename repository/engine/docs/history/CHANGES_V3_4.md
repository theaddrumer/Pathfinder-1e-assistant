> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# V3.4 — Runtime data registration and effect injection

**Purpose:** GM or future AI interpreter can give the kernel validated creature numbers and mechanical effects at runtime. No monster-specific code changes are required for ordinary statblocks/bonuses.

Added `registry.mjs` / `RegistryGame` on top of the V3.3 automation engine, containing persisted reusable creature/effect catalogs, independent creature instance spawning, printable stat totals, explicit ability-score dependency links, associated declarative trigger rules, condition injection/refresh, and a compact controller state snapshot. Added generic skill/ability d20 checks, including imported skill modifiers and `skill_checks`/`ability_checks` effect categories. Expanded modifier targets to INT/CHA. Added guardrails for imported fields, transaction rollback, GM authorization, and snapshot-safe rule attachment.

Added new default browser scenario with editable JSON definitions and controls for register, spawn, inject, roll Perception, and review structured encounter state. All V3.3 fixtures remain available. `index.html` and `automation-demo.html` are standalone; `demo.html` is the V1 legacy demo.

**Intentional boundaries:** No AP ingestion, no automated AoN lookup, no AI integration, no tactical logic, no complete regeneration or fear-condition precedence. Printed totals remain snapshots unless explicitly linked to ability modifiers. Duration ticking is scoped to target turn-end, not a complete PF timing implementation. See `RUNTIME_REGISTRY_V3_4.md`.
