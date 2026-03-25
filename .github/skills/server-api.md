---
description: Use when working on the FastAPI server, adding or modifying API endpoints, handling authentication, log linking, or the admin page.
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
- **Only `/admin` requires credentials** when `server_user` and `server_pass` are set
- All other endpoints (`/add-outputs`, `/remove-outputs`, etc.) are **unauthenticated by design**
- If no credentials are configured, `/admin` is also open

---

## All Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/` | None | Serves `robot_dashboard.html` from the working directory |
| `GET` | `/admin` | Basic (if configured) | Serves the admin page HTML (generated from `templates/admin.html`) |
| `POST` | `/refresh-dashboard` | None | Manually triggers `robotdashboard.create_dashboard()` without adding data |
| `GET` | `/get-outputs` | None | Returns list of `{run_start, name, alias, tags}` for all stored runs |
| `POST` | `/add-outputs` | None | Add output(s) from a path, raw XML string, or folder. See body fields below. |
| `POST` | `/add-output-file` | None | Multipart upload of `output.xml` (or `.gz`/`.gzip`). Form fields: `tags` (colon-separated), `version`. |
| `DELETE` | `/remove-outputs` | None | Remove runs by various selectors. See body fields below. |
| `GET` | `/get-logs` | None | Lists filenames in `robot_logs/` |
| `POST` | `/add-log` | None | Saves HTML log content to `robot_logs/<log_name>` and links it to the matching run in the DB |
| `POST` | `/add-log-file` | None | Same as `/add-log` but via multipart file upload (supports `.gz`/`.gzip`) |
| `DELETE` | `/remove-log` | None | Removes one log by `log_name`, or all logs with `all: True` |
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

## Server State

The `ApiServer` instance holds:

| Attribute | Description |
|---|---|
| `self.robotdashboard` | The `RobotDashboard` instance (set via `set_robotdashboard()`) |
| `self.server_user` / `self.server_pass` | Basic auth credentials (empty = no auth) |
| `self.no_autoupdate` | Skip HTML regeneration after mutations |
| `self.log_dir` | Directory for log HTML files (default: `robot_logs/`) |
| `self.latest_log_dir` | Parent dir of the last served log file (used by catch-all route) |
