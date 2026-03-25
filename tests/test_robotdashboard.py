import shutil
import pytest
from datetime import datetime
from pathlib import Path

from robotframework_dashboard.robotdashboard import RobotDashboard

OUTPUTS_DIR = Path(__file__).parent.parent / "testdata" / "outputs"
SAMPLE_XML = OUTPUTS_DIR / "output-20250313-002134.xml"
SAMPLE_XML_2 = OUTPUTS_DIR / "output-20250313-002151.xml"


def _make_rd(tmp_path, **kwargs):
    """Create a RobotDashboard instance with sane defaults."""
    defaults = dict(
        database_path=tmp_path / "test.db",
        generate_dashboard=False,
        dashboard_name=str(tmp_path / "dashboard.html"),
        generation_datetime=datetime(2025, 1, 1, 12, 0, 0),
        list_runs=True,
        dashboard_title="",
        database_class=None,
        json_config="",
        message_config=[],
        quantity=20,
        use_logs=False,
        offline_dependencies=False,
        force_json_config=False,
        project_version=None,
        no_vacuum=True,
        timezone="+00:00",
        no_autoupdate=False,
    )
    defaults.update(kwargs)
    return RobotDashboard(**defaults)


# --- __init__ ---

def test_init_stores_attributes(tmp_path):
    rd = _make_rd(tmp_path)
    assert rd.database_path == tmp_path / "test.db"
    assert rd.generate_dashboard is False
    assert rd.server is False


# --- _print_console ---

def test_print_console_returns_message_with_newline(tmp_path):
    rd = _make_rd(tmp_path)
    result = rd._print_console("Hello World")
    assert result == "Hello World\n"


# --- initialize_database ---

def test_initialize_database_creates_database_instance(tmp_path):
    rd = _make_rd(tmp_path)
    rd.initialize_database()
    assert rd.database is not None


def test_initialize_database_verbose_returns_console(tmp_path):
    rd = _make_rd(tmp_path)
    console = rd.initialize_database(suppress=False)
    assert "Database preparation" in console or "created database" in console


# --- process_outputs ---

def test_process_outputs_no_outputs_returns_skip(tmp_path):
    rd = _make_rd(tmp_path)
    rd.initialize_database()
    console = rd.process_outputs()
    assert "skipping" in console.lower()


def test_process_outputs_with_file_list(tmp_path):
    rd = _make_rd(tmp_path)
    rd.initialize_database()
    console = rd.process_outputs(output_file_info_list=[(str(SAMPLE_XML), ["dev"])])
    assert "Processing output XML" in console


def test_process_outputs_duplicate_logs_error(tmp_path):
    rd = _make_rd(tmp_path)
    rd.initialize_database()
    rd.process_outputs(output_file_info_list=[(str(SAMPLE_XML), [])])
    # Second insert of same XML → error message
    console = rd.process_outputs(output_file_info_list=[(str(SAMPLE_XML), [])])
    assert "ERROR" in console


def test_process_outputs_invalid_xml_logs_error(tmp_path):
    rd = _make_rd(tmp_path)
    rd.initialize_database()
    console = rd.process_outputs(output_file_info_list=[("nonexistent_file.xml", [])])
    assert "ERROR" in console


def test_process_outputs_folder_not_exists(tmp_path):
    rd = _make_rd(tmp_path)
    rd.initialize_database()
    console = rd.process_outputs(output_folder_configs=[("nonexistent_folder_xyz", [])])
    assert "ERROR" in console


def test_process_outputs_folder_with_xml_files(tmp_path):
    # Copy one XML to a temp folder so the scan finds it
    scan_dir = tmp_path / "scan"
    scan_dir.mkdir()
    shutil.copy(SAMPLE_XML, scan_dir / "output-test.xml")

    rd = _make_rd(tmp_path)
    rd.initialize_database()
    console = rd.process_outputs(output_folder_configs=[(str(scan_dir), [])])
    assert "Processing output XML" in console


def test_process_outputs_with_version_tag_in_tags(tmp_path):
    rd = _make_rd(tmp_path)
    rd.initialize_database()
    console = rd.process_outputs(output_file_info_list=[(str(SAMPLE_XML), ["version_1.0", "prod"])])
    assert "Processing output XML" in console


# --- print_runs ---

