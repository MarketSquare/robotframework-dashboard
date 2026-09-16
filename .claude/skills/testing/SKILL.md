---
name: testing
description: Run, add, debug, or fix tests of any tier — Robot Framework acceptance tests (tests/robot/, Playwright screenshots, pabot, Docker), Python unit tests (tests/python/, pytest), or JavaScript unit tests (tests/javascript/, Vitest). Use whenever the task mentions tests, test failures, CI being red, reference screenshots, or verifying a change end-to-end.
---

# Testing

Three tiers. Each has a project script; **never call `pytest`, `vitest`, `robot`, or `pabot` by hand outside of what is documented here**.

| Tier | Location | Runner | Deep reference |
|---|---|---|---|
| Robot acceptance | `tests/robot/` | pabot + Playwright, **in Docker** | [robot-tests.md](robot-tests.md) |
| Python unit | `tests/python/` | pytest | [python-unit-tests.md](python-unit-tests.md) |
| JavaScript unit | `tests/javascript/` | Vitest | [javascript-unit-tests.md](javascript-unit-tests.md) |

Read the deep reference for the tier you are touching before adding or fixing tests.

---

## Hard rule: Robot tests run in Docker, never locally

The robot suites call the `robotdashboard` **CLI** (see `Generate Dashboard` in `tests/robot/resources/keywords/general-keywords.resource`). That CLI is whatever version is `pip install`-ed on the machine — **not** the source tree. A local `robot`/`pabot` run therefore silently tests stale code and produces screenshots that don't match the Linux-rendered references. The Docker wrapper does `pip install .` first and matches the CI environment exactly.

### Commands (Git Bash, works on Windows too — the wrapper detects a missing TTY)

```bash
# Build the image once (also rebuild after dependency changes)
bash scripts/docker/create-test-image.sh robot

# Full suite, same as CI
bash scripts/docker/run-in-robot-container.sh bash scripts/robot-tests.sh

# One suite
bash scripts/docker/run-in-robot-container.sh robot --outputdir results tests/robot/testsuites/06_filters.robot

# One test by name pattern
bash scripts/docker/run-in-robot-container.sh robot --outputdir results -t "*Run Tags Filter*" tests/robot/testsuites/06_filters.robot
```

`.bat` equivalents exist under `scripts\docker\` for cmd.exe; prefer the `.sh` form from an agent shell.

Results land in `results/` (gitignored). Screenshots taken during the run: `results/browser/screenshot/<name>.png`.

### Reading the result

Check the Robot summary line, **not** the process exit code:

```
N tests, N passed, 0 failed
```

Known false alarms:
- Exit code 1 from Docker — pip writes deprecation warnings to stderr.
- `Path … index.txt does not exist` FAIL messages inside `Run Keyword And Return Status` in `Get Dashboard Index` — expected for the first test in a run.

---

## Python and JavaScript unit tests

```bash
bash scripts/python-tests.sh        # Windows: scripts\python-tests.bat
bash scripts/javascript-tests.sh    # Windows: scripts\javascript-tests.bat
```

Both can also run in Docker (`scripts/docker/run-in-python-container.sh`, `scripts/docker/run-in-js-container.sh`) but that is optional — they test the source tree directly.

Targeted runs are fine for iteration (see the deep references), but run the project script before declaring a change done.

---

## CI

`.github/workflows/tests.yml` ("Robotdashboard Tests"): `unit-tests` and `js-unit-tests` jobs run first; `robot-tests` declares `needs: [unit-tests, js-unit-tests]` and is skipped if either fails. The robot job always uploads its `results/` folder as artifact **`robot-results`**.

### Diagnosing a red CI run

```bash
# 1. find the run for the branch / PR
gh run list --workflow "Robotdashboard Tests" --branch <branch> -L 5
gh pr checks <PR>                                   # alternative entry point

# 2. which job/step failed
gh run view <run-id>                                # summary per job
gh run view <run-id> --log-failed | tail -100       # only the failing steps' log

# 3. robot failures: pull the artifact and diagnose locally
gh run download <run-id> -n robot-results -D robot-results
```

`gh run download` yields `robot-results/output.xml`, `log.html`, and `robot-results/browser/screenshot/*.png`. Then:

- Run the diagnosis script from [robot-tests.md](robot-tests.md) — it picks up `robot-results*/output.xml` automatically and classifies each failure (stale screenshot / element not visible / other).
- Stale screenshot and the new rendering is correct → copy `robot-results/browser/screenshot/<name>.png` over the reference in `tests/robot/resources/dashboard_output/<folder>/`. CI screenshots are Linux-rendered, so they are valid references (unlike anything captured on a Windows host).
- Anything else → reproduce in Docker with the single suite/test, fix, re-run.
- Python/JS unit failures: reproduce with the project script locally; the `--log-failed` output already contains the pytest/vitest assertion.

Delete the downloaded `robot-results/` folder afterwards; it is not gitignored.

---

## Adding a test — which tier?

| Change | Add test in |
|---|---|
| Pure Python logic (processors, database, arguments, dashboard generation, server endpoints) | `tests/python/` |
| Pure JS data transformation (`graph_data/*`, `common.js`, `localstorage.js` merge helpers) | `tests/javascript/` |
| Anything that needs the rendered dashboard: DOM, filters, clicks, layout, screenshots, CLI end-to-end | `tests/robot/` |

JS modules that touch `document`, Chart.js, GridStack, or DataTables are **not** unit-testable — cover them with a robot test instead.
