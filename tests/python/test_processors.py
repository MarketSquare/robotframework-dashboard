from datetime import datetime
from pathlib import Path
import pytest
from robotframework_dashboard.processors import OutputProcessor

OUTPUTS_DIR = Path(__file__).parent.parent / "e2e" / "resources" / "outputs"
SAMPLE_XML = OUTPUTS_DIR / "output-20250313-002134.xml"


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
    assert set(data.keys()) == {"runs", "suites", "tests", "keywords"}


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
