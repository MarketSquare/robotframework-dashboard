import sqlite3
import re
from pathlib import Path
import pytest
from robotframework_dashboard.database import DatabaseProcessor
from robotframework_dashboard.processors import OutputProcessor
from robotframework_dashboard.arguments import LogRemovedConfig

OUTPUTS_DIR = Path(__file__).parent.parent / "robot" / "resources" / "outputs"
SAMPLE_XML = OUTPUTS_DIR / "output-20250313-002134.xml"
SAMPLE_XML_2 = OUTPUTS_DIR / "output-20250313-002151.xml"


# --- open / close ---

def test_open_database_creates_connection(db):
    db.open_database()
    assert db.connection is not None
    db.close_database()


def test_close_database_closes_connection(db):
    db.open_database()
    db.close_database()
    with pytest.raises(Exception):
        db.connection.cursor()


# --- _create_tables ---

def test_create_tables_results_in_four_tables(db):
    db.open_database()
    tables = {
        row[0]
        for row in db.connection.cursor()
        .execute("SELECT name FROM sqlite_master WHERE type='table'")
        .fetchall()
    }
    db.close_database()
    assert {"runs", "suites", "tests", "keywords"}.issubset(tables)


def test_runs_table_column_count(db):
    db.open_database()
    cols = db.connection.cursor().execute("PRAGMA table_info(runs)").fetchall()
    db.close_database()
    assert len(cols) == 15


def test_suites_table_column_count(db):
    db.open_database()
    cols = db.connection.cursor().execute("PRAGMA table_info(suites)").fetchall()
    db.close_database()
    assert len(cols) == 11


def test_tests_table_column_count(db):
    db.open_database()
    cols = db.connection.cursor().execute("PRAGMA table_info(tests)").fetchall()
    db.close_database()
    assert len(cols) == 12


def test_keywords_table_column_count(db):
    db.open_database()
    cols = db.connection.cursor().execute("PRAGMA table_info(keywords)").fetchall()
    db.close_database()
    assert len(cols) == 12


# --- run_start_exists ---

def test_run_start_not_in_empty_db(db):
    db.open_database()
    assert db.run_start_exists("2025-03-13 00:21:34.707148") is False
    db.close_database()


def test_run_start_exists_after_insert(populated_db):
    populated_db.open_database()
    # The fixture stores with +01:00; startswith check in run_start_exists handles this
    result = populated_db.run_start_exists("2025-03-13 00:21:34.707148")
    populated_db.close_database()
    assert result is True


def test_run_start_with_full_tz_also_found(populated_db):
    populated_db.open_database()
    result = populated_db.run_start_exists("2025-03-13 00:21:34.707148+01:00")
    populated_db.close_database()
    assert result is True


# --- insert_output_data / get_data ---

def test_insert_and_get_data_round_trip(populated_db):
    populated_db.open_database()
    data = populated_db.get_data()
    populated_db.close_database()
    assert len(data["runs"]) == 1
    assert len(data["suites"]) > 0
    assert len(data["tests"]) > 0
    assert len(data["keywords"]) > 0


def test_tags_stored_correctly(populated_db):
    populated_db.open_database()
    data = populated_db.get_data()
    populated_db.close_database()
    assert "dev" in data["runs"][0]["tags"]
    assert "prod" in data["runs"][0]["tags"]


def test_alias_stored_correctly(populated_db):
    populated_db.open_database()
    data = populated_db.get_data()
    populated_db.close_database()
    assert data["runs"][0]["run_alias"] == "my_alias"


def test_timezone_appended_to_run_start(populated_db):
    populated_db.open_database()
    data = populated_db.get_data()
    populated_db.close_database()
    assert "+01:00" in data["runs"][0]["run_start"]


def test_project_version_stored(tmp_path):
    db = DatabaseProcessor(tmp_path / "pv.db")
    processor = OutputProcessor(SAMPLE_XML)
    processor.get_run_start()
    data = processor.get_output_data()
    db.open_database()
    db.insert_output_data(data, [], "alias", SAMPLE_XML, "2.5.0")
    result = db.get_data()
    db.close_database()
    assert result["runs"][0]["project_version"] == "2.5.0"


