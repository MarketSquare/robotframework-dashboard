---
description: Use when working on the listener integration feature, the robotdashboardlistener.py script, or any task involving auto-uploading output.xml to the server after test runs.
---

# Listener Integration

## Overview

The listener integration auto-uploads `output.xml` (and optionally `log.html`) to the dashboard server after each Robot Framework test run. The script is `example/listener/robotdashboardlistener.py`. It hooks into Robot Framework's Listener Interface v2.

Key behaviours:
- Detects when `output.xml` is created (end of run)
- Sends it to `/add-output-file` on the server (gzip-compressed)
- Optionally uploads the log file via `/add-log-file`
- Is pabot-compatible — waits for the final merged output, not the per-worker intermediates
- When using pabot with a custom output name, the `output=<name>.xml` argument is required
- Enforces an optional `limit=N` (oldest runs auto-deleted after N runs stored)

> The script file name and the class name inside it must match (both default to `robotdashboardlistener`).

---

## All Listener Arguments

| Argument | Default | Description |
|---|---|---|
| `tags` | — | Comma-separated tags attached to the run |
| `version` | — | Version label (e.g. `v1.2.3`) |
| `uploadlog` | `false` | Set to `true` to also upload `log.html` |
| `host` | `127.0.0.1` | Dashboard server hostname |
| `port` | `8543` | Dashboard server port |
| `protocol` | `http` | `http` or `https` |
| `sslverify` | `true` | SSL verification: `true`, `false`, or path to CA bundle |
| `limit` | — | Keep only the N most recent runs; older ones auto-deleted |
| `output` | — | Required when using pabot with a custom `-o` output filename |

---

## Basic Usage

```bash
# Minimal
robot --listener robotdashboardlistener.py tests.robot

# With tags and version
robot --listener robotdashboardlistener.py:tags=smoke,regression:version=v1.2.3 tests.robot

# With log upload
robot --listener robotdashboardlistener.py:uploadlog=true tests.robot

# Custom host/port
robot --listener path/to/robotdashboardlistener.py:host=10.0.0.5:port=8543 tests.robot

# HTTPS with self-signed cert
robot --listener robotdashboardlistener.py:protocol=https:sslverify=false tests.robot

# HTTPS with custom CA bundle
robot --listener robotdashboardlistener.py:protocol=https:sslverify=/path/to/ca-bundle.pem tests.robot
```

---

## Pabot Usage

Pabot workers each produce a temporary output; the listener waits for the **final merged** output automatically.

```bash
# Standard pabot
pabot --listener robotdashboardlistener.py tests.robot

# With test-level splitting
pabot --testlevelsplit --listener robotdashboardlistener.py tests.robot

# Custom output name — must pass output= to listener
pabot --testlevelsplit --listener robotdashboardlistener.py:output=custom_output.xml -o custom_output.xml tests.robot
```

---

## RobotCode (`robot.toml`)

Place both `robot.toml` and `robotdashboardlistener.py` in the project root (or adjust paths).

```toml
# Minimal
[listeners]
"robotdashboardlistener.py" = []

# With tags
[listeners]
"robotdashboardlistener.py" = ["tags=dev1,dev2"]

# Custom host/port + limit
[listeners]
"robotdashboardlistener.py" = ["tags=dev1,dev2", "host=127.0.0.2", "port=8888", "limit=100"]

# Full options
[listeners]
"robotdashboardlistener.py" = ["tags=dev1,dev2", "version=v2.0", "uploadlog=true", "limit=100"]
```

Steps to use with RobotCode:
1. Place `robot.toml` + `robotdashboardlistener.py` in project root
2. `pip install robotcode-runner`
3. Start the dashboard server: `robotdashboard --server default`
4. Run tests: `robotcode robot .`

---

## Server-Side Endpoints Used

The listener calls these server endpoints (see `server-api.md`):
- `POST /add-output-file` — multipart upload of gzip-compressed `output.xml`; accepts `tags` (colon-separated) and `version` form fields
- `POST /add-log-file` — multipart upload of the log HTML (when `uploadlog=true`)

---

## Example Script Location

`example/listener/robotdashboardlistener.py` — reference implementation.
`example/listener/robot.toml` — reference RobotCode config.
