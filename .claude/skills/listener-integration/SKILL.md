---
name: listener-integration
description: "The Robot Framework listener (robotframework_dashboard.robotdashboardlistener) and standalone push script that upload output.xml/log.html to the dashboard server after a run: all listener arguments, pabot/RobotCode usage, and which server endpoints get called. Use for any listener, auto-upload, or CI-integration task."
---

# Listener Integration

## Overview

The listener integration auto-uploads `output.xml` (and optionally `log.html`) to the dashboard server after each Robot Framework test run. It hooks into Robot Framework's Listener Interface v2.

The canonical implementation is `robotframework_dashboard/robotdashboardlistener.py` — it ships **inside the installed package** (not just as an example), with zero extra dependencies: HTTP (multipart upload, JSON DELETE, HTTPS/SSL context) is implemented on top of `urllib`/`ssl`/`json` from the standard library only, no `requests`. Reference it with the dotted module path:
```
--listener robotframework_dashboard.robotdashboardlistener
```
`example/listener/robotdashboardlistener.py` is a thin re-export (`from robotframework_dashboard.robotdashboardlistener import robotdashboardlistener`) kept for users who prefer pointing `--listener` at a local file path instead of the installed module. Don't duplicate logic into it — it should stay a one-line re-export.

Key behaviours:
- Detects when `output.xml` is created (end of run)
- Sends it to `/add-output-file` on the server (gzip-compressed)
- Optionally uploads the log file via `/add-log-file`
- Is pabot-compatible — waits for the final merged output, not the per-worker intermediates
- When using pabot with a custom output name, the `output=<name>.xml` argument is required
- Enforces an optional `limit=N` (oldest runs auto-deleted after N runs stored)
- `port` can be left empty (`port=`) to build a URL with no port segment at all, for servers reachable on the protocol's default port or behind a reverse proxy — see `_base_url()`

> The script file name (or, for the packaged module, the last segment of the dotted path) and the class name inside it must match (both default to `robotdashboardlistener`).

---

## All Listener Arguments

| Argument | Default | Description |
|---|---|---|
| `tags` | — | Comma-separated tags attached to the run |
| `version` | — | Version label (e.g. `v1.2.3`) |
| `uploadlog` | `false` | Set to `true` to also upload `log.html` |
| `host` | `127.0.0.1` | Dashboard server hostname |
| `port` | `8543` | Dashboard server port. Pass `port=` (empty) to omit it from the URL entirely |
| `protocol` | `http` | `http` or `https` |
| `sslverify` | `true` | SSL verification: `true`, `false`, or path to CA bundle |
| `limit` | — | Keep only the N most recent runs; older ones auto-deleted |
| `output` | — | Required when using pabot with a custom `-o` output filename |
| `user` | — | Username for basic authentication |
| `password` | — | Password for basic authentication |

---

## Basic Usage

```bash
# Minimal — dotted module path, no file needed since it ships in the package
robot --listener robotframework_dashboard.robotdashboardlistener tests.robot

# With tags and version
robot --listener robotframework_dashboard.robotdashboardlistener:tags=smoke,regression:version=v1.2.3 tests.robot

# With log upload
robot --listener robotframework_dashboard.robotdashboardlistener:uploadlog=true tests.robot

# Custom host/port
robot --listener robotframework_dashboard.robotdashboardlistener:host=10.0.0.5:port=8543 tests.robot

# No port (server on the protocol's default port, or behind a reverse proxy)
robot --listener robotframework_dashboard.robotdashboardlistener:host=dashboard.internal.company.com:port= tests.robot

# HTTPS with self-signed cert
robot --listener robotframework_dashboard.robotdashboardlistener:protocol=https:sslverify=false tests.robot

# HTTPS with custom CA bundle
robot --listener robotframework_dashboard.robotdashboardlistener:protocol=https:sslverify=/path/to/ca-bundle.pem tests.robot

# Standalone file copy instead of the dotted path
robot --listener path/to/robotdashboardlistener.py:host=10.0.0.5:port=8543 tests.robot
```

---

## Pabot Usage

Pabot workers each produce a temporary output; the listener waits for the **final merged** output automatically.

```bash
# Standard pabot
pabot --listener robotframework_dashboard.robotdashboardlistener tests.robot

# With test-level splitting
pabot --testlevelsplit --listener robotframework_dashboard.robotdashboardlistener tests.robot

# Custom output name — must pass output= to listener
pabot --testlevelsplit --listener robotframework_dashboard.robotdashboardlistener:output=custom_output.xml -o custom_output.xml tests.robot
```

---

## RobotCode (`robot.toml`)

Reference the dotted module path directly — no file needs to be placed in the project.

```toml
# Minimal
[listeners]
"robotframework_dashboard.robotdashboardlistener" = []

# With tags
[listeners]
"robotframework_dashboard.robotdashboardlistener" = ["tags=dev1,dev2"]

# Custom host/port + limit
[listeners]
"robotframework_dashboard.robotdashboardlistener" = ["tags=dev1,dev2", "host=127.0.0.2", "port=8888", "limit=100"]

# No port
[listeners]
"robotframework_dashboard.robotdashboardlistener" = ["host=dashboard.internal.company.com", "port="]

# Full options
[listeners]
"robotframework_dashboard.robotdashboardlistener" = ["tags=dev1,dev2", "version=v2.0", "uploadlog=true", "limit=100"]
```

Steps to use with RobotCode:
1. Place `robot.toml` in project root
2. `pip install robotcode-runner`
3. Start the dashboard server: `robotdashboard --server default`
4. Run tests: `robotcode robot .`

(To use the standalone file copy instead, place `robotdashboardlistener.py` next to `robot.toml` and reference it as `"robotdashboardlistener.py"`.)

---

## Server-Side Endpoints Used

The listener calls these server endpoints (see `server-api.md`):
- `POST /add-output-file` — multipart upload of gzip-compressed `output.xml`; accepts `tags` (colon-separated) and `version` form fields
- `POST /add-log-file` — multipart upload of the log HTML (when `uploadlog=true`)

Requests are built and sent with `urllib.request`/`urllib.error` — not `requests` — so the packaged listener adds zero runtime dependencies beyond Robot Framework itself. `_build_multipart()` hand-rolls the multipart/form-data body; `_request()` wraps `urlopen()` and normalizes both the success path and `HTTPError` (non-2xx) into the same `SimpleNamespace(status_code=..., json=lambda: ...)` shape the rest of the class expects, so `_print_console_message()` and the `status_code == 200` checks didn't need to change from the old `requests`-based version.

---

## Example Script Location

`robotframework_dashboard/robotdashboardlistener.py` — canonical implementation, ships inside the installed package.
`example/listener/robotdashboardlistener.py` — thin re-export of the above, for users who want a local file path instead of the dotted module.
`example/listener/robot.toml` — reference RobotCode config.
`example/script/robotdashboardscript.py` — separate standalone "push an existing output.xml without running tests" script; NOT packaged, still uses `requests` (out of scope for the dependency-removal work above — different script, different use case).