# --- remove_runs ---

def _insert_second_run(populated_db):
    """Helper: insert a second run from a different XML into populated_db."""
    processor = OutputProcessor(SAMPLE_XML_2)
    processor.get_run_start()
    data = processor.get_output_data()
    populated_db.insert_output_data(data, [], "alias2", SAMPLE_XML_2, None)


def test_remove_by_index(populated_db):
    populated_db.open_database()
    _insert_second_run(populated_db)
    assert len(populated_db.get_data()["runs"]) == 2
    populated_db.remove_runs(["index=0"])
    assert len(populated_db.get_data()["runs"]) == 1
    populated_db.close_database()


def test_remove_by_index_range(populated_db):
    populated_db.open_database()
    _insert_second_run(populated_db)
    assert len(populated_db.get_data()["runs"]) == 2
    populated_db.remove_runs(["index=0:1"])
    assert len(populated_db.get_data()["runs"]) == 0
    populated_db.close_database()


def test_remove_by_alias(populated_db):
    populated_db.open_database()
    populated_db.remove_runs(["alias=my_alias"])
    assert len(populated_db.get_data()["runs"]) == 0
    populated_db.close_database()


def test_remove_by_tag(populated_db):
    populated_db.open_database()
    populated_db.remove_runs(["tag=dev"])
    assert len(populated_db.get_data()["runs"]) == 0
    populated_db.close_database()


def test_remove_by_tag_no_match_is_noop(populated_db):
    populated_db.open_database()
    populated_db.remove_runs(["tag=nonexistent"])
    assert len(populated_db.get_data()["runs"]) == 1
    populated_db.close_database()


def test_remove_by_limit_keeps_most_recent(populated_db):
    populated_db.open_database()
    _insert_second_run(populated_db)
    assert len(populated_db.get_data()["runs"]) == 2
    populated_db.remove_runs(["limit=1"])
    assert len(populated_db.get_data()["runs"]) == 1
    populated_db.close_database()


def test_remove_by_limit_higher_than_count_is_noop(populated_db):
    populated_db.open_database()
    populated_db.remove_runs(["limit=100"])
    assert len(populated_db.get_data()["runs"]) == 1


# --- remove_runs by limit scoped to tag(s) (issue #309) ---

def _insert_run(db, xml, tags):
    """Helper: insert a run from the given XML with the given tags."""
    processor = OutputProcessor(xml)
    processor.get_run_start()
    data = processor.get_output_data()
    db.insert_output_data(data, tags, None, xml, None)


def _tags_of(runs):
    return [run["tags"] for run in runs]


def _run_starts(db):
    return [run["run_start"] for run in db.get_data()["runs"]]


def test_remove_by_limit_with_single_tag_keeps_newest_matching(db):
    db.open_database()
    # oldest -> newest; three "nightly" runs + one unrelated "release" run
    _insert_run(db, OUTPUTS_DIR / "output-20250313-002134.xml", ["nightly"])
    _insert_run(db, OUTPUTS_DIR / "output-20250313-002151.xml", ["nightly"])
    _insert_run(db, OUTPUTS_DIR / "output-20250313-002222.xml", ["nightly"])
    _insert_run(db, OUTPUTS_DIR / "output-20250313-002257.xml", ["release"])
    starts_before = _run_starts(db)  # ordered oldest -> newest
    db.remove_runs(["limit=2;tag=nightly"])
    starts_after = _run_starts(db)
    # oldest nightly removed; 2 newest nightly + release remain
    assert len(starts_after) == 3
    assert starts_before[0] not in starts_after  # oldest nightly removed
    assert starts_before[3] in starts_after  # release untouched
    db.close_database()


