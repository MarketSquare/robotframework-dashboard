CREATE_RUNS = """ CREATE TABLE IF NOT EXISTS runs ("run_start" TEXT, "full_name" TEXT, "name" TEXT, "total" INTEGER, "passed" INTEGER, "failed" INTEGER, "skipped" INTEGER, "elapsed_s" TEXT, "start_time" TEXT, "tags" TEXT, "run_alias" TEXT, "path" TEXT, "metadata" TEXT, "project_version" TEXT, unique(run_start, full_name)); """
CREATE_SUITES = """ CREATE TABLE IF NOT EXISTS suites ("run_start" TEXT, "full_name" TEXT, "name" TEXT, "total" INTEGER, "passed" INTEGER, "failed" INTEGER, "skipped" INTEGER, "elapsed_s" TEXT, "start_time" TEXT, "run_alias" TEXT, "id" TEXT); """
CREATE_TESTS = """ CREATE TABLE IF NOT EXISTS tests ("run_start" TEXT, "full_name" TEXT, "name" TEXT, "passed" INTEGER, "failed" INTEGER, "skipped" INTEGER, "elapsed_s" TEXT, "start_time" TEXT, "message" TEXT, "tags" TEXT, "run_alias" TEXT, "id" TEXT); """
CREATE_KEYWORDS = """ CREATE TABLE IF NOT EXISTS keywords ("run_start" TEXT, "name" TEXT, "passed" INTEGER, "failed" INTEGER, "skipped" INTEGER, "times_run" TEXT, "total_time_s" TEXT, "average_time_s" TEXT, "min_time_s" TEXT, "max_time_s" TEXT, "run_alias" TEXT, "owner" TEXT); """
CREATE_EXCEPTIONS = """ CREATE TABLE IF NOT EXISTS exceptions ("run_start" TEXT, "message" TEXT, "amount" INTEGER, "run_alias" TEXT); """

RUN_TABLE_EXISTS = (
    """SELECT name FROM sqlite_master WHERE type='table' AND name='runs';"""
)
RUN_TABLE_LENGTH = """PRAGMA table_info(runs);"""
RUN_TABLE_UPDATE_ALIAS = """ALTER TABLE runs ADD COLUMN run_alias TEXT;"""
RUN_TABLE_UPDATE_PATH = """ALTER TABLE runs ADD COLUMN path TEXT;"""
RUN_TABLE_UPDATE_METADATA = """ALTER TABLE runs ADD COLUMN metadata TEXT;"""
RUN_TABLE_UPDATE_PROJECT_VERSION = """ALTER TABLE runs ADD COLUMN project_version TEXT;"""

SUITE_TABLE_LENGTH = """PRAGMA table_info(suites);"""
SUITE_TABLE_UPDATE_ALIAS = """ALTER TABLE suites ADD COLUMN run_alias TEXT;"""
SUITE_TABLE_UPDATE_ID = """ALTER TABLE suites ADD COLUMN id TEXT;"""

TEST_TABLE_LENGTH = """PRAGMA table_info(tests);"""
TEST_TABLE_UPDATE_TAGS = """ALTER TABLE tests ADD COLUMN tags TEXT;"""
TEST_TABLE_UPDATE_ALIAS = """ALTER TABLE tests ADD COLUMN run_alias TEXT;"""
TEST_TABLE_UPDATE_ID = """ALTER TABLE tests ADD COLUMN id TEXT;"""

KEYWORD_TABLE_LENGTH = """PRAGMA table_info(keywords);"""
KEYWORD_TABLE_UPDATE_ALIAS = """ALTER TABLE keywords ADD COLUMN run_alias TEXT;"""
KEYWORD_TABLE_UPDATE_OWNER = """ALTER TABLE keywords ADD COLUMN owner TEXT;"""

INSERT_INTO_RUNS = """ INSERT INTO runs VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) """
INSERT_INTO_SUITES = """ INSERT INTO suites VALUES (?,?,?,?,?,?,?,?,?,?,?) """
INSERT_INTO_TESTS = """ INSERT INTO tests VALUES (?,?,?,?,?,?,?,?,?,?,?,?) """
INSERT_INTO_KEYWORDS = """ INSERT INTO keywords VALUES (?,?,?,?,?,?,?,?,?,?,?,?) """
INSERT_INTO_EXCEPTIONS = """ INSERT INTO exceptions VALUES (?,?,?,?) """

SELECT_FROM_RUNS = """ SELECT * FROM runs """
SELECT_RUN_STARTS_FROM_RUNS = """ SELECT run_start FROM runs """
SELECT_RUN_DATA = """ SELECT name, run_start, run_alias, tags FROM runs """
SELECT_FROM_SUITES = """ SELECT * FROM suites """
SELECT_FROM_TESTS = """ SELECT * FROM tests """
SELECT_FROM_KEYWORDS = """ SELECT * FROM keywords """
SELECT_FROM_EXCEPTIONS = """ SELECT * FROM exceptions """

DELETE_FROM_RUNS = """ DELETE FROM runs WHERE run_start="{run_start}" """
DELETE_FROM_SUITES = """ DELETE FROM suites WHERE run_start="{run_start}" """
DELETE_FROM_TESTS = """ DELETE FROM tests WHERE run_start="{run_start}" """
DELETE_FROM_KEYWORDS = """ DELETE FROM keywords WHERE run_start="{run_start}" """
DELETE_FROM_EXCEPTIONS = """ DELETE FROM exceptions WHERE run_start="{run_start}" """
UPDATE_RUN_PATH = """ UPDATE runs SET path="{path}" WHERE run_start="{run_start}" """

VACUUM_DATABASE = """ VACUUM """
