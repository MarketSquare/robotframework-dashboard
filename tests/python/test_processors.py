from datetime import datetime
from pathlib import Path
from types import SimpleNamespace
import pytest
from robotframework_dashboard.processors import OutputProcessor, ExceptionProcessor

OUTPUTS_DIR = Path(__file__).parent.parent / "robot" / "resources" / "outputs"
SAMPLE_XML = sorted(OUTPUTS_DIR.glob("output-*.xml"))[0]


# --- get_run_start ---

def test_get_run_start_returns_datetime(xml_output):
    processor = OutputProcessor(xml_output)
    result = processor.get_run_start()
    assert isinstance(result, datetime)


def test_get_run_start_is_consistent(xml_output):
    processor = OutputProcessor(xml_output)
    assert processor.get_run_start() == processor.get_run_start()


def test_get_run_start_all_xml_files(all_xml_outputs):
    for xml_path in all_xml_outputs:
        processor = OutputProcessor(xml_path)
        result = processor.get_run_start()
        assert isinstance(result, datetime), f"Expected datetime for {xml_path.name}"


# --- get_output_data ---

def test_get_output_data_returns_expected_keys(processed_output):
    data = processed_output.get_output_data()
    assert set(data.keys()) == {"runs", "suites", "tests", "keywords", "exceptions"}


def test_get_output_data_runs_has_one_entry(processed_output):
    data = processed_output.get_output_data()
    assert len(data["runs"]) == 1


def test_get_output_data_suites_not_empty(processed_output):
    data = processed_output.get_output_data()
    assert len(data["suites"]) > 0


def test_get_output_data_tests_not_empty(processed_output):
    data = processed_output.get_output_data()
    assert len(data["tests"]) > 0


def test_get_output_data_keywords_not_empty(processed_output):
    data = processed_output.get_output_data()
    assert len(data["keywords"]) > 0


def test_get_output_data_all_xml_files(all_xml_outputs):
    for xml_path in all_xml_outputs:
        processor = OutputProcessor(xml_path)
        processor.get_run_start()
        data = processor.get_output_data()
        assert len(data["runs"]) == 1, f"Expected 1 run for {xml_path.name}"
        assert len(data["tests"]) > 0, f"Expected tests for {xml_path.name}"


# --- calculate_keyword_averages ---

def _make_processor():
    """Return an OutputProcessor instance without parsing a real XML."""
    return OutputProcessor.__new__(OutputProcessor)


def test_calculate_keyword_averages_single_use():
    run_start = datetime(2025, 1, 1)
    keyword_list = [(run_start, "My Keyword", 1, 0, 0, 0.5, "MyLibrary")]
    result = _make_processor().calculate_keyword_averages(keyword_list)
    assert len(result) == 1
    row = result[0]
    assert row[0] == run_start   # run_start preserved
    assert row[1] == "My Keyword"
    assert row[2] == 1           # passed
    assert row[3] == 0           # failed
    assert row[4] == 0           # skipped
    assert row[5] == 1           # times_run
    assert row[6] == 0.5         # total_time_s
    assert row[7] == 0.5         # average_time_s
    assert row[8] == 0.5         # min_time_s
    assert row[9] == 0.5         # max_time_s
    assert row[10] == "MyLibrary"


def test_calculate_keyword_averages_multiple_uses_same_keyword():
    run_start = datetime(2025, 1, 1)
    keyword_list = [
        (run_start, "Sleep", 1, 0, 0, 0.1, "BuiltIn"),
        (run_start, "Sleep", 1, 0, 0, 0.3, "BuiltIn"),
        (run_start, "Sleep", 0, 1, 0, 0.2, "BuiltIn"),
    ]
    result = _make_processor().calculate_keyword_averages(keyword_list)
    assert len(result) == 1
    row = result[0]
    assert row[1] == "Sleep"
    assert row[2] == 2           # passed: 1+1
    assert row[3] == 1           # failed: 0+0+1
    assert row[5] == 3           # times_run
    assert row[6] == pytest.approx(0.6)  # total: 0.1+0.3+0.2
    assert row[7] == pytest.approx(0.2)  # avg: 0.6/3
    assert row[8] == pytest.approx(0.1)  # min
    assert row[9] == pytest.approx(0.3)  # max