def test_print_runs_enabled(tmp_path):
    rd = _make_rd(tmp_path, list_runs=True)
    rd.initialize_database()
    rd.process_outputs(output_file_info_list=[(str(SAMPLE_XML), [])])
    console = rd.print_runs()
    assert "3. Listing" in console


def test_print_runs_disabled(tmp_path):
    rd = _make_rd(tmp_path, list_runs=False)
    rd.initialize_database()
    console = rd.print_runs()
    assert "skipping" in console.lower()


# --- remove_outputs ---

def test_remove_outputs_none_returns_skip(tmp_path):
    rd = _make_rd(tmp_path)
    rd.initialize_database()
    console = rd.remove_outputs(remove_runs=None)
    assert "skipping" in console.lower()


def test_remove_outputs_with_runs(tmp_path):
    rd = _make_rd(tmp_path, no_vacuum=False)
    rd.initialize_database()
    rd.process_outputs(output_file_info_list=[(str(SAMPLE_XML), ["dev"])])
    console = rd.remove_outputs(remove_runs=["tag=dev"])
    assert "4. Removing" in console


# --- create_dashboard ---

def test_create_dashboard_disabled_returns_skip(tmp_path):
    rd = _make_rd(tmp_path, generate_dashboard=False)
    rd.initialize_database()
    console = rd.create_dashboard()
    assert "skipping" in console.lower()


def test_create_dashboard_enabled_creates_file(tmp_path):
    rd = _make_rd(tmp_path, generate_dashboard=True)
    rd.initialize_database()
    rd.create_dashboard()
    assert Path(rd.dashboard_name).exists()


# --- get_runs ---

def test_get_runs_returns_expected_counts(tmp_path):
    rd = _make_rd(tmp_path)
    rd.initialize_database()
    rd.process_outputs(output_file_info_list=[(str(SAMPLE_XML), ["dev"])])
    runs, names, aliases, tags = rd.get_runs()
    assert len(runs) == 1
    assert len(names) == 1


# --- get_run_paths ---

def test_get_run_paths_returns_dict(tmp_path):
    rd = _make_rd(tmp_path)
    rd.initialize_database()
    rd.process_outputs(output_file_info_list=[(str(SAMPLE_XML), [])])
    run_paths = rd.get_run_paths()
    assert len(run_paths) == 1


# --- update_output_path ---

def test_update_output_path_returns_string(tmp_path):
    rd = _make_rd(tmp_path)
    rd.initialize_database()
    rd.process_outputs(output_file_info_list=[(str(SAMPLE_XML), [])])
    console = rd.update_output_path("log-20250313-002134.html")
    assert isinstance(console, str)


# --- initialize_database with custom database_class ---

def test_initialize_database_with_custom_database_class(tmp_path):
    """initialize_database() uses importlib to load a custom DatabaseProcessor."""
    custom_db_file = tmp_path / "custom_db.py"
    custom_db_file.write_text(
        "from pathlib import Path\n"
        "from robotframework_dashboard.abstractdb import AbstractDatabaseProcessor\n"
        "\n"
        "class DatabaseProcessor(AbstractDatabaseProcessor):\n"
        "    def __init__(self, database_path: Path):\n"
        "        self.database_path = database_path\n"
        "    def open_database(self): pass\n"
        "    def close_database(self): pass\n"
        "    def run_start_exists(self, run_start: str): return False\n"
        "    def insert_output_data(self, output_data, tags, run_alias, path, project_version, timezone=''): pass\n"
        "    def get_data(self): return {}\n"
        "    def list_runs(self): pass\n"
        "    def remove_runs(self, remove_runs): pass\n"
    )
    from robotframework_dashboard.database import DatabaseProcessor as BuiltInDB
    rd = _make_rd(tmp_path, database_class=str(custom_db_file))
    rd.initialize_database(suppress=False)  # suppress=False covers the verbose print branch
    assert rd.database is not None
    assert not isinstance(rd.database, BuiltInDB)


# --- process_outputs folder scan exception path ---

def test_process_outputs_folder_scan_corrupt_xml_logs_error(tmp_path):
    """process_outputs() logs an error for files that fail to parse in folder scan."""
    corrupt_xml = tmp_path / "output_corrupt.xml"
    corrupt_xml.write_text("THIS IS NOT VALID XML CONTENT")
    rd = _make_rd(tmp_path)
    rd.initialize_database()
    output_folder_configs = [[str(tmp_path), []]]
    console = rd.process_outputs(output_folder_configs=output_folder_configs)
    assert "ERROR" in console
