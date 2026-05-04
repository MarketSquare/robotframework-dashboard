---
name: fix-robot-tests
description: 'Follow this workflow whenever the user asks to fix failing robot tests. Covers: diagnosing failures from an output.xml, updating reference screenshots, fixing keyword navigation issues, regenerating screenshots via Docker. Use for: "fix robot tests", "tests are failing", "update reference images", "robot test failures".'
argument-hint: 'Optional: path to the output.xml or results folder containing the failing run'
---

# Fixing Robot Tests

## Step 1 — Parse failures from output.xml

Identify the failure types by parsing the output.xml (usually in `results/` or `robot-results*/`):

```python
import xml.etree.ElementTree as ET
tree = ET.parse('results/output.xml')
root = tree.getroot()
for test in root.iter('test'):
    status = test.find('status')
    if status is not None and status.get('status') == 'FAIL':
        name = test.get('name')
        for msg in test.iter('msg'):
            if msg.get('level') in ('FAIL', 'ERROR'):
                print(f'FAIL [{name}]: {(msg.text or "")[:400]}')
```

Two root causes appear in this project:

| Symptom | Cause | Fix |
|---|---|---|
| `The compared images are different.` | Reference screenshot is stale (UI changed) | Regenerate reference screenshots via Docker (Step 3) |
| `TimeoutError: locator.click … element is not visible` | An element moved to a different settings tab or modal section | Find the element's new location in `templates/dashboard.html` and update the keyword (Step 4) |

---

## Step 2 — Understand the test structure

- Test suites: `tests/robot/testsuites/`
- Keywords: `tests/robot/resources/keywords/dashboard-keywords.resource` and `general-keywords.resource`
- Reference screenshots: `tests/robot/resources/dashboard_output/<folder>/<name>.png`
- Screenshots captured during a run: `results/browser/screenshot/<name>.png`

The `Generate Dashboard` keyword (in `general-keywords.resource`) calls `robotdashboard` CLI. It now passes `-j tests/robot/resources/test_config.json` to suppress the "stat widgets" notification banner during tests.

---

## Step 3 — Update stale reference screenshots

### Option A — Copy from a previous Docker run
If `results/browser/screenshot/<name>.png` was captured inside Docker (e.g. from a previous `docker run` test run) and the new UI is correct, copy it straight to the reference folder:

```powershell
Copy-Item "results\browser\screenshot\<name>.png" `
          "tests\robot\resources\dashboard_output\<folder>\<name>.png" -Force
```

> **Important**: screenshots taken on a Windows host will not match Docker references due to font rendering differences. Only use Option A if the screenshot came from a Docker run.

### Option B — Regenerate via Docker (required when no Docker screenshots exist)

The robot docker image (`test-dashboard-robot`) is required. Build it once if it doesn't exist:

```bat
scripts\docker\create-test-image.bat robot
```

Run only the affected suite(s) inside the container to capture fresh screenshots:

```powershell
# From the repo root
docker run --rm --ipc=host -v "${PWD}:/robotframework-dashboard" test-dashboard-robot `
    bash -c "pip install -q . ; export PATH=`$PATH:~/.local/bin; robot --outputdir results_ref tests/robot/testsuites/<suite>.robot"
```

The screenshots land in `results/browser/screenshot/`. Copy them to the reference folder:

```powershell
Copy-Item "results\browser\screenshot\<name>.png" `
          "tests\robot\resources\dashboard_output\<folder>\<name>.png" -Force
```

---

## Step 4 — Fix element-not-visible timeouts

When a `locator.click` times out with `element is not visible`, the element exists in the DOM but is hidden — typically because it is inside a collapsed section, a modal that isn't open, or a tab panel that isn't active.

1. Search `templates/dashboard.html` for the element ID to find which tab pane or modal contains it.
2. Update the keyword in `dashboard-keywords.resource` to open/navigate to that container first (e.g. click the tab button before clicking the element inside it).
3. If the modal or section has changed structure, compare the current HTML with the keyword steps and align them.

---

## Step 5 — Check test_config.json suppresses transient UI elements

`tests/robot/resources/test_config.json` is passed to the CLI via `-j` in `Generate Dashboard`. It must disable any banners or notices that would overlay elements during screenshot comparison. Currently it contains:

```json
{
    "notices": {
        "statWidgets": true
    }
}
```

If a new notice/banner is added to the codebase and starts appearing in screenshots, add its flag here with `true` (dismissed).

---

## Step 6 — Verify

Re-run the fixed suites in Docker. Check the Robot summary line in the output — not the process exit code:

```
N tests, N passed, 0 failed
```

Two known false alarms that do **not** indicate real failures:
- **Exit code 1 from Docker** — pip writes deprecation warnings to stderr, which causes the shell to report exit code 1 even when all tests passed. Always check the Robot summary line.
- **`Path … index.txt does not exist` FAIL messages** in the log — these come from inside `Run Keyword And Return Status` in the `Get Dashboard Index` keyword and are expected when a test runs first. They do not fail the test.

To confirm a clean result, check `results/output.xml` for `fail="0"` in the `<stat>` elements:

```powershell
Select-String -Path "results\output.xml" -Pattern "stat name="
```