def test_calculate_keyword_averages_multiple_keywords():
    run_start = datetime(2025, 1, 1)
    keyword_list = [
        (run_start, "Keyword A", 1, 0, 0, 1.0, "LibA"),
        (run_start, "Keyword B", 0, 1, 0, 2.0, "LibB"),
    ]
    result = _make_processor().calculate_keyword_averages(keyword_list)
    assert len(result) == 2
    names = {row[1] for row in result}
    assert names == {"Keyword A", "Keyword B"}


def test_calculate_keyword_averages_skipped_counted():
    run_start = datetime(2025, 1, 1)
    keyword_list = [(run_start, "Skip Kw", 0, 0, 3, 0.0, "Lib")]
    result = _make_processor().calculate_keyword_averages(keyword_list)
    assert result[0][4] == 3    # skipped


# --- ExceptionProcessor ---

def _branch(branch_type):
    return SimpleNamespace(type=branch_type)


def _keyword(failed, message=""):
    return SimpleNamespace(failed=failed, message=message)


def test_exception_processor_start_try_branch_increments_depth():
    ep = ExceptionProcessor(datetime(2025, 1, 1))
    ep.start_try_branch(_branch("TRY"))
    assert ep._try_depth == 1


def test_exception_processor_start_try_branch_ignores_non_try():
    ep = ExceptionProcessor(datetime(2025, 1, 1))
    ep.start_try_branch(_branch("EXCEPT"))
    assert ep._try_depth == 0


def test_exception_processor_end_try_branch_decrements_depth():
    ep = ExceptionProcessor(datetime(2025, 1, 1))
    ep._try_depth = 1
    ep.end_try_branch(_branch("TRY"))
    assert ep._try_depth == 0


def test_exception_processor_end_try_branch_ignores_non_try():
    ep = ExceptionProcessor(datetime(2025, 1, 1))
    ep._try_depth = 1
    ep.end_try_branch(_branch("EXCEPT"))
    assert ep._try_depth == 1


def test_exception_processor_end_keyword_records_failure_in_try():
    ep = ExceptionProcessor(datetime(2025, 1, 1))
    ep._try_depth = 1
    kw = _keyword(failed=True, message="Something went wrong")
    ep.start_keyword(kw)
    ep.end_keyword(kw)
    assert ep._exception_counts["Something went wrong"] == 1


def test_exception_processor_end_keyword_ignores_outside_try():
    ep = ExceptionProcessor(datetime(2025, 1, 1))
    kw = _keyword(failed=True, message="Error")
    ep.start_keyword(kw)
    ep.end_keyword(kw)
    assert len(ep._exception_counts) == 0


def test_exception_processor_end_keyword_ignores_passed():
    ep = ExceptionProcessor(datetime(2025, 1, 1))
    ep._try_depth = 1
    kw = _keyword(failed=False, message="OK")
    ep.start_keyword(kw)
    ep.end_keyword(kw)
    assert len(ep._exception_counts) == 0


def test_exception_processor_end_keyword_ignores_empty_message():
    ep = ExceptionProcessor(datetime(2025, 1, 1))
    ep._try_depth = 1
    kw = _keyword(failed=True, message="")
    ep.start_keyword(kw)
    ep.end_keyword(kw)
    assert len(ep._exception_counts) == 0


def test_exception_processor_aggregates_same_message():
    ep = ExceptionProcessor(datetime(2025, 1, 1))
    ep._try_depth = 1
    kw1 = _keyword(failed=True, message="Timeout")
    ep.start_keyword(kw1)
    ep.end_keyword(kw1)
    kw2 = _keyword(failed=True, message="Timeout")
    ep.start_keyword(kw2)
    ep.end_keyword(kw2)
    assert ep._exception_counts["Timeout"] == 2


def test_exception_processor_get_aggregated_exceptions():
    run_time = datetime(2025, 1, 1)
    ep = ExceptionProcessor(run_time)
    ep._try_depth = 1
    for msg in ["Error A", "Error A", "Error B"]:
        kw = _keyword(failed=True, message=msg)
        ep.start_keyword(kw)
        ep.end_keyword(kw)
    result = ep.get_aggregated_exceptions()
    assert len(result) == 2
    by_msg = {r[1]: r for r in result}
    assert by_msg["Error A"] == (run_time, "Error A", 2)
    assert by_msg["Error B"] == (run_time, "Error B", 1)


