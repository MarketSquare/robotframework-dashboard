"""Run the sample Playwright suite a few times and build a robotdashboard from the results.

    cd adapters/playwright/sample && npm install && npx playwright install chromium
    python adapters/playwright/demo.py --runs 5                      # dashboard reporter: all steps
    python adapters/playwright/demo.py --runs 5 --group-by-function  # … grouped per helper function
    python adapters/playwright/demo.py --runs 5 --reporter json      # Playwright's own JSON reporter

Writes everything to adapters/playwright/demo_output/ (git-ignored):
output-run<N>.xml, log-run<N>.html, playwright.db and robot_dashboard.html.
"""

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(HERE))

from playwright_to_robot import convert  # noqa: E402


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--runs", type=int, default=5, help="number of Playwright runs (default: 5)")
    parser.add_argument("--reporter", choices=("dashboard", "json"), default="dashboard",
                        help="dashboard-reporter.js (every action as keyword) or the built-in JSON reporter "
                             "(only test.step); default: dashboard")
    parser.add_argument("--group-by-function", action="store_true",
                        help="dashboard reporter: group actions per helper function / page object method")
    args = parser.parse_args()

    sample = HERE / "sample"
    out = HERE / "demo_output"
    shutil.rmtree(out, ignore_errors=True)
    out.mkdir()
    npx = "npx.cmd" if os.name == "nt" else "npx"

    outputs = []
    for run in range(1, args.runs + 1):
        report = out / f"report-run{run}.json"
        env = dict(os.environ, SAMPLE_ENV="staging" if run % 2 else "production",
                   PLAYWRIGHT_DASHBOARD_OUTPUT_FILE=str(report),
                   PLAYWRIGHT_DASHBOARD_GROUP_BY_FUNCTION="1" if args.group_by_function else "0")
        print(f"Playwright run {run}/{args.runs}")
        # Failing tests are part of the sample, so a non-zero exit code is expected.
        if args.reporter == "dashboard":
            subprocess.run([npx, "playwright", "test", f"--reporter={HERE / 'dashboard-reporter.js'}"],
                           cwd=sample, env=env, stdout=subprocess.DEVNULL)
        else:
            with report.open("w", encoding="utf-8") as stdout:
                subprocess.run([npx, "playwright", "test", "--reporter=json"], cwd=sample, env=env, stdout=stdout)
        output = out / f"output-run{run}.xml"
        convert(out / f"report-run{run}.json", output, log_path=out / f"log-run{run}.html")
        outputs.append(output)

    command = [sys.executable, "-m", "robotframework_dashboard.main",
               "-d", str(out / "playwright.db"), "-n", str(out / "robot_dashboard.html"),
               "-t", "Playwright Dashboard", "--uselogs", "True"]
    for output in outputs:
        # relative path: a Windows drive letter would clash with the ":tag" suffix
        command += ["-o", f"{output.relative_to(REPO).as_posix()}:playwright"]
    subprocess.run(command, cwd=REPO, check=True)
    print(f"Dashboard: {out / 'robot_dashboard.html'}")


if __name__ == "__main__":
    main()
