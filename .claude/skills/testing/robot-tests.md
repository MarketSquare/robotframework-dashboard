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

`scripts/robot-tests.sh` runs pabot with `--pabotlib --testlevelsplit --artifacts png,jpg --artifactsinsubfolders --processes 2 -d results`. `--pabotlib` starts the shared lock server (needed by the index counter below); `--testlevelsplit` parallelises per test case.

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
| `tests/robot/resources/keywords/general-keywords.resource` | `Get Dashboard Index`, `Generate Dashboard`, `Remove Database And Dashboard With Index` |
| `tests/robot/resources/keywords/database-keywords.resource` | DB connection helpers, normalisation, row comparison |
| `tests/robot/resources/keywords/dashboard-keywords.resource` | Browser lifecycle (`Open Dashboard`), page navigation (`Open Overview Page`, …), filter helpers (`Set Run Filter`, `Set Run Tags Filter`, `Set Date Filter`, `Set Amount Filter`, `Set Versions Filter`), profile helpers, `Validate Component`, `Validate Filter Settings`, `Should Show N Of M Runs`, `Change Settings` |
| `tests/robot/resources/outputs/` | The 15 `output.xml` fixtures (tagged `prod`/`dev`, `project_1`/`project_2`, `version_1.0`–`1.2`) |
| `tests/robot/resources/cli_output/` | Expected CLI output reference files |
| `tests/robot/resources/database_output/` | Expected DB row reference files |
| `tests/robot/resources/dashboard_output/<folder>/<name>.png` | Reference screenshots |
| `tests/robot/resources/test_config.json` | Passed via `-j` in `Generate Dashboard`; dismisses notices/banners that would overlay screenshots |

### Parallel-safe index system

Tests run in parallel and each needs its own `.db` and `.html`. `Get Dashboard Index` uses a pabot lock to atomically bump `tests/robot/resources/index.txt`; each test gets integer N and works with `robotresults_N.db` + `robotdashboard_N.html`. `Remove Database And Dashboard With Index` cleans both up in teardown. Always use it for new browser tests.

### Fixture facts useful for assertions

15 runs total. By run tag: `prod` 8, `dev` 7, `project_1` 8, `project_2` 7, `amount` 1. Overview "Latest Runs" cards in run-tags mode have ids `overviewLatest<tag>Card0` (e.g. `overviewLatestproject_1Card0`).

---

## Browser tests (02–07)

- Headless Chromium via `robotframework-browser`; `Open Dashboard` opens `robotdashboard_N.html` over `file://`, sets animation duration to 0, and hides the relative run-time labels so screenshots stay deterministic.
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
