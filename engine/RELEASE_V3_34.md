# V3.34 release notes

Variable map dimensions (up to 256×256 five-foot squares), batched terrain editing and an advisory establishment flag now use public GM commands. Explicit scene closure preserves retained mechanical consequences/resources and world time while discarding obsolete encounter state and undo history. Companion campaign notes/storage remains external and product-independent.

Creature/tile elevation annotations, declared occupancy layers, directional geometry rulings and per-cell traversal decisions extend the existing two-dimensional mechanics. Surface/volume exposure uses native automation and persistent-area payloads. Ordinary action costs, spell expenditure, damage mitigation and timer ownership remain enforced. Tiny-and-smaller capacity, same-square attacks and movement AoOs use the native combat paths.

The browser uses a bounded map window and shared-occupant selection; it remains an inspection/test workbench. There is no AI/plugin connection yet. See MAP_AND_ELEVATION_V3_34.md for the command contract and deliberate GM boundaries.

Validation: 79/79 suites passed: 42 Node suites and 37 browser suites. New coverage includes 20 scene/mechanical integration groups and 4 browser scenarios. Standalone HTML was rebuilt and map/shared-occupant screenshots were visually inspected. The complete output is TEST_RESULTS_V3_34.txt. This is regression evidence, not certification of complete Pathfinder coverage or an AI-agent benchmark.
