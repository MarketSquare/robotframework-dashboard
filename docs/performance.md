---
outline: deep
---

# Performance

This page documents the performance characteristics of robotframework-dashboard across different workload sizes, so you can judge whether the tool fits your scale before adopting it.

## How Performance Is Measured

The process has three distinct stages — each with its own time and size cost:

| Stage | What happens |
|---|---|
| **XML processing** | `OutputProcessor` uses `robot.api.ExecutionResult` to parse each `output.xml` and insert its data into the SQLite database. |
| **Dashboard generation** | `DashboardGenerator` reads all data from the database, compresses it (JSON → zlib → base64), inlines all JS/CSS, and writes a single self-contained `.html` file. |
| **Browser rendering** | The browser decompresses the embedded data with its native `DecompressionStream` (Chrome 80+, Firefox 113+, Safari 16.4+) and renders charts using Chart.js. Render time scales with the number of displayed runs and active data views. |

## Baseline Results

### Small (10 runs × 30 tests × ~40 kw/test)

| Metric | Value |
|---|---|
| XML size per run | 242 KB |
| Total XML size | 2.4 MB |
| XML processing time | 0.89s total (0.089s/run) |
| Database size | 92 KB |
| Dashboard generation | 0.09s |
| HTML output size | 497 KB |

### Medium (50 runs × 150 tests × ~93 kw/test)

| Metric | Value |
|---|---|
| XML size per run | 2.8 MB |
| Total XML size | 138 MB |
| XML processing time | 38.4s total (0.77s/run) |
| Database size | 1.3 MB |
| Dashboard generation | 0.14s |
| HTML output size | 654 KB |

### Large (50 runs × 100 tests × ~880 kw/test — deeply nested)

| Metric | Value |
|---|---|
| XML size per run | 17.7 MB |
| Total XML size | 886 MB |
| XML processing time | 240s total (4.8s/run) |
| Database size | 1.1 MB |
| Dashboard generation | 0.13s |
| HTML output size | 612 KB |

::: info Large scenario note
At this scale the `robot.api` XML parser is loading ~17 MB files entirely into memory per run — this is an extreme edge case representing suites with hundreds of FOR loop iterations and 3-level deep keyword nesting. In practice, most Robot Framework suites produce 0.5–5 MB per output file. Notice that despite the extreme XML size, the **database remains tiny (1.1 MB) and HTML generation stays under 0.2s** — keyword aggregation ensures the stored data stays compact regardless of call depth.
:::

::: tip Key observation
Dashboard generation is under one second for the benchmark fixtures above. These measurements are not capacity limits: histories with many distinct tests and keywords can produce much larger reports and take longer to regenerate and open.
:::

## What Scales and What Doesn't

### XML Processing (Python / robot.api)

Processing time scales roughly **linearly with XML file size**. The dominant cost is the `robot.api.ExecutionResult` parser, which loads the entire XML into memory. Key factors:

- **Test count** per run is the primary driver
- **Keyword depth and FOR loops** increase file size significantly — a test with 880 keyword elements is ~24× larger than one with 40, but only ~2× slower to process (the parser is I/O-bound, not compute-bound)
- **Number of runs** scales linearly — each XML is processed independently; there is no cross-run overhead

### Database Size

The database stays small because keywords are **aggregated per run** before being stored (total calls, min/max/avg duration). A run with 400 tests × 140 keywords per test does not produce 56,000 keyword rows — it produces one row per unique keyword name.

### Dashboard HTML Size

HTML size grows with **number of runs** and **number of unique tests/keywords**, not with raw keyword volume. The data is zlib-compressed before embedding, so growth is sub-linear:

- 10 runs → ~500 KB
- 50 runs → ~650 KB
- 100 runs → typically 700–900 KB

Larger histories can exceed these example sizes substantially. Compressed HTML size also understates browser memory use: the browser must decompress the JSON and construct JavaScript objects before applying display filters.

### Chart.js Rendering (Dashboard Load Time)

Opening a report includes decoding and filtering its data as well as drawing with Chart.js. Both data volume and the selected graphs matter. Key factors:

- **Default quantity is 20 runs per project** — renders near-instantly on any hardware. The amount filter is applied per project (run name / `project_` tag), so a dashboard with several projects renders more runs than the quantity itself.
- **Hundreds of runs** — expect a few seconds. As a reference, a dashboard with 504 runs, 208k test results and 138k keyword results loads in about 2.3 seconds with the default quantity, and applying a filter that shows all 504 runs takes about 3.6 seconds on the Dashboard page, 2.4 seconds on the Tables page and under 0.1 seconds on the Overview page. The exact time depends on:
  - The **size of your test suite** — more tests and suites mean more data points per chart.
  - Whether **"All Suites"** or **"All Tests"** is selected in their respective sections — these views render one data series per unique suite/test name, which scales with the breadth of your suite.

Use the quantity filter or the `--quantity` CLI flag to keep the displayed run count at a level that renders comfortably. Note that this is just the default amount (quantity) of runs that are shown when opening the dashboard. If you want to look at more data you can always manually change this in the filters whilst the dashboard is open.

```bash
# Show only the 20 most recent runs (the default)
robotdashboard -f ./results/ -q 20
```

::: tip
If rendering feels slow, reducing the quantity limit is the most effective lever. Switching away from "All Suites" / "All Tests" views also helps significantly on large suites.
:::

## Opening a smaller history

