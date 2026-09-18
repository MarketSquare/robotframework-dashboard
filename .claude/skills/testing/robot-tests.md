# Robot Framework Acceptance Tests

Deep reference for `tests/robot/`. How to run them is in [SKILL.md](SKILL.md) — **always via Docker**.

---

## Test dependencies (`requirements-test.txt`)

| Library | Role |
|---|---|
| `robotframework-pabot` | Parallel test runner |
| `robotframework-browser` | Playwright-based browser automation |
| `robotframework-databaselibrary` | SQLite query assertions |
| `robotframework-doctestlibrary` | Visual screenshot comparison |

`scripts/robot-tests.sh` runs pabot with `--pabotlib --testlevelsplit --artifacts png,jpg --artifactsinsubfolders --processes 4 -d results` (`ROBOT_PROCESSES` overrides the process count). `--pabotlib` starts the shared lock server (needed by the index counter below); `--testlevelsplit` parallelises per test case.

If any test fails, the script reruns **only the failed tests** once (`--rerunfailed`) and merges both attempts with `rebot --merge`; the exit code is the number of tests still failing. This absorbs transient failures in the container (Playwright browser-launch crash, a dropped keystroke in a date input, a modal still fading). `results/output.xml` / `log.html` are the merged result; `results/first_output.xml` and `results/rerun_output.xml` keep the attempts. A test that is red in the merged log therefore failed **twice** — a real problem, not a flake. When diagnosing, remember the merged run only contains the rerun's screenshots for rerun tests.

---

## Suite structure

| Suite | What it tests | Method |
|---|---|---|
| `00_cli.robot` | Every CLI flag (short + long form) | Runs `robotdashboard` as a subprocess, checks stdout/files against `tests/robot/resources/cli_output/` |
| `01_database.robot` | SQLite table contents after parsing | Queries the DB via DatabaseLibrary, compares rows against `tests/robot/resources/database_output/` |
| `02_overview.robot` | Overview page rendering | Screenshot diff vs. reference images |
| `03_dashboard.robot` | Dashboard tab charts/layout | Screenshot diff |
| `04_compare.robot` | Compare page | Screenshot diff |
| `05_tables.robot` | Tables page | Screenshot diff |
| `06_filters.robot` | Filter modal behaviour, filter profiles | Browser interactions + screenshot diff + DOM assertions |
| `07_settings.robot` | Settings modal behaviour | Browser interactions + screenshot diff |

`tests/robot/testsuites/__init__.robot` is the suite init — detects the OS at suite setup, sets a 60-second global test timeout, and runs `Remove Index` + `Move All Screenshots` once as teardown.

---

## Shared resources

| File | Contents |
|---|---|
| `tests/robot/resources/keywords/general-keywords.resource` | `Generate Shared Dashboard` (browser suites), `Get Dashboard Index` + `Generate Dashboard` + `Remove Database And Dashboard With Index` (CLI/DB suites), `Output Arguments` (the 18 `-o file:tags` arguments) |
| `tests/robot/resources/keywords/database-keywords.resource` | DB connection helpers, normalisation, row comparison |
| `tests/robot/resources/keywords/dashboard-keywords.resource` | Browser lifecycle (`Open Dashboard`, `Wait For Dashboard Idle`), page navigation (`Open Overview Page`, …), filter helpers (`Set Run Filter`, `Set Run Tags Filter`, `Set Date Filter`, `Set Amount Filter`, `Set Versions Filter`), profile helpers, `Validate Component`, `Validate Filter Settings`, `Should Show N Of M Runs`, `Change Settings` |
| `tests/robot/resources/outputs/` | The 18 `output.xml` + `log.html` fixtures — **generated** by `tests/robot/resources/generator/generate.py` (see its README), never edited by hand. `Generate Dashboard` tags them `prod`/`dev`, `project_1`/`project_2`, `version_1.0`–`1.2` |
| `tests/robot/resources/cli_output/` | Expected CLI output reference files |
| `tests/robot/resources/database_output/` | Expected DB row reference files |
| `tests/robot/resources/dashboard_output/<folder>/<name>.png` | Reference screenshots |
| `tests/robot/resources/test_config.json` | Passed via `-j` by `Generate Shared Dashboard`; disables chart animations (`show.animation: false`) so Chart.js draws synchronously. Add flags for notices/banners here if they ever overlay screenshots |

