"""Build the example dashboard (example/robot_dashboard.html + example/robot_results.db).

    python scripts/example.py

Imports every fixture from tests/robot/resources/outputs/ with run tags, project
versions, timezones and custom filters so the example shows all dashboard features,
then copies the result into example/. Runs the package from source (python -m), so
no install is needed. The fixtures come from tests/robot/resources/generator/.
"""

import shutil
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUTS = ROOT / "tests" / "robot" / "resources" / "outputs"
EXAMPLE = ROOT / "example"
DATABASE = ROOT / "robot_results.db"
DASHBOARD = ROOT / "robot_dashboard.html"

PROJECT_TAG = {"WebshopUI": "project_1", "WebshopAPI": "project_2"}
ENVIRONMENT_TAG = {"production": "prod", "staging": "dev"}
# project version per (project, nth run of that project)
VERSIONS = {
    "WebshopUI": ["1.0"] * 4 + ["1.1"] * 3 + ["1.2"] * 3,
    "WebshopAPI": ["1.0"] * 3 + ["1.1"] * 3 + ["1.2"] * 2,
}
# the UI team runs from Europe, the API team from the US east coast
TIMEZONES = {"WebshopUI": "+02:00", "WebshopAPI": "-04:00"}


def describe(xml_path):
    """Project name and Environment metadata of a fixture, from its top-level suite."""
    root = ET.parse(xml_path).getroot()
    suite = root.find("suite")
    environment = next((m.text for m in suite.findall("meta") if m.get("name") == "Environment"), "staging")
    return suite.get("name"), environment


def build_commands():
    fixtures = sorted(OUTPUTS.glob("output-*.xml"))
    seen = {project: 0 for project in PROJECT_TAG}
    commands = []
    for index, xml_path in enumerate(fixtures):
        project, environment = describe(xml_path)
        nth = seen[project]
        seen[project] += 1
        version = VERSIONS[project][nth]
        tags = f"{ENVIRONMENT_TAG[environment]}:{PROJECT_TAG[project]}"
        pipeline = "nightly" if xml_path.name[16:18] in ("02", "06") else "manual"
        release = f"2026.{35 + index // 4}"
        command = [
            sys.executable, "-m", "robotframework_dashboard.main",
            "-o", f"{xml_path.relative_to(ROOT).as_posix()}:{tags}",
            "--projectversion", version,
            "--customfilters", f"Pipeline={pipeline}:Release={release}",
            f"--timezone={TIMEZONES[project]}",
            "--uselogs",
            "-m", "example/messageconfig.txt",
        ]
        last = index == len(fixtures) - 1
        if last:
            command += ["-n", DASHBOARD.name, "-t", "Webshop_Test_Dashboard"]
        else:
            command += ["-g", "-l"]  # no dashboard, no run listing until the last import
        commands.append(command)
    return commands


def main():
    for stale in (DATABASE, DASHBOARD):
        if stale.exists():
            stale.unlink()
    for command in build_commands():
        print(" ".join(command[3:5]), flush=True)
        subprocess.run(command, cwd=ROOT, check=True)
    shutil.copy(DATABASE, EXAMPLE / DATABASE.name)
    shutil.copy(DASHBOARD, EXAMPLE / DASHBOARD.name)
    print(f"Updated {EXAMPLE / DATABASE.name} and {EXAMPLE / DASHBOARD.name}")


if __name__ == "__main__":
    main()