def test_exception_processor_get_aggregated_exceptions_empty():
    ep = ExceptionProcessor(datetime(2025, 1, 1))
    assert ep.get_aggregated_exceptions() == []


def test_exception_processor_only_counts_leaf_keyword():
    ep = ExceptionProcessor(datetime(2025, 1, 1))
    ep._try_depth = 1
    # Simulate: parent keyword wraps a child that fails
    parent = _keyword(failed=True, message="Error")
    child = _keyword(failed=True, message="Error")
    ep.start_keyword(parent)
    ep.start_keyword(child)
    ep.end_keyword(child)   # leaf — counted
    ep.end_keyword(parent)  # parent — should NOT be counted
    assert ep._exception_counts["Error"] == 1


def test_exception_processor_get_output_data_includes_exceptions_key(processed_output):
    """get_output_data() wires ExceptionProcessor's results into the returned dict."""
    data = processed_output.get_output_data()
    # the fixtures contain keywords failing inside TRY/EXCEPT blocks: (run_start, message, count) rows
    assert len(data["exceptions"]) > 0
    for row in data["exceptions"]:
        assert len(row) == 3
        assert row[2] >= 1


def test_calculate_keyword_averages_from_real_xml(processed_output):
    data = processed_output.get_output_data()
    keywords = data["keywords"]
    assert len(keywords) > 0
    for kw in keywords:
        assert len(kw) == 11, "Each keyword row must have 11 fields"
        assert kw[5] >= 1, "times_run must be at least 1"
        assert kw[8] <= kw[7] <= kw[9], "min <= avg <= max must hold"


# --- merge_run_and_suite_metadata ---

def _make_run_suite(run_metadata=None, suite_metadata=None):
    run_start = datetime(2025, 1, 1)
    run_list = [
        (run_start, "Full.Name", "Name", 5, 4, 1, 0, 1.0, "2025-01-01", run_metadata or {})
    ]
    suite_list = [
        (run_start, "Full.Name.Suite", "Suite", 5, 4, 1, 0, 1.0, "2025-01-01", "s1-s1", suite_metadata or {})
    ]
    return run_list, suite_list


def test_merge_run_and_suite_metadata_suite_loses_metadata():
    run_list, suite_list = _make_run_suite()
    _, new_suite_list = _make_processor().merge_run_and_suite_metadata(run_list, suite_list)
    # SuiteProcessor produces 11-element tuples; merge strips the last (metadata) → 10
    assert len(new_suite_list[0]) == 10


def test_merge_run_and_suite_metadata_run_contains_suite_metadata():
    run_list, suite_list = _make_run_suite(suite_metadata={"env": "staging"})
    new_run_list, _ = _make_processor().merge_run_and_suite_metadata(run_list, suite_list)
    # Suite metadata key/value should appear in the run's metadata string
    assert "env" in new_run_list[0][-1]
    assert "staging" in new_run_list[0][-1]


def test_merge_run_and_suite_metadata_run_contains_own_metadata():
    run_list, suite_list = _make_run_suite(run_metadata={"version": "1.2"})
    new_run_list, _ = _make_processor().merge_run_and_suite_metadata(run_list, suite_list)
    assert "version" in new_run_list[0][-1]
    assert "1.2" in new_run_list[0][-1]


def test_merge_run_and_suite_metadata_cleans_single_quotes():
    run_list, suite_list = _make_run_suite(run_metadata={"key": "val'ue"})
    new_run_list, _ = _make_processor().merge_run_and_suite_metadata(run_list, suite_list)
    # The apostrophe inside the VALUE should be stripped; the outer list repr still uses quotes
    assert "val'ue" not in new_run_list[0][-1]
    assert "value" in new_run_list[0][-1]


def test_merge_run_and_suite_metadata_cleans_double_quotes():
    run_list, suite_list = _make_run_suite(suite_metadata={"author": '"Bob"'})
    new_run_list, _ = _make_processor().merge_run_and_suite_metadata(run_list, suite_list)
    assert '"' not in new_run_list[0][-1]


def test_merge_run_and_suite_metadata_deduplicates():
    # same metadata in both run and suite – should not appear twice
    meta = {"shared": "value"}
    run_list, suite_list = _make_run_suite(run_metadata=meta, suite_metadata=meta)
    new_run_list, _ = _make_processor().merge_run_and_suite_metadata(run_list, suite_list)
    metadata_str = new_run_list[0][-1]
    assert metadata_str.count("shared: value") == 1


