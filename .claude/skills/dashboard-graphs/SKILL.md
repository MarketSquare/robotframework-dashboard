---
name: dashboard-graphs
description: What each dashboard page (Overview, Dashboard, Compare, Tables) shows, the Chart.js architecture (get_graph_config, chart_factory, supported chart types), which graph_data / graph_creation module owns each graph, and the step-by-step checklist for adding a new graph (graphmetadata entry, naming rules, data + creation modules, tooltips, tests, docs). Use when adding or changing a graph, chart type, tooltip, or page section.
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

### Central Config: `js/graph_data/graph_config.js`
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

---

## Adding a New Graph (checklist)

Everything keys off one entry in `js/variables/graphmetadata.js`; the rest of the system derives ids, buttons, sections, and defaults from it. Naming is rigid — get it right once:

| Piece | Convention | Example (`runDuration`) |
|---|---|---|
| `key` | `<section><Name>` camelCase | `runDuration` |
| `label` | `"<Section> <Name>"` — **the leading word decides which section grid it lands in** (`Run`, `Suite`, `Test`, `Keyword`, `Compare`, `Table`) | `"Run Duration"` |
| Canvas id | `<key>Graph` (from `_graphHtml`) | `runDurationGraph` |
| Chart instance | `window["<key>Graph"]` (registered by `graphVars` in `graphs.js`) | `window.runDurationGraph` |
| Type-switch buttons | `<key>Graph<View>` | `runDurationGraphBar`, `runDurationGraphLine` |
| Persisted type | `settings.graphTypes.<key>GraphType` (auto-added by `defaultGraphTypes`) | `runDurationGraphType` |
| Create/update fns | `create_<snake_key>_graph` / `update_<snake_key>_graph` — **must be global**, the type-switch handler calls `window["create_<snake_key>_graph"]()` | `create_run_duration_graph` |
| Config builder | `build_<snake_key>_config` | `build_run_duration_config` |

Steps:

1. **`js/variables/graphmetadata.js`** — add `{ key, label, defaultType, viewOptions: ["Bar", "Line"], hasFullscreenButton, html: _graphHtml(key, "Title", viewOptions) }`. Options: `defaultSize`/`minSize` (`{w, h}`), `defaultHidden: true` to ship hidden, `hasVertical` for vertically scrollable timelines. `viewOptions` must be keys of `viewOptionClassMap`. Insert it where it should appear in the default layout order.
2. **`js/graph_data/<name>.js`** (new or existing) — a pure function `get_<name>_data(...)` that turns `filteredRuns`/`filteredSuites`/… into Chart.js datasets. Keep it DOM-free so it can be unit-tested (`testing` skill → JS).
3. **`js/graph_creation/<section>.js`** — `build_<snake_key>_config()` calling `get_graph_config(type, data, title, xTitle, yTitle)`, then the one-liners `create_*` (`create_chart(id, build_fn)`) and `update_*` (`update_chart`). Respect `settings.graphTypes.<key>GraphType` for each view option and `inFullscreen && inFullscreenGraph.includes(key)` for larger limits. Export both.
4. **`js/graph_creation/all.js`** — import and call `create_*` in `create_dashboard_graphs()` and `update_*` in `update_dashboard_graphs()` inside the right section block.
5. **`js/variables/information.js`** — add `key` to `graphKeys` (generates Fullscreen/Close/Move/Show/Hide tooltips) and one `"<key>Graph<View>": "…"` tooltip per view option.
6. **`js/variables/settings.js`** — nothing for plain graphs (types and show/hide lists are derived). Only add a `settings.switch.*` entry if the graph gets its own toggle (e.g. `ignoreSkips`), wired in `eventlisteners.js` and persisted via `set_local_storage_item`.
7. **Template** — nothing; sections already exist (`#runStatisticsSection` … `#runDataHidden`). Compare/Table graphs are the exception and have their own markup patterns in `graphmetadata.js` (`_tableHtml`).
8. **CSS** — only for a new `viewOptionClassMap` icon class (`css/components.css`).
9. **Tests** — reference screenshot for the section changes: regenerate `dashboard_output/<section>/base<Section>Section.png` in Docker; add a JS unit test for the `graph_data` function.
10. **Docs** — row in the section table of `docs/graphs-tables.md` (Graph Name / Views / Views Description / Notes).

Verify: regenerate the dashboard (`dev-workflow` skill), open the section, switch every view option, toggle fullscreen, hide/show it in Customize mode, reload — position and type must persist.
