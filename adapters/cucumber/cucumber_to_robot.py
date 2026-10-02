"""Convert Cucumber reports (JSON or NDJSON messages) into a Robot Framework output.xml.

robotdashboard only understands Robot Framework output.xml files. Instead of teaching the
dashboard a second input format, this adapter translates a Cucumber run into the Robot
Framework result model and lets Robot Framework write the XML:

    mvn test        # with cucumber.plugin=json:target/cucumber.json (or message:…ndjson)
    python cucumber_to_robot.py target/cucumber.json -o output-cucumber.xml
    robotdashboard -o output-cucumber.xml

Both report formats are read, detected from the file content:

- Cucumber JSON (``json:`` plugin), the format most projects already produce;
- Cucumber Messages NDJSON (``message:`` plugin), which adds real step timestamps, Rules,
  hook types and retry attempts.

Mapping:

    Cucumber                            Robot Framework
    ----------------------------------  ------------------------------------------
    run (one or more report files)      root suite, output.xml `generated` = run start
    feature file folders                suites (folders shared by every feature dropped)
    Feature                             suite
    Rule (NDJSON only)                  suite
    Scenario / Scenario Outline row     test ("Name [Example N]" for outline rows)
    tags (@smoke)                       test tags (smoke)
    step                                keyword, argument values replaced by {} in the name,
                                        step definition class as library
    Background                          GROUP "Background" holding its steps
    hooks (@Before, @After, …)          keywords, hook class as library
    passed / skipped                    PASS / SKIP
    failed / pending / undefined /      FAIL (+ tag pending / undefined / ambiguous)
      ambiguous
    attempts (retries, --rerun files)   `rebot --merge` style message, so the dashboard
                                        shows every attempt; flaky tests get tag "flaky"

Requires Robot Framework 7 or newer (the version that writes output.xml schema 5).
"""

import argparse
import json
import re
import sys
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from html import escape
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from robot.result import Result, TestSuite

# Cucumber's own severity order: a scenario gets the status of its most severe step.
SEVERITY = ["unknown", "passed", "skipped", "pending", "undefined", "ambiguous", "failed"]
FAILING = ("failed", "ambiguous", "undefined", "pending")
ANSI_RE = re.compile(r"\x1b\[[0-9;]*m")
STACK_LINE_RE = re.compile(r"^\s+at \S")
JAVA_PACKAGE_RE = re.compile(r"^(?:[a-z_$][\w$]*\.)+(?=[A-Z][\w$]*(?::|$))")
JAVA_METHOD_RE = re.compile(r"^(?P<cls>[\w$.]+)\.(?P<method>[\w$<>]+)\(.*\)$")
# Lines Selenium appends to every WebDriver error. They change per run (session id, browser
# version, ports), so they would stop the dashboard from grouping equal failures.
NOISE_PREFIXES = (
    "(Session info", "(tried for", "For documentation on this error", "Build info:", "System info:",
    "Driver info:", "Command:", "Capabilities {", "Session ID:", "Element:",
)
MERGE_HEADER = '*HTML* <span class="merge">Test has been re-executed and results merged.</span>'
GROUP_OWNER = "Cucumber"


# --------------------------------------------------------------------------------------
# Intermediate model, filled by both parsers
# --------------------------------------------------------------------------------------

@dataclass
class Step:
    name: str
    owner: str
    status: str  # Cucumber status, lower case
    args: Tuple[str, ...] = ()
    error: str = ""  # full error text (stack trace included)
    start: Optional[datetime] = None
    elapsed: timedelta = timedelta(0)
    attachments: list = field(default_factory=list)  # (media type, name, body, is base64)
    hook: bool = False


@dataclass
class Attempt:
    start: Optional[datetime]
    end: Optional[datetime]
    before: List[Step] = field(default_factory=list)  # Before hooks
    background: List[Step] = field(default_factory=list)  # Background steps and their step hooks
    steps: List[Step] = field(default_factory=list)  # scenario steps and their step hooks
    after: List[Step] = field(default_factory=list)  # After hooks

    def all_steps(self) -> List[Step]:
        return self.before + self.background + self.steps + self.after

    @property
    def status(self) -> str:
        statuses = [step.status for step in self.all_steps()] or ["passed"]
        return max(statuses, key=lambda status: SEVERITY.index(status) if status in SEVERITY else 0)

    @property
    def message(self) -> str:
        status = self.status
        for step in self.all_steps():
            if step.status == status and status in FAILING:
                message = clean_message(step.error)
                return message or f"{status.capitalize()} step: {step.name}"
            if step.status == status == "skipped" and step.error:
                return clean_message(step.error)  # e.g. a JUnit assumption that skipped the scenario
        return ""


