---
outline: deep
---

# Custom Database Class

RobotFramework Dashboard supports custom database implementations. This page explains how to create your own database class, which interfaces must be implemented, and how to use it with the dashboard command line interface.

The Dashboard processes Robot Framework output files and stores them in a database. By default it uses a SQLite3 database, but you are free to implement any backend you want—MySQL, PostgreSQL, MongoDB, flat-file systems, cloud storage, or fully custom solutions.


## Example Implementations

The project includes several reference implementations. These demonstrate how to structure your own custom database class and how to correctly implement all required methods.

**Available examples:**

- [abstractdb.py](https://github.com/marketsquare/robotframework-dashboard/blob/main/example/database/abstractdb.py): base abstract class to extend
- [sqlite3.py](https://github.com/marketsquare/robotframework-dashboard/blob/main/example/database/sqlite3.py): default implementation used by RobotDashboard
- [mysql.py](https://github.com/marketsquare/robotframework-dashboard/blob/main/example/database/mysql.py): example MySQL implementation

These files define the required structure and show how each method should behave. If you create your own custom database implementation, you are encouraged to submit it via pull request or github issue so it can be added to the example folder to help others.

## Basic Custom Class Structure

To implement your own database class, extend the `AbstractDatabaseProcessor` from the example folder.

A minimal structure looks like this:

```bash
from robotframework_dashboard.abstractdb import AbstractDatabaseProcessor

class DatabaseProcessor(AbstractDatabaseProcessor):
    # implement all abstract methods here
```

You may name the Python file anything you want. The *only rule* is that your class must be named:

**`DatabaseProcessor`**

This is the class name the dashboard dynamically loads at runtime.

## Custom Class Requirements

Your custom database class must implement the following methods:

### `__init__(self, database_path: Path)`
- Responsible for initial setup.  
- Should create the database file (if applicable) and initialize tables or structures.  
- `database_path` is provided by the dashboard and points to the configured database file or directory.

---

### `open_database(self)`
- Opens a database connection.  
- Must set a property such as `self.connection` for later use.

---

### `close_database(self)`
- Closes the connection.  
- Must be implemented to ensure resources are cleaned up properly.

---

### `run_start_exists(self, run_start: str) -> bool`
- Checks whether a run with the given `run_start` timestamp already exists.
- Returning `False` always is acceptable but inefficient—duplicate processing will occur.

---

### `insert_output_data(self, output_data: dict, tags: list, run_alias: str, path: Path)`
This method handles the actual insertion of all run-related data.

You must process:

- `output_data` — contains runs, suites, tests, and keywords  
- `tags` — list of tags associated with the run  
- `run_alias` — a human-friendly alias chosen by the user or system  
- `path` — path to `output.xml`  

You can inspect the example implementations for the exact structure of `output_data` and how each record is inserted.

---

### `get_data(self) -> dict`
Must return **all data** in this dictionary format:

```bash
{
  "runs": [
    {
      "run_start": "2024-10-13 22:33:19",
      "full_name": "Robotframework-Dashboard",
      "name": "Robotframework-Dashboard",
      "total": 6,
      "passed": 4,
      "failed": 1,
      "skipped": 1,
      "elapsed_s": "6.313",
      "start_time": "2024-10-13 22:33:19.673821",
      "tags": "",
      "run_alias": "output-20241013-223319",
      "path": "results/output-20241013-223319.xml",
      "metadata": "[]"
    },
    {...etc}
  ],
  "suites": [
    {
      "run_start": "2024-10-13 22:33:19",
      "full_name": "Robotframework-Dashboard.01 Login",
      "name": "01 Login",
      "total": 2,
      "passed": 2,
      "failed": 0,
      "skipped": 0,
      "elapsed_s": "1.21",
      "start_time": "2024-10-13 22:33:20.120000",
      "run_alias": "output-20241013-223319",
      "id": "s1-s1"
    },
    {...etc}
  ],
  "tests": [
    {
      "run_start": "2024-10-13 22:33:19",
      "full_name": "Robotframework-Dashboard.01 Login.Valid Login",
      "name": "Valid Login",
      "passed": 1,
      "failed": 0,
      "skipped": 0,
      "elapsed_s": "0.55",
      "start_time": "2024-10-13 22:33:20.125000",
      "message": "",
      "tags": "[\"sanity\"]",
      "run_alias": "output-20241013-223319",
      "id": "s1-s1-t1"
    },
    {...etc}
  ],
  "keywords": [
    {
      "run_start": "2024-10-13 22:33:19",
      "name": "Open Browser",
      "passed": 6,
      "failed": 0,
      "skipped": 0,
      "times_run": "6",
      "total_time_s": "2.100",
      "average_time_s": "0.350",
      "min_time_s": "0.200",
      "max_time_s": "0.500",
      "run_alias": "output-20241013-223319",
      "owner": "SeleniumLibrary"
    },
    {...etc}
  ]
}

```

Each type must be a list of dictionaries matching what RobotDashboard expects.

---

### `list_runs(self)`
- Prints all runs in the database with identifiable information.
- This is required for CLI features like:  
  ```bash  
  robotdashboard --database list  
  ```
- You may leave this function empty if you do not need command-line listing, but it must exist.

---

### `remove_runs(self, remove_runs: list)`
`remove_runs` may contain any of the following:

- `index=<n>`  
- `run_start=<timestamp>`  
- `alias=<alias>`  
- `tag=<tag>`  

You must correctly interpret and remove runs accordingly. If you only want to support removing based on run_start or index you could only implement those usages.

---

### *(Optional)* `update_output_path(self, log_path: str)`
This is only required when using:

- The Dashboard Server, **and**
- `uselogs=True` option  

In this approach, you store `log.html` and related files on the server, and this method updates the stored path.

If you do not use server-side log storage, you can safely omit this method.


## Important Notes

- **Do not use relative imports.**  
  Custom classes run dynamically and relative paths will fail.

- Class name must be **exactly** `DatabaseProcessor`.

- Your Python file name can be anything.

- Look at the examples before implementing your own:
  - [abstractdb.py](https://github.com/marketsquare/robotframework-dashboard/blob/main/example/database/abstractdb.py): base abstract class to extend
  - [sqlite3.py](https://github.com/marketsquare/robotframework-dashboard/blob/main/example/database/sqlite3.py): default implementation used by RobotDashboard
  - [mysql.py](https://github.com/marketsquare/robotframework-dashboard/blob/main/example/database/mysql.py): example MySQL implementation