def test_merge_run_and_suite_metadata_keeps_document_order():
    # order must be deterministic (run metadata first, then suites) so DB references are stable
    run_list, suite_list = _make_run_suite(
        run_metadata={"Team": "Storefront", "Browser": "chromium"}, suite_metadata={"Environment": "staging"}
    )
    new_run_list, _ = _make_processor().merge_run_and_suite_metadata(run_list, suite_list)
    assert new_run_list[0][-1] == "['Team: Storefront', 'Browser: chromium', 'Environment: staging']"


def test_merge_run_and_suite_metadata_empty_metadata():
    run_list, suite_list = _make_run_suite()
    new_run_list, new_suite_list = _make_processor().merge_run_and_suite_metadata(
        run_list, suite_list
    )
    assert new_run_list[0][-1] == "[]"


def test_merge_run_and_suite_metadata_all_real_xmls(all_xml_outputs):
    for xml_path in all_xml_outputs:
        processor = OutputProcessor(xml_path)
        processor.get_run_start()
        data = processor.get_output_data()
        assert len(data["runs"]) == 1, f"Unexpected run count for {xml_path.name}"


# --- get_run_start legacy path (no generation_time attribute) ---

from datetime import timedelta
from robotframework_dashboard.processors import (
    RunProcessor, SuiteProcessor, TestProcessor as RF_TestProcessor, KeywordProcessor,
)


def _legacy_processor(xml_path):
    """Return an OutputProcessor that falls to the legacy file-parsing path."""
    processor = OutputProcessor.__new__(OutputProcessor)
    processor.output_path = xml_path

    class MockResult:
        pass

    processor.execution_result = MockResult()
    return processor


def test_get_run_start_legacy_t_format(tmp_path):
    xml_file = tmp_path / "output.xml"
    xml_file.write_text('<robot generated="2025-05-15T09:30:00.000000" rpa="false">\n</robot>\n')
    processor = _legacy_processor(xml_file)
    result = processor.get_run_start()
    assert isinstance(result, datetime)
    assert result.year == 2025
    assert result.month == 5


def test_get_run_start_legacy_no_t_format(tmp_path):
    xml_file = tmp_path / "output_old.xml"
    xml_file.write_text('<robot generated="20250515 09:30:00.000000" rpa="false">\n</robot>\n')
    processor = _legacy_processor(xml_file)
    result = processor.get_run_start()
    assert isinstance(result, datetime)
    assert result.year == 2025
    assert result.month == 5


# --- Old-style ResultVisitor processors (pre-RF 6 compat) ---

class _OldSuiteStats:
    total = 4
    passed = 3
    failed = 1
    skipped = 0


class _OldStyleSuite:
    """Mimics a Robot Framework suite without the new-style attributes."""

    def __init__(self):
        self.longname = "Old.Suite.Name"   # instead of full_name
        self.elapsedtime = 5000            # ms, instead of elapsed_time
        self.starttime = "20250101 12:00:00.000"
        self.name = "OldSuite"
        self.metadata = {}
        self.statistics = _OldSuiteStats()
        self.tests = [True]   # truthy so SuiteProcessor processes it
        self.id = "s1"


def test_run_processor_old_style_suite():
    run_time = datetime(2025, 1, 1)
    run_list = []
    processor = RunProcessor(run_time, run_list)
    processor.visit_suite(_OldStyleSuite())
    assert len(run_list) == 1
    row = run_list[0]
    assert row[1] == "Old.Suite.Name"   # uses longname
    assert row[7] == 5.0               # elapsedtime 5000ms → 5s
    assert row[8] == "20250101 12:00:00.000"


def test_suite_processor_old_style_suite():
    run_time = datetime(2025, 1, 1)
    suite_list = []
    processor = SuiteProcessor(run_time, suite_list)
    processor.start_suite(_OldStyleSuite())
    assert len(suite_list) == 1
    row = suite_list[0]
    assert row[1] == "Old.Suite.Name"
    assert row[7] == 5.0


class _OldStyleTest:
    """Mimics an old-style Robot Framework test case."""

    def __init__(self):
        self.longname = "Old.Test.Name"
        self.elapsedtime = 1000
        self.starttime = "20250101 12:00:01.000"
        self.name = "OldTest"
        self.passed = True
        self.failed = False
        self.skipped = False
        self.message = "All good"
        self.tags = ["tag1"]
        self.id = "t1"


