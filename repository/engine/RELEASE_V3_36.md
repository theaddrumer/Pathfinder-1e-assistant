# V3.36 — Explicit falling resolver

Adds GM-only `gm_preview_fall` and `gm_resolve_fall` with ordinary/deliberate falls,
Acrobatics softening, yielding surfaces, water bands, dive checks, declared special
distance reductions and reasoned damage/prone overrides. Optional landing elevation
uses existing contact notifications. The offline workbench provides preview/resolve
controls beside map management; the scene JSON editor accepts both commands.

No automatic falling detection, gravity simulation, new persistent state, scheduler,
damage ledger or spell catalog is added. Existing HP, nonlethal immunity/overflow,
temporary HP, conditions, concentration, surface exposure and undo remain the owners.
Mixed impact damage produces one concentration check using the existing grouping hook.

Read FALLING_V3_36.md for command schemas, examples, documented rule conventions,
and GM boundaries. Integration is the next milestone; no AI connection is included.

Validation: **83/83 suites passed (44 Node + 39 browser)**; see TEST_RESULTS_V3_36.txt. New coverage includes 16 engine integration
groups and four browser scenarios alongside the existing regression suites.