If the full report cannot be read, the dashboard tries to open the latest 20
matching runs per project instead. It reads the compressed result arrays incrementally and
keeps only records for those runs, avoiding a single oversized JSON string.
Project and tag selections from the URL are respected when choosing these runs.

After recovery, or when an explicit smaller load leaves out results, a notice
stays visible above the dashboard with the loaded and available run counts and
date range. After automatic recovery, the notice reads **We couldn’t open the full
report, so we’re showing the latest 20 of 55 matching runs.** An explicit smaller
selection uses **Showing 20 of 55 matching runs.** Both use the actual counts for
the current selection and offer **Use Filters to choose a different date range,
select a project, or try showing more runs.** The notice is hidden when all matching runs are shown
or the complete report is already open. Use the existing **Filters** dialog to choose another
project, date range, or **Amount per project**. The complete run index remains
available to these filters. If matching details are outside the opened subset,
the dashboard reads them incrementally before updating charts and tables.
There is no second set of project/history controls after loading.
**All Runs** can request all matching runs; **Reset Filters** restores the recent
default if a combination has no matches. These actions do not delete stored data.

To open a smaller history directly, use a `loadRuns` URL parameter, for example:

```text
robot_dashboard.html?loadRuns=20&run=WebshopUI
https://dashboard.example/?loadRuns=5&run=WebshopUI&tag=regression
```

This sets the initial **Amount per project**, using the same grouping as the
existing filter. Choosing older dates can open older results without increasing
the amount. A selected suite path is matched across the embedded suite history
before applying the amount; the path navigator lists paths from opened results.

The loading screen shows the current data stage and also offers smaller-history
controls for use before the Filters dialog is ready. If a smaller load fails too,
the animation stops and these controls
remain available alongside a technical-details disclosure. Corrupt data is
reported rather than presented as a successful partial load.

Recovery starts when reading or parsing the full data fails. There is no elapsed
time limit that switches a slow read to recent results. The page may still offer
a smaller initial load through the loading controls while it is working.

This recovery is shared by standalone and hosted reports. The complete HTML is
still downloaded, and recovery still scans its compressed data. Smaller loaded
histories reduce retained data but do not establish an unlimited capacity or make
every browser memory failure recoverable. Regenerate existing reports with the
updated version to receive this behavior.

[Watch the sample recovery demo](/loading-recovery/demo.webm). It uses 60 generated
runs and deliberately fails one full read after four seconds, then opens recent
results. The Filters dialog opens all 30 runs of one project. The delay belongs
to the demonstration; the application has no four-second timeout.

![Result counts and the Filters action after opening recent results](/loading-recovery/notice.png)

![The existing Filters dialog can select matching results outside the initial view](/loading-recovery/filters.png)

## Server Mode (`--server`)

When running in server mode, HTTP response time depends on which endpoint is called. Each endpoint has a different performance profile.

### `GET /` — Serving the dashboard page

The dashboard is served by reading the pre-built `robot_dashboard.html` file from disk and returning its contents. **No database query is performed.** Response time is therefore determined entirely by disk read speed and the size of the HTML file:

| HTML file size | Expected response time |
|---|---|
| ~500 KB (10 runs) | Near-instant |
| ~650 KB (50 runs) | Near-instant |
| ~900 KB (100 runs) | Near-instant |
| 5–10 MB (500+ runs) | A few hundred milliseconds over a local network; longer over slow or remote connections |

At typical scales the dashboard page loads fast. The more significant delay at scale is the **browser rendering time** described in the Chart.js section above, not the transfer itself.

### `POST /add-outputs`, `POST /add-output-file`, `DELETE /remove-outputs`

These endpoints perform two sequential operations before returning:

1. **XML processing** — parses the `output.xml` and inserts data into the database. This is the bottleneck already described in the [XML Processing](#xml-processing-python-robot-api) section above. For a 2.8 MB file (~150 tests, ~93 kw/test) this takes roughly 0.77 seconds; for a 17.7 MB file (~880 kw/test) it takes roughly 4.8 seconds.

2. **Dashboard regeneration** — after processing, the server automatically rebuilds `robot_dashboard.html` by reading all data from the database, re-compressing it, and re-inlining all JS/CSS. This step takes under 0.2 seconds for typical datasets but scales with the number of stored runs and unique test/keyword names.

The HTTP response is only returned **after both steps complete**. Callers should expect the request to block for the full duration of XML processing plus dashboard generation.

### `GET /get-outputs`

Queries only the lightweight `runs` table (one row per run). Fast regardless of database size.

### `POST /refresh-dashboard`

Triggers only the dashboard regeneration step — no XML processing. Expected to complete in under 0.2 seconds for most datasets.

### Using `--noautoupdate` to reduce upload response times

By default, every upload and delete operation triggers an automatic dashboard regeneration. With a large database (many runs or a slow custom database backend), this regeneration adds measurable latency to every upload request.

The `--noautoupdate` flag disables this automatic regeneration:

```bash
robotdashboard --server --noautoupdate
```

With this flag active, upload and delete endpoints return **immediately after XML processing**, skipping the dashboard regeneration step entirely. The dashboard is only rebuilt when `/refresh-dashboard` is explicitly called — either manually via the **Refresh Dashboard** button in the navbar, or programmatically via the API.

::: tip When to use `--noautoupdate`
- You are uploading many results in quick succession (e.g., via the listener integration) and want uploads to return fast.
- Your database queries are slow due to large datasets or a remote custom database.
- You prefer to control exactly when the dashboard reflects new data.
:::
