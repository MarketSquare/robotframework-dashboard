---
name: fix-robot-tests
description: 'Follow this workflow whenever the user asks to fix failing robot tests. Covers: diagnosing failures from an output.xml, updating reference screenshots, fixing keyword navigation issues, regenerating screenshots via Docker. Use for: "fix robot tests", "tests are failing", "update reference images", "robot test failures".'
argument-hint: 'Optional: path to the output.xml or results folder containing the failing run'
---

# Fixing Robot Tests

## Step 1 — Parse failures from output.xml

Locate the `output.xml` — it is usually in `results/` or in an alternate folder such as `robot-results (4)/` when the run came from a downloaded CI artifact.

To diagnose failures, write the script below to a temp file and run it (writing to a file avoids PowerShell quote-escaping issues with inline `python -c`):

```powershell
@'
import glob, os, xml.etree.ElementTree as ET

candidates = glob.glob("results/output.xml") + glob.glob("robot-results*/output.xml")
if not candidates:
    raise FileNotFoundError("No output.xml found")
xml_path = max(candidates, key=os.path.getmtime)   # most recently modified
print("Parsing: " + xml_path + "\n")

tree = ET.parse(xml_path)
root = tree.getroot()
for test in root.iter("test"):
    status = test.find("status")
    if status is None or status.get("status") != "FAIL":
        continue
    name = test.get("name")
    all_msgs  = [msg.text or "" for msg in test.iter("msg")]
    fail_msgs = [msg.text or "" for msg in test.iter("msg") if msg.get("level") in ("FAIL", "ERROR")]
    fail_text    = next((m for m in all_msgs if "compared images are different" in m.lower()), None)
    timeout_text = next((m for m in all_msgs if "timeouterror" in m.lower() or "element is not visible" in m.lower()), None)
    if fail_text:
        screenshot_msg = next((m for m in all_msgs if "browser/screenshot/" in m), "")
        reference_msg  = next((m for m in all_msgs if "dashboard_output" in m), "")
        screenshot_file = screenshot_msg.split("browser/screenshot/")[-1].split('"')[0].split("'")[0].strip() if screenshot_msg else "?"
        ref_path   = reference_msg.split("dashboard_output/")[-1].strip() if reference_msg else "?"
        ref_folder = ref_path.split("/")[0] if "/" in ref_path else "?"
        print("STALE SCREENSHOT [" + name + "]")
        print("  screenshot : " + screenshot_file)
        print("  ref folder : tests/robot/resources/dashboard_output/" + ref_folder + "/")
    elif timeout_text:
        element_msg = next((m for m in all_msgs if "locator" in m.lower() or "click" in m.lower()), timeout_text)
        print("TIMEOUT / NOT VISIBLE [" + name + "]")
        print("  " + element_msg[:300])
    else:
        other = next((m for m in fail_msgs if m.strip()), "")
        print("OTHER FAILURE [" + name + "]: " + other[:300])
    print()
'@ | Out-File -Encoding utf8 "$env:TEMP\rf_diag.py"
python "$env:TEMP\rf_diag.py"
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

### Option A — Copy from a Docker run (local or CI artifact)
If the screenshots came from a Docker run — either a local `docker run` or a downloaded CI artifact folder such as `robot-results (4)/` — and the new UI is correct, copy them straight to the reference folder using the `Copy-Item` commands printed by the Step 1 script, or manually:

```powershell
# screenshots from a local Docker run land in results\browser\screenshot\
Copy-Item "results\browser\screenshot\<name>.png" `
          "tests\robot\resources\dashboard_output\<folder>\<name>.png" -Force

# screenshots from a CI artifact folder (e.g. robot-results (4)\) follow the same layout
Copy-Item "robot-results (4)\browser\screenshot\<name>.png" `
          "tests\robot\resources\dashboard_output\<folder>\<name>.png" -Force
```

> **Important**: screenshots taken on a Windows host will not match Docker references due to font rendering differences. Only use Option A if the screenshots came from a Docker or Linux CI run. Check the `${reference}` log message — a path starting with `/__w/` confirms it ran on Linux.

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
