"""Example --databaseclass backed by MySQL (mysql-connector-python).

Mirrors robotframework_dashboard/database.py (the built-in SQLite implementation) method for
method, so the dashboard, the server and every CLI feature (--removeruns selectors, --logremoved,
log linking, custom filters, rerun attempts, exceptions) behave the same. Only the connection,
the queries and the schema migration differ. Adjust the connection settings below (or set the
ROBOTDASHBOARD_MYSQL_* environment variables) and run e.g.:

    robotdashboard --databaseclass example/database/mysql.py -o output.xml

The database itself must exist; the tables are created on the first run.
"""

import os
import re
from datetime import datetime, timedelta, timezone
from json import dumps
from pathlib import Path
from time import time
from typing import Union

import mysql.connector
from robotframework_dashboard.abstractdb import AbstractDatabaseProcessor

# connection settings, overridable through the environment
MYSQL_CONFIG = {
    "host": os.environ.get("ROBOTDASHBOARD_MYSQL_HOST", "localhost"),
    "port": int(os.environ.get("ROBOTDASHBOARD_MYSQL_PORT", "3306")),
    "user": os.environ.get("ROBOTDASHBOARD_MYSQL_USER", "root"),
    "password": os.environ.get("ROBOTDASHBOARD_MYSQL_PASSWORD", "password"),
    "database": os.environ.get("ROBOTDASHBOARD_MYSQL_DATABASE", "robot_results"),
}

# schema: same tables and column order as robotframework_dashboard/queries.py
# run_start carries a timezone suffix ("2026-09-10 06:00:11.098769+02:00"), hence VARCHAR(40)
TABLE_SUFFIX = "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci"
CREATE_RUNS = f"""CREATE TABLE IF NOT EXISTS runs (`run_start` VARCHAR(40) NOT NULL, `full_name` TEXT, `name` TEXT, `total` INT, `passed` INT, `failed` INT, `skipped` INT, `elapsed_s` TEXT, `start_time` TEXT, `tags` TEXT, `run_alias` TEXT, `path` TEXT, `metadata` TEXT, `project_version` TEXT, `custom_filters` TEXT, PRIMARY KEY (`run_start`)) {TABLE_SUFFIX}"""
CREATE_SUITES = f"""CREATE TABLE IF NOT EXISTS suites (`run_start` VARCHAR(40) NOT NULL, `full_name` TEXT, `name` TEXT, `total` INT, `passed` INT, `failed` INT, `skipped` INT, `elapsed_s` TEXT, `start_time` TEXT, `run_alias` TEXT, `id` TEXT, INDEX (`run_start`)) {TABLE_SUFFIX}"""
CREATE_TESTS = f"""CREATE TABLE IF NOT EXISTS tests (`run_start` VARCHAR(40) NOT NULL, `full_name` TEXT, `name` TEXT, `passed` INT, `failed` INT, `skipped` INT, `elapsed_s` TEXT, `start_time` TEXT, `message` TEXT, `tags` TEXT, `run_alias` TEXT, `id` TEXT, `attempts` TEXT, INDEX (`run_start`)) {TABLE_SUFFIX}"""
CREATE_KEYWORDS = f"""CREATE TABLE IF NOT EXISTS keywords (`run_start` VARCHAR(40) NOT NULL, `name` TEXT, `passed` INT, `failed` INT, `skipped` INT, `times_run` TEXT, `total_time_s` TEXT, `average_time_s` TEXT, `min_time_s` TEXT, `max_time_s` TEXT, `run_alias` TEXT, `owner` TEXT, INDEX (`run_start`)) {TABLE_SUFFIX}"""
CREATE_EXCEPTIONS = f"""CREATE TABLE IF NOT EXISTS exceptions (`run_start` VARCHAR(40) NOT NULL, `message` TEXT, `amount` INT, `run_alias` TEXT, INDEX (`run_start`)) {TABLE_SUFFIX}"""