@dataclass
class Scenario:
    uri: str
    line: int
    suites: Tuple[str, ...]  # feature name, plus the rule name for NDJSON
    name: str
    tags: List[str]
    attempts: List[Attempt] = field(default_factory=list)

    @property
    def key(self):
        return self.uri, self.line


@dataclass
class Run:
    start: Optional[datetime] = None
    end: Optional[datetime] = None
    scenarios: List[Scenario] = field(default_factory=list)
    metadata: Dict[str, str] = field(default_factory=dict)
    errors: List[str] = field(default_factory=list)

    def add(self, other: "Run"):
        """Combine with a report of the same run (another runner class or module)."""
        self.scenarios += other.scenarios
        self.metadata.update(other.metadata)
        self.errors += other.errors
        self.start = min_time(self.start, other.start)
        self.end = max_time(self.end, other.end)

    def merge_rerun(self, other: "Run"):
        """Add the attempts of a rerun (`rerun:` plugin + `@rerun.txt`) to the scenarios they retried."""
        scenarios = {scenario.key: scenario for scenario in self.scenarios}
        for scenario in other.scenarios:
            if scenario.key in scenarios:
                scenarios[scenario.key].attempts += scenario.attempts
            else:
                self.scenarios.append(scenario)
        self.errors += other.errors
        self.start = min_time(self.start, other.start)
        self.end = max_time(self.end, other.end)


def min_time(*times):
    return min((t for t in times if t), default=None)


def max_time(*times):
    return max((t for t in times if t), default=None)


# --------------------------------------------------------------------------------------
# Helpers shared by both parsers
# --------------------------------------------------------------------------------------

def parse_iso(value: Optional[str]) -> Optional[datetime]:
    """Cucumber writes UTC ISO timestamps; Robot Framework output uses naive local time."""
    if not value:
        return None
    value = value.replace("Z", "+00:00")
    # Pythons before 3.11 only accept exactly 3 or 6 fraction digits.
    value = re.sub(r"\.(\d+)", lambda m: "." + m.group(1)[:6].ljust(6, "0"), value, count=1)
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone().replace(tzinfo=None)


def parse_timestamp(value: Optional[dict]) -> Optional[datetime]:
    """NDJSON timestamps are {seconds, nanos} since the epoch."""
    if not value:
        return None
    seconds = value.get("seconds", 0) + value.get("nanos", 0) / 1e9
    return datetime.fromtimestamp(seconds, tz=timezone.utc).astimezone().replace(tzinfo=None)


def parse_duration(value: Optional[dict]) -> timedelta:
    if not value:
        return timedelta(0)
    return timedelta(seconds=value.get("seconds", 0), microseconds=value.get("nanos", 0) / 1000)


def clean_name(name: str) -> str:
    """The dashboard splits full names on '.', so a dot inside a single name would create a fake level."""
    return (name or "").replace(".", "_").strip() or "Unnamed"


def clean_message(message: str) -> str:
    """First part of an error: no stack trace, no Selenium session details, no Java package prefix.

    The dashboard groups failures on their message, so keep only what is the same every run.
    """
    lines = []
    for line in ANSI_RE.sub("", message or "").replace("\r\n", "\n").split("\n"):
        if STACK_LINE_RE.match(line) or line.strip().startswith(NOISE_PREFIXES):
            break
        lines.append(line.rstrip())
    return JAVA_PACKAGE_RE.sub("", "\n".join(lines).strip())


def unquote(value: str) -> str:
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        return value[1:-1]
    return value


def step_name(text: str, arguments: List[Tuple[int, str]], raw: bool) -> str:
    """Replace argument values by {} so one step definition is one keyword in the dashboard.

    `arguments` holds (offset, matched text) pairs, exactly as Cucumber matched them.
    """
    if raw:
        return text
    for offset, value in sorted(arguments, reverse=True):
        if offset is not None and value is not None and text[offset:offset + len(value)] == value:
            text = text[:offset] + "{}" + text[offset + len(value):]
    return text


