---
outline: deep
---

# Log Linking

Enable interactive log navigation directly from dashboard graphs. When enabled, clicking on a graph element (run, suite, test, or keyword) opens the corresponding `log.html` file. And in the case of suites or tests the log opens at the correct suite or test within the log file.

## Enabling Log Linking

Add the `--uselogs` (or `-u`) flag when generating your dashboard:

```bash
robotdashboard -u true
```

This can be combined with other options:

```bash
robotdashboard -u true -o output.xml -n robot_dashboard.html
```

> For the full list of CLI options, see [Basic CLI](/basic-command-line-interface-cli.md#enable-log-linking-in-the-dashboard).

## File Naming Convention

The dashboard derives the log path from the output path by replacing `output` with `log` and `.xml` with `.html`:

| Output File                       | Expected Log File                  |
| --------------------------------- | ---------------------------------- |
| `path/to/output.xml`              | `path/to/log.html`                 |
| `path/to/my_output_123.xml`       | `path/to/my_log_123.html`          |
| `some_test_output_file.xml`       | `some_test_log_file.html`          |
| `output_nightly.xml`              | `log_nightly.html`                 |

::: warning
If the log file does not follow this naming convention, it will not be found when clicking a graph element.
:::

## Usage Scenarios

### Local (No Server)

The simplest setup. The dashboard opens log files directly from the filesystem.

**Requirements:**
- The `log.html` must be in the **same directory** as the `output.xml`.
- The filename must follow the naming convention above.

```bash
robotdashboard -u true -o path/to/output_nightly.xml
```

Clicking a graph element will open `path/to/log_nightly.html` in a new browser tab.

### Local Server

When running the dashboard as a local server (`--server`), the behavior is the same as the local setup. The only difference is that log files are **served by the server** instead of opened directly from the filesystem. The same naming convention and directory requirements apply.

```bash
robotdashboard -u true --server
```

### Remote Server

When the dashboard runs on a remote machine (e.g., in a container), log files are not available on the filesystem. You must **upload** them to the server.

**Upload methods:**
- The server's **admin GUI** (manual upload)
- The **`/add-log-file`** API endpoint (programmatic upload)
- The **`robotdashboardlistener`** (automatic upload after test execution)

Uploaded logs are stored in a `robot_logs` folder in the server's working directory. The naming convention still applies — the server matches logs to runs using the filename.

::: tip
Make sure to start the server with the `--uselogs` flag so that graph elements become clickable. Without this flag, no log linking will occur even if logs have been uploaded.
:::

For more details about the server and its API, see [Dashboard Server](/dashboard-server.md).

### CI Pipelines and Hosted Logs

In a typical CI setup, tests are run and logs are published to a server at a unique URL per build, for example:

```
https://ci.example.com/pipeline/build42/log.html
```

The default log-linking behaviour (deriving the log path from the stored `output.xml` path) breaks here because the base URL changes for every build. The `--logurl` flag lets you store the exact URL directly in the database so each run links to its own log, wherever it is hosted.

#### Single Output

When processing one output file per run, pass the direct URL:

```bash
robotdashboard -u true \
  -o output-20250313-003006.xml \
  --logurl https://marketsquare.github.io/robotframework-dashboard/example/tests/robot/resources/outputs/log-20250313-003006.html
```

The URL is stored in the database for that run. Clicking any graph element for that run opens it directly in a new tab.

#### Multiple Outputs — `{run_alias}` Placeholder

When processing multiple output files at once (via `-f` or repeated `-o`), use `{run_alias}` as a placeholder in the URL. It is substituted per file with the run alias — derived from the filename by stripping the `output_` prefix and `.xml` extension.

**File naming:** files must use an underscore separator (`output_<alias>.xml`) so the alias strips cleanly:

| File | Alias | Resolved URL |
|---|---|---|
| `output_20250313-002134.xml` | `20250313-002134` | `…/log-20250313-002134.html` |
| `output_20250313-003006.xml` | `20250313-003006` | `…/log-20250313-003006.html` |

```bash
robotdashboard -u true \
  -f ./tests/robot/resources/outputs/ \
  --logurl "https://marketsquare.github.io/robotframework-dashboard/example/tests/robot/resources/outputs/log-{run_alias}.html"
```

::: warning
If `--logurl` is provided **without** `{run_alias}` while multiple output files are being processed, the command will fail with an error. Either add the `{run_alias}` placeholder or use one `-o` per invocation.
:::

::: tip
`--logurl` requires `--uselogs` (or `-u`) to also be set. Without it, graph elements are not clickable and the stored URL has no visible effect.
:::

## Deep Linking

When clicking a data point on a **suite** or **test** graph, the dashboard doesn't just open `log.html` — it navigates directly to the corresponding suite or test within the log file by appending the element's ID as a URL fragment (e.g., `log.html#s1-s1-t2`).

This means you land exactly on the relevant suite or test in the log, without needing to manually search for it.

### Label Clicks

Clicking on **X-axis or Y-axis run labels** (run_start or alias) on any graph also opens the corresponding log file for that run.

### Missing Log Behavior

If no log path is stored in the database for a run, clicking a graph element will show a **ERR_FILE_NOT_FOUND** error.

## Accessing Reports

Robot Framework `report.html` files can also be accessed through the log file:

1. Name the report file the same as the log file, but replace `log` with `report`.
2. Place the report in the **same directory** as the log.
3. The link to the report inside the `log.html` (top-right corner) will then work correctly.

| Log File                          | Expected Report File               |
| --------------------------------- | ---------------------------------- |
| `log_nightly.html`                | `report_nightly.html`              |
| `my_log_123.html`                 | `my_report_123.html`               |
