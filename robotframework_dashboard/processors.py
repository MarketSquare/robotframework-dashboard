from robot.api import ExecutionResult, ResultVisitor
from robot.result.model import TestCase, TestSuite, Keyword
from datetime import datetime
from pathlib import Path
from collections import Counter
from html import unescape
from json import dumps
from re import compile, DOTALL

# `rebot --merge` (used after `robot --rerunfailed`) keeps only the final result of a
# re-executed test, but records every earlier attempt in the test message as HTML:
#   *HTML* <span class="merge">Test has been re-executed and results merged.</span>
#   <hr><span class="new-status">New status:</span> <span class="pass">PASS</span><br>
#   <span class="new-message">New message:</span> ...<br>
#   <hr><span class="old-status">Old status:</span> <span class="fail">FAIL</span><br>
#   <span class="old-message">Old message:</span> ...<br>
# Each further merge prepends its result, so the "old" blocks run newest to oldest.
#
# The variant rebot writes when the re-execution was skipped: the original result is
# kept and the skipped attempt is only mentioned in the message:
#   *HTML* Test has been re-executed and results merged. Latter result had <span class="skip">SKIP</span>
#   status and was ignored. Message:\n<skip message><hr>Original message:\n<original message>
#
# A message rebot embeds is HTML escaped, or embedded as-is without its *HTML* marker when it
# was HTML itself. So a result that was already merged nests its whole history inside the
# message of the next merge: as the skipped attempt's original message, as an old message,
# and as the *new* message when an already merged result is merged into another output (a
# rerun pipeline that merges every retry and then merges the retries back into the full run).
# rebot ends such an embedded history with the <br> of the message that contains it.
MERGE_HEADER_RE = compile(
    r"^\*HTML\*\s*<span class=\"merge\">(?:Test|Task) has been re-executed and results merged\.</span>"
)
MERGE_ATTEMPT_RE = compile(
    r"<span class=\"(?:new|old)-status\">(?:New|Old) status:</span>\s*<span class=\"\w+\">(\w+)</span><br>"
    r"(?:<span class=\"(?:new|old)-message\">(?:New|Old) message:</span>\s*(.*?)<br>)?",
    DOTALL,
)
MERGE_HTML_RE = compile(r"\*HTML\*\s*")
MERGE_BANNER_RE = compile(r"<span class=\"merge\">(?:Test|Task) has been re-executed and results merged\.</span>")
MERGE_SKIPPED_HEAD_RE = compile(
    r"(?:Test|Task) has been re-executed and results merged\. Latter result had "
    r"<span class=\"skip\">SKIP</span> status and was ignored\. Message:\n"
)
MERGE_ENTRY_RE = compile(
    r"<hr><span class=\"(?:new|old)-status\">(?:New|Old) status:</span>\s*<span class=\"\w+\">(\w+)</span><br>"
)
MERGE_ENTRY_MESSAGE_RE = compile(r"<span class=\"(?:new|old)-message\">(?:New|Old) message:</span>\s*")
MERGE_SKIPPED_ORIGINAL = "<hr>Original message:\n"


# the default --messagelength: long enough for nearly every assertion and library error, short
# enough that large diffs and stack traces do not bloat the database and the dashboard
DEFAULT_MESSAGE_LENGTH = 1000


def clip_message(message: str, length: int):
    """Clip a message to at most `length` characters, ending a clipped one in an ellipsis; 0 keeps it whole"""
    if length <= 0 or len(message) <= length:
        return message
    return message[: length - 1] + "…"


# the <robot> element is on the second line; the limit only guards against a file without newlines
GENERATED_HEADER_BYTES = 65536
GENERATED_RE = compile(r'<robot\b[^>]*?\bgenerated="([^"]+)"')


