---
name: server-api
description: "The optional FastAPI server (--server): every REST endpoint, HTTP Basic Auth on /admin only, log linking (/add-log, /log), auto-update behaviour, and the admin page bundle. Use when adding or changing endpoints, debugging uploads from the listener, or touching server.py / templates/admin.html."
---

# Server API

## Overview

The server is an optional FastAPI application started with `robotdashboard --server` (or `-s host:port:user:pass`). It wraps a persistent `RobotDashboard` instance and exposes REST endpoints for managing outputs and serving the dashboard. Implementation is in `robotframework_dashboard/server.py`.

---

## Starting the Server

```bash
robotdashboard --server                         # localhost:8000, no auth
robotdashboard -s 0.0.0.0:9000:admin:secret    # custom host:port:user:pass
```

Served with **uvicorn** via `fastapi_offline.FastAPIOffline`.

---

## Authentication

- HTTP Basic Auth is implemented using `HTTPBasic` + `secrets.compare_digest` (constant-time comparison)
- **`/admin` and all mutation endpoints require credentials** when `server_user` and `server_pass` are set
- Read-only endpoints (`/`, `/get-outputs`, `/get-logs`, `/log`, `/{full_path}`) are **unauthenticated**
- If no credentials are configured, all endpoints are open (the `authenticate` dependency returns `"anonymous"`)

---

## All Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/` | None | Serves `robot_dashboard.html` from the working directory |
| `GET` | `/admin` | Basic (if configured) | Serves the admin page HTML (generated from `templates/admin.html`) |
| `POST` | `/refresh-dashboard` | Basic (if configured) | Manually triggers `robotdashboard.create_dashboard()` without adding data |
| `GET` | `/get-outputs` | None | Returns list of `{run_start, name, alias, tags}` for all stored runs |
| `POST` | `/add-outputs` | Basic (if configured) | Add output(s) from a path, raw XML string, or folder. See body fields below. |
| `POST` | `/add-output-file` | Basic (if configured) | Multipart upload of `output.xml` (or `.gz`/`.gzip`). Form fields: `tags` (colon-separated), `version`, `custom_filters`, `log_url`. |
| `DELETE` | `/remove-outputs` | Basic (if configured) | Remove runs by various selectors. See body fields below. |
| `GET` | `/get-logs` | None | Lists filenames in `robot_logs/` |
| `POST` | `/add-log` | Basic (if configured) | Saves HTML log content to `robot_logs/<log_name>` and links it to the matching run in the DB |
| `POST` | `/add-log-file` | Basic (if configured) | Same as `/add-log` but via multipart file upload (supports `.gz`/`.gzip`). Filenames containing `report` are saved as-is with no DB matching — see Report Handling below. |
| `DELETE` | `/remove-log` | Basic (if configured) | Removes one log by `log_name`, or all logs with `all: True` |
| `GET` | `/log` | None | Serves a log HTML file by `?path=` query param; stores parent dir for subsequent resource requests |
| `GET` | `/{full_path:path}` | None | Catch-all: serves static resources (screenshots, etc.) relative to the last served log's directory. Path-traversal protected. |

---

## Request Body Fields

### `POST /add-outputs`
Exactly one input source must be provided (mutually exclusive):

| Field | Type | Description |
|---|---|---|
| `output_path` | `str` | Absolute path to an `output.xml` file |
| `output_data` | `str` | Raw XML content (written to a temp file) |
| `output_folder_path` | `str` | Folder scanned recursively for `*output*.xml` files |
| `output_tags` | `List[str]` | Optional tags to attach to all added runs |
| `output_alias` | `str` | Optional alias override |
| `output_version` | `str` | Optional project version string |
| `output_log_url` | `str` | Optional externally-hosted log URL, mirrors CLI `--logurl`. Requires a `{run_alias}` placeholder when `output_folder_path` is used (potentially multiple runs); rejected without one. `/add-output-file`'s multipart equivalent is the unprefixed `log_url` form field (no placeholder requirement there since it always processes a single file). |

### `DELETE /remove-outputs`
Any combination of the following:

| Field | Type | Description |
|---|---|---|
| `run_starts` | `List[str]` | Run start timestamps (exact match) |
| `indexes` | `List[str]` | Positional indexes; supports negatives and range syntax (e.g. `"0:5"`) |
| `aliases` | `List[str]` | Run aliases |
| `tags` | `List[str]` | Run tags |
| `limit` | `int` | Keep only the N most recent runs, remove the rest |
| `all` | `bool` | Remove all runs |

---

## Response Model

All mutation endpoints return `ResponseMessage`:

```json
{ "success": "1", "message": "...", "console": "..." }
```

- `success`: `"1"` on success, `"0"` on error
- `message`: human-readable summary
- `console`: raw stdout-style log from the `RobotDashboard` processor

---

## Auto-Update Behavior

After any mutation (add/remove outputs, add/remove logs):
- If `no_autoupdate` is `False` (default): `robotdashboard.create_dashboard()` is called automatically to regenerate the HTML
- If `no_autoupdate` is `True` (set via `--no-autoupdate` flag): regeneration is skipped; call `POST /refresh-dashboard` manually

---

## Log File Naming Convention

Log files linked to runs **must** follow this naming pattern:

```
output-XYZ.xml  ←→  log-XYZ.html
```

The suffix `XYZ` must match between the output file and its corresponding log. The server's `/add-log` and `/add-log-file` endpoints enforce this convention when calling `update_output_path()` to link the log to the correct run in the DB.

---

## Report Handling (`/add-log-file`)

Reports are not tracked in the database — Robot Framework's own `log.html` already links to `report.html` (top-right corner), so the dashboard just needs the report saved next to its log with a matching name (`log_XYZ.html` ↔ `report_XYZ.html`).

`/add-log-file` detects a `report` substring in the uploaded filename and takes a different path than for `log` files:
- The file is saved to `robot_logs/` as-is; `update_output_path()` (DB matching) is **not** called — a report filename would never match a stored output/log path anyway.
- It checks whether a `log` file exists with the same name (`report` → `log`) in `robot_logs/`. If found: `SUCCESS` with a console note that the report is reachable from its log. If not found: still `SUCCESS`, but the console carries a `WARNING` that the report was saved but has no matching log yet (upload order matters — upload the log first, or the report before it just produces a harmless warning).
- This intentionally returns `success: "1"` either way; before this behavior, a `report*.html` upload always returned `success: "0"` with a misleading DB-matching error even though the file was saved correctly (#308).

## Server State

The `ApiServer` instance holds:

| Attribute | Description |
|---|---|
| `self.robotdashboard` | The `RobotDashboard` instance (set via `set_robotdashboard()`) |
| `self.server_user` / `self.server_pass` | Basic auth credentials (empty = no auth) |
| `self.no_autoupdate` | Skip HTML regeneration after mutations |
| `self.log_dir` | Directory for log HTML files (default: `robot_logs/`) |
| `self.latest_log_dir` | Parent dir of the last served log file (used by catch-all route) |
