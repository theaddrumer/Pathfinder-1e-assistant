# V3.37 — AI-facing MCP integration

The existing mechanics engine now has a runnable private MCP server. Seven tools
provide concise state, command discovery, read-only queries, ordinary actions,
reasoned GM setup/adjudication, latest-result details and reference documentation.
The 142-command index points back to existing validators; it adds no rules database.

The adapter exposes native continuation choices for movement reactions, riders,
full attacks, casting opportunities/completion and event checkpoints. Revision guards
reject stale intentions. The last 64 request receipts prevent uncertain retries from
spending resources or applying damage again, including after a restart. Native state,
RNG and undo checkpoints are autosaved with an atomic single-writer file. Persistence
joins the existing engine transaction; it does not introduce a second rollback engine.

Both stdio and Streamable HTTP use the pinned official MCP SDK. HTTP provides private
bearer authentication, explicit Host/Origin handling and bounded request bodies.
The package includes local plugin manifests, dependencies, setup documentation and
a utility to generate a remote connection manifest once a real HTTPS endpoint exists.
No OpenAI API key or model API call is needed by the mechanics server itself.

No changes to PF1e mechanics are introduced. The offline browser workbench is labeled
as a separate sandbox; it does not share the server's live encounter automatically.

Validation: **85/85 suites passed (46 Node + 39 browser)**, recorded in TEST_RESULTS_V3_37.txt. New tests cover 15 adapter/encounter
groups and three official-SDK transport groups, including restart, retry, action cost,
continuation, persistence failure, concurrent revision conflicts and private HTTP access.

Next: choose a persistent host or local MCP client, register the connection, and run
a small actual AI-GM encounter. This release is not a deployed endpoint, installed
ChatGPT connection, public plugin listing, AP importer or multiplayer service.
