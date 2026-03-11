---
description: Use when working on, running, or reasoning about the Python unit tests in tests/.
---

# Unit Tests

## How to run

**Windows:**
```bat
scripts\unittests.bat
```

**Linux / macOS:**
```bash
bash scripts/unittests.sh
```

Both scripts run `pytest` with coverage reporting on the `robotframework_dashboard` package.

## Test layout

All unit tests live flat in `tests/` — no subdirectories.

| File | What it covers |
|---|---|
| `tests/conftest.py` | Shared pytest fixtures (XML paths, `OutputProcessor`, `DatabaseProcessor`) |
| `tests/test_arguments.py` | `dotdict`, `_normalize_bool`, `_check_project_version_usage`, `_process_arguments` (all branches), `get_arguments` via mocked `sys.argv` |
| `tests/test_processors.py` | `OutputProcessor`: `get_run_start`, `get_output_data`, `calculate_keyword_averages`, `merge_run_and_suite_metadata`; legacy RF compat branches (`RunProcessor`, `SuiteProcessor`, `TestProcessor`, `KeywordProcessor`) |
| `tests/test_database.py` | `DatabaseProcessor`: table creation, schema migration, insert/get round-trip, all `remove_runs` strategies, `list_runs`, `vacuum_database`, `update_output_path`, static helpers |
| `tests/test_dashboard.py` | `DashboardGenerator`: `_compress_and_encode`, `_minify_text`, `generate_dashboard` (file creation, title, server mode, configs, subdirectory) |
| `tests/test_dependencies.py` | `DependencyProcessor`: JS/CSS block generation, CDN vs offline mode, admin-page variant, file gathering |
| `tests/test_robotdashboard.py` | `RobotDashboard`: `initialize_database`, `process_outputs`, `print_runs`, `remove_outputs`, `create_dashboard`, `get_runs`, `get_run_paths`, `update_output_path` |
| `tests/test_main.py` | `main()`: orchestration pipeline via mocked `ArgumentParser` and `RobotDashboard`; server branch |
| `tests/test_server.py` | `ApiServer`: all FastAPI endpoints via `TestClient` — auth, add/remove outputs, add/remove logs, file uploads (plain and gzip), catch-all resource route, autoupdate flag |

## Test data

Real `output.xml` files live in `testdata/outputs/`. These are the same 15 Robot Framework output files used by the acceptance tests — no synthetic mocks. Using real XMLs means `OutputProcessor` and `DatabaseProcessor` are exercised against genuine data, not fabricated inputs.

Inline data fixtures (plain Python tuples/dicts) are used only for edge cases that real XMLs cannot cover, such as malformed inputs and single-entry keyword lists.

## Testing the server

`tests/test_server.py` uses `fastapi.testclient.TestClient` (backed by `httpx`) to exercise every endpoint in `ApiServer` without starting a real network process.  The `RobotDashboard` dependency is replaced with a `MagicMock`, making every test fast and deterministic.  `httpx` is a required dev dependency — install it with `pip install httpx`.

Key patterns used:
- `_make_server()` helper creates an `ApiServer` with mock `RobotDashboard` attached.
- `monkeypatch.chdir(tmp_path)` is used whenever the server writes files to the current directory (e.g., `output_data`, file uploads).
- `client.request("DELETE", ...)` is used for the `DELETE` endpoints since `TestClient` has no `.delete()` method that accepts a JSON body.

## Why no pytest-mock

`pytest-mock` was considered and explicitly rejected for the pure-logic tests. The codebase has no need for it because:

- Pure functions are tested directly with inline data.
- `DatabaseProcessor` is tested against an in-memory SQLite (`:memory:`) — no patching needed.
- `OutputProcessor` is tested with real XML files — no patching of `robot.api` needed.
- `server.py` endpoints use `TestClient` + `MagicMock` — the standard library `unittest.mock` is sufficient.

## What is deliberately not unit-tested

| Module | Reason |
|---|---|
| `main.py` (fully wired) | Pure orchestration entry point; the two `test_main.py` tests cover the call graph using mocks, but the real subprocess path (file I/O) is covered by acceptance tests |
| `abstractdb.py` abstract methods | These are abstract — by definition untestable without a concrete subclass; the concrete `DatabaseProcessor` is fully tested |

## CI integration

Unit tests run as a separate `unit-tests` job in `.github/workflows/tests.yml` **before** the Robot acceptance tests. The `robot-tests` job declares `needs: unit-tests`, so acceptance tests are skipped entirely if unit tests fail. This keeps CI fast: a broken pure-Python function fails in seconds rather than after the full heavyweight Playwright container spins up.

## Schema migration test

`test_schema_migration_runs_table_from_10_to_14` in `test_database.py` creates a legacy 10-column SQLite database by hand and asserts that `DatabaseProcessor.__init__` automatically migrates all four tables to their current column counts (runs: 14, suites: 11, tests: 12, keywords: 12). This protects against regressions when future schema columns are added.
