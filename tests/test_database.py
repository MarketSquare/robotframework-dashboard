import sqlite3
import re
from pathlib import Path
import pytest
from robotframework_dashboard.database import DatabaseProcessor
from robotframework_dashboard.processors import OutputProcessor

OUTPUTS_DIR = Path(__file__).parent.parent / "testdata" / "outputs"
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
    assert len(cols) == 14


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


def test_remove_by_run_start(populated_db):
    populated_db.open_database()
    data = populated_db.get_data()
    run_start = data["runs"][0]["run_start"]
    populated_db.remove_runs([f"run_start={run_start}"])
    assert len(populated_db.get_data()["runs"]) == 0
    populated_db.close_database()


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
    """A legacy runs table with 10 columns should be migrated to 14 columns."""
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

    assert len(runs_cols) == 14
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
    """get_data() assigns 'Alias 0' when run_alias is NULL (pre-0.6.0 compat)."""
    db.open_database()
    db.connection.execute(
        "INSERT INTO runs VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        ("2020-01-01 00:00:00+00:00", "Suite", "Suite", 1, 1, 0, 0, "1.0",
         "2020-01-01", "tag", None, "/some/path.xml", "{}", None),
    )
    db.connection.commit()
    data = db.get_data()
    db.close_database()
    assert data["runs"][0]["run_alias"] == "Alias 1"


def test_get_data_empty_run_alias_generates_auto_alias(db):
    """get_data() assigns 'Alias 1' when run_alias is '' (pre-0.6.0 compat)."""
    db.open_database()
    db.connection.execute(
        "INSERT INTO runs VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        ("2020-01-01 00:00:00+00:00", "Suite", "Suite", 1, 1, 0, 0, "1.0",
         "2020-01-01", "tag", "", "/some/path.xml", "{}", None),
    )
    db.connection.commit()
    data = db.get_data()
    db.close_database()
    assert data["runs"][0]["run_alias"] == "Alias 1"


def test_get_data_null_path_becomes_empty_string(db):
    """get_data() replaces NULL path with '' (pre-0.8.1 compat)."""
    db.open_database()
    db.connection.execute(
        "INSERT INTO runs VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        ("2020-01-01 00:00:00+00:00", "Suite", "Suite", 1, 1, 0, 0, "1.0",
         "2020-01-01", "tag", "alias_np", None, "{}", None),
    )
    db.connection.commit()
    data = db.get_data()
    db.close_database()
    assert data["runs"][0]["path"] == ""


def test_get_data_null_suite_id(db):
    """get_data() handles NULL suite id (pre-0.8.4 compat)."""
    db.open_database()
    db.connection.execute(
        "INSERT INTO runs VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        ("2020-01-01 00:00:00+00:00", "Suite", "Suite", 1, 1, 0, 0, "1.0",
         "2020-01-01", "tag", "alias_si", "/path.xml", "{}", None),
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
        "INSERT INTO runs VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        ("2020-01-01 00:00:00+00:00", "Suite", "Suite", 1, 1, 0, 0, "1.0",
         "2020-01-01", "tag", "alias_ti", "/path.xml", "{}", None),
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


# --- remove_runs bare except branch ---

def test_remove_runs_exception_branch_logs_error(populated_db):
    """remove_runs() catches exceptions (e.g. index parse error) in its bare except."""
    populated_db.open_database()
    # "index=not_a_number" matches the 'elif "index=" in run' branch but
    # int("not_a_number") raises ValueError, which the bare except catches.
    console = populated_db.remove_runs(["index=not_a_number"])
    populated_db.close_database()
    assert "ERROR" in console
