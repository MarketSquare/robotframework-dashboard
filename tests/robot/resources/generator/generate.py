"""Regenerate the output.xml / log.html fixtures in tests/robot/resources/outputs.

    python tests/robot/resources/generator/generate.py            # all runs
    python tests/robot/resources/generator/generate.py --only 3   # one run (index in SCHEDULE)
    python tests/robot/resources/generator/generate.py --outdir /tmp/x --keep

Each entry in SCHEDULE is one Robot Framework run of one of the simulated
projects (WebshopUI, WebshopAPI). The run is executed for real with the fake
libraries under libraries/, then post-processed:

* every timestamp is moved so the run starts at the scheduled date/time,
* every duration is multiplied by SIM_SCALE (the libraries sleep 1/SIM_SCALE of
  the intended time so generation stays fast),
* log-<stamp>.html is rebuilt from the shifted output with rebot so log linking
  (--uselogs) keeps working,
* runs listed in RERUNS re-execute their failed tests with `robot --rerunfailed`
  (one or two times) and the attempts are merged with `rebot --merge`, the way a
  CI pipeline with retries produces its output.xml.

Behaviour of the tests (failures, flakiness, exceptions, skips, slowness) is
declared in libraries/profiles.py.
"""

import argparse
import shutil
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from pathlib import Path

HERE = Path(__file__).resolve().parent
LIBRARIES = HERE / "libraries"
DEFAULT_OUTDIR = HERE.parent / "outputs"

SIM_SCALE = 50
SEED = 1
TIME_FORMAT = "%Y-%m-%dT%H:%M:%S.%f"
# suite `source` attributes point here instead of the temporary directory the run used
SOURCE_ROOT = "/home/runner/work/webshop-tests"

# (project, run_index, start time, environment). run_index drives the profiles in
# profiles.py (broken-since, fixed-since, BAD_RUNS, ...). Times are deliberately
# spread over weekdays and hours so the run heatmap and date filters have data.
SCHEDULE = [
    ("WebshopUI", 1, datetime(2026, 8, 17, 2, 15, 12), "staging"),
    ("WebshopAPI", 1, datetime(2026, 8, 17, 6, 0, 4), "staging"),
    ("WebshopUI", 2, datetime(2026, 8, 18, 2, 15, 45), "staging"),
    ("WebshopUI", 3, datetime(2026, 8, 19, 14, 40, 31), "staging"),
    ("WebshopAPI", 2, datetime(2026, 8, 20, 6, 0, 9), "staging"),
    ("WebshopUI", 4, datetime(2026, 8, 21, 2, 15, 3), "staging"),
    ("WebshopAPI", 3, datetime(2026, 8, 22, 10, 15, 27), "staging"),
    ("WebshopUI", 5, datetime(2026, 8, 24, 9, 5, 58), "production"),
    ("WebshopAPI", 4, datetime(2026, 8, 25, 6, 0, 16), "production"),
    ("WebshopUI", 6, datetime(2026, 8, 26, 2, 15, 22), "staging"),
    ("WebshopUI", 7, datetime(2026, 8, 28, 16, 20, 40), "staging"),
    ("WebshopAPI", 5, datetime(2026, 8, 28, 17, 45, 2), "staging"),
    ("WebshopUI", 8, datetime(2026, 9, 1, 2, 15, 19), "staging"),
    ("WebshopAPI", 6, datetime(2026, 9, 2, 6, 0, 33), "staging"),
    ("WebshopUI", 9, datetime(2026, 9, 4, 11, 30, 7), "staging"),
    ("WebshopAPI", 7, datetime(2026, 9, 5, 13, 0, 49), "staging"),
    ("WebshopUI", 10, datetime(2026, 9, 9, 2, 15, 36), "production"),
    ("WebshopAPI", 8, datetime(2026, 9, 10, 6, 0, 11), "production"),
]

# (project, run_index) -> number of reruns of the failed tests (robot --rerunfailed), merged
# into one output.xml with rebot --merge. Reruns use a different SEED so flaky and outage
# failures can recover while profile failures (always-fail, broken-since) keep failing.
RERUNS = {
    ("WebshopUI", 7): 1,
    ("WebshopAPI", 5): 2,
}
# pause between the end of an attempt and the start of the next one
RERUN_GAP = timedelta(minutes=2)