# columns added after the first release, in order; missing ones are added at startup
# (the built-in class does the same with ALTER TABLE ADD COLUMN)
TABLE_COLUMNS = {
    "runs": ["run_start", "full_name", "name", "total", "passed", "failed", "skipped", "elapsed_s", "start_time",
             "tags", "run_alias", "path", "metadata", "project_version", "custom_filters"],
    "suites": ["run_start", "full_name", "name", "total", "passed", "failed", "skipped", "elapsed_s", "start_time",
               "run_alias", "id"],
    "tests": ["run_start", "full_name", "name", "passed", "failed", "skipped", "elapsed_s", "start_time", "message",
              "tags", "run_alias", "id", "attempts"],
    "keywords": ["run_start", "name", "passed", "failed", "skipped", "times_run", "total_time_s", "average_time_s",
                 "min_time_s", "max_time_s", "run_alias", "owner"],
    "exceptions": ["run_start", "message", "amount", "run_alias"],
}
COLUMN_TYPES = {"total": "INT", "passed": "INT", "failed": "INT", "skipped": "INT", "amount": "INT"}
SELECT_COLUMNS = """SELECT COLUMN_NAME, CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s"""
ADD_COLUMN = """ALTER TABLE `{table}` ADD COLUMN `{column}` {type}"""
# the previous version of this example used VARCHAR(26), too short for a run_start with timezone suffix
WIDEN_RUN_START = """ALTER TABLE `{table}` MODIFY `run_start` VARCHAR(40) NOT NULL"""
RUN_START_LENGTH = 40

INSERT_INTO_RUNS = """INSERT INTO runs (run_start, full_name, name, total, passed, failed, skipped, elapsed_s, start_time, tags, run_alias, path, metadata, project_version, custom_filters) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)"""
INSERT_INTO_SUITES = """INSERT INTO suites (run_start, full_name, name, total, passed, failed, skipped, elapsed_s, start_time, run_alias, id) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)"""
INSERT_INTO_TESTS = """INSERT INTO tests (run_start, full_name, name, passed, failed, skipped, elapsed_s, start_time, message, tags, run_alias, id, attempts) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)"""
INSERT_INTO_KEYWORDS = """INSERT INTO keywords (run_start, name, passed, failed, skipped, times_run, total_time_s, average_time_s, min_time_s, max_time_s, run_alias, owner) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)"""
INSERT_INTO_EXCEPTIONS = """INSERT INTO exceptions (run_start, message, amount, run_alias) VALUES (%s,%s,%s,%s)"""

SELECT_FROM_RUNS = """SELECT * FROM runs"""
SELECT_RUN_STARTS_FROM_RUNS = """SELECT run_start FROM runs"""
SELECT_RUN_DATA = """SELECT name, run_start, run_alias, tags, custom_filters FROM runs"""
SELECT_FROM_SUITES = """SELECT * FROM suites"""
SELECT_FROM_TESTS = """SELECT * FROM tests"""
SELECT_FROM_KEYWORDS = """SELECT * FROM keywords"""
SELECT_FROM_EXCEPTIONS = """SELECT * FROM exceptions"""
GET_RUN_INFO_BY_RUN_START = """SELECT * FROM runs WHERE run_start = %s"""
SELECT_BY_RUN_START = """SELECT * FROM `{table}` WHERE run_start = %s"""

DELETE_FROM_RUNS = """DELETE FROM runs WHERE run_start = %s"""
DELETE_FROM_SUITES = """DELETE FROM suites WHERE run_start = %s"""
DELETE_FROM_TESTS = """DELETE FROM tests WHERE run_start = %s"""
DELETE_FROM_KEYWORDS = """DELETE FROM keywords WHERE run_start = %s"""
DELETE_FROM_EXCEPTIONS = """DELETE FROM exceptions WHERE run_start = %s"""

UPDATE_RUN_PATH = """UPDATE runs SET path = %s WHERE run_start = %s"""
OPTIMIZE_TABLE = """OPTIMIZE TABLE `{table}`"""