def table_text(rows: List[List[str]]) -> str:
    return "\n".join("| " + " | ".join(row) + " |" for row in rows)


def owner_and_name(location: str, default_name: str) -> Tuple[str, str]:
    """Library and name from a step or hook location.

    Java: `shop.steps.Hooks.startBrowser()` → (Hooks, startBrowser).
    Other implementations: `features/support/hooks.js:12` → (hooks, default_name).
    """
    match = JAVA_METHOD_RE.match(location or "")
    if match:
        return match.group("cls").rsplit(".", 1)[-1], match.group("method")
    path = re.sub(r":\d+$", "", location or "")
    return (Path(path).stem if path else GROUP_OWNER), default_name


def example_name(name: str, row: int) -> str:
    return f"{name} [Example {row}]"


# --------------------------------------------------------------------------------------
# Cucumber JSON
# --------------------------------------------------------------------------------------

class JsonParser:
    """Reads the `json:` plugin report: a list of features with their scenarios."""

    def __init__(self, features: list, raw_names: bool = False):
        self.features = features
        self.raw_names = raw_names

    def parse(self) -> Run:
        run = Run()
        for feature in self.features:
            background = []
            for element in feature.get("elements", []):
                # The report repeats the background before every scenario it applies to.
                if element.get("type") == "background":
                    background = element.get("steps", [])
                    continue
                scenario = self._scenario(feature, element, background)
                background = []
                run.scenarios.append(scenario)
                attempt = scenario.attempts[0]
                run.start = min_time(run.start, attempt.start)
                run.end = max_time(run.end, attempt.end)
        return run

    def _scenario(self, feature: dict, element: dict, background: list) -> Scenario:
        name = element.get("name", "")
        # Outline rows share the outline's name. Their id ends in ";<examples name>;<row>", where
        # row is the position in the Examples table, the header being row 1. The keyword is
        # translated in other languages, hence the id check.
        row = re.search(r";;(\d+)$", element.get("id", ""))
        if row or "outline" in element.get("keyword", "").lower():
            last = element.get("id", "").rsplit(";", 1)[-1]
            name = example_name(name, int(last) - 1 if last.isdigit() else element.get("line", 0))
        tags = [tag["name"] for tag in element.get("tags", [])]
        start = parse_iso(element.get("start_timestamp"))
        attempt = Attempt(start=start, end=None)
        clock = [start]
        attempt.before = [self._hook(hook, "Before", clock) for hook in element.get("before", [])]
        attempt.background = self._steps(background, clock)
        attempt.steps = self._steps(element.get("steps", []), clock)
        attempt.after = [self._hook(hook, "After", clock) for hook in element.get("after", [])]
        attempt.end = clock[0]
        return Scenario(uri=feature.get("uri", ""), line=element.get("line", 0),
                        suites=(feature.get("name", ""),), name=name, tags=tags, attempts=[attempt])

    def _steps(self, steps: list, clock: list) -> List[Step]:
        result = []
        for step in steps:
            result += [self._hook(hook, "BeforeStep", clock) for hook in step.get("before", [])]
            result.append(self._step(step, clock))
            result += [self._hook(hook, "AfterStep", clock) for hook in step.get("after", [])]
        return result

    def _step(self, step: dict, clock: list) -> Step:
        text = step.get("name", "")
        match = step.get("match") or {}
        arguments = match.get("arguments") or []
        owner, _ = owner_and_name(match.get("location", ""), "")
        status = (step.get("result") or {}).get("status", "unknown")
        if status in ("undefined", "ambiguous") or not match.get("location"):
            owner = status.capitalize() if status in ("undefined", "ambiguous") else GROUP_OWNER
        args = [unquote(arg.get("val", "")) for arg in arguments if arg.get("val") is not None]
        if step.get("doc_string"):
            args.append(step["doc_string"].get("value", ""))
        if step.get("rows"):
            args.append(table_text([row.get("cells", []) for row in step["rows"]]))
        name = step_name(text, [(arg.get("offset"), arg.get("val")) for arg in arguments], self.raw_names)
        return self._timed(Step(name=name, owner=owner, status=status, args=tuple(args)), step, clock)

    def _hook(self, hook: dict, kind: str, clock: list) -> Step:
        owner, name = owner_and_name((hook.get("match") or {}).get("location", ""), f"{kind} hook")
        status = (hook.get("result") or {}).get("status", "unknown")
        return self._timed(Step(name=name, owner=owner, status=status, hook=True), hook, clock)

    @staticmethod
    def _timed(step: Step, raw: dict, clock: list) -> Step:
        # JSON has durations (nanoseconds) but no start times; lay the steps out back to back.
        result = raw.get("result") or {}
        step.error = result.get("error_message", "")
        step.elapsed = timedelta(microseconds=(result.get("duration") or 0) / 1000)
        step.start = clock[0]
        if clock[0] is not None:
            clock[0] += step.elapsed
        for embedding in raw.get("embeddings", []):
            step.attachments.append((embedding.get("mime_type", ""), embedding.get("name", ""),
                                     embedding.get("data", ""), True))
        for output in raw.get("output", []):
            step.attachments.append(("text/plain", "", output, False))
        return step