def test_test_processor_old_style_test():
    run_time = datetime(2025, 1, 1)
    test_list = []
    processor = RF_TestProcessor(run_time, test_list)
    processor.visit_test(_OldStyleTest())
    assert len(test_list) == 1
    row = test_list[0]
    assert row[1] == "Old.Test.Name"
    assert row[6] == 1.0   # 1000ms → 1s


# --- KeywordProcessor old/new style ---

class _NewStyleKeywordNoOwner:
    """New-style keyword but with no owner (e.g. defined in a test suite file)."""

    def __init__(self):
        self.name = "My Keyword"
        self.owner = ""      # falsy → falls to the 'if not owner' branch
        self.passed = True
        self.failed = False
        self.skipped = False
        self.elapsed_time = timedelta(seconds=0.5)


def test_keyword_processor_new_style_no_owner():
    run_time = datetime(2025, 1, 1)
    kw_list = []
    processor = KeywordProcessor(run_time, kw_list)
    processor.end_keyword(_NewStyleKeywordNoOwner())
    assert len(kw_list) == 1
    assert kw_list[0][6] == "TestSuite"   # default owner


class _OldStyleKeywordWithLib:
    """Old-style keyword: elapsedtime (ms) + libname, name contains dot."""

    def __init__(self):
        self.name = "Library.MyKeyword"
        self.libname = "Library"
        self.passed = True
        self.failed = False
        self.skipped = False
        self.elapsedtime = 500    # ms; no elapsed_time attribute


def test_keyword_processor_old_style_with_library():
    run_time = datetime(2025, 1, 1)
    kw_list = []
    processor = KeywordProcessor(run_time, kw_list)
    processor.end_keyword(_OldStyleKeywordWithLib())
    assert len(kw_list) == 1
    row = kw_list[0]
    assert row[1] == "MyKeyword"   # dot-prefix stripped
    assert row[5] == 0.5           # 500ms → 0.5s


class _OldStyleKeywordNoLib:
    """Old-style keyword without a libname → assigned 'TestSuite'."""

    def __init__(self):
        self.name = "StandaloneKeyword"
        self.libname = ""    # falsy
        self.passed = False
        self.failed = True
        self.skipped = False
        self.elapsedtime = 200


def test_keyword_processor_old_style_no_library():
    run_time = datetime(2025, 1, 1)
    kw_list = []
    processor = KeywordProcessor(run_time, kw_list)
    processor.end_keyword(_OldStyleKeywordNoLib())
    assert len(kw_list) == 1
    assert kw_list[0][6] == "TestSuite"


class _OldStyleKeywordLibNoDot:
    """Old-style keyword with libname but keyword name has no dot."""

    def __init__(self):
        self.name = "PlainKeyword"
        self.libname = "MyLib"
        self.passed = True
        self.failed = False
        self.skipped = False
        self.elapsedtime = 100


def test_keyword_processor_old_style_lib_no_dot_in_name():
    run_time = datetime(2025, 1, 1)
    kw_list = []
    processor = KeywordProcessor(run_time, kw_list)
    processor.end_keyword(_OldStyleKeywordLibNoDot())
    assert len(kw_list) == 1
    row = kw_list[0]
    assert row[1] == "PlainKeyword"   # name unchanged
    assert row[6] == "MyLib"


# --- rebot --merge attempt history (issue #310) ---

import json
from robotframework_dashboard.processors import parse_merged_message


class _NewStyleTest:
    """Mimics a Robot Framework 7 test case that ran once."""

    def __init__(self):
        self.full_name = "Suite.Test"
        self.name = "Test"
        self.passed = False
        self.failed = True
        self.skipped = False
        self.elapsed_time = timedelta(seconds=1)
        self.start_time = datetime(2025, 1, 1, 12, 0, 1)
        self.message = "Element not found"
        self.tags = ["tag1"]
        self.id = "s1-t1"

MERGE_HEADER = '*HTML* <span class="merge">Test has been re-executed and results merged.</span>'


def _merge_block(state, status, message=None):
    block = f'<span class="{state.lower()}-status">{state} status:</span> <span class="{status.lower()}">{status}</span><br>'
    if message:
        block += f'<span class="{state.lower()}-message">{state} message:</span> {message}<br>'
    return block


