---
description: Use when working on dashboard pages, tabs, graphs, Chart.js configurations, or the HTML template.
---

# Dashboard Pages and Charts

## Pages / Tabs

### Overview Page
High-level summary of all test runs. Shows the latest results per project with pass/fail/skip counts, recent trends, and overall performance. Special sections: "Latest Runs" (latest run per project) and "Total Stats" (aggregated stats by project/tag). Projects can be grouped by custom `project_` tags.

### Dashboard Page
Interactive visualizations across four sections — Runs, Suites, Tests, Keywords. Layout is fully customizable via drag-and-drop. Most graphs support multiple display modes. Graphs can be expanded to fullscreen (increases data limits, e.g. Top 10 → Top 50).

### Compare Page
Side-by-side comparison of up to four test runs with statistics, charts (bar, radar, timeline), and summaries to identify regressions or improvements.

### Tables Page
Raw database data in DataTables for runs, suites, tests, and keywords. Useful for debugging and ad-hoc analysis.

## Chart.js Architecture

### Central Config: `graph_config.js`
`get_graph_config(graphType, graphData, graphTitle, xTitle, yTitle)` is the single factory function that returns a complete Chart.js config object. All graphs route through it.

### Supported Chart Types
| Type | Chart.js `type` | Usage |
|---|---|---|
| `line` | `line` | Time-series trends (statistics, durations over time) |
| `bar` | `bar` | Stacked bars (statistics amounts, durations, rankings) |
| `timeline` | `bar` (indexAxis: y) | Horizontal bars for timeline views (test status, most-failed) |
| `boxplot` | `boxplot` | Duration deviation / flaky test detection |
| `donut` | `doughnut` | Run/suite distribution charts |
| `heatmap` | `matrix` | Test execution activity by hour/minute per weekday |
| `radar` | `radar` | Compare suite durations across runs |

### Chart Factory: `chart_factory.js`
- `create_chart(chartId, buildConfigFn)` — destroys existing chart, creates new `Chart` instance, attaches log-click handler.
- `update_chart(chartId, buildConfigFn)` — updates data/options in-place for smooth transitions; falls back to `create_chart` if the chart doesn't exist yet.

### Graph Data Modules (in `js/graph_data/`)
Each module transforms filtered DB data into Chart.js-compatible datasets:
- `statistics.js` — pass/fail/skip counts and percentages for runs, suites, tests, keywords.
- `duration.js` — elapsed time data (total, average, min, max).
- `duration_deviation.js` — boxplot quartile calculations for test duration spread.
- `donut.js` — aggregated donut/doughnut data, including folder-level drill-down for suites.
- `heatmap.js` — matrix data (day × hour/minute) for execution activity.
- `messages.js` — failure message frequency data.
- `tooltip_helpers.js` — rich tooltip metadata (duration, status, message).
- `helpers.js` — shared utilities (height updates, data exclusions).

### Graph Creation Modules (in `js/graph_creation/`)
Each section has its own module that wires data modules to chart factory calls:
- `overview.js` — Overview page project cards and grouped stats.
- `run.js` — Run statistics, donut, duration, heatmap, stats graphs.
- `suite.js` — Suite folder donut, statistics, duration, most-failed, most-time-consuming.
- `test.js` — Test statistics (timeline), duration, deviation (boxplot), messages, most-flaky, most-failed, most-time-consuming.
- `keyword.js` — Keyword statistics, times-run, duration variants, most-failed, most-time-consuming, most-used.
- `compare.js` — Compare page statistics bar, radar, and timeline graphs.

### Common Patterns
- All graphs use the `settings` object (`js/variables/settings.js`) for display preferences (animation, graph types, date labels, legends, axis titles).
- Graph type switching (e.g. bar ↔ line ↔ percentages) is driven by `settings.graphTypes.<graphName>GraphType`.
- Fullscreen mode changes data limits (e.g. top-N from 10/30 to 50/100) via `inFullscreen` and `inFullscreenGraph` globals.
- Clicking chart data points opens the corresponding Robot Framework log via `open_log_file` / `open_log_from_label`.
- Chart color constants (passed/failed/skipped backgrounds and borders) live in `js/variables/chartconfig.js`.
