from pathlib import Path
import warnings
import pytest

# Suppress sqlite3 ResourceWarning. These surface when coverage tracing changes
# GC timing, causing closed Connection objects to be collected during XML
# parsing. The connections ARE properly closed; this is a Python 3.12+
# GC-strictness artefact that only appears with pytest-cov active.
warnings.filterwarnings("ignore", category=ResourceWarning)

OUTPUTS_DIR = Path(__file__).parent.parent / "testdata" / "outputs"
SAMPLE_XML = OUTPUTS_DIR / "output-20250313-002134.xml"


@pytest.fixture
def xml_output():
    return SAMPLE_XML


@pytest.fixture
def all_xml_outputs():
    return sorted(OUTPUTS_DIR.glob("output-*.xml"))


@pytest.fixture
def processed_output():
    from robotframework_dashboard.processors import OutputProcessor

    processor = OutputProcessor(SAMPLE_XML)
    processor.get_run_start()
    return processor


@pytest.fixture
def db(tmp_path):
    from robotframework_dashboard.database import DatabaseProcessor

    return DatabaseProcessor(tmp_path / "test.db")


@pytest.fixture
def populated_db(tmp_path):
    from robotframework_dashboard.database import DatabaseProcessor
    from robotframework_dashboard.processors import OutputProcessor

    db = DatabaseProcessor(tmp_path / "test.db")
    processor = OutputProcessor(SAMPLE_XML)
    processor.get_run_start()
    data = processor.get_output_data()
    db.open_database()
    db.insert_output_data(
        data,
        tags=["dev", "prod"],
        run_alias="my_alias",
        path=SAMPLE_XML,
        project_version=None,
        timezone="+01:00",
    )
    db.close_database()
    return db
