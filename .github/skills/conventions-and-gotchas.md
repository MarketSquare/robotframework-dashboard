---
description: Use when modifying core logic, adding features, or debugging issues related to runs, logs, versions, database backends, or offline mode.
---

# Project Conventions and Gotchas

- Run identity is `run_start` from output.xml; duplicates are rejected. `run_alias` defaults to file name and may be auto-adjusted to avoid collisions.
- If you add log support, log names must mirror output names (output-XYZ.xml -> log-XYZ.html) for `uselogs` and server log linking.
- `--projectversion` and `version_` tags are mutually exclusive; version tags are parsed from output tags in `RobotDashboard._process_single_output`.
- Custom DB backends are supported via `--databaseclass`; the module must expose a `DatabaseProcessor` class compatible with `AbstractDatabaseProcessor`.
- Offline mode is handled by embedding dependency content into the HTML; do not assume external CDN availability when `--offlinedependencies` is used.
- Data flow is always: parse outputs -> DB -> HTML. Reuse `RobotDashboard` methods instead of reimplementing this flow.
- Template changes should keep placeholder keys intact (e.g. `placeholder_runs`, `placeholder_css`) because replacements are string-based.
