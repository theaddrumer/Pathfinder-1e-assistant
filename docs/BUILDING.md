# Build the release downloads

Prerequisites: Python 3.10+, Node.js 22.12+, npm and network access to the npm registry. From the repository root, run each command separately:

```sh
npm ci --prefix engine --ignore-scripts
python3 scripts/build_release.py
python3 scripts/verify_release.py
```

The build uses a tracked source allowlist and dependency hashes, not every file that happens to be in your working directory. Unlisted personal files are never copied. Do not add private files to that allowlist. Dependency contents are verified before packaging, including Ajv runtime files.

`dist/` contains the Ubuntu asset, experimental desktop asset and SHA256SUMS.txt. ZIPs are written to temporary files, closed, flushed and atomically renamed before validation. The verification script extracts them to disposable directories, runs integration/transport/save/launcher checks and a desktop SDK smoke test. It never uses the developer's active encounter or tunnel. It does not install WSL or contact a live tunnel.

For ordinary code edits, rebuild after review. When deliberately adding source files, update `scripts/source-files.json`. Dependency upgrades need a deliberate lockfile and `scripts/dependency-files.json` refresh and fresh validation; do not bypass a mismatch. The hashes describe the bundled dependency bytes for this checkpoint.

The GitHub preparation bundle already includes both built assets in `release-assets/`; testers do not need npm or this build process. Source users can also run `npm run test:integration --prefix engine`. Broader suites are available through `python3 engine/run_regressions.py`.