class _MergeMessageParser:
    """Reads a `rebot --merge` message from left to right, following the nesting rebot writes.

    Every read_* method takes the position to start at and returns (message, attempts, end):
    the effective message, the attempts oldest first (None for a plain message) and the
    position after what it read. A message that does not follow the format raises ValueError.
    """

    def __init__(self, text: str):
        self.text = text

    def read_message(self, start: int, status: str, to_end: bool):
        """A message: an embedded merge history, a skipped-rerun message, or plain text that
        runs up to the <br> rebot closes it with (or to the end of the whole message)"""
        banner = MERGE_BANNER_RE.match(self.text, start)
        if banner:
            return self.read_merged(banner.end())
        skipped = MERGE_SKIPPED_HEAD_RE.match(self.text, start)
        if skipped:
            return self.read_skipped(skipped.end(), status, to_end)
        end = len(self.text) if to_end else self.text.find("<br>", start)
        if end == -1:
            raise ValueError("message without its closing <br>")
        return unescape(self.text[start:end].strip()), None, end

    def read_merged(self, start: int):
        """The status and message blocks after a merge banner, newest first"""
        entries = []
        position = start
        while entry := MERGE_ENTRY_RE.match(self.text, position):
            status, position = entry.group(1), entry.end()
            message, attempts = "", None
            message_header = MERGE_ENTRY_MESSAGE_RE.match(self.text, position)
            if message_header:
                message, attempts, position = self.read_message(message_header.end(), status, to_end=False)
                if not self.text.startswith("<br>", position):
                    raise ValueError("message block without its closing <br>")
                position += len("<br>")
            entries.append((status, message, attempts))
        if not entries:
            raise ValueError("merge banner without status blocks")
        history = []
        for status, message, attempts in reversed(entries):
            if attempts is None:
                history.append({"status": status, "message": message})
                continue
            # an embedded history starts from a copy of the result it was merged into (the retries
            # began from the failed tests of that run): the same attempt, not a new one
            if history and history[-1] == attempts[0]:
                attempts = attempts[1:]
            history.extend(attempts)
        return entries[0][1], history, position

    def read_skipped(self, start: int, status: str, to_end: bool):
        """A skipped rerun: the skip message, then the original result that stayed in effect"""
        original_at = self.text.find(MERGE_SKIPPED_ORIGINAL, start)
        stop = len(self.text) if to_end else self.text.find("<br>", start)
        if original_at != -1 and (stop == -1 or original_at < stop):
            skip_message = self.text[start:original_at]
            message, attempts, position = self.read_message(original_at + len(MERGE_SKIPPED_ORIGINAL), status, to_end)
        elif stop != -1:
            skip_message, message, attempts, position = self.text[start:stop], "", None, stop
        else:
            raise ValueError("skip message without its closing <br>")
        attempts = attempts if attempts is not None else [{"status": status, "message": message}]
        return message, attempts + [{"status": "SKIP", "message": unescape(skip_message.strip())}], position


def _parse_merge_blocks(message: str):
    """The previous, flat reading of a merge message: every status block in the order written.
    Used when a message does not follow the format (e.g. an *HTML* message with its own <br>)."""
    if not MERGE_HEADER_RE.match(message):
        return message, []
    attempts = [
        {"status": found_status, "message": unescape((found_message or "").strip())}
        for found_status, found_message in MERGE_ATTEMPT_RE.findall(message)
    ]
    if not attempts:
        return message, []
    attempts.reverse()
    return attempts[-1]["message"], attempts


def parse_merged_message(message: str, status: str):
    """Split a `rebot --merge` message into the final message and the attempt history.

    Returns (message, attempts) where attempts is a list of {"status", "message"}
    dicts from the first attempt to the last, or an empty list when the message is
    not a merge message.
    """
    html = MERGE_HTML_RE.match(message)
    if not html:
        return message, []
    try:
        final_message, attempts, end = _MergeMessageParser(message).read_message(html.end(), status, to_end=True)
    except ValueError:
        return _parse_merge_blocks(message)
    if message[end:].strip():
        # stopped before the end: part of the history would be lost
        return _parse_merge_blocks(message)
    if attempts is None:
        return message, []
    return final_message, attempts


def get_suite_start_time(suite: TestSuite):
    """Start time of a suite; `rebot --merge` clears it on merged suites, fall back to the earliest test."""
    if hasattr(suite, "start_time"):
        start_time = suite.start_time
        if start_time is None:
            starts = [test.start_time for test in suite.all_tests if test.start_time is not None]
            start_time = min(starts) if starts else None
        return start_time
    return suite.starttime


