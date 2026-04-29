---
outline: deep
---

# Performance

This page documents the performance characteristics of robotframework-dashboard across different workload sizes, so you can judge whether the tool fits your scale before adopting it.

## How Performance Is Measured

The pipeline has three distinct stages — each with its own time and size cost:

| Stage | What happens |
|---|---|
| **XML processing** | `OutputProcessor` uses `robot.api.ExecutionResult` to parse each `output.xml` and insert its data into the SQLite database. |
| **Dashboard generation** | `DashboardGenerator` reads all data from the database, compresses it (JSON → zlib → base64), inlines all JS/CSS, and writes a single self-contained `.html` file. |
| **Browser rendering** | The browser decompresses the embedded data and renders charts. This is bounded by browser memory, not by disk or CPU. |

## Running the Benchmark Yourself

A benchmark script is included in the `scripts/` directory. It generates synthetic `output.xml` files with realistic keyword structures (flat calls, nested helper keywords, and FOR loops with iterations), runs them through the full pipeline, and reports sizes and timings.

```bash
# Run all four scenarios (may take 10–20 minutes for large/stress)
python scripts/benchmark.py

# Run only specific scenarios
python scripts/benchmark.py --scenarios small medium

# See all options
python scripts/benchmark.py --help
```

### Scenario definitions

| Scenario | Runs | Tests/run | ~kw/test | Keyword structure |
|---|---|---|---|---|
| `small` | 10 | 30 | ~40 | 5 flat + 1 helper + 1 FOR(8 iter × 2 kw) |
| `medium` | 50 | 150 | ~93 | 12 flat + 2 helpers + 1 FOR(15 iter × 3 kw) |
| `large` | 100 | 400 | ~140 | 18 flat + 3 helpers + 2 FOR(20 iter × 4 kw) |
| `stress` | 50 | 100 | ~880 | 20 flat + 5 helpers + 4 FOR(30 iter × 5 kw) — deep nesting (depth 3) |

The `stress` scenario specifically stresses keyword depth: helpers nest 3 levels deep, and each FOR loop iteration also contains a nested validation call. This simulates real Robot Framework suites where page-object and utility keywords stack 3–4 call levels.

## Baseline Results

Measured on Windows 11, Python 3.8, Intel Core i7, SSD.

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

### Stress (50 runs × 100 tests × ~880 kw/test — deeply nested)

| Metric | Value |
|---|---|
| XML size per run | 17.7 MB |
| Total XML size | 886 MB |
| XML processing time | 240s total (4.8s/run) |
| Database size | 1.1 MB |
| Dashboard generation | 0.13s |
| HTML output size | 612 KB |

::: info Stress scenario note
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

### Browser Memory (Practical Ceiling)

The self-contained HTML decompresses all data in the browser on page load. Modern browsers handle dashboards with:

- **Up to ~500 runs** with typical test suites: no issues on any modern device
- **500–2000 runs**: works but initial load may take 2–5 seconds on lower-end hardware
- **2000+ runs**: consider using the `--quantity` flag to limit the dashboard to the most recent N runs, or using [Server Mode](/dashboard-server.md) to serve a dynamically filtered view

```bash
# Keep only the 200 most recent runs in the dashboard
robotdashboard -f ./results/ -q 200
```