# --------------------------------------------------------------------------------------
# Cucumber Messages (NDJSON)
# --------------------------------------------------------------------------------------

class MessagesParser:
    """Reads the `message:` plugin report: one JSON envelope per line, joined by ids."""

    def __init__(self, envelopes: list, raw_names: bool = False):
        self.raw_names = raw_names
        self.nodes = {}  # gherkin ast node id -> info about it
        self.pickles, self.test_cases, self.step_definitions, self.hooks = {}, {}, {}, {}
        self.started = {}  # testCaseStartedId -> testCaseStarted
        self.finished = {}  # testCaseStartedId -> testCaseFinished
        self.step_started, self.step_finished, self.attachments = {}, {}, {}
        self.run = Run()
        for envelope in envelopes:
            self._index(envelope)

    def _index(self, envelope: dict):
        for kind, message in envelope.items():
            if kind == "gherkinDocument" and message.get("feature"):
                self._index_document(message)
            elif kind == "pickle":
                self.pickles[message["id"]] = message
            elif kind == "testCase":
                self.test_cases[message["id"]] = message
            elif kind == "stepDefinition":
                self.step_definitions[message["id"]] = message
            elif kind == "hook":
                self.hooks[message["id"]] = message
            elif kind == "testCaseStarted":
                self.started[message["id"]] = message
            elif kind == "testCaseFinished":
                self.finished[message["testCaseStartedId"]] = message
            elif kind == "testStepStarted":
                self.step_started[(message["testCaseStartedId"], message["testStepId"])] = message
            elif kind == "testStepFinished":
                self.step_finished[(message["testCaseStartedId"], message["testStepId"])] = message
            elif kind == "attachment" and message.get("testCaseStartedId"):
                key = (message["testCaseStartedId"], message.get("testStepId"))
                self.attachments.setdefault(key, []).append(message)
            elif kind == "testRunStarted":
                self.run.start = parse_timestamp(message.get("timestamp"))
            elif kind == "testRunFinished":
                self.run.end = parse_timestamp(message.get("timestamp"))
                error = message.get("exception") or {}
                if error.get("message") or message.get("message"):
                    self.run.errors.append(clean_message(error.get("message") or message.get("message")))
            elif kind == "testRunHookFinished":
                result = message.get("result") or {}
                if result.get("status", "").lower() in FAILING:
                    self.run.errors.append(clean_message(self._error(result)))
            elif kind == "meta":
                implementation = message.get("implementation") or {}
                runtime = message.get("runtime") or {}
                if implementation.get("name"):
                    self.run.metadata["Cucumber"] = f"{implementation['name']} {implementation.get('version', '')}".strip()
                if runtime.get("name"):
                    self.run.metadata["Runtime"] = f"{runtime['name']} {runtime.get('version', '')}".strip()

    def _index_document(self, document: dict):
        feature = document["feature"]

        def walk(children, rule, backgrounds):
            backgrounds = list(backgrounds)
            for child in children:
                if "background" in child:
                    backgrounds += [step["id"] for step in child["background"].get("steps", [])]
            for child in children:
                if "rule" in child:
                    walk(child["rule"].get("children", []), child["rule"].get("name", ""), backgrounds)
                elif "scenario" in child:
                    scenario = child["scenario"]
                    self.nodes[scenario["id"]] = {"feature": feature.get("name", ""), "rule": rule,
                                                  "line": scenario["location"]["line"],
                                                  "outline": bool(scenario.get("examples"))}
                    for examples in scenario.get("examples", []):
                        for index, row in enumerate(examples.get("tableBody", []), start=1):
                            self.nodes[row["id"]] = {"row": index, "line": row["location"]["line"]}
                    for step_id in backgrounds:
                        self.nodes[step_id] = {"background": True}

        walk(feature.get("children", []), "", [])

    def parse(self) -> Run:
        scenarios = {}
        attempts = sorted(self.started.values(), key=lambda started: started.get("attempt", 0))
        for started in attempts:
            test_case = self.test_cases.get(started["testCaseId"])
            if not test_case:
                continue
            if test_case["id"] not in scenarios:
                scenarios[test_case["id"]] = self._scenario(self.pickles[test_case["pickleId"]])
            scenarios[test_case["id"]].attempts.append(self._attempt(started, test_case))
        self.run.scenarios = [scenario for scenario in scenarios.values() if scenario.attempts]
        return self.run

    def _scenario(self, pickle: dict) -> Scenario:
        ast_ids = pickle.get("astNodeIds", [])
        node = self.nodes.get(ast_ids[0], {}) if ast_ids else {}
        row = self.nodes.get(ast_ids[1], {}) if len(ast_ids) > 1 else {}
        name = pickle.get("name", "")
        if row:
            name = example_name(name, row["row"])
        line = row.get("line") or (pickle.get("location") or {}).get("line") or node.get("line", 0)
        suites = tuple(part for part in (node.get("feature", ""), node.get("rule", "")) if part)
        return Scenario(uri=pickle.get("uri", ""), line=line, suites=suites or ("",), name=name,
                        tags=[tag["name"] for tag in pickle.get("tags", [])])

    def _attempt(self, started: dict, test_case: dict) -> Attempt:
        finished = self.finished.get(started["id"], {})
        attempt = Attempt(start=parse_timestamp(started.get("timestamp")),
                          end=parse_timestamp(finished.get("timestamp")))
        pickle_steps = {step["id"]: step for step in self.pickles[test_case["pickleId"]].get("steps", [])}
        test_steps = test_case.get("testSteps", [])
        step_positions = [i for i, test_step in enumerate(test_steps) if test_step.get("pickleStepId")]
        first_step = step_positions[0] if step_positions else len(test_steps)
        last_step = step_positions[-1] if step_positions else -1
        waiting = []  # before-step hooks, placed next to the step they precede
        target = attempt.before
        for position, test_step in enumerate(test_steps):
            if test_step.get("pickleStepId"):
                pickle_step = pickle_steps.get(test_step["pickleStepId"], {})
                in_background = any(self.nodes.get(i, {}).get("background") for i in pickle_step.get("astNodeIds", []))
                target = attempt.background if in_background else attempt.steps
                target += waiting + [self._step(started["id"], test_step, pickle_step)]
                waiting = []
                continue
            hook = self.hooks.get(test_step.get("hookId"), {})
            # Older message protocols have no hook type; the position tells it apart.
            hook_type = hook.get("type") or ("BEFORE_TEST_CASE" if position < first_step else
                                             "AFTER_TEST_CASE" if position > last_step else "AFTER_TEST_STEP")
            if hook_type == "BEFORE_TEST_CASE":
                attempt.before.append(self._hook(started["id"], test_step, hook, "Before"))
            elif hook_type == "AFTER_TEST_CASE":
                attempt.after.append(self._hook(started["id"], test_step, hook, "After"))
            elif hook_type == "BEFORE_TEST_STEP":
                waiting.append(self._hook(started["id"], test_step, hook, "BeforeStep"))
            else:
                target.append(self._hook(started["id"], test_step, hook, "AfterStep"))
        attempt.after = waiting + attempt.after
        return attempt

    def _step(self, started_id: str, test_step: dict, pickle_step: dict) -> Step:
        text = pickle_step.get("text", "")
        definitions = [self.step_definitions.get(i, {}) for i in test_step.get("stepDefinitionIds", [])]
        argument_lists = test_step.get("stepMatchArgumentsLists") or []
        arguments = argument_lists[0].get("stepMatchArguments", []) if len(argument_lists) == 1 else []
        groups = [argument.get("group", {}) for argument in arguments]
        args = [next((child["value"] for child in group.get("children", []) if child.get("value") is not None),
                     group.get("value", "")) for group in groups]
        payload = pickle_step.get("argument") or {}
        if payload.get("docString"):
            args.append(payload["docString"].get("content", ""))
        if payload.get("dataTable"):
            args.append(table_text([[cell.get("value", "") for cell in row.get("cells", [])]
                                    for row in payload["dataTable"].get("rows", [])]))
        name = step_name(text, [(group.get("start"), group.get("value")) for group in groups], self.raw_names)
        if len(definitions) == 1:
            owner = self._source_owner(definitions[0].get("sourceReference") or {})
        else:
            owner = "Undefined" if not definitions else "Ambiguous"
        step = Step(name=name, owner=owner, status="unknown", args=tuple(args))
        return self._timed(step, started_id, test_step["id"])

    def _hook(self, started_id: str, test_step: dict, hook: dict, kind: str) -> Step:
        reference = hook.get("sourceReference") or {}
        name = hook.get("name") or (reference.get("javaMethod") or {}).get("methodName") or f"{kind} hook"
        step = Step(name=name, owner=self._source_owner(reference), status="unknown", hook=True)
        return self._timed(step, started_id, test_step["id"])

    @staticmethod
    def _source_owner(reference: dict) -> str:
        java = reference.get("javaMethod") or reference.get("javaStackTraceElement") or {}
        if java.get("className"):
            return java["className"].rsplit(".", 1)[-1]
        if reference.get("uri"):
            return Path(reference["uri"]).stem
        return GROUP_OWNER

    def _timed(self, step: Step, started_id: str, step_id: str) -> Step:
        started = self.step_started.get((started_id, step_id), {})
        result = (self.step_finished.get((started_id, step_id)) or {}).get("testStepResult") or {}
        step.status = result.get("status", "unknown").lower()
        step.start = parse_timestamp(started.get("timestamp"))
        step.elapsed = parse_duration(result.get("duration"))
        step.error = self._error(result)
        for attachment in self.attachments.get((started_id, step_id), []):
            step.attachments.append((attachment.get("mediaType", ""), attachment.get("fileName", ""),
                                     attachment.get("body", ""), attachment.get("contentEncoding") == "BASE64"))
        return step

    @staticmethod
    def _error(result: dict) -> str:
        exception = result.get("exception") or {}
        if exception.get("stackTrace"):
            return exception["stackTrace"]
        if exception.get("type"):
            return f"{exception['type']}: {exception.get('message', '')}"
        return result.get("message", "")