class OutputProcessor:
    """This class creates an output processor that collects all the relevant data for the database"""

    def __init__(self, output_path: Path, message_length: int = DEFAULT_MESSAGE_LENGTH):
        self.output_path = output_path
        self.message_length = message_length
        self._execution_result = None

    @property
    def execution_result(self):
        """Parsed on first use: get_run_start reads only the header, so an output that is
        already in the database is skipped without parsing the whole XML"""
        if self._execution_result is None:
            self._execution_result = ExecutionResult(self.output_path)
        return self._execution_result

    @execution_result.setter
    def execution_result(self, execution_result):
        self._execution_result = execution_result

    def get_run_start(self):
        """Function to get the run_start to do a check if it is not already present in the database"""
        generation_time = self._read_generation_time()
        if generation_time is None:
            # no readable header: Robot Framework 7 parses it itself, and reports a broken file
            generation_time = getattr(self.execution_result, "generation_time", None)
        if generation_time is None:
            raise ValueError(
                f"no <robot generated=\"...\"> header found in '{self.output_path}'"
            )
        self.generation_time = generation_time
        return self.generation_time

    def _read_generation_time(self):
        """The generated attribute of the <robot> element, the value Robot Framework 7 exposes as generation_time"""
        try:
            with open(self.output_path, "r", encoding="utf-8", errors="replace") as f:
                header = f.read(GENERATED_HEADER_BYTES)
        except OSError:
            return None
        match = GENERATED_RE.search(header)
        if not match:
            return None
        generated = match.group(1)
        try:
            if "T" in generated:
                return datetime.fromisoformat(generated)
            return datetime.strptime(generated, "%Y%m%d %H:%M:%S.%f")
        except ValueError:
            return None

    def get_output_data(self):
        """This is the main function that is actually called by robotdashboard"""
        run_list, suite_list, test_list, keyword_list = [], [], [], []
        self.execution_result.visit(RunProcessor(self.generation_time, run_list))
        self.execution_result.visit(SuiteProcessor(self.generation_time, suite_list))
        self.execution_result.visit(TestProcessor(self.generation_time, test_list, self.message_length))
        # one walk over all keywords for both, it is the largest part of the visiting time
        exception_processor = ExceptionProcessor(self.generation_time, self.message_length)
        self.execution_result.visit(
            KeywordWalk(KeywordProcessor(self.generation_time, keyword_list), exception_processor)
        )
        if not suite_list:
            print("  WARNING: No suites found in output, suite data will be empty!")
        if not test_list:
            print("  WARNING: No tests found in output, test data will be empty!")
        if keyword_list:
            average_keyword_list = self.calculate_keyword_averages(keyword_list)
        else:
            print("  WARNING: No keywords found in output, keyword data will be empty!")
            average_keyword_list = []
        run_list, suite_list = self.merge_run_and_suite_metadata(run_list, suite_list)
        return {
            "runs": run_list,
            "suites": suite_list,
            "tests": test_list,
            "keywords": average_keyword_list,
            "exceptions": exception_processor.get_aggregated_exceptions(),
        }

    def calculate_keyword_averages(self, keyword_list: list):
        """Helper function to calculate keyword statistics"""
        average_keyword_dict = {}
        average_keyword_list = []
        run_start = keyword_list[0][0]
        for keyword in keyword_list:
            name = keyword[1]
            passed = int(keyword[2])
            failed = int(keyword[3])
            skipped = int(keyword[4])
            elapsed_s = keyword[5]
            owner = keyword[6]
            if not name in average_keyword_dict.keys():
                average_keyword_dict[name] = {
                    "passed": passed,
                    "failed": failed,
                    "skipped": skipped,
                    "elapsed_s": [elapsed_s],
                    "owner": owner,
                }
            else:
                average_keyword_dict[name]["passed"] += passed
                average_keyword_dict[name]["failed"] += failed
                average_keyword_dict[name]["skipped"] += skipped
                average_keyword_dict[name]["elapsed_s"].append(elapsed_s)
        for name in average_keyword_dict.keys():
            elapsed_list = average_keyword_dict[name]["elapsed_s"]
            sum_elapsed_list = sum(elapsed_list)
            len_elapsed_list = len(elapsed_list)
            min_elapsed_list = min(elapsed_list)
            max_elapsed_list = max(elapsed_list)
            average_keyword_list.append(
                (
                    run_start,  # run_start
                    name,  # keyword name
                    average_keyword_dict[name]["passed"],  # amount of passes
                    average_keyword_dict[name]["failed"],  # amount of fails
                    average_keyword_dict[name]["skipped"],  # amount of skips
                    len_elapsed_list,  # times used
                    round(sum_elapsed_list, 3),  # total usage time
                    round(sum_elapsed_list / len_elapsed_list, 3),  # average usage time
                    round(min_elapsed_list, 3),  # fastest usage time
                    round(max_elapsed_list, 3),  # slowest usage time
                    average_keyword_dict[name]["owner"],  # library
                )
            )
        return average_keyword_list

    def merge_run_and_suite_metadata(self, run_list: list, suite_list: list):
        new_suite_list = []
        suite_metadata_items = []

        def clean_metadata_value(s):
            s = s.replace("'", "")
            s = s.replace('"', "")
            return s

        for suite in suite_list:
            for k, v in suite[-1].items():
                cleaned_key = clean_metadata_value(str(k))
                cleaned_value = clean_metadata_value(str(v))
                suite_metadata_items.append(f"{cleaned_key}: {cleaned_value}")
            suite = suite[:-1]
            new_suite_list.append(suite)

        run_metadata = run_list[0][-1]
        run_metadata_items = []
        for k, v in run_metadata.items():
            cleaned_key = clean_metadata_value(str(k))
            cleaned_value = clean_metadata_value(str(v))
            run_metadata_items.append(f"{cleaned_key}: {cleaned_value}")
        run_metadata_items += suite_metadata_items

        run = list(run_list[0])
        # dedupe while keeping document order; a set would reorder per process (hash seed)
        run[-1] = str(list(dict.fromkeys(run_metadata_items)))
        run_list[0] = tuple(run)

        return run_list, new_suite_list