# Suite files that only exist from a given run index onwards (tests added over time)
# or that disappear from a given run index (tests removed). Paths relative to HERE.
ADDED_FILES = {
    "WebshopUI/checkout_gift_cards.robot": 6,
}
REMOVED_FILES = {
    "WebshopUI/login_registration.robot": 9,
}


def run_robot(project, project_dir, outdir, variables, metadata=None, rerun_failed=None):
    cmd = [
        sys.executable, "-m", "robot",
        "--name", project,
        "--pythonpath", str(LIBRARIES),
        "--outputdir", str(outdir),
        "--log", "NONE", "--report", "NONE",
        "--consolecolors", "off", "--consolewidth", "100",
    ]
    if rerun_failed:
        cmd += ["--rerunfailed", str(rerun_failed)]
    for key, value in variables.items():
        cmd += ["--variable", f"{key}:{value}"]
    for key, value in (metadata or {}).items():
        cmd += ["--metadata", f"{key}:{value}"]
    cmd.append(str(project_dir))
    result = subprocess.run(cmd, capture_output=True, text=True)
    # robot exits with the number of failed tests; only treat real errors as fatal
    if "[ ERROR ]" in result.stdout or "[ ERROR ]" in result.stderr or result.returncode >= 250:
        print(result.stdout)
        print(result.stderr)
        raise SystemExit(f"robot failed for {project_dir}")
    summary = [line for line in result.stdout.splitlines() if " tests, " in line][-1].strip()
    return outdir / "output.xml", summary


def calibrate(project, workdir):
    """Count the leaf steps per test so the plans know where a failure can land."""
    counts = workdir / f"steps-{project}.json"
    run_robot(
        project,
        HERE / project,
        workdir / f"calibrate-{project}",
        {"SIM_MODE": "count", "STEP_COUNTS_OUT": counts, "SEED": SEED, "RUN_INDEX": 0},
    )
    return counts


def prepare_project(project, run_index, workdir):
    """Copy the project and drop suite files that do not exist in this run."""
    target = workdir / f"src-{project}-{run_index}"
    shutil.copytree(HERE / project, target)
    for relative, since in ADDED_FILES.items():
        if relative.startswith(project) and run_index < since:
            (target / Path(relative).relative_to(project)).unlink()
    for relative, since in REMOVED_FILES.items():
        if relative.startswith(project) and run_index >= since:
            (target / Path(relative).relative_to(project)).unlink()
    return target


def shift_timestamps(xml_path, new_start, project, source_dir):
    """Move the run to new_start, scale every duration by SIM_SCALE, hide the temp paths.

    The `generated` attribute (which robotdashboard uses as run_start) becomes exactly
    new_start, so regenerating gives stable run identities.
    """
    tree = ET.parse(xml_path)
    root = tree.getroot()
    old_start = datetime.strptime(root.get("generated"), TIME_FORMAT)

    def convert(value):
        old = datetime.strptime(value, TIME_FORMAT)
        return (new_start + (old - old_start) * SIM_SCALE).strftime(TIME_FORMAT)

    for element in root.iter():
        if element.get("start"):
            element.set("start", convert(element.get("start")))
        if element.get("elapsed"):
            element.set("elapsed", "%.6f" % (float(element.get("elapsed")) * SIM_SCALE))
        if element.get("time"):
            element.set("time", convert(element.get("time")))
        if element.get("source"):
            relative = Path(element.get("source")).relative_to(source_dir).as_posix()
            element.set("source", f"{SOURCE_ROOT}/{project}" + ("" if relative == "." else f"/{relative}"))
    root.set("generated", new_start.strftime(TIME_FORMAT))
    tree.write(xml_path, encoding="UTF-8", xml_declaration=True)
    return root


def run_end(root):
    """End of the run according to the (shifted) output.xml: generated + elapsed of the root suite."""
    start = datetime.strptime(root.get("generated"), TIME_FORMAT)
    return start + timedelta(seconds=float(root.find("suite").find("status").get("elapsed")))


def rebot_merge(inputs, merged, generated):
    """rebot --merge the attempts into one output; `generated` (the run identity in robotdashboard)
    is the scheduled start instead of the wall clock rebot stamps in."""
    result = subprocess.run(
        [sys.executable, "-m", "robot.rebot", "--merge", "--output", str(merged),
         "--log", "NONE", "--report", "NONE", *map(str, inputs)],
        capture_output=True, text=True,
    )
    if not merged.exists() or "[ ERROR ]" in result.stderr:
        print(result.stdout)
        print(result.stderr)
        raise SystemExit(f"rebot --merge failed for {merged}")
    tree = ET.parse(merged)
    tree.getroot().set("generated", generated.strftime(TIME_FORMAT))
    tree.write(merged, encoding="UTF-8", xml_declaration=True)


