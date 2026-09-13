---
outline: deep
---

# Architecture

An overview of how `robotdashboard` is structured internally, from CLI invocation through to a rendered dashboard, in both Regular Mode (one-off HTML generation) and Server Mode (a persistent FastAPI instance).

```mermaid
flowchart LR
    CLI(["robotdashboard CLI"]) --> ARGS["Parse CLI arguments"]
    ARGS --> SRVQ{"--server flag?"}
    SRVQ -->|"No"| REG(["Regular Mode"])
    SRVQ -->|"Yes"| SRV(["Server Mode"])
```

## Regular Mode

The default mode: process one or more `output.xml` files into a database, then generate a single self-contained HTML dashboard.

```mermaid
flowchart LR
    INIT["Init Database\nSQLite or custom class"] --> XML{"output.xml\nprovided?"}
    XML -->|"Yes"| PROC["Store runs data"]
    PROC --> DB[("Database")]
    XML -->|"No"| DB
    DB --> GENQ{"Generate\ndashboard?"}
    GENQ -->|"Yes"| GEN["Generate self-contained HTML dashboard"]
    GEN --> OUTPUT(["robot_dashboard.html"])
    OUTPUT --> BROWSER["Open in any browser"]
    GENQ -->|"No"| DONE(["Done"])
```

## Server Mode

Started with `--server`, this keeps a persistent `RobotDashboard` instance alive behind a FastAPI app, so outputs and logs can be pushed in continuously (e.g. from CI) without re-invoking the CLI each time.

```mermaid
flowchart LR
    INST["FastAPI server · Persistent RobotDashboard instance"] --> DASH["GET / — Dashboard"]
    INST --> ADMIN["GET /admin — Admin UI\nBasic Auth optional"]

    subgraph OUT_MGMT["Output management"]
        EP_ADD["POST /add-outputs · /add-output-file"]
        EP_REM["DELETE /remove-outputs"]
        EP_REF["POST /refresh-dashboard"]
    end

    subgraph LOG_MGMT["Log management"]
        EP_LOGS["POST /add-log · DELETE /remove-log\nGET /get-logs · /log"]
    end

    INST --> EP_ADD & EP_REM & EP_REF & EP_LOGS

    LISTENER(["Robot Framework test run\nrobotdashboardlistener.py"]) -->|"POST /add-output-file"| EP_ADD
    ADMIN -->|"calls"| EP_ADD & EP_REM & EP_REF & EP_LOGS

    EP_ADD & EP_REM & EP_REF & EP_LOGS --> REGEN["Regenerate\ndashboard HTML"]
```

> **Tip:** For the full endpoint reference (request/response shapes, auth), see [Dashboard Server](/dashboard-server.md). For pushing results automatically from a test run, see [Listener Integration](/listener-integration.md).