def test_remove_by_limit_with_multiple_tags(db):
    db.open_database()
    _insert_run(db, OUTPUTS_DIR / "output-20250313-002134.xml", ["alpha"])
    _insert_run(db, OUTPUTS_DIR / "output-20250313-002151.xml", ["beta"])
    _insert_run(db, OUTPUTS_DIR / "output-20250313-002222.xml", ["alpha"])
    _insert_run(db, OUTPUTS_DIR / "output-20250313-002257.xml", ["gamma"])
    starts_before = _run_starts(db)
    # candidates = union of alpha+beta = 3 oldest runs; keep 2 newest of those
    db.remove_runs(["limit=2;tag=alpha;tag=beta"])
    starts_after = _run_starts(db)
    assert len(starts_after) == 3
    assert starts_before[0] not in starts_after  # oldest alpha removed
    assert starts_before[3] in starts_after  # gamma untouched
    db.close_database()


def test_remove_by_limit_with_tag_higher_than_count_is_noop(db):
    db.open_database()
    _insert_run(db, OUTPUTS_DIR / "output-20250313-002134.xml", ["nightly"])
    _insert_run(db, OUTPUTS_DIR / "output-20250313-002151.xml", ["nightly"])
    _insert_run(db, OUTPUTS_DIR / "output-20250313-002222.xml", ["other"])
    console = db.remove_runs(["limit=5;tag=nightly"])
    assert len(db.get_data()["runs"]) == 3
    assert "WARNING" in console
    db.close_database()


def test_remove_by_limit_only_ignores_tags(db):
    db.open_database()
    _insert_run(db, OUTPUTS_DIR / "output-20250313-002134.xml", ["nightly"])
    _insert_run(db, OUTPUTS_DIR / "output-20250313-002151.xml", ["release"])
    _insert_run(db, OUTPUTS_DIR / "output-20250313-002222.xml", ["nightly"])
    starts_before = _run_starts(db)
    # no tag scope -> global limit, keep 1 newest regardless of tag
    db.remove_runs(["limit=1"])
    starts_after = _run_starts(db)
    assert starts_after == [starts_before[-1]]  # only the newest remains
    db.close_database()


# --- remove_runs by age scoped to tag(s) (issue #309 follow-up) ---
# Sample XMLs are dated 2025-03 -> always "older" than the test run date.

def test_remove_by_age_with_single_tag_only_removes_matching(db):
    db.open_database()
    _insert_run(db, OUTPUTS_DIR / "output-20250313-002134.xml", ["nightly"])
    _insert_run(db, OUTPUTS_DIR / "output-20250313-002151.xml", ["release"])
    _insert_run(db, OUTPUTS_DIR / "output-20250313-002222.xml", ["nightly"])
    starts_before = _run_starts(db)
    # remove only 'nightly' runs older than 10 days; release untouched
    db.remove_runs(["age=10d;tag=nightly"])
    starts_after = _run_starts(db)
    assert len(starts_after) == 1
    assert starts_after == [starts_before[1]]  # the release run remains
    db.close_database()


def test_remove_by_age_with_multiple_tags(db):
    db.open_database()
    _insert_run(db, OUTPUTS_DIR / "output-20250313-002134.xml", ["alpha"])
    _insert_run(db, OUTPUTS_DIR / "output-20250313-002151.xml", ["beta"])
    _insert_run(db, OUTPUTS_DIR / "output-20250313-002222.xml", ["gamma"])
    starts_before = _run_starts(db)
    db.remove_runs(["age=10d;tag=alpha;tag=beta"])
    starts_after = _run_starts(db)
    assert starts_after == [starts_before[2]]  # only gamma remains
    db.close_database()


def test_remove_by_age_with_tag_no_match_is_noop(db):
    db.open_database()
    _insert_run(db, OUTPUTS_DIR / "output-20250313-002134.xml", ["nightly"])
    _insert_run(db, OUTPUTS_DIR / "output-20250313-002151.xml", ["nightly"])
    console = db.remove_runs(["age=10d;tag=nonexistent"])
    assert len(db.get_data()["runs"]) == 2
    assert "WARNING" in console
    db.close_database()