def rerun_failed_tests(project, run_index, source, workdir, variables, metadata, xml_path, start, summary):
    """Re-execute the failed tests of xml_path RERUNS times and merge every attempt into one output."""
    root = ET.parse(xml_path).getroot()
    attempts = [xml_path]
    next_start = run_end(root) + RERUN_GAP
    for attempt in range(1, RERUNS[(project, run_index)] + 1):
        rerun_xml, rerun_summary = run_robot(
            project,
            source,
            workdir / f"rerun-{project}-{run_index}-{attempt}",
            dict(variables, SEED=SEED + 100 * attempt),
            metadata=metadata,
            rerun_failed=attempts[-1],
        )
        rerun_root = shift_timestamps(rerun_xml, next_start, project, source)
        summary += f", rerun {attempt}: {rerun_summary}"
        attempts.append(rerun_xml)
        next_start = run_end(rerun_root) + RERUN_GAP
    merged = workdir / f"merged-{project}-{run_index}.xml"
    rebot_merge(attempts, merged, start)
    return merged, summary


def rebot_log(xml_path, log_path):
    # rebot exits with the number of failed tests, so check the output instead of the code
    result = subprocess.run(
        [sys.executable, "-m", "robot.rebot", "--output", "NONE", "--report", "NONE",
         "--log", str(log_path), str(xml_path)],
        capture_output=True, text=True,
    )
    if not log_path.exists() or "[ ERROR ]" in result.stderr:
        print(result.stdout)
        print(result.stderr)
        raise SystemExit(f"rebot failed for {xml_path}")


def generate(schedule, outdir, workdir):
    counts = {}
    for project in sorted({entry[0] for entry in schedule}):
        counts[project] = calibrate(project, workdir)
    for index, (project, run_index, start, environment) in enumerate(schedule):
        # real runs never start on a whole second; keep the value deterministic per run
        start = start.replace(microsecond=(index * 123457) % 1000000)
        source = prepare_project(project, run_index, workdir)
        xml_path, summary = run_robot(
            project,
            source,
            workdir / f"run-{project}-{run_index}",
            {"SEED": SEED, "RUN_INDEX": run_index, "SIM_SCALE": SIM_SCALE, "STEP_COUNTS": counts[project]},
            metadata={"Environment": environment},
        )
        shift_timestamps(xml_path, start, project, source)
        if (project, run_index) in RERUNS:
            xml_path, summary = rerun_failed_tests(
                project, run_index, source, workdir,
                {"SEED": SEED, "RUN_INDEX": run_index, "SIM_SCALE": SIM_SCALE, "STEP_COUNTS": counts[project]},
                {"Environment": environment}, xml_path, start, summary,
            )
        stamp = start.strftime("%Y%m%d-%H%M%S")
        final_xml = outdir / f"output-{stamp}.xml"
        shutil.copy(xml_path, final_xml)
        rebot_log(final_xml, outdir / f"log-{stamp}.html")
        print(f"{final_xml.name}  {project:<10} run {run_index:>2}  {summary}")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--outdir", type=Path, default=DEFAULT_OUTDIR, help="where output-*.xml / log-*.html land")
    parser.add_argument("--only", type=int, action="append", help="0-based index in SCHEDULE; repeatable")
    parser.add_argument("--keep", action="store_true", help="keep existing files in --outdir")
    args = parser.parse_args()

    schedule = SCHEDULE if not args.only else [SCHEDULE[i] for i in args.only]
    if args.only:
        print("note: --only changes the run's microseconds (they derive from the SCHEDULE index); "
              "regenerate everything before committing")
    args.outdir.mkdir(parents=True, exist_ok=True)
    if not args.keep:
        for old in list(args.outdir.glob("output-*.xml")) + list(args.outdir.glob("log-*.html")):
            old.unlink()
    with tempfile.TemporaryDirectory(prefix="rfdashboard-fixtures-") as tmp:
        generate(schedule, args.outdir, Path(tmp))


if __name__ == "__main__":
    main()
