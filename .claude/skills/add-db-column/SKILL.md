---
name: add-db-column
description: Checklist for adding a new column/field to the runs, suites, tests, or keywords table — every file from output.xml parsing through SQLite schema + migration, get_data, the JS payload, the Tables page, server/admin, custom-DB contract, unit and robot fixtures, and docs. Use when a feature needs to store or expose a new per-run/per-suite/per-test/per-keyword value.
---

# Adding a database column

Data flows parse → DB → HTML → JS. A new column has to be threaded through **all** of it or it silently arrives as `null` somewhere. Model: `custom_filters` on `runs` (commit `759b798`, #286) touched 28 files; use `git show --stat 759b798` as the reference diff.

Work through the list top to bottom.

## 1. Schema (`robotframework_dashboard/queries.py`)

- `CREATE_<TABLE>` — append the column **at the end** (column order = insert tuple order).
- `INSERT_INTO_<TABLE>` — add one `?`.
- `<TABLE>_TABLE_UPDATE_<NAME> = """ALTER TABLE <table> ADD COLUMN <name> TEXT;"""`.
- Any narrow `SELECT` that should expose it (e.g. `SELECT_RUN_DATA` for the run list used by `--listruns`/server).

## 2. Migration (`robotframework_dashboard/database.py` → `_create_tables`)

Migrations are a chain of `if <table>_table_length == N:` checks on `PRAGMA table_info`. Add the next step for the new column count and update the version comment block above it:

```python
if run_table_length == 15:  # -> column <name> not present
    self.connection.cursor().execute(RUN_TABLE_UPDATE_<NAME>)
    self.connection.commit()
```

Make the *previous* step refresh `run_table_length = get_runs_length()` again (the last step currently doesn't, because nothing followed it).

## 3. Producing the value

| Where the value comes from | Change |
|---|---|
| Parsed from `output.xml` | The matching `ResultVisitor` in `processors.py` (`RunProcessor`, `SuiteProcessor`, `TestProcessor`, `KeywordProcessor`) — append to the tuple it builds |
| CLI argument | `add-cli-argument` skill first, then pass it: `main.py` → `RobotDashboard.__init__` → `process_outputs` → `database.insert_output_data(...)` |
| Server upload | `server.py` Pydantic models (`GetOutput`, `AddOutput` → `output_<name>`) and the multipart `/add-output-file` form field + `templates/admin.html` field + `js/admin_page/admin_api.js` |
| Listener | `robotdashboardlistener.py` argument + upload payload (`listener-integration` skill) |

## 4. Storing it (`database.py`)

- `insert_output_data(...)` signature and the `_insert_<table>` helper — extend the tuple in the same position as the schema.
- `abstractdb.py`: `AbstractDatabaseProcessor.insert_output_data` signature must match — custom backends implement it.
- `_collect_log_entry` / `_get_run_data` if the column should appear in the removed-runs `.jsonl` log or in `--listruns` output.

## 5. Reading it (`database.py` → `get_data`)

`get_data` uses `SELECT * FROM <table>` and `_dict_from_row`, so a new column appears automatically in each row dict. Only touch this if the value needs normalisation (e.g. how `run_alias` collisions are rewritten there).

## 6. Browser side

- `js/variables/data.js` decodes whatever `get_data` returned — no change needed.
- **Tables page**: `js/graph_creation/tables.js` — add the value to the row builder (`run.<name> ?? ""` for runs) *and* the `{ title: "<name>" }` column list.
- Any graph/filter/stat widget that should use it: `filtering-and-settings`, `dashboard-graphs`, `js-features` skills.
- Admin page table if it lists the column: `js/admin_page/admin_api.js` row builder + `templates/admin.html` header.

## 7. Tests

- `tests/python/test_database.py`: `test_<table>_table_column_count` — bump the expected count (runs is 15 today). `test_schema_migration_runs_table_from_10_to_14` builds a legacy 10-column DB by hand and asserts the final counts after `DatabaseProcessor.__init__` — bump its expected count too (and rename it if you like); it is what proves the migration chain in step 2.
- `tests/python/test_robotdashboard.py` / `test_server.py` / `test_arguments.py`: update helper defaults and any tuple/kwarg assertions the new parameter changes.
- `tests/robot/resources/database_output/<table>.txt`: every row gains one value (usually `None` for the fixtures) — regenerate by running `01_database.robot` in Docker and copying the actual output from the log, or edit by hand if the change is uniform.
- Robot screenshots of the Tables page (`dashboard_output/tables/*.png`) change when a column is added — regenerate in Docker (`testing` skill).
- If a CLI flag was added, `cli_output/help.txt` changes too.

## 8. Docs

- `docs/custom-database-class.md` — the `insert_output_data` signature and example class.
- `docs/graphs-tables.md` (Tables tab) if it is visible there; the CLI/server/listener pages if the value is user-supplied.

## Verify

```bash
rm -f robot_results.db && python -m robotframework_dashboard.main -f tests -n robot_dashboard.html
```
Open the Tables tab and confirm the column shows real values. Then run `bash scripts/python-tests.sh` and the affected robot suites in Docker. Also run once against an **old** database (copy `example/robot_results.db`) to prove the migration path.