def test_remove_by_age_only_ignores_tags(db):
    db.open_database()
    _insert_run(db, OUTPUTS_DIR / "output-20250313-002134.xml", ["nightly"])
    _insert_run(db, OUTPUTS_DIR / "output-20250313-002151.xml", ["release"])
    # no tag scope -> all runs older than 10 days removed regardless of tag
    db.remove_runs(["age=10d"])
    assert len(db.get_data()["runs"]) == 0
    db.close_database()


# --- list_runs ---

def test_list_runs_empty_prints_warning(db, capsys):
    db.open_database()
    db.list_runs()
    db.close_database()
    captured = capsys.readouterr()
    assert "WARNING" in captured.out


def test_list_runs_populated_prints_run_info(populated_db, capsys):
    populated_db.open_database()
    populated_db.list_runs()
    populated_db.close_database()
    captured = capsys.readouterr()
    assert "Run 0" in captured.out


# --- vacuum_database ---

def test_vacuum_database_returns_console(populated_db):
    populated_db.open_database()
    console = populated_db.vacuum_database()
    populated_db.close_database()
    assert "Vacuumed" in console


# --- update_output_path ---

def test_update_output_path_found(populated_db):
    populated_db.open_database()
    # SAMPLE_XML is stored as path; its corresponding log is log-20250313-002134.html
    log_path = str(OUTPUTS_DIR / "log-20250313-002134.html")
    console = populated_db.update_output_path(log_path)
    populated_db.close_database()
    assert "Executed query" in console


def test_update_output_path_not_found(populated_db):
    populated_db.open_database()
    console = populated_db.update_output_path("path/to/nonexistent-log.html")
    populated_db.close_database()
    assert "ERROR" in console


# --- remove_runs by run_start ---

def test_remove_runs_by_run_start(populated_db):
    populated_db.open_database()
    data = populated_db.get_data()
    run_start = data["runs"][0]["run_start"]
    populated_db.remove_runs([f"run_start={run_start}"])
    assert len(populated_db.get_data()["runs"]) == 0
    populated_db.close_database()


def test_remove_runs_by_run_start_not_found_logs_error(populated_db):
    populated_db.open_database()
    console = populated_db.remove_runs(["run_start=2000-01-01 00:00:00.000000+00:00"])
    populated_db.close_database()
    assert "ERROR" in console


def test_remove_runs_invalid_format_logs_error(populated_db):
    populated_db.open_database()
    console = populated_db.remove_runs(["invalid_format=something"])
    populated_db.close_database()
    assert "ERROR" in console


def test_remove_runs_semicolon_separated_indexes(populated_db):
    populated_db.open_database()
    _insert_second_run(populated_db)
    assert len(populated_db.get_data()["runs"]) == 2
    populated_db.remove_runs(["index=0;1"])
    assert len(populated_db.get_data()["runs"]) == 0
    populated_db.close_database()


# --- get_data with duplicate aliases ---

def test_get_data_duplicate_aliases(tmp_path):
    """Two runs with the same alias → second gets a counter suffix."""
    db = DatabaseProcessor(tmp_path / "dup.db")
    processor1 = OutputProcessor(SAMPLE_XML)
    processor1.get_run_start()
    data1 = processor1.get_output_data()

    processor2 = OutputProcessor(SAMPLE_XML_2)
    processor2.get_run_start()
    data2 = processor2.get_output_data()

    db.open_database()
    db.insert_output_data(data1, [], "same_alias", SAMPLE_XML, None)
    db.insert_output_data(data2, [], "same_alias", SAMPLE_XML_2, None)
    result = db.get_data()
    db.close_database()

    aliases = [run["run_alias"] for run in result["runs"]]
    assert "same_alias" in aliases
    # The second entry should have a counter appended
    assert any(a != "same_alias" and "same_alias" in a for a in aliases)


# --- get_data without timezone stored (adds local tz) ---

