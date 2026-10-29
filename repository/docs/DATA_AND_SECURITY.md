# Data and connection boundaries

Encounter saves include GM secrets and may embed map artwork. Keep them outside this source checkout. The player view is filtered; the GM artwork editor can show unrevealed material. Never publish a live save as a bug report.

The Ubuntu launcher remembers file paths and tunnel/organization IDs. Its API secret is session-only; it passes the secret to the tunnel process. Enter it locally, not in chat or GitHub. The desktop edition does not need a tunnel key. Tool requests and responses are shared with the AI provider; this is not an entirely offline AI system.

The default servers bind to loopback. No public hosting, port forwarding or multiplayer service is configured. GitHub hosts the download, not your encounter. Do not expose the GM editor or unauthenticated calculator on the public Internet.

Report ordinary bugs with redacted text and a synthetic reproduction. Do not post credentials or exploitable security details in public Issues. If a secret was exposed, revoke it through its provider. A dedicated private security-reporting channel is not configured in this copy; the repository owner should enable one before soliciting sensitive reports.
