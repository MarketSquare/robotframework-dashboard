---
description: Use when modifying core logic, adding features, or debugging issues related to runs, logs, versions, database backends, or offline mode.
---

# Project Conventions and Gotchas

- Run identity is `run_start` from output.xml; duplicates are rejected. `run_alias` defaults to file name and may be auto-adjusted to avoid collisions.
- If you add log support, log names must mirror output names (output-XYZ.xml -> log-XYZ.html) for `uselogs` and server log linking. The server's `/add-log` endpoint enforces this naming convention at runtime.
- `--projectversion` and `version_` tags are mutually exclusive; version tags are parsed from output tags in `RobotDashboard._process_single_output`.
- Custom DB backends are supported via `--databaseclass`; the module must expose a `DatabaseProcessor` class compatible with `AbstractDatabaseProcessor`.
- Offline mode is handled by embedding dependency content into the HTML; do not assume external CDN availability when `--offlinedependencies` is used.
- Data flow is always: parse outputs -> DB -> HTML. Reuse `RobotDashboard` methods instead of reimplementing this flow.
- Template changes should keep placeholder keys intact (e.g. `placeholder_runs`, `placeholder_css`) because replacements are string-based.
- The server only applies HTTP Basic Auth to `/admin`. All other API endpoints (`/add-outputs`, `/remove-outputs`, `/get-outputs`, etc.) are unauthenticated by design.
- After any mutation on the server (add/remove outputs, add/remove logs), the dashboard HTML is regenerated automatically unless `--no-autoupdate` is set. Use `POST /refresh-dashboard` to trigger it manually.
