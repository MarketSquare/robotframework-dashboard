---
description: Use when running tests, adding new tests, understanding how the test suite is structured, or debugging test failures.
---

# Testing

## Overview

All tests are **Robot Framework acceptance tests** run with **pabot**. Tests live in `tests/robot/`.

---

## Running Tests

```bash
# Windows
pabot --pabotlib --testlevelsplit --artifacts png,jpg --artifactsinsubfolders --processes 2 -d results .\tests\robot\*.robot

# Linux / macOS
pabot --pabotlib --testlevelsplit --artifacts png,jpg --artifactsinsubfolders --processes 2 -d results tests/robot/*.robot
```

Convenience scripts: `scripts/tests.bat` and `scripts/tests.sh`.

Key pabot flags:
- `--pabotlib` — starts the pabot shared library server (required for cross-process locks used by the index counter)
- `--testlevelsplit` — each individual test case runs in parallel, not each suite
- `--artifacts png,jpg --artifactsinsubfolders` — collects screenshots from each pabot worker's output dir
- `-d results` — all output goes to `results/`

---

## Test Dependencies (`requirements-test.txt`)

| Library | Role |
|---|---|
| `robotframework-pabot` | Parallel test runner |
| `robotframework-browser` | Playwright-based browser automation |
| `robotframework-databaselibrary` | SQLite query assertions |
| `robotframework-doctestlibrary` | Visual screenshot comparison |

---

## Suite Structure

| Suite | What it tests | Method |
|---|---|---|
| `00_cli.robot` | Every CLI flag (short + long form) | Runs `robotdashboard` as a subprocess, checks stdout/files against `tests/robot/resources/cli_output/` |
| `01_database.robot` | SQLite table contents after parsing | Queries the DB via DatabaseLibrary, compares rows against `tests/robot/resources/database_output/` |
| `02_overview.robot` | Overview page rendering | Browser screenshot diff vs. reference images |
| `03_dashboard.robot` | Dashboard tab charts/layout | Browser screenshot diff |
| `04_compare.robot` | Compare page | Browser screenshot diff |
| `05_tables.robot` | Tables page | Browser screenshot diff |
| `06_filters.robot` | Filter modal behavior | Browser interactions + screenshot diff |
| `07_settings.robot` | Settings modal behavior | Browser interactions + screenshot diff |

`tests/robot/testsuites/__init__.robot` is the **suite init** — it detects OS at suite setup (stored as global variable), sets a 60-second global test timeout, and runs `Remove Index` + `Move All Screenshots` as a single teardown (`Run Teardown Only Once`).

---

## Parallel-Safe Index System

Because tests run in parallel and each test needs its own `.db` and `.html` files, the test infrastructure uses an **atomic counter**:

- `tests/robot/resources/keywords/general-keywords.resource` provides `Get Dashboard Index`
- Uses `Acquire Lock` (pabot lock) to atomically read/write `tests/robot/resources/index.txt`
- Each test gets a unique integer N, and works with `robotresults_N.db` + `robotdashboard_N.html`
- `Remove Database And Dashboard With Index` cleans up both files in teardown

---

## CLI Tests (`00_cli.robot`)

- Each flag has two tests: short form (`-x`) and long form (`--flag`)
- Uses `Validate CLI` keyword: runs `robotdashboard <cmd>` via `Run` (OperatingSystem library)
- Compares output against expected files in `tests/robot/resources/cli_output/`
- Server tests (`-s`) are currently skipped
- OS-specific tests (e.g. `-c` custom DB class) skip on non-Windows

---

## Database Tests (`01_database.robot`)

- Test Setup generates a fresh dashboard and opens a SQLite connection
- Tests query each of the four tables (`runs`, `suites`, `tests`, `keywords`) via `DatabaseLibrary`
- Result strings are normalized (path separators, timezone offsets) via regex before comparison against `tests/robot/resources/database_output/` reference files

---

## Browser Tests (`02–07`)

- Use `robotframework-browser` (Playwright, headless Chromium)
- Open a generated `robotdashboard_N.html` via `file://` URL (no server needed)
- Interact with UI (clicks, fills, waits for elements)
- Take screenshots and compare with reference images in `tests/robot/resources/dashboard_output/`
- Comparison uses `DocTest.VisualTest` at **98% accuracy** (`threshold=0.02`)
- Screenshots per worker are moved to `results/screenshots/` in the suite teardown so they appear in `log.html`

---

## Shared Resources

| File | Contents |
|---|---|
| `tests/robot/resources/keywords/general-keywords.resource` | `Get Dashboard Index`, `Generate Dashboard`, `Remove Database And Dashboard With Index` |
| `tests/robot/resources/keywords/database-keywords.resource` | DB connection helpers, normalization, row comparison |
| `tests/robot/resources/keywords/dashboard-keywords.resource` | Browser lifecycle, filter helpers (`Set Run Filter`, `Set Date Filter`, `Set Amount Filter`), screenshot comparison, `Change Settings` |
| `tests/robot/resources/outputs/` | Input `output.xml` files used as test fixtures |
| `tests/robot/resources/cli_output/` | Expected CLI output reference files |
| `tests/robot/resources/database_output/` | Expected DB row reference files |
| `tests/robot/resources/dashboard_output/` | Reference screenshots for visual comparison |

---

## Adding a New Test

1. **CLI test**: add two test cases in `00_cli.robot` (short + long form), add expected output file to `tests/robot/resources/cli_output/`
2. **Database test**: add test case in `01_database.robot`, add reference row file to `tests/robot/resources/database_output/`
3. **Browser test**: add test case in the relevant suite (`02–07`), capture a reference screenshot and add to `tests/robot/resources/dashboard_output/`
4. All tests should use `Get Dashboard Index` for a unique file suffix to stay parallel-safe