def test_parse_merged_message_plain_message_has_no_attempts():
    assert parse_merged_message("Element not found", "FAIL") == ("Element not found", [])
    assert parse_merged_message("", "PASS") == ("", [])


def test_parse_merged_message_single_rerun():
    message = MERGE_HEADER + "<hr>" + _merge_block("New", "PASS") + "<hr>" + _merge_block("Old", "FAIL", "Timeout &lt;10s&gt;")
    final_message, attempts = parse_merged_message(message, "PASS")
    assert final_message == ""
    assert attempts == [
        {"status": "FAIL", "message": "Timeout <10s>"},
        {"status": "PASS", "message": ""},
    ]


def test_parse_merged_message_chained_reruns_oldest_first():
    message = (
        MERGE_HEADER + "<hr>" + _merge_block("New", "PASS", "finally")
        + "<hr>" + _merge_block("Old", "FAIL", "second")
        + "<hr>" + _merge_block("Old", "FAIL", "first")
    )
    final_message, attempts = parse_merged_message(message, "PASS")
    assert final_message == "finally"
    assert [a["status"] for a in attempts] == ["FAIL", "FAIL", "PASS"]
    assert [a["message"] for a in attempts] == ["first", "second", "finally"]


def test_parse_merged_message_skipped_rerun_keeps_original():
    message = (
        '*HTML* Test has been re-executed and results merged. Latter result had '
        '<span class="skip">SKIP</span> status and was ignored. Message:\nno environment<hr>boom'
    )
    final_message, attempts = parse_merged_message(message, "FAIL")
    assert final_message == "boom"
    assert attempts == [
        {"status": "FAIL", "message": "boom"},
        {"status": "SKIP", "message": "no environment"},
    ]


class _MergedTest(_NewStyleTest):
    def __init__(self):
        super().__init__()
        self.passed = True
        self.failed = False
        self.message = MERGE_HEADER + "<hr>" + _merge_block("New", "PASS") + "<hr>" + _merge_block("Old", "FAIL", "x" * 200)


def test_test_processor_stores_attempts_and_final_message():
    test_list = []
    RF_TestProcessor(datetime(2025, 1, 1), test_list).visit_test(_MergedTest())
    row = test_list[0]
    assert row[8] == ""  # the merge HTML is not stored as the test message
    attempts = json.loads(row[11])
    assert [a["status"] for a in attempts] == ["FAIL", "PASS"]
    assert len(attempts[0]["message"]) == 150  # attempt messages are truncated like test messages


def test_test_processor_without_rerun_has_empty_attempts():
    test_list = []
    RF_TestProcessor(datetime(2025, 1, 1), test_list).visit_test(_NewStyleTest())
    assert test_list[0][11] == ""


def test_merged_output_end_to_end(tmp_path):
    """rebot --merge of two fixtures gives one run whose tests carry an attempt chain."""
    from robot.rebot import rebot_cli
    from tests.python.conftest import OUTPUTS_DIR

    merged = tmp_path / "merged.xml"
    rebot_cli(
        ["--merge", "--output", str(merged), "--log", "NONE", "--report", "NONE",
         str(OUTPUTS_DIR / "output-20260817-021512.xml"), str(OUTPUTS_DIR / "output-20260818-021545.xml")],
        exit=False,
    )
    processor = OutputProcessor(merged)
    processor.get_run_start()
    tests = processor.get_output_data()["tests"]
    assert tests
    for test in tests:
        assert not test[8].startswith("*HTML*")
        assert len(json.loads(test[11])) == 2


def test_merged_output_run_and_suite_start_time_fall_back_to_first_test(tmp_path):
    """rebot --merge clears the start time of merged suites; the earliest test start is used instead."""
    from robot.rebot import rebot_cli
    from tests.python.conftest import OUTPUTS_DIR

    merged = tmp_path / "merged.xml"
    rebot_cli(
        ["--merge", "--output", str(merged), "--log", "NONE", "--report", "NONE",
         str(OUTPUTS_DIR / "output-20260817-021512.xml"), str(OUTPUTS_DIR / "output-20260818-021545.xml")],
        exit=False,
    )
    processor = OutputProcessor(merged)
    processor.get_run_start()
    data = processor.get_output_data()
    assert data["runs"][0][8] is not None
    first_test_start = min(test[7] for test in data["tests"])
    assert data["runs"][0][8] == first_test_start
    assert all(suite[8] is not None for suite in data["suites"])