def test_get_data_run_without_timezone_gets_tz_appended(tmp_path):
    db = DatabaseProcessor(tmp_path / "notz.db")
    processor = OutputProcessor(SAMPLE_XML)
    processor.get_run_start()
    data = processor.get_output_data()
    db.open_database()
    # Insert without timezone
    db.insert_output_data(data, [], "alias", SAMPLE_XML, None, timezone="")
    result = db.get_data()
    db.close_database()
    # Local timezone should have been appended by get_data
    assert re.match(r".*[+-]\d{2}:\d{2}$", result["runs"][0]["run_start"])


# --- _has_timezone_offset (static) ---

@pytest.mark.parametrize("run_start,expected", [
    ("2025-03-13 00:21:34.707148+01:00", True),
    ("2025-03-13 00:21:34.707148-05:30", True),
    ("2025-03-13 00:21:34.707148+00:00", True),
    ("2025-03-13 00:21:34.707148", False),
    ("short", False),
    ("", False),
])
def test_has_timezone_offset(run_start, expected):
    assert DatabaseProcessor._has_timezone_offset(run_start) is expected


# --- _get_local_timezone_offset (static) ---

def test_get_local_timezone_offset_format():
    result = DatabaseProcessor._get_local_timezone_offset()
    assert re.match(r"^[+-]\d{2}:\d{2}$", result), f"Unexpected format: {result}"


# --- _dict_from_row (static) ---

def test_dict_from_row():
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute("CREATE TABLE t (a TEXT, b INTEGER)")
    conn.execute("INSERT INTO t VALUES ('hello', 42)")
    row = conn.execute("SELECT * FROM t").fetchone()
    # _dict_from_row is an instance method (no @staticmethod decorator)
    db_inst = DatabaseProcessor.__new__(DatabaseProcessor)
    result = db_inst._dict_from_row(row)
    conn.close()
    assert result == {"a": "hello", "b": 42}


# --- schema migration ---

def test_schema_migration_runs_table_from_10_to_14(tmp_path):
    """A legacy runs table with 10 columns should be migrated to 15 columns."""
    db_path = tmp_path / "legacy.db"
    conn = sqlite3.connect(str(db_path))
    conn.execute("""
        CREATE TABLE runs (
            "run_start" TEXT, "full_name" TEXT, "name" TEXT,
            "total" INTEGER, "passed" INTEGER, "failed" INTEGER,
            "skipped" INTEGER, "elapsed_s" TEXT, "start_time" TEXT, "tags" TEXT,
            UNIQUE(run_start, full_name)
        )
    """)
    conn.execute("""
        CREATE TABLE suites (
            "run_start" TEXT, "full_name" TEXT, "name" TEXT,
            "total" INTEGER, "passed" INTEGER, "failed" INTEGER,
            "skipped" INTEGER, "elapsed_s" TEXT, "start_time" TEXT
        )
    """)
    conn.execute("""
        CREATE TABLE tests (
            "run_start" TEXT, "full_name" TEXT, "name" TEXT,
            "passed" INTEGER, "failed" INTEGER, "skipped" INTEGER,
            "elapsed_s" TEXT, "start_time" TEXT, "message" TEXT
        )
    """)
    conn.execute("""
        CREATE TABLE keywords (
            "run_start" TEXT, "name" TEXT, "passed" INTEGER, "failed" INTEGER,
            "skipped" INTEGER, "times_run" TEXT, "total_time_s" TEXT,
            "average_time_s" TEXT, "min_time_s" TEXT, "max_time_s" TEXT
        )
    """)
    conn.commit()
    conn.close()

    # Opening via DatabaseProcessor should trigger migration
    db = DatabaseProcessor(str(db_path))
    db.open_database()
    runs_cols = db.connection.cursor().execute("PRAGMA table_info(runs)").fetchall()
    suites_cols = db.connection.cursor().execute("PRAGMA table_info(suites)").fetchall()
    tests_cols = db.connection.cursor().execute("PRAGMA table_info(tests)").fetchall()
    keywords_cols = db.connection.cursor().execute("PRAGMA table_info(keywords)").fetchall()
    db.close_database()

    assert len(runs_cols) == 15
    assert len(suites_cols) == 11
    assert len(tests_cols) == 12
    assert len(keywords_cols) == 12


