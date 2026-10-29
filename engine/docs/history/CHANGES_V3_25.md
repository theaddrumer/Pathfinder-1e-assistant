> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# V3.25 — Touch spell and ray delivery

Held touch charges now use the existing Pending Events registry and common history/removal. Casting, moving, missing, retrying, repeated charges, casting a new spell, accidental contact, natural/unarmed delivery, persistence and undo use that same record.

Touch/ray hit checks share the existing attack, range, defense, critical and fortification implementation; only their payload differs from weapon damage. Rays support independent rolls/mitigation for a declared volley and cached SR by casting/target. Their separate delivery AoOs reuse the ranged-action interruption path and real opportunity budgets, including after defensive casting.

Also corrected continued long casting provoking again and casters threatening during unfinished casting. The workbench exposes touch/ray examples, charge targets and contact controls; held charges also appear with the existing Pending Events/time controls.

See TOUCH_AND_RAY_DELIVERY_V3_25.md for commands, scope and sources. New checks comprise 47 engine groups and five browser scenarios; all observed suite results are in TEST_RESULTS_V3_25.txt. Counterspells/dispels, slot expenditure and persistent areas remain forthcoming.
