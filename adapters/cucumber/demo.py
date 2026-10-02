"""Run the sample Cucumber + Selenium suite a few times and build a robotdashboard from the results.

    python adapters/cucumber/demo.py --runs 5               # Cucumber JSON reports
    python adapters/cucumber/demo.py --runs 5 --format ndjson  # Cucumber Messages reports

Needs JDK 17+ and Chrome; the Maven wrapper in sample/ downloads Maven itself. Every run
reruns its failed scenarios once (Cucumber's rerun plugin), so scenarios that only fail now
and then show up as flaky in the dashboard.

Writes everything to adapters/cucumber/demo_output/ (git-ignored): the raw reports,
output-run<N>.xml, log-run<N>.html, cucumber.db and robot_dashboard.html.
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

from cucumber_to_robot import convert  # noqa: E402


def maven(sample: Path, report: Path, *properties: str):
    mvnw = str(sample / ("mvnw.cmd" if os.name == "nt" else "mvnw"))
    # Failing scenarios are part of the sample, so a non-zero exit code is expected; only a
    # missing report means Maven itself failed.
    run = subprocess.run([mvnw, "-q", "-B", "test", *properties], cwd=sample, capture_output=True, text=True,
                         encoding="utf-8", errors="replace")
    if not report.exists():
        print("\n".join((run.stdout + run.stderr).splitlines()[-25:]))
        sys.exit(f"\nMaven did not produce {report.name}. The sample needs JDK 17 or newer: check `java -version` "
                 f"and that JAVA_HOME (now {os.environ.get('JAVA_HOME', 'not set')}) points to that JDK.")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--runs", type=int, default=5, help="number of Cucumber runs (default: 5)")
    parser.add_argument("--format", choices=("json", "ndjson"), default="json",
                        help="report format to convert (default: json)")
    args = parser.parse_args()

    sample = HERE / "sample"
    reports = sample / "target" / "cucumber"
    out = HERE / "demo_output"
    shutil.rmtree(out, ignore_errors=True)
    out.mkdir()

    outputs = []
    for run in range(1, args.runs + 1):
        print(f"Cucumber run {run}/{args.runs}")
        shutil.rmtree(reports, ignore_errors=True)
        maven(sample, reports / f"report.{args.format}")
        report = out / f"report-run{run}.{args.format}"
        shutil.copy(reports / f"report.{args.format}", report)

        reruns = []
        rerun_file = reports / "rerun.txt"
        failed = rerun_file.read_text().split() if rerun_file.exists() else []
        if failed:
            print("  rerunning the failed scenarios")
            # The JUnit Platform engine takes the failed scenarios (feature:line) from
            # cucumber.features, not as @rerun.txt. Excluding the top-level cucumber engine
            # keeps it from running them a second time next to the suite class.
            maven(sample, reports / f"rerun.{args.format}", f"-Dcucumber.features={','.join(failed)}",
                  "-Dcucumber.plugin=json:target/cucumber/rerun.json,message:target/cucumber/rerun.ndjson",
                  "-Dsurefire.excludeJUnit5Engines=cucumber")
            reruns.append(out / f"report-run{run}-rerun.{args.format}")
            shutil.copy(reports / f"rerun.{args.format}", reruns[0])

        output = out / f"output-run{run}.xml"
        convert(report, output, log_path=out / f"log-run{run}.html", reruns=reruns,
                metadata={"Browser": "chrome", "Environment": "staging" if run % 2 else "production"},
                include_attachments=True)
        outputs.append(output)

    command = [sys.executable, "-m", "robotframework_dashboard.main",
               "-d", str(out / "cucumber.db"), "-n", str(out / "robot_dashboard.html"),
               "-t", "Cucumber Dashboard", "--uselogs", "True"]
    for output in outputs:
        # relative path: a Windows drive letter would clash with the ":tag" suffix
        command += ["-o", f"{output.relative_to(REPO).as_posix()}:cucumber:{args.format}"]
    subprocess.run(command, cwd=REPO, check=True)
    print(f"Dashboard: {out / 'robot_dashboard.html'}")


if __name__ == "__main__":
    main()