### Shared dashboard for browser tests

All browser tests (02–07) use identical inputs, so `Generate Shared Dashboard` (test setup) builds `robotresults_shared.db` + `robotdashboard_shared.html` **once per run** under a pabot lock and every test opens that file; each test gets its own browser context (own `localStorage`), so parallel tests cannot influence each other. The files are removed by the `__init__.robot` teardown (`Run Teardown Only Once`). Parsing the 18 fixtures per test used to be the biggest cost of the suite.

### Parallel-safe index system (CLI/DB tests)

When a test needs its **own** database or generated files (`01_database.robot`), `Get Dashboard Index` uses a pabot lock to atomically bump `index.txt`; the test gets integer N and works with `robotresults_N.db` + `robotdashboard_N.html`; `Remove Database And Dashboard With Index` cleans both up in teardown.

### Fixture facts useful for assertions

18 runs total, two simulated projects: `WebshopUI` (10 runs, 105–113 tests, run name / overview card `WebshopUI`) and `WebshopAPI` (8 runs, 50 tests). Runs span 2026-08-17 … 2026-09-10. By run tag: `prod` 4, `dev` 14, `project_1` 10, `project_2` 8, `amount` 1 (on a `dev` run). Overview "Latest Runs" cards in run-tags mode have ids `overviewLatest<tag>Card0` (e.g. `overviewLatestproject_1Card0`); project sections use the run name (`WebshopUISection`, `collapseWebshopUIBody`).

The data is designed to fill every graph: persistent failures, flaky tests, tests broken/fixed at a given run, an outage run per project (`WebshopUI` run 7 on 2026-08-28, `WebshopAPI` run 5) whose failed tests were re-executed with `robot --rerunfailed` and merged with `rebot --merge` (one rerun for `WebshopUI` run 7, two for `WebshopAPI` run 5 — the only runs with an `attempts` history), one all-green run (`WebshopAPI` run 4, 2026-08-25) and one pass+skip-only run (`WebshopAPI` run 6, 2026-09-02), `TRY/EXCEPT` exceptions, feature-flag skips, slow outliers and duration trends. `tests/robot/resources/generator/libraries/profiles.py` says which test does what.

After regenerating fixtures: rerun **all** robot suites in Docker and refresh `cli_output/`, `database_output/` and every reference screenshot.

---

## Browser tests (02–07)

- Headless Chromium via `robotframework-browser`; `Open Dashboard` opens `robotdashboard_shared.html` over `file://` and hides the relative run-time labels so screenshots stay deterministic.
- **Never `Sleep` before a screenshot.** `Wait For Dashboard Idle` polls `window.dashboard_is_idle()`, a **test-only** hook that `Open Dashboard` injects from `tests/robot/resources/scripts/dashboard_idle.js` (`Evaluate JavaScript`; the shipped dashboard contains no test code): false while the page spinner, filter overlay, graph overlays, an open/closing modal or backdrop, a jQuery fade or a Chart.js animation is active, and true only after 50 ms without any of those. `Validate Component` and `Open Dashboard` call it; call it yourself before DOM assertions that follow a filter/settings change. If a new async render path is added to the dashboard (a `setTimeout`, a fade, a new overlay), extend `dashboard_idle.js` rather than sleeping in the tests (unit-tested in `tests/javascript/dashboard_idle.test.js`; the file must start with the arrow function or Browser evaluates it as an expression).
- Note: the settings UI "animation duration" only scales the stagger delay in `graph_config.js`; Chart.js's default 1000 ms draw still runs. That is why the test config turns animations off instead.
- `Validate Component    id=<sectionId>    name=<refName>    folder=<refFolder>` takes a screenshot of one element and compares it with `tests/robot/resources/dashboard_output/<refFolder>/<refName>.png` at 99.5 % accuracy by default (`threshold=0.005`); pass `threshold=` to loosen.
- Prefer DOM assertions (`Should Show 8 Of 8 Runs`, `Validate Filter Settings    runTags=project_1`) over screenshots when the behaviour under test is a state, not a rendering — they need no reference image.
- Put multi-step UI interactions into a named keyword in `dashboard-keywords.resource` (e.g. `Enable Run Tags On Overview Page`) rather than inlining raw `Click` sequences in the test case.

---

## Adding a test