class DatabaseProcessor(AbstractDatabaseProcessor):
    def __init__(self, database_path: Path, log_removed=None):
        """Connects to MySQL and creates/migrates the tables. database_path is unused (the connection
        settings live in MYSQL_CONFIG) but must stay in the signature: robotdashboard passes it."""
        self.database_path = database_path
        self.connection = None
        # set again by robotdashboard after construction when --logremoved is used
        self.log_removed_path = log_removed.path if log_removed else None
        self.log_removed_types = log_removed.types if log_removed else []
        self.open_database()
        self._create_tables()
        self.close_database()

    def open_database(self):
        """This function should handle the setting of the connection to the database"""
        self.connection = mysql.connector.connect(**MYSQL_CONFIG)

    def close_database(self):
        """This function is called to close the connection to the database"""
        if self.connection is not None:
            self.connection.close()
        self.connection = None

    def _cursor(self):
        """Dictionary cursor: rows come back as {column: value} like sqlite3.Row in the built-in class"""
        return self.connection.cursor(dictionary=True)

    def _create_tables(self):
        """Creates the tables and adds columns that were introduced in later versions"""
        cursor = self.connection.cursor()
        for statement in (CREATE_RUNS, CREATE_SUITES, CREATE_TESTS, CREATE_KEYWORDS, CREATE_EXCEPTIONS):
            cursor.execute(statement)
        for table, columns in TABLE_COLUMNS.items():
            cursor.execute(SELECT_COLUMNS, (table,))
            existing = {row[0].lower(): row[1] for row in cursor.fetchall()}
            for column in columns:
                if column.lower() not in existing:
                    cursor.execute(ADD_COLUMN.format(table=table, column=column, type=COLUMN_TYPES.get(column, "TEXT")))
            run_start_length = existing.get("run_start")
            if run_start_length is not None and run_start_length < RUN_START_LENGTH:
                cursor.execute(WIDEN_RUN_START.format(table=table))
        self.connection.commit()
        cursor.close()

    def run_start_exists(self, run_start: str):
        cursor = self._cursor()
        cursor.execute(SELECT_RUN_STARTS_FROM_RUNS)
        run_starts = [row["run_start"] for row in cursor.fetchall()]
        cursor.close()
        # startswith handles TZ-aware run_starts in the database ("... 00:21:34.123456+02:00")
        # when the incoming run_start has no timezone suffix ("... 00:21:34.123456")
        run_start_str = str(run_start)
        return any(rs == run_start_str or rs.startswith(run_start_str) for rs in run_starts)

    def insert_output_data(
        self,
        output_data: dict,
        tags: list,
        run_alias: str,
        path: Union[Path, str],
        project_version: str,
        custom_filters: str = "",
        timezone: str = "",
    ):
        """This function inserts the data of an output file into the database"""
        try:
            self._insert_runs(output_data["runs"], tags, run_alias, path, project_version, custom_filters, timezone)
            self._insert_suites(output_data["suites"], run_alias, timezone)
            self._insert_tests(output_data["tests"], run_alias, timezone)
            self._insert_keywords(output_data["keywords"], run_alias, timezone)
            self._insert_exceptions(output_data.get("exceptions", []), run_alias, timezone)
            self.connection.commit()
        except Exception as error:
            self.connection.rollback()
            print(f"   ERROR: something went wrong with the database: {error}")

    def _insert_runs(self, runs: list, tags: list, run_alias: str, path, project_version, custom_filters, timezone):
        """Helper function to insert the run data with the run tags"""
        full_runs = []
        for run in runs:
            *rest, metadata = run
            run_start_with_tz = f"{rest[0]}{timezone}" if timezone else str(rest[0])
            full_runs.append((
                run_start_with_tz,
                *rest[1:],
                ",".join(tags),
                run_alias,
                str(path),
                metadata,
                project_version,
                custom_filters,
            ))
        self._executemany(INSERT_INTO_RUNS, full_runs)

    def _insert_suites(self, suites: list, run_alias: str, timezone: str = ""):
        """Helper function to insert the suite data"""
        full_suites = []
        for suite in suites:
            suite = list(suite)
            if timezone:
                suite[0] = f"{suite[0]}{timezone}"
            suite.insert(9, run_alias)
            full_suites.append(tuple(suite))
        self._executemany(INSERT_INTO_SUITES, full_suites)

    def _insert_tests(self, tests: list, run_alias: str, timezone: str = ""):
        """Helper function to insert the test data"""
        full_tests = []
        for test in tests:
            test = list(test)
            if timezone:
                test[0] = f"{test[0]}{timezone}"
            test.insert(10, run_alias)
            full_tests.append(tuple(test))
        self._executemany(INSERT_INTO_TESTS, full_tests)

    def _insert_keywords(self, keywords: list, run_alias: str, timezone: str = ""):
        """Helper function to insert the keyword data"""
        full_keywords = []
        for keyword in keywords:
            keyword = list(keyword)
            if timezone:
                keyword[0] = f"{keyword[0]}{timezone}"
            keyword.insert(10, run_alias)
            full_keywords.append(tuple(keyword))
        self._executemany(INSERT_INTO_KEYWORDS, full_keywords)

    def _insert_exceptions(self, exceptions: list, run_alias: str, timezone: str = ""):
        """Helper function to insert the exception data"""
        full_exceptions = []
        for exc in exceptions:
            exc = list(exc)
            if timezone:
                exc[0] = f"{exc[0]}{timezone}"
            exc.append(run_alias)
            full_exceptions.append(tuple(exc))
        self._executemany(INSERT_INTO_EXCEPTIONS, full_exceptions)

    def _executemany(self, query: str, rows: list):
        if not rows:
            return
        cursor = self.connection.cursor()
        cursor.executemany(query, rows)
        cursor.close()

    @staticmethod
    def _get_local_timezone_offset():
        """Helper function to get the local machine's timezone offset as a string like +01:00"""
        now = datetime.now(timezone.utc).astimezone()
        total_seconds = int(now.utcoffset().total_seconds())
        sign = "+" if total_seconds >= 0 else "-"
        hours, remainder = divmod(abs(total_seconds), 3600)
        return f"{sign}{hours:02d}:{remainder // 60:02d}"

    @staticmethod
    def _has_timezone_offset(run_start: str):
        """Helper function to check if the run_start string already ends with an offset like +02:00"""
        if len(run_start) < 6:
            return False
        suffix = run_start[-6:]
        return (suffix[0] in ("+", "-") and suffix[3] == ":" and suffix[1:3].isdigit() and suffix[4:6].isdigit())

    def _fetch_all(self, query: str, params: tuple = ()):
        cursor = self._cursor()
        cursor.execute(query, params)
        rows = [self._dict_from_row(row) for row in cursor.fetchall()]
        cursor.close()
        return rows

    def get_data(self):
        """This function gets all the data in the database"""
        data, runs, suites, tests, keywords, exceptions, aliases = {}, [], [], [], [], [], {}
        name_labels = {}
        local_tz = self._get_local_timezone_offset()
        alias_counter = 1
        run_name_counter = 1
        for row in self._fetch_all(SELECT_FROM_RUNS):
            # runs stored before aliases existed, or duplicate aliases, get a numbered one
            if row["run_alias"] is None or row["run_alias"] == "":
                alias = f"Alias {alias_counter}"
                aliases[row["run_start"]] = alias
                row["run_alias"] = alias
                alias_counter += 1
            elif row["run_alias"] in aliases.values():
                alias = f"{row['run_alias']} {alias_counter}"
                aliases[row["run_start"]] = alias
                row["run_alias"] = alias
                alias_counter += 1
            else:
                aliases[row["run_start"]] = row["run_alias"]
            # deduplicated run_name for display (separate from name, same pattern as aliases)
            run_name = row["name"] or ""
            if run_name in name_labels.values():
                dedup_name = f"{run_name} {run_name_counter}"
                name_labels[row["run_start"]] = dedup_name
                row["run_name"] = dedup_name
                run_name_counter += 1
            else:
                name_labels[row["run_start"]] = run_name
                row["run_name"] = run_name
            if row["path"] is None:
                row["path"] = ""
            # runs stored without a timezone get the local one
            if not self._has_timezone_offset(row["run_start"]):
                row["run_start"] = f"{row['run_start']}{local_tz}"
            runs.append(row)
        data["runs"] = runs
        # lookups by full run_start and by its first 19 characters (wall-clock part) for older rows
        alias_prefix_lookup = {key[:19]: alias for key, alias in aliases.items()}
        name_prefix_lookup = {key[:19]: name for key, name in name_labels.items()}

        def attach_run_labels(row):
            if not self._has_timezone_offset(row["run_start"]):
                row["run_start"] = f"{row['run_start']}{local_tz}"
            row["run_alias"] = aliases.get(row["run_start"], alias_prefix_lookup.get(row["run_start"][:19], ""))
            row["run_name"] = name_labels.get(row["run_start"], name_prefix_lookup.get(row["run_start"][:19], ""))
            return row

        for row in self._fetch_all(SELECT_FROM_SUITES):
            if row["id"] is None:
                row["id"] = ""
            suites.append(attach_run_labels(row))
        data["suites"] = suites
        for row in self._fetch_all(SELECT_FROM_TESTS):
            if row["tags"] is None:
                row["tags"] = ""
            if row["id"] is None:
                row["id"] = ""
            if row.get("attempts") is None:
                row["attempts"] = ""
            tests.append(attach_run_labels(row))
        data["tests"] = tests
        for row in self._fetch_all(SELECT_FROM_KEYWORDS):
            keywords.append(attach_run_labels(row))
        data["keywords"] = keywords
        for row in self._fetch_all(SELECT_FROM_EXCEPTIONS):
            exceptions.append(attach_run_labels(row))
        data["exceptions"] = exceptions
        return data

    def _dict_from_row(self, row):
        """Rows already are dicts (dictionary cursor); copy so callers can modify them freely"""
        return dict(row)

    def _get_runs(self):
        """Helper function to get the run data"""
        runs, names, aliases, tags, custom_filters = [], [], [], [], []
        for entry in self._fetch_all(SELECT_RUN_DATA):
            runs.append(entry["run_start"])
            names.append(entry["name"])
            aliases.append(entry["run_alias"])
            tags.append(entry["tags"])
            custom_filters.append(entry.get("custom_filters") or "")
        return runs, names, aliases, tags, custom_filters

    def list_runs(self):
        """This function gets all available runs and prints them to the console"""
        run_starts, run_names, run_aliases, run_tags, _ = self._get_runs()
        for index, run_start in enumerate(run_starts):
            print(f"  Run {str(index).ljust(3, ' ')} | {run_start} | {run_names[index]}")
        if len(run_starts) == 0:
            print(f"  WARNING: There are no runs so the dashboard will be empty!")

    def _get_run_paths(self):
        """Helper function to get a mapping of run_start to path for all runs"""
        return {entry["run_start"]: entry.get("path") or "" for entry in self._fetch_all(SELECT_FROM_RUNS)}

    def _get_run_data(self, run_start):
        rows = self._fetch_all(GET_RUN_INFO_BY_RUN_START, (run_start,))
        return rows[0] if rows else None

    def _rows_for_run_start(self, table, run_start):
        return self._fetch_all(SELECT_BY_RUN_START.format(table=table), (run_start,))

    def _collect_log_entry(self, run_start):
        """--logremoved: the data of a run before it is deleted"""
        entry = {}
        types = self.log_removed_types
        include_all = "all" in types
        if include_all or "run" in types:
            entry["run"] = self._get_run_data(run_start)
        if include_all or "suite" in types:
            entry["suites"] = self._rows_for_run_start("suites", run_start)
        if include_all or "test" in types:
            entry["tests"] = self._rows_for_run_start("tests", run_start)
        if include_all or "keyword" in types:
            entry["keywords"] = self._rows_for_run_start("keywords", run_start)
        return entry

    def _log_run_jsonl(self, logpath, entry):
        with Path(logpath).open("a", encoding="utf-8") as f:
            f.write(dumps(entry, default=str) + "\n")

    def remove_runs(self, remove_runs: list):
        """This function removes all provided runs and all their corresponding data"""
        run_starts, run_names, run_aliases, run_tags, _ = self._get_runs()
        console = ""
        for run in remove_runs:
            try:
                if "run_start=" in run:
                    console += self._remove_by_run_start(run, run_starts)
                elif "index=" in run:
                    console += self._remove_by_index(run, run_starts)
                elif "alias=" in run:
                    console += self._remove_by_alias(run, run_starts, run_aliases)
                elif "limit=" in run:
                    # before "tag=": a scoped combo ("limit=10;tag=x") also contains "tag="
                    console += self._remove_by_limit(run, run_starts, run_tags)
                elif "tag=" in run:
                    console += self._remove_by_tag(run, run_starts, run_tags)
                elif "age=" in run:
                    console += self._remove_by_age(run, run_starts)
                else:
                    message = f"  ERROR: incorrect usage of the remove_run feature ({run}), check out robotdashboard --help for instructions"
                    print(message)
                    console += message + "\n"
            except Exception as error:
                message = f"  ERROR: Could not remove run: {run}, reason: {error}, check out robotdashboard --help for instructions"
                print(message)
                console += message + "\n"
        return console

    def _remove_by_run_start(self, run: str, run_starts: list):
        run_start = run.replace("run_start=", "")
        if run_start not in run_starts:
            message = f"  ERROR: Could not find run to remove from the database: run_start={run_start}"
            print(message)
            return message + "\n"
        self._remove_run(run_start)
        message = f"  Removed run from the database: run_start={run_start}"
        print(message)
        return message + "\n"

    def _remove_by_index(self, run: str, run_starts: list):
        console = ""
        indexes = []
        for part in run.replace("index=", "").split(";"):
            if ":" in part:
                start, stop = part.split(":")
                indexes.extend(range(int(start), int(stop) + 1))
            else:
                indexes.append(int(part))
        for index in indexes:
            self._remove_run(run_starts[index])
            message = f"  Removed run from the database: index={index}, run_start={run_starts[index]}"
            print(message)
            console += message + "\n"
        return console

    def _remove_by_alias(self, run: str, run_starts: list, run_aliases: list):
        alias = run.replace("alias=", "")
        run_start = run_starts[run_aliases.index(alias)]
        self._remove_run(run_start)
        message = f"  Removed run from the database: alias={alias}, run_start={run_start}"
        print(message)
        return message + "\n"

    def _remove_by_tag(self, run: str, run_starts: list, run_tags: list):
        console = ""
        tag = run.replace("tag=", "")
        removed = 0
        for index, run_tag in enumerate(run_tags):
            if tag in run_tag:
                self._remove_run(run_starts[index])
                message = f"  Removed run from the database: tag={tag}, run_start={run_starts[index]}"
                print(message)
                console += message + "\n"
                removed += 1
        if removed == 0:
            message = f"  WARNING: no runs were removed as no runs were found with tag: {tag}"
            print(message)
            console += message + "\n"
        return console

    def _remove_by_limit(self, run: str, run_starts: list, run_tags: list = None):
        """Keep the N newest runs; with tag filters ('limit=10;tag=nightly') only runs with one of
        those tags are counted and removed, other runs are left untouched."""
        console = ""
        parts = run.split(";")
        limit = int(parts[0].replace("limit=", ""))
        tag_filters = [part.replace("tag=", "") for part in parts[1:] if part.startswith("tag=")]
        # run_starts are ordered oldest -> newest, so keeping the N newest means dropping the leading ones
        if tag_filters and run_tags is not None:
            candidates = [index for index, run_tag in enumerate(run_tags) if any(tag in run_tag for tag in tag_filters)]
            scope = f" with tag(s) {', '.join(tag_filters)}"
        else:
            candidates = list(range(len(run_starts)))
            scope = ""
        if limit >= len(candidates):
            message = f"  WARNING: no runs were removed as the provided limit ({limit}) is higher than the total number of runs{scope} ({len(candidates)})"
            print(message)
            return message + "\n"
        for index in candidates[: len(candidates) - limit]:
            self._remove_run(run_starts[index])
            message = f"  Removed run from the database: index={index}, run_start={run_starts[index]}"
            print(message)
            console += message + "\n"
        return console

    def _remove_by_age(self, run_query: str, run_starts: list):
        console = ""
        try:
            clean_query = run_query.replace("age=", "")
            mod, delta = self.parse_time_range(clean_query)
        except ValueError as error:
            print(f"  ERROR: {error}")
            return f"  ERROR: {error}\n"
        cutoff = datetime.now(timezone.utc) - delta
        targets = []
        for run_start in run_starts:
            try:
                run_dt = datetime.fromisoformat(run_start)
                if run_dt.tzinfo is None:
                    run_dt = run_dt.replace(tzinfo=timezone.utc)
                if (mod == "+" and run_dt < cutoff) or (mod == "-" and run_dt > cutoff):
                    targets.append(run_start)
            except ValueError as error:
                print(f"    WARNING: Skipping invalid timestamp: '{run_start}' ({error})")
        if not targets:
            message = f"  WARNING: no runs were removed as no runs were within range {clean_query}"
            print(message)
            return message + "\n"
        for run_start in targets:
            self._remove_run(run_start)
            message = f"  Removed run from the database: run_start={run_start}"
            print(message)
            console += message + "\n"
        return console

    def _remove_run(self, run_start: str):
        """Helper function to remove the data from all tables in one transaction"""
        entry = self._collect_log_entry(run_start) if self.log_removed_path else None
        cursor = self.connection.cursor()
        try:
            cursor.execute(DELETE_FROM_RUNS, (run_start,))
            if cursor.rowcount > 0:
                cursor.execute(DELETE_FROM_SUITES, (run_start,))
                cursor.execute(DELETE_FROM_TESTS, (run_start,))
                cursor.execute(DELETE_FROM_KEYWORDS, (run_start,))
                cursor.execute(DELETE_FROM_EXCEPTIONS, (run_start,))
                # log inside the transaction: if the write fails the run is not deleted
                if self.log_removed_path and entry:
                    self._log_run_jsonl(self.log_removed_path, entry)
            self.connection.commit()
        except Exception:
            self.connection.rollback()
            raise
        finally:
            cursor.close()

    def vacuum_database(self):
        """MySQL has no VACUUM; OPTIMIZE TABLE reclaims the space of removed rows"""
        start = time()
        cursor = self.connection.cursor()
        for table in TABLE_COLUMNS:
            cursor.execute(OPTIMIZE_TABLE.format(table=table))
            cursor.fetchall()  # OPTIMIZE returns a result set that must be consumed
        cursor.close()
        self.connection.commit()
        console = f"  Optimized the database tables in {round(time() - start, 2)} seconds\n"
        print(console.rstrip())
        return console

    def parse_time_range(self, range_str: str):
        """'+10d', '-4h', '1y' -> (modifier, timedelta); a year counts as 365 days"""
        match = re.match(r"([+-])?(\d+)([smhdy])", range_str)
        if not match:
            raise ValueError("Invalid format. Use e.g., 10d, +5h, -1y")
        modifier, value, unit = match.groups()
        value = int(value)
        units = {"s": "seconds", "m": "minutes", "h": "hours", "d": "days", "y": "days"}
        delta_kwargs = {units[unit]: value * (365 if unit == "y" else 1)}
        return modifier or "+", timedelta(**delta_kwargs)

    def update_output_path(self, log_path: str):
        """Function to update the output_path using the log path that the server has used"""
        console = ""
        log_name = Path(log_path).name
        output_name = log_name.replace("log", "output").replace(".html", ".xml")
        for entry in self._fetch_all(SELECT_FROM_RUNS):
            if output_name in (entry["path"] or "") or log_name in (entry["path"] or ""):
                cursor = self.connection.cursor()
                cursor.execute(UPDATE_RUN_PATH, (log_path, entry["run_start"]))
                cursor.close()
                self.connection.commit()
                console = f"Executed query: {UPDATE_RUN_PATH} with ({log_path}, {entry['run_start']})\n"
                break
        if console == "":
            console = f"ERROR: There was no output with the name {output_name} or {log_name} in any of the existing outputs in the database!\n"
        return console