class RunProcessor(ResultVisitor):
    """Processer to get the run data"""

    def __init__(self, run_time: datetime, run_list: list):
        self.run_list = run_list
        self.run_time = run_time

    def visit_suite(self, suite: TestSuite):
        stats = suite.statistics

        # handling for older robot versions
        if hasattr(suite, "full_name"):
            full_name = suite.full_name
        else:
            full_name = suite.longname
        if hasattr(suite, "elapsed_time"):
            elapsed_time = round(suite.elapsed_time.total_seconds(), 3)
        else:
            elapsed_time = round(suite.elapsedtime / 1000, 3)
        start_time = get_suite_start_time(suite)

        self.run_list.append(
            (
                self.run_time,
                full_name,
                suite.name,
                stats.total,
                stats.passed,
                stats.failed,
                stats.skipped,
                elapsed_time,
                start_time,
                suite.metadata,
            )
        )


class SuiteProcessor(ResultVisitor):
    """Processer to get the suite data"""

    def __init__(self, run_time: datetime, suite_list: list):
        self.suite_list = suite_list
        self.run_time = run_time

    def start_suite(self, suite: TestSuite):
        if suite.tests:
            try:
                stats = suite.statistics.all
            except:
                stats = suite.statistics

            # handling for older robot versions
            if hasattr(suite, "full_name"):
                full_name = suite.full_name
            else:
                full_name = suite.longname
            if hasattr(suite, "elapsed_time"):
                elapsed_time = round(suite.elapsed_time.total_seconds(), 3)
            else:
                elapsed_time = round(suite.elapsedtime / 1000, 3)
            start_time = get_suite_start_time(suite)

            self.suite_list.append(
                (
                    self.run_time,
                    full_name,
                    suite.name,
                    stats.total,
                    stats.passed,
                    stats.failed,
                    stats.skipped,
                    elapsed_time,
                    start_time,
                    suite.id,
                    suite.metadata,
                )
            )

    def visit_test(self, test: TestCase):
        """Only suites are collected, so the tests and their keywords are not walked"""

    def visit_keyword(self, keyword: Keyword):
        """Suite setups and teardowns are not walked either"""


