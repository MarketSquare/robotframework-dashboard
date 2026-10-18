---
name: hub-contract
description: "What robotframework-dashboard-hub (separate repo, timdegroot1996/robotframework-dashboard-hub) imports and calls from this package, and the checks to run before changing it. Use whenever a change touches get_run_stats, GET /get-run-stats, RunStats/GetRunStats, DatabaseProcessor (__init__, open/close, schema migrations), AbstractDatabaseProcessor, DependencyProcessor or DEPENDENCIES, the dependencies/ folder, version.py, or when bumping/removing a library the hub page loads."
---

# Hub contract

[robotframework-dashboard-hub](https://github.com/timdegroot1996/robotframework-dashboard-hub) (`robotdashboardhub`, local checkout usually `../robotframework-dashboard-hub`) depends on this package. It has no copy of the database or bundler code: it imports them. A change here can break the hub without any test in this repo failing.

**Before changing anything below, stop and check the hub.** If the change is breaking, say so to the user before making it, and keep the old behaviour working (a new optional argument, a new field) rather than changing it.

## What the hub uses

All imports live in one hub file, `src/robotframework_dashboard_hub/compat.py`. Grep it first: `grep -rn "robotframework_dashboard" ../robotframework-dashboard-hub/src`.

| This package | Hub use | Breaking when |
|---|---|---|
| `database.DatabaseProcessor(path)`, `open_database()`, `close_database()`, `get_run_stats()` | `compat.read_run_stats` reads a `.db` source | constructor arguments become required; `get_run_stats` is renamed, starts needing arguments, or loses a key |
| `get_run_stats()` row keys: `run_start, name, run_alias, total, passed, failed, skipped, elapsed_s (float), start_time, tags (list), metadata (list), project_version` | hub payload and every chart | a key is removed, renamed or changes type. Adding a key is fine |
| `GET /get-run-stats` → `{version, runs}` (`server_models.GetRunStats`, `server_routes_outputs.py`) | `collect._collect_url` reads a server source | the path, the envelope, or a run key changes; the endpoint starts requiring auth |
| `version.__version__` (`"Robotdashboard X.Y.Z"`) | shown in the hub; `compat.dashboard_version_number` takes the last word | the format stops ending in the version number |
| `dependencies.DependencyProcessor(js_root=, css_root=, dependencies=, exclude=)`, `get_js_block`, `get_css_block`, `get_dependencies_block(offline)`, `JS_ROOT` | `compat.dependency_processor` bundles the hub page | a keyword is renamed or removed; module stripping (`import`/`export`) changes |
| `DEPENDENCIES` names `bootstrap_css`, `datatables_css`, `chartjs`, `bootstrap_js`, `datatables_js` and their `dependencies/` offline copies | `generator.HUB_DEPENDENCIES` | a name is renamed or removed; a major library upgrade (Chart.js, Bootstrap, DataTables API) |

A schema migration in `DatabaseProcessor._create_tables` runs on the hub's databases too, so it must stay additive (`ALTER TABLE ADD COLUMN`).

## Checks

1. Grep the hub for the symbol you change (command above).
2. Run the hub tests against your working tree:
   ```bash
   cd ../robotframework-dashboard-hub
   .venv/Scripts/python -m pip install -e ../robotframework-dashboard   # once; Linux/macOS: .venv/bin/python
   .venv/Scripts/python -m pytest
   ```
3. A library upgrade: generate a hub page (`robotdashboardhub -s robot_results.db`) and open it; the hub has no screenshot tests yet.
4. A breaking change that is still wanted: change the hub in the same session, raise its minimum `robotframework-dashboard` version in `pyproject.toml`, and tell the user both repos need a release.

The tests in this repo that pin the contract: `tests/python/test_database.py` (`test_get_run_stats_*`), `tests/python/test_server.py` (`test_get_run_stats_*`), `tests/python/test_dependencies.py` (`test_custom_roots_bundle_another_package`), `tests/robot/testsuites/09_server.robot` (`Server Serves Run Stats For The Hub`). Keep them passing; don't loosen them to fit a change.
