"""Convert a Playwright JSON report into a Robot Framework output.xml.

robotdashboard only understands Robot Framework output.xml files. Instead of teaching
the dashboard a second input format, this adapter translates a Playwright run into the
Robot Framework result model and lets Robot Framework write the XML. The result can be
fed to robotdashboard like any other output:

    npx playwright test --reporter=json > report.json
    python playwright_to_robot.py report.json -o output-playwright.xml
    robotdashboard -o output-playwright.xml

Mapping:

    Playwright                          Robot Framework
    ----------------------------------  ------------------------------------------
    run (config + stats.startTime)      root suite, output.xml `generated` = run start
    project (only when > 1 project)     suite
    spec file (tests/cart.spec.ts)      suite per folder + suite per file ("cart")
    test.describe                       suite
    spec + project                      test
    tags (@smoke)                       test tags (smoke)
    test.step (nested)                  keywords (nested), library "Playwright"
    retries                             `rebot --merge` style message, so the dashboard
                                        shows every attempt; flaky tests get tag "flaky"
    expected / flaky / unexpected /     PASS / PASS / FAIL / SKIP
      skipped
    config.metadata                     root suite metadata

Requires Robot Framework 7 or newer (the version that writes output.xml schema 5).
"""

import argparse
import json
import re
import sys
from datetime import datetime, timedelta
from html import escape
from pathlib import Path

from robot.result import Result, TestSuite

ANSI_RE = re.compile(r"\x1b\[[0-9;]*m")
SPEC_SUFFIX_RE = re.compile(r"\.(spec|test)\.[cm]?[jt]sx?$|\.[cm]?[jt]sx?$")
STATUS_MAP = {"passed": "PASS", "skipped": "SKIP"}  # failed, timedOut, interrupted -> FAIL
MERGE_HEADER = '*HTML* <span class="merge">Test has been re-executed and results merged.</span>'
STEP_OWNER = "Playwright"


def parse_time(value: str) -> datetime:
    """Playwright writes UTC ISO timestamps; Robot Framework output uses naive local time."""
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone().replace(tzinfo=None)


def clean_name(name: str) -> str:
    """The dashboard splits full names on '.', so a dot inside a single name would create a fake level."""
    return name.replace(".", "_").strip() or "Unnamed"


def clean_message(message: str) -> str:
    return ANSI_RE.sub("", message or "").strip()


def result_status(result: dict) -> str:
    return STATUS_MAP.get(result.get("status"), "FAIL")


def result_message(result: dict, test: dict) -> str:
    errors = result.get("errors") or ([result["error"]] if result.get("error") else [])
    if errors:
        return "\n\n".join(clean_message(error.get("message", "")) for error in errors)
    if result.get("status") == "skipped":
        for annotation in result.get("annotations") or test.get("annotations") or []:
            if annotation.get("type") in ("skip", "fixme"):
                return annotation.get("description", "")
    return ""


def merge_message(attempts: list) -> str:
    """Build the message `rebot --merge` writes for a re-executed test.

    The dashboard parses this format back into a per-attempt history, so Playwright
    retries show up the same way as Robot Framework `--rerunfailed` runs.
    """

    def block(state: str, status: str, message: str) -> str:
        text = f'<span class="{state.lower()}-status">{state} status:</span> <span class="{status.lower()}">{status}</span><br>'
        if message:
            text += f'<span class="{state.lower()}-message">{state} message:</span> {escape(message)}<br>'
        return text

    *older, newest = attempts
    parts = [MERGE_HEADER, "<hr>", block("New", *newest)]
    for status, message in reversed(older):
        parts += ["<hr>", block("Old", status, message)]
    return "".join(parts)