class TestProcessor(ResultVisitor):
    """Processer to get the test data"""

    def __init__(self, run_time: datetime, test_list: list, message_length: int = DEFAULT_MESSAGE_LENGTH):
        self.test_list = test_list
        self.run_time = run_time
        self.message_length = message_length

    def visit_keyword(self, keyword: Keyword):
        """Suite setups and teardowns hold no test data"""

    def visit_test(self, test: TestCase):
        # handling for older robot versions
        if hasattr(test, "full_name"):
            full_name = test.full_name
        else:
            full_name = test.longname
        if hasattr(test, "elapsed_time"):
            elapsed_time = round(test.elapsed_time.total_seconds(), 3)
        else:
            elapsed_time = round(test.elapsedtime / 1000, 3)
        if hasattr(test, "start_time"):
            start_time = test.start_time
        else:
            start_time = test.starttime

        status = "PASS" if test.passed else "FAIL" if test.failed else "SKIP"
        message, attempts = parse_merged_message(test.message, status)
        for attempt in attempts:
            attempt["message"] = clip_message(attempt["message"], self.message_length)

        self.test_list.append(
            (
                self.run_time,
                full_name,
                test.name,
                test.passed,
                test.failed,
                test.skipped,
                elapsed_time,
                start_time,
                clip_message(message, self.message_length),
                # joined without spaces after the comma, spaces inside a tag are kept
                f"[{','.join(test.tags)}]",
                test.id,
                dumps(attempts) if attempts else "",
            )
        )


class KeywordProcessor(ResultVisitor):
    """Processer to get the keyword data"""

    def __init__(self, run_time: datetime, keyword_list: list):
        self.keyword_list = keyword_list
        self.run_time = run_time

    def end_keyword(self, keyword: Keyword):
        # handling for older robot versions
        if hasattr(keyword, "elapsed_time"):
            elapsed_time = round(keyword.elapsed_time.total_seconds(), 3)
        else:
            elapsed_time = round(keyword.elapsedtime / 1000, 3)

        if hasattr(keyword, "owner"):
            name = keyword.name
            owner = keyword.owner
            if not owner:
                # There is no owner, this happens when keywords are located in testsuites directly
                # Add a default one to not be empty
                owner = "TestSuite"
        else:
            name = keyword.name
            owner = keyword.libname
            if owner:   
                # There is a parent library or resource file
                if "." in name: 
                    # There is a library name in the name of the keyword
                    name = name.split(".", 1)[1]
            else:   
                # There is no owner, this happens when keywords are located in testsuites directly
                # Add a default one to not be empty
                owner = 'TestSuite'

        self.keyword_list.append(
            (
                self.run_time,
                name,
                keyword.passed,
                keyword.failed,
                keyword.skipped,
                elapsed_time,
                owner,
            )
        )


class KeywordWalk(ResultVisitor):
    """Hands every keyword and TRY branch of one walk to several processors"""

    def __init__(self, *processors: ResultVisitor):
        self.processors = processors

    def start_keyword(self, keyword: Keyword):
        for processor in self.processors:
            processor.start_keyword(keyword)

    def end_keyword(self, keyword: Keyword):
        for processor in self.processors:
            processor.end_keyword(keyword)

    def start_try_branch(self, branch):
        for processor in self.processors:
            processor.start_try_branch(branch)

    def end_try_branch(self, branch):
        for processor in self.processors:
            processor.end_try_branch(branch)


class ExceptionProcessor(ResultVisitor):
    """Processor to collect exception messages from keywords inside TRY/EXCEPT blocks"""

    def __init__(self, run_time: datetime, message_length: int = DEFAULT_MESSAGE_LENGTH):
        self.run_time = run_time
        self.message_length = message_length
        self._try_depth = 0
        self._exception_counts = Counter()
        self._child_failed = []

    def start_try_branch(self, branch):
        if branch.type == "TRY":
            self._try_depth += 1

    def end_try_branch(self, branch):
        if branch.type == "TRY":
            self._try_depth -= 1

    def start_keyword(self, keyword: Keyword):
        self._child_failed.append(False)

    def end_keyword(self, keyword: Keyword):
        child_already_counted = self._child_failed.pop()
        if self._try_depth > 0 and keyword.failed and keyword.message and not child_already_counted:
            self._exception_counts[clip_message(keyword.message, self.message_length)] += 1
        if self._child_failed and keyword.failed:
            self._child_failed[-1] = True

    def get_aggregated_exceptions(self):
        return [
            (self.run_time, message, count)
            for message, count in self._exception_counts.items()
        ]
