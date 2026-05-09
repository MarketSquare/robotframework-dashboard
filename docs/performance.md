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
| **Browser rendering** | The browser decompresses the embedded data and renders charts using Chart.js. Render time scales with the number of displayed runs and active data views. |

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
Dashboard generation (HTML output) is almost always **under 1 second** regardless of scale — the bottleneck is always XML parsing, not the dashboard itself. Once data is in the database, re-generating the dashboard is essentially free.
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

Very large dashboards (500+ runs with many unique tests) may reach 5–10 MB. This is still trivially small to serve or share, but the browser will use proportionally more memory to decompress and render it.

### Chart.js Rendering (Dashboard Load Time)

The time it takes for the dashboard to finish drawing after the page opens is driven by Chart.js — not by data size or HTML file size. Key factors:

- **Default quantity is 20 runs** — renders near-instantly on any hardware.
- **50 runs** — expect a couple of seconds while Chart.js draws all graphs.
- **100+ runs** — rendering can approach **~10 seconds or more!**. The exact time depends on:
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