# --------------------------------------------------------------------------------------
# Building the Robot Framework result
# --------------------------------------------------------------------------------------

def merge_message(attempts: list) -> str:
    """Build the message `rebot --merge` writes for a re-executed test.

    The dashboard parses this format back into a per-attempt history, so Cucumber
    retries and reruns show up the same way as Robot Framework `--rerunfailed` runs.
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


def robot_status(status: str) -> str:
    return "PASS" if status == "passed" else "SKIP" if status == "skipped" else "FAIL"


class RobotBuilder:
    def __init__(self, run: Run, name: str = "Cucumber", include_steps: bool = True, include_hooks: bool = True,
                 include_attachments: bool = False):
        self.run = run
        self.name = name
        self.include_steps = include_steps
        self.include_hooks = include_hooks
        self.include_attachments = include_attachments

    def build(self) -> Result:
        root = TestSuite(name=self.name)
        for key, value in self.run.metadata.items():
            root.metadata[key] = value
        prefix = self._common_folders()
        for scenario in self.run.scenarios:
            parent = root
            folders = self._folders(scenario.uri)[len(prefix):]
            for title in [*folders, *scenario.suites]:
                parent = self._child_suite(parent, title)
            self._add_test(parent, scenario)
        if self.run.errors:
            root.message = "\n\n".join(error for error in self.run.errors if error)
        self._set_suite_times(root)
        if self.run.start:
            root.start_time = self.run.start
            if self.run.end:
                root.end_time = self.run.end
        return Result(suite=root)

    @staticmethod
    def _folders(uri: str) -> List[str]:
        path = re.sub(r"^(classpath|file):/*", "", uri.replace("\\", "/"))
        return [part for part in path.split("/")[:-1] if part]

    def _common_folders(self) -> List[str]:
        """Folders every feature shares (like `features/`) add a level without information."""
        paths = [self._folders(scenario.uri) for scenario in self.run.scenarios]
        common = []
        for parts in zip(*paths) if paths else []:
            if len(set(parts)) != 1:
                break
            common.append(parts[0])
        return common

    @staticmethod
    def _child_suite(parent: TestSuite, title: str) -> TestSuite:
        name = clean_name(title)
        for suite in parent.suites:
            if suite.name == name:
                return suite
        return parent.suites.create(name=name)

    def _add_test(self, suite: TestSuite, scenario: Scenario):
        final = scenario.attempts[-1]
        status = robot_status(final.status)
        tags = [tag.lstrip("@") for tag in scenario.tags]
        if final.status in ("pending", "undefined", "ambiguous"):
            tags.append(final.status)
        message = final.message
        if len(scenario.attempts) > 1:
            if status == "PASS" and any(robot_status(a.status) == "FAIL" for a in scenario.attempts):
                tags.append("flaky")
            history = [(robot_status(a.status), a.message) for a in scenario.attempts]
            message = merge_message(history)

        name = clean_name(scenario.name)
        taken = {test.name for test in suite.tests}
        if name in taken:
            # Two scenarios with the same name: the dashboard keys tests by full name.
            name = next(f"{name} ({n})" for n in range(2, len(taken) + 3) if f"{name} ({n})" not in taken)
        elapsed = (final.end - final.start) if final.start and final.end else sum(
            (step.elapsed for step in final.all_steps()), timedelta(0))
        test = suite.tests.create(name=name, tags=tags, status=status, message=message,
                                  start_time=final.start, elapsed_time=elapsed)

        if not self.include_steps:
            return
        failed = status == "FAIL"
        self._add_keywords(test.body, final.before, failed)
        if final.background:
            group = self._group(test.body, "Background", final.background)
            self._add_keywords(group.body if group else test.body, final.background, failed)
        self._add_keywords(test.body, final.steps, failed)
        self._add_keywords(test.body, final.after, failed)

    def _group(self, body, name: str, steps: List[Step]):
        """GROUP needs Robot Framework 7.2; older versions get the steps without the group."""
        if not hasattr(body, "create_group"):
            return None
        statuses = [step.status for step in steps if self.include_hooks or not step.hook]
        if not statuses:
            return None
        worst = max(statuses, key=lambda s: SEVERITY.index(s) if s in SEVERITY else 0)
        starts = [step.start for step in steps if step.start]
        return body.create_group(name=name, status=robot_status(worst),
                                 start_time=min(starts) if starts else None,
                                 elapsed_time=sum((step.elapsed for step in steps), timedelta(0)))

    def _add_keywords(self, body, steps: List[Step], test_failed: bool):
        for step in steps:
            if step.hook and not self.include_hooks:
                continue
            if step.status == "skipped" and test_failed:
                status = "NOT RUN"  # skipped because an earlier step failed
            elif step.status == "unknown":
                status = "NOT RUN"
            else:
                status = robot_status(step.status)
            message = clean_message(step.error) if status == "FAIL" else ""
            if status == "FAIL" and not message:
                message = f"{step.status.capitalize()} step"
            keyword = body.create_keyword(name=step.name, owner=step.owner, args=step.args, status=status,
                                          message=message, start_time=step.start, elapsed_time=step.elapsed)
            if step.error and step.error.strip() != message:
                keyword.body.create_message(message=ANSI_RE.sub("", step.error).replace("\r\n", "\n").strip(),
                                            level="FAIL" if status == "FAIL" else "INFO", timestamp=step.start)
            if self.include_attachments:
                for media_type, name, content, base64 in step.attachments:
                    keyword.body.create_message(message=self._attachment_html(media_type, name, content, base64),
                                                level="INFO", html=True, timestamp=step.start)

    @staticmethod
    def _attachment_html(media_type: str, name: str, content: str, base64: bool) -> str:
        label = escape(name or media_type or "attachment")
        if media_type.startswith("image/") and base64:
            return f'{label}<br><img src="data:{escape(media_type)};base64,{content}" width="800">'
        if not base64 or media_type.startswith("text/"):
            if base64:
                import base64 as codec

                content = codec.b64decode(content).decode("utf-8", "replace")
            return f"{label}<pre>{escape(content)}</pre>"
        return f"{label} ({escape(media_type)}, not shown)"

    def _set_suite_times(self, suite: TestSuite):
        for child in suite.suites:
            self._set_suite_times(child)
        starts = [t.start_time for t in suite.all_tests if t.start_time]
        ends = [t.start_time + t.elapsed_time for t in suite.all_tests if t.start_time]
        if starts:
            suite.start_time = min(starts)
            suite.end_time = max(ends)


# --------------------------------------------------------------------------------------
# Entry points
# --------------------------------------------------------------------------------------

def read_report(path: Path, raw_names: bool = False) -> Run:
    """Parse a Cucumber JSON or NDJSON report; the format is detected from the content."""
    text = Path(path).read_text(encoding="utf-8-sig").strip()
    if not text:
        return Run()
    if text.startswith("["):
        return JsonParser(json.loads(text), raw_names).parse()
    envelopes = [json.loads(line) for line in text.splitlines() if line.strip()]
    return MessagesParser(envelopes, raw_names).parse()


def convert(reports, output_path: Path, name: str = "Cucumber", log_path: Path = None, reruns=(),
            metadata: dict = None, start_time: datetime = None, include_steps: bool = True,
            include_hooks: bool = True, raw_names: bool = False, include_attachments: bool = False) -> Path:
    if isinstance(reports, (str, Path)):
        reports = [reports]
    run = Run()
    for report in reports:
        run.add(read_report(report, raw_names))
    for rerun in reruns:
        run.merge_rerun(read_report(rerun, raw_names))
    run.metadata.update(metadata or {})
    if start_time:
        run.start = start_time
    if run.start is None:
        # Old Cucumber versions write no timestamps at all; the report's age is the best guess.
        run.start = datetime.fromtimestamp(Path(reports[0]).stat().st_mtime)

    result = RobotBuilder(run, name=name, include_steps=include_steps, include_hooks=include_hooks,
                          include_attachments=include_attachments).build()
    result.save(str(output_path))
    # robotdashboard identifies a run by the output.xml `generated` timestamp; use the
    # Cucumber start time so converting the same report twice is detected as a duplicate.
    xml = Path(output_path).read_text(encoding="utf-8")
    xml = re.sub(r'generated="[^"]*"', f'generated="{run.start.isoformat()}"', xml, count=1)
    Path(output_path).write_text(xml, encoding="utf-8")
    if log_path:
        from robot import rebot

        rebot(str(output_path), log=str(log_path), report=None, output=None, stdout=None)
    return Path(output_path)


def key_value(text: str) -> Tuple[str, str]:
    if "=" not in text:
        raise argparse.ArgumentTypeError(f"expected KEY=VALUE, got '{text}'")
    key, value = text.split("=", 1)
    return key.strip(), value.strip()


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Convert Cucumber reports (JSON or NDJSON messages) to a Robot Framework output.xml")
    parser.add_argument("reports", type=Path, nargs="+",
                        help="Cucumber report(s) of one run: json: or message: plugin output")
    parser.add_argument("-o", "--output", type=Path, default=Path("output-cucumber.xml"),
                        help="output.xml to write (default: output-cucumber.xml)")
    parser.add_argument("-n", "--name", default="Cucumber", help="name of the root suite (default: Cucumber)")
    parser.add_argument("-l", "--log", type=Path, help="also write a Robot Framework log.html (for log linking)")
    parser.add_argument("-r", "--rerun", type=Path, action="append", default=[],
                        help="report of a rerun of the failed scenarios; adds their attempts (repeatable)")
    parser.add_argument("-m", "--metadata", type=key_value, action="append", default=[],
                        help="run metadata KEY=VALUE, e.g. Browser=chrome (repeatable)")
    parser.add_argument("--start-time", type=parse_iso,
                        help="run start (ISO 8601) for reports without timestamps")
    parser.add_argument("--raw-step-names", action="store_true",
                        help="use the literal step text as keyword name instead of replacing arguments by {}")
    parser.add_argument("--no-steps", action="store_true", help="do not convert steps and hooks to keywords")
    parser.add_argument("--no-hooks", action="store_true", help="do not convert hooks to keywords")
    parser.add_argument("--attachments", action="store_true",
                        help="embed attachments (screenshots, text) in the output, visible in log.html")
    args = parser.parse_args(argv)
    output = convert(args.reports, args.output, name=args.name, log_path=args.log, reruns=args.rerun,
                     metadata=dict(args.metadata), start_time=args.start_time, include_steps=not args.no_steps,
                     include_hooks=not args.no_hooks, raw_names=args.raw_step_names,
                     include_attachments=args.attachments)
    print(f"Wrote {output}")


if __name__ == "__main__":
    sys.exit(main())
