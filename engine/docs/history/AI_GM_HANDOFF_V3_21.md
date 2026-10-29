> Historical milestone document. Current entry point, scope and behavior: [handoff](../../AI_GM_HANDOFF.md), [architecture](../../ARCHITECTURE.md), [command map](../../COMMAND_REFERENCE.md). Older roadmap/coverage claims are not the current contract.

# Pathfinder 1e Tabletop Kernel — V3.21 Handoff

## Working release

Start with `tabletop_kernel_v3_21/`. **V3.21 adds Pending Events and lightweight Readied Action bookkeeping** on top of V3.20 initiative, V3.19 full attack/ranged ammunition, V3.17 game clock and all older tested systems. See `PENDING_EVENTS_AND_READY_V3_21.md` for supported command shapes, event lifetime types, exact Fast Forward behavior, and limitations. All older version handoffs are retained.

`PendingEventsGame extends InitiativeGame` in `pending_events.mjs`. `scenarios.mjs` returns this new class; `build_demos.py` bundles the module after `initiative.mjs` and before scenario fixtures. The root workbench `index.html` and standalone `automation-demo.html` share the same mechanics. API: `instance.dispatch(command,'gm')`; for ordinary actions `instance.dispatch(command,'actor')`.

GM event commands: `gm_register_pending_event`, `gm_get_pending_events`, `gm_trigger_pending_event`, `gm_resolve_pending_event`, `gm_cancel_pending_event`. Use arbitrary `trigger` descriptions only as GM-facing text. Expiration types `indefinite`, `encounter`, `turn_start`, `time`, `initiative`; timer expiry outcomes `expire` or `trigger`. Readied Actions `kind:'ready'` must consume their standard action, expire at next owner turn (or encounter end), require a GM resolution checkpoint, and move initiative position at GM-declared activation. **Never automatically treat registering a Ready as an executable order.** Trigger actions remain GM/Free Mode adjudications.

When calling `gm_advance_time` or `gm_advance_to_event` with unresolved active Pending Events, expect a `pending_events_warning` result first (time unchanged); send the same command with `confirmPendingEvents:true` to proceed. If an activated countdown requires GM input, return `needs_gm` at the exact clock time, allowing already-due deterministic effects to execute; resolve with `gm_resolve_pending_event`, then resume for the returned `remainingRounds`. Pre-turn initiative GM checkpoints defer new turn-start effects until acknowledgment.

Everything related to time is grouped under **Time & Events** in the workbench. This was a specific design decision for this project, not a global response-style instruction.

## Verify and rebuild

`node pending_events_tests.mjs`, `python test_browser_v3_21.py`, every `*tests.mjs`, and historical `test_browser_v3_*.py`. Rebuild using `python build_demos.py`. Standalone HTML works offline. Game state and history remain serializable and roll back through existing turn/round snapshots.

## Remaining docket

1. True nested interrupts and other exceptional Ready/Delay ordering cases, if they become necessary when actual encounters expose them. The V3.21 system deliberately delegates arbitrary trigger semantics to the AI GM.
2. Spellcasting and magic resolution: casting actions, concentration, SR, save/area targeting, counterspell/dispel, spell-duration effects, and generic declarative effect execution. Summoning should mostly reuse creature spawn/registration; new basic reusable templates **Advanced, Celestial, Fiendish** are explicitly planned. Exotic templates remain AI/GM adjudicated when a generalized transform is not worthwhile.
3. General rules completion: dying/stabilization/death; flanking, lighting, terrain; class features, transformation, skills; richer map geometry/squeezing as a separate milestone.
4. External AI-GM host adapters (tools/plugin interfaces), input validation, importing adventure paths and statblocks, persistent campaigns and real encounter trials. The kernel remains a deterministic calculator and does not itself make tactical or narrative decisions.

## Scope limitations

No independent natural-language trigger detection or automatic spell execution. Countdown `requiresInput:false` registers an automatic **event activation record**, not arbitrary trap/spell mechanical consequences. World-clock events have six-second resolution; legacy turn-duration modifiers are not all automatically initiative-count based. Full spellcasting and broad nested interrupt resolution are still future work. Do not describe the system as an autonomous AI Game Master or rules-complete PF1e.
