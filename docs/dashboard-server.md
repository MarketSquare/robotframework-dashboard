---
outline: deep
---

# Dashboard Server

RobotFramework Dashboard includes a built-in server that lets you host the dashboard on a separate machine. This allows you to centrally serve the HTML dashboard, and remotely add, list, or remove test result outputs from other clients. The server is built using [**FastAPI**](https://pypi.org/project/fastapi/), [**FastAPI-offline**](https://pypi.org/project/fastapi-offline/) and [**Uvicorn**](https://pypi.org/project/uvicorn/), and comes with a set of Pydantic models to validate request payloads. 

> **Tip:** The server is not installed by default see [Installation & Version Info](/installation-version-info.md#install-robot-framework-dashboard) for more info!

## Why Use the Dashboard Server

- Host a centralized, always-available dashboard accessible via HTTP  
- Enable remote clients to push or delete runs in your database  
- Provide a web-based admin interface for manual management  
- Secure access via optional basic authentication (username/password)  
- The server automatically uses offline CDN (js/css) because `FastAPI-offline` is used, making it compatible with [`--offlinedependencies`](https://marketsquare.github.io/robotframework-dashboard/advanced-cli-examples) for full offline usage!
> **Tip:** To implement your server into your test runs look at the example [listener](/listener-integration.md) integration!


## Starting the Server

You can start the server using the `robotdashboard` CLI with the `--server` (or `-s`) option:

**Basic usage**

```bash 
robotdashboard --s  
robotdashboard --server  
robotdashboard --server default  
```

**Bind to a specific host / port**

```bash 
robotdashboard -s 127.0.0.1:8543  
```

**Enable authentication for the admin page**

```bash 
robotdashboard -s default:user:password  
```

Or with a custom host and port plus authentication:

```bash 
robotdashboard -s host:port:user:password  
```

Once the server is running, open your browser at the configured address (for example, `http://127.0.0.1:8543/`) to access:

- The **admin page** (for manual control), this page lives on `/admin`: `http://127.0.0.1:8543/admin`
    - On the admin page a menu option [`Swagger API Docs`](https://swagger.io/docs/) is available to open the swagger openapi documentation
    - On the admin page a menu option [`Redoc API Docs`](https://redocly.com/docs/redoc) is available to open the redoc openapi documentation
    - On the admin page a menu option `Dashboard` is available to open the dashboard
- The **dashboard HTML** , this page lives on the root url: `http://127.0.0.1:8543/`
    - On the dashboard page a menu option `Admin` is available to open the admin page
- The **Swagger API documentation**, this page lives on `/docs`: `http://127.0.0.1:8543/docs`
- The **Redoc API documentation**, this page lives on `/redoc`: `http://127.0.0.1:8543/redoc`

## Server Features & Endpoints

The built-in server exposes several HTTP endpoints to manage and serve dashboard data:

| Endpoint | Purpose |
|---|---|
| `/` | Serves the HTML dashboard (reflects current database), not callable through scripts |
| `/admin` | Admin page for manual management of runs and logs, not callable through scripts |
| `/get-outputs` | Returns a JSON list of stored runs (`run_start`, `alias`, `tags`), callable |
| `/add-outputs` | Accepts new output data via JSON (file path, raw XML or folder), callable |
| `/add-output-file` | Accepts new output data via file input, callable |
| `/remove-outputs` | Deletes runs by index, alias, `run_start`, tags, limit or 'all=true' for all outputs, callable |
| `/get-logs` | Returns a JSON list of stored logs on the server (`log_name`), callable |
| `/add-log` | Upload HTML a log file and associate them with runs (for [Log Linking](/log-linking.md)), callable |
| `/add-log-file` | Upload a HTML log file (for [Log Linking](/log-linking.md)), callable |
| `/remove-log` | Remove previously uploaded log files or provide 'all=true' for all logs, callable |

All API endpoints are documented and described in the server’s own OpenAPI schema, accessible via the admin interface under “Swagger API Docs” or "Redoc API Docs", after starting the server.

## Security: Basic Auth (Optional)

If you start the server with a username and password, the admin page will be protected. Only someone providing the correct credentials can:

- Add or remove outputs manually  
- Add or remove logs manually  

The dashboard itself (the HTML) does **not** require authentication. API calls as of now do also **not** require authentication.

## Working Programmatically with the Server

You can interact with the server programmatically using HTTP, Python, or Robot Framework. There are example scripts in the `example/server` folder:

- [interact.http](https://github.com/marketsquare/robotframework-dashboard/blob/main/example/server/interact.http) 
- [interact.py](https://github.com/marketsquare/robotframework-dashboard/blob/main/example/server/interact.py) 
- [interact.robot](https://github.com/marketsquare/robotframework-dashboard/blob/main/example/server/interact.robot) 

These scripts demonstrate how to:

- List existing outputs  
- Add a new `output.xml` by path  
- Remove runs by index, alias, or timestamp  

> **Tip:** to implement your server into your test runs look at the example [listener](/listener-integration.md) integration!

## Admin Page

The admin page (`/admin`) provides a web-based interface for managing the dashboard without writing code. It includes sections for adding and removing outputs, managing log files, and viewing the current database contents.

### Adding Outputs

The admin page supports four methods for adding test results:

| Method | Description |
|--------|-------------|
| **By Absolute Path** | Provide the full path to an `output.xml` on the server filesystem. Optionally add run tags and a version label. |
| **By XML Data** | Paste raw `output.xml` content directly into a text area. Supports run tags, alias, and version label. |
| **By Folder Path** | Provide a folder path; the server recursively scans for `*output*.xml` files. Supports run tags and version label. |
| **By File Upload** | Upload an `output.xml` file directly. Supports run tags and version label. Gzip-compressed files (`.gz`/`.gzip`) are automatically decompressed. |

### Removing Outputs

| Method | Description |
|--------|-------------|
| **By Run Start** | Comma-separated `run_start` timestamps (e.g., `2024-07-30 15:27:20.184407`). |
| **By Index** | Supports single values, colon-separated ranges, and semicolon-separated lists (e.g., `1:3;9;13`). |
| **By Alias** | Comma-separated alias names. |
| **By Tag** | Comma-separated tags — removes all runs matching any of the specified tags. |
| **By Limit** | Keep only the N most recent runs; all older runs are deleted. |
| **Remove All** | Irreversibly deletes all runs from the database. |

### Managing Logs

| Action | Description |
|--------|-------------|
| **Add Log (Data)** | Paste `log.html` content and provide a log name. |
| **Add Log (File Upload)** | Upload a `log.html` file. Gzip-compressed files are automatically decompressed. |
| **Remove Log by Name** | Remove a specific log file (e.g., `log-20250219-172535.html`). |
| **Remove All Logs** | Irreversibly deletes all uploaded log files. |

### Database & Log Tables

The admin page displays two tables:
- **Runs in Database** — all runs currently stored, with run_start, name, alias, and tags
- **Logs on Server** — all log files in the `robot_logs/` directory

### Navigation

The admin page menu includes links to:
- **Swagger API Docs** — interactive OpenAPI documentation
- **Redoc API Docs** — alternative API documentation
- **Dashboard** — the main dashboard view

A confirmation modal is shown before any destructive action (removing outputs or logs).

## Additional Server Endpoints

Beyond the main API endpoints listed above, the server exposes two additional routes:

| Endpoint | Purpose |
|----------|---------|
| `GET /log?path=<path>` | Serves a stored `log.html` file by its path. Used internally by log linking to render uploaded logs in the browser. |
| `GET /{full_path:path}` | Catch-all route that serves static resources (screenshots, images, etc.) relative to the last opened log directory. This allows embedded screenshots in log files to display correctly. |

## Gzip Upload Support

Both `/add-output-file` and `/add-log-file` endpoints support gzip-compressed uploads. If the uploaded filename ends with `.gz` or `.gzip`, the server automatically decompresses the file before processing. This is used by the [listener integration](/listener-integration.md) to reduce upload bandwidth.