class PlaywrightConverter:
    def __init__(self, report: dict, name: str = "Playwright", include_steps: bool = True):
        self.report = report
        self.name = name
        self.include_steps = include_steps
        projects = {p.get("name", "") for p in report.get("config", {}).get("projects", [])}
        self.split_projects = len(projects) > 1

    def convert(self) -> Result:
        stats = self.report.get("stats", {})
        root = TestSuite(name=self.name)
        for key, value in (self.report.get("config", {}).get("metadata") or {}).items():
            root.metadata[str(key)] = str(value)
        version = self.report.get("config", {}).get("version")
        if version:
            root.metadata["Playwright Version"] = version

        for file_suite in self.report.get("suites", []):
            self._add_file_suite(root, file_suite)

        errors = [clean_message(e.get("message", "")) for e in self.report.get("errors", [])]
        if errors:
            root.message = "\n\n".join(errors)

        self._set_suite_times(root)
        if stats.get("startTime"):
            root.start_time = parse_time(stats["startTime"])
            root.elapsed_time = timedelta(milliseconds=stats.get("duration", 0))
        return Result(suite=root)

    def _add_file_suite(self, root: TestSuite, file_suite: dict):
        # One JSON file suite holds the tests of every project; split them per project first.
        projects = dict.fromkeys(test.get("projectName", "") for test in self._all_tests(file_suite))
        *folders, file_name = (file_suite.get("file") or file_suite["title"]).replace("\\", "/").split("/")
        for project in projects:
            parent = self._child_suite(root, project) if self.split_projects else root
            for folder in folders:
                parent = self._child_suite(parent, folder)
            file_node = self._child_suite(parent, SPEC_SUFFIX_RE.sub("", file_name))
            self._add_suite_content(file_node, file_suite, project)

    def _all_tests(self, suite: dict):
        for spec in suite.get("specs", []):
            yield from spec.get("tests", [])
        for child in suite.get("suites", []):
            yield from self._all_tests(child)

    def _child_suite(self, parent: TestSuite, title: str) -> TestSuite:
        name = clean_name(title)
        for suite in parent.suites:
            if suite.name == name:
                return suite
        return parent.suites.create(name=name)

    def _add_suite_content(self, node: TestSuite, pw_suite: dict, project: str):
        for spec in pw_suite.get("specs", []):
            for test in spec.get("tests", []):
                if test.get("projectName", "") == project:
                    self._add_test(node, spec, test)
        for child in pw_suite.get("suites", []):
            if any(t.get("projectName", "") == project for t in self._all_tests(child)):
                self._add_suite_content(self._child_suite(node, child["title"]), child, project)

    def _add_test(self, suite: TestSuite, spec: dict, test: dict):
        results = test.get("results") or []
        final = results[-1] if results else {"status": "skipped"}
        # Use Playwright's verdict, not the raw result: a test.fail() test that fails is "expected".
        status = {"expected": "PASS", "flaky": "PASS", "unexpected": "FAIL", "skipped": "SKIP"}.get(
            test.get("status"), result_status(final)
        )

        tags = list(spec.get("tags", []))
        if test.get("status") == "flaky":
            tags.append("flaky")
        for annotation in test.get("annotations", []):
            if annotation.get("type") in ("fail", "slow", "fixme"):
                tags.append(annotation["type"])

        message = result_message(final, test)
        if len(results) > 1:
            attempts = [(result_status(r), result_message(r, test)) for r in results[:-1]]
            attempts.append((status, message))
            message = merge_message(attempts)

        start = parse_time(final["startTime"]) if final.get("startTime") else None
        robot_test = suite.tests.create(
            name=clean_name(spec["title"]),
            tags=tags,
            status=status,
            message=message,
            start_time=start,
            elapsed_time=timedelta(milliseconds=final.get("duration", 0)),
        )
        if self.include_steps and start is not None:
            self._add_steps(robot_test.body, final.get("steps", []), start, status == "SKIP")

    def _add_steps(self, body, steps: list, start: datetime, skipped: bool):
        # Steps carry only a duration, so start times are laid out sequentially.
        for step in steps:
            elapsed = timedelta(milliseconds=step.get("duration", 0))
            status = "SKIP" if skipped else "FAIL" if step.get("error") else "PASS"
            keyword = body.create_keyword(
                name=step.get("title", "step"),
                owner=STEP_OWNER,
                status=status,
                message=clean_message((step.get("error") or {}).get("message", "")),
                start_time=start,
                elapsed_time=elapsed,
            )
            self._add_steps(keyword.body, step.get("steps", []), start, skipped)
            start += elapsed

    def _set_suite_times(self, suite: TestSuite):
        for child in suite.suites:
            self._set_suite_times(child)
        starts = [t.start_time for t in suite.all_tests if t.start_time]
        ends = [t.start_time + t.elapsed_time for t in suite.all_tests if t.start_time]
        if starts:
            suite.start_time = min(starts)
            suite.end_time = max(ends)


def convert(report_path: Path, output_path: Path, name: str = "Playwright", include_steps: bool = True,
            log_path: Path = None) -> Path:
    report = json.loads(Path(report_path).read_text(encoding="utf-8"))
    result = PlaywrightConverter(report, name=name, include_steps=include_steps).convert()
    result.save(str(output_path))
    # robotdashboard identifies a run by the output.xml `generated` timestamp; use the
    # Playwright start time so converting the same report twice is detected as a duplicate.
    start_time = report.get("stats", {}).get("startTime")
    if start_time:
        xml = Path(output_path).read_text(encoding="utf-8")
        xml = re.sub(r'generated="[^"]*"', f'generated="{parse_time(start_time).isoformat()}"', xml, count=1)
        Path(output_path).write_text(xml, encoding="utf-8")
    if log_path:
        from robot import rebot

        rebot(str(output_path), log=str(log_path), report=None, output=None, stdout=None)
    return Path(output_path)


def main(argv=None):
    parser = argparse.ArgumentParser(description="Convert a Playwright JSON report to a Robot Framework output.xml")
    parser.add_argument("report", type=Path, help="Playwright JSON report (--reporter=json)")
    parser.add_argument("-o", "--output", type=Path, default=Path("output-playwright.xml"),
                        help="output.xml to write (default: output-playwright.xml)")
    parser.add_argument("-n", "--name", default="Playwright", help="name of the root suite (default: Playwright)")
    parser.add_argument("-l", "--log", type=Path, help="also write a Robot Framework log.html (for log linking)")
    parser.add_argument("--no-steps", action="store_true", help="do not convert test.step() calls to keywords")
    args = parser.parse_args(argv)
    output = convert(args.report, args.output, args.name, not args.no_steps, args.log)
    print(f"Wrote {output}")


if __name__ == "__main__":
    sys.exit(main())