# --- insert_output_data exception path ---

def test_insert_output_data_exception_prints_error(db, capsys):
    """insert_output_data catches exceptions from _insert_runs and prints an error."""
    from unittest.mock import patch
    db.open_database()
    fake_data = {"runs": [], "suites": [], "tests": [], "keywords": []}
    with patch.object(db, "_insert_runs", side_effect=Exception("boom")):
        db.insert_output_data(fake_data, [], "alias", "path.xml", None)
    db.close_database()
    captured = capsys.readouterr()
    assert "ERROR" in captured.out


# --- get_data backward-compatibility branches ---

def test_get_data_null_run_alias_generates_auto_alias(db):
    """get_data() assigns 'Alias 1' when run_alias is NULL (pre-0.6.0 compat)."""
    db.open_database()
    db.connection.execute(
        "INSERT INTO runs VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        ("2020-01-01 00:00:00+00:00", "Suite", "Suite", 1, 1, 0, 0, "1.0",
         "2020-01-01", "tag", None, "/some/path.xml", "{}", None, None),
    )
    db.connection.commit()
    data = db.get_data()
    db.close_database()
    assert data["runs"][0]["run_alias"] == "Alias 1"


def test_get_data_empty_run_alias_generates_auto_alias(db):
    """get_data() assigns 'Alias 1' when run_alias is '' (pre-0.6.0 compat)."""
    db.open_database()
    db.connection.execute(
        "INSERT INTO runs VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        ("2020-01-01 00:00:00+00:00", "Suite", "Suite", 1, 1, 0, 0, "1.0",
         "2020-01-01", "tag", "", "/some/path.xml", "{}", None, None),
    )
    db.connection.commit()
    data = db.get_data()
    db.close_database()
    assert data["runs"][0]["run_alias"] == "Alias 1"


def test_get_data_null_path_becomes_empty_string(db):
    """get_data() replaces NULL path with '' (pre-0.8.1 compat)."""
    db.open_database()
    db.connection.execute(
        "INSERT INTO runs VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        ("2020-01-01 00:00:00+00:00", "Suite", "Suite", 1, 1, 0, 0, "1.0",
         "2020-01-01", "tag", "alias_np", None, "{}", None, None),
    )
    db.connection.commit()
    data = db.get_data()
    db.close_database()
    assert data["runs"][0]["path"] == ""


def test_get_data_null_suite_id(db):
    """get_data() handles NULL suite id (pre-0.8.4 compat)."""
    db.open_database()
    db.connection.execute(
        "INSERT INTO runs VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        ("2020-01-01 00:00:00+00:00", "Suite", "Suite", 1, 1, 0, 0, "1.0",
         "2020-01-01", "tag", "alias_si", "/path.xml", "{}", None, None),
    )
    db.connection.execute(
        "INSERT INTO suites VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        ("2020-01-01 00:00:00+00:00", "Suite.Sub", "Sub", 1, 1, 0, 0, "0.5",
         "2020-01-01", "alias_si", None),
    )
    db.connection.commit()
    data = db.get_data()
    db.close_database()
    assert len(data["suites"]) == 1


def test_get_data_null_test_tags_and_id(db):
    """get_data() handles NULL test tags and NULL test id (pre-0.8.4 compat)."""
    db.open_database()
    db.connection.execute(
        "INSERT INTO runs VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        ("2020-01-01 00:00:00+00:00", "Suite", "Suite", 1, 1, 0, 0, "1.0",
         "2020-01-01", "tag", "alias_ti", "/path.xml", "{}", None, None),
    )
    db.connection.execute(
        "INSERT INTO tests VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        ("2020-01-01 00:00:00+00:00", "Suite.Test", "Test", 1, 0, 0, "0.1",
         "2020-01-01", "OK", None, "alias_ti", None),
    )
    db.connection.commit()
    data = db.get_data()
    db.close_database()
    assert len(data["tests"]) == 1
    assert data["tests"][0]["tags"] == ""