1. **CLI**: two cases in `00_cli.robot` (short + long form), expected output file in `cli_output/`.
2. **Database**: case in `01_database.robot`, reference row file in `database_output/`.
3. **Browser**: case in the matching suite; if it uses `Validate Component`, generate the reference screenshot **in Docker** (see below) — screenshots from a Windows host never match.
4. Run the affected suite in Docker and check the summary line.

---

## Fixing failing robot tests

### Step 1 — Parse failures from `output.xml`

Write the script below to a temp file and run it (a file avoids shell quoting issues). It reads the newest `output.xml` under `results/` or a downloaded CI artifact folder such as `robot-results (4)/`.

```python
import glob, os, xml.etree.ElementTree as ET

candidates = glob.glob("results/output.xml") + glob.glob("robot-results*/output.xml")
if not candidates:
    raise FileNotFoundError("No output.xml found")
xml_path = max(candidates, key=os.path.getmtime)
print("Parsing: " + xml_path + "\n")

root = ET.parse(xml_path).getroot()
for test in root.iter("test"):
    status = test.find("status")
    if status is None or status.get("status") != "FAIL":
        continue
    name = test.get("name")
    all_msgs = [m.text or "" for m in test.iter("msg")]
    fail_msgs = [m.text or "" for m in test.iter("msg") if m.get("level") in ("FAIL", "ERROR")]
    fail_text = next((m for m in all_msgs if "compared images are different" in m.lower()), None)
    timeout_text = next((m for m in all_msgs if "timeouterror" in m.lower() or "element is not visible" in m.lower()), None)
    if fail_text:
        shot = next((m for m in all_msgs if "browser/screenshot/" in m), "")
        ref = next((m for m in all_msgs if "dashboard_output" in m), "")
        shot_file = shot.split("browser/screenshot/")[-1].split('"')[0].split("'")[0].strip() if shot else "?"
        ref_path = ref.split("dashboard_output/")[-1].strip() if ref else "?"
        ref_folder = ref_path.split("/")[0] if "/" in ref_path else "?"
        print(f"STALE SCREENSHOT [{name}]\n  screenshot : {shot_file}\n  ref folder : tests/robot/resources/dashboard_output/{ref_folder}/")
    elif timeout_text:
        el = next((m for m in all_msgs if "locator" in m.lower() or "click" in m.lower()), timeout_text)
        print(f"TIMEOUT / NOT VISIBLE [{name}]\n  {el[:300]}")
    else:
        other = next((m for m in fail_msgs if m.strip()), "")
        print(f"OTHER FAILURE [{name}]: {other[:300]}")
    print()
```

| Symptom | Cause | Fix |
|---|---|---|
| `The compared images are different.` | Reference screenshot stale (UI changed intentionally) | Regenerate reference in Docker (Step 2) |
| `TimeoutError: locator.click … element is not visible` | Element moved to another settings tab / modal section / collapsed section | Find its new container in `templates/dashboard.html`, update the keyword to open that container first (Step 3) |
| Assertion on text/count | Behaviour changed | Decide whether the test or the code is wrong — do not just update the expectation |

### Step 2 — Regenerate stale reference screenshots (Docker only)

```bash
bash scripts/docker/run-in-robot-container.sh robot --outputdir results tests/robot/testsuites/<suite>.robot
cp results/browser/screenshot/<name>.png tests/robot/resources/dashboard_output/<folder>/<name>.png
```

Screenshots from a downloaded CI artifact (`robot-results (N)/browser/screenshot/`) are also valid sources — the `${reference}` log path starting with `/__w/` confirms a Linux run. **Never** copy a screenshot taken on a Windows host: font rendering differs and it will fail in CI.

### Step 3 — Element-not-visible timeouts

1. Search `templates/dashboard.html` for the element id to find its tab pane / modal.
2. Update the keyword in `dashboard-keywords.resource` to navigate there first (e.g. click the tab button before the element).

### Step 4 — Transient UI elements

If a new notice/banner appears in screenshots, add its flag to `tests/robot/resources/test_config.json` with `true` (dismissed):

```json
{ "notices": { "statWidgets": true } }
```

### Step 5 — Verify

Re-run the fixed suites in Docker and confirm `N tests, N passed, 0 failed`; `results/output.xml` `<stat>` elements must show `fail="0"`.