# --- _get_run_data ---
def test_get_run_data_returns_dict_for_existing_run(populated_db):
    populated_db.open_database()
    run_start = populated_db.get_data()["runs"][0]["run_start"]
    result = populated_db._get_run_data(run_start)
    populated_db.close_database()
    assert result is not None
    assert result["run_start"] == run_start


def test_get_run_data_returns_none_for_missing_run(populated_db):
    populated_db.open_database()
    result = populated_db._get_run_data("2000-01-01 00:00:00.000000")
    populated_db.close_database()
    assert result is None


# --- _log_run_jsonl ---

def test_log_run_jsonl_creates_file_and_writes_entry(tmp_path):
    import json
    db = DatabaseProcessor(tmp_path / "test.db")
    logpath = tmp_path / "removed.jsonl"
    db._log_run_jsonl(logpath, {"run_start": "2025-01-01", "name": "My Run"})
    parsed = json.loads(logpath.read_text())
    assert parsed["run_start"] == "2025-01-01"


def test_log_run_jsonl_appends_on_successive_calls(tmp_path):
    db = DatabaseProcessor(tmp_path / "test.db")
    logpath = tmp_path / "removed.jsonl"
    db._log_run_jsonl(logpath, {"run_start": "2025-01-01"})
    db._log_run_jsonl(logpath, {"run_start": "2025-01-02"})
    assert len(logpath.read_text().splitlines()) == 2


def test_log_run_jsonl_serializes_datetime(tmp_path):
    import json
    from datetime import datetime
    db = DatabaseProcessor(tmp_path / "test.db")
    logpath = tmp_path / "removed.jsonl"
    db._log_run_jsonl(logpath, {"run_start": datetime(2025, 1, 1, 12, 0, 0)})
    parsed = json.loads(logpath.read_text())
    assert "2025-01-01" in parsed["run_start"]


# --- _remove_run with logging ---

def test_remove_run_with_logging_writes_jsonl_and_deletes(tmp_path):
    import json
    logpath = tmp_path / "removed.jsonl"
    db = DatabaseProcessor(tmp_path / "test.db", log_removed=LogRemovedConfig(types=["all"], path=str(logpath)))
    processor = OutputProcessor(SAMPLE_XML)
    processor.get_run_start()
    db.open_database()
    db.insert_output_data(processor.get_output_data(), [], "alias", SAMPLE_XML, None, timezone="+00:00")
    run_start = db.get_data()["runs"][0]["run_start"]
    db.remove_runs([f"run_start={run_start}"])
    assert len(db.get_data()["runs"]) == 0
    db.close_database()
    lines = logpath.read_text().splitlines()
    assert len(lines) == 1
    assert json.loads(lines[0])["run"]["run_alias"] == "alias"


def test_remove_run_logging_failure_rolls_back_delete(tmp_path):
    from unittest.mock import patch
    logpath = tmp_path / "removed.jsonl"
    db = DatabaseProcessor(tmp_path / "test.db", log_removed=LogRemovedConfig(types=["all"], path=str(logpath)))
    processor = OutputProcessor(SAMPLE_XML)
    processor.get_run_start()
    db.open_database()
    db.insert_output_data(processor.get_output_data(), [], "alias", SAMPLE_XML, None, timezone="+00:00")
    run_start = db.get_data()["runs"][0]["run_start"]
    with patch.object(db, "_log_run_jsonl", side_effect=OSError("disk full")):
        db.remove_runs([f"run_start={run_start}"])
    assert len(db.get_data()["runs"]) == 1
    db.close_database()


# --- remove_runs bare except branch ---

def test_remove_runs_exception_branch_logs_error(populated_db):
    """remove_runs() catches exceptions (e.g. index parse error) in its bare except."""
    populated_db.open_database()
    # "index=not_a_number" matches the 'elif "index=" in run' branch but
    # int("not_a_number") raises ValueError, which the bare except catches.
    console = populated_db.remove_runs(["index=not_a_number"])
    populated_db.close_database()
    assert "ERROR" in console
