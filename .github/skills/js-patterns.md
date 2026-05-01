---
description: Use when reading, understanding, or navigating existing JavaScript code in this project. Describes how JS code is currently structured and what patterns exist.
---

# JavaScript Patterns in This Project

## Module System

All dashboard JS lives under `robotframework_dashboard/js/`. Files use ES module syntax (`import`/`export`), but the Python bundler (`DependencyProcessor`) strips all `import`/`export` statements before concatenation. After bundling, every function and variable declared at module level is effectively global inside the single `<script>` block.

### Dependency graph
- `js/main.js` is the entry point. Everything is discovered via `import` chains from it.
- JS modules import each other using relative paths (`'../common.js'`, `'./variables/settings.js'`, etc.).
- Adding a new file: import it from an existing file so `DependencyProcessor` can reach it.

---

## Directory Layout

```
js/
  main.js                    — startup entry; imports and calls all setup functions
  common.js                  — shared utilities (format_duration, add_alert, etc.)
  localstorage.js            — localStorage read/write + deep merge logic
  filter.js                  — all filter + filter-profile logic
  layout.js                  — GridStack layout setup, customize/save layout flow
  menu.js                    — tab/page switching
  eventlisteners.js          — wires all event listeners on DOMContentLoaded
  statwidgets.js             — custom stat widget CRUD, rendering, and modal wiring
  variables/
    data.js                  — decodes the base64/zlib-compressed data payload
    globals.js               — shared mutable state (filteredRuns, filteredSuites, etc.)
    graphs.js                — graph registry, section lists, graph show/hide lists
    graphmetadata.js         — per-graph config (label, key, html, type, viewOptions, etc.)
    settings.js              — `settings` object defaults; loaded from / merged into localStorage
    information.js           — tooltip/info text per graph key
    statwidgetdefs.js        — STAT_WIDGET_DEFS, STAT_WIDGET_COLORS, STAT_WIDGET_BG_COLORS
  graph_creation/
    all.js                   — create_dashboard_graphs() / update_dashboard_graphs()
    run.js / suite.js / test.js / keyword.js / compare.js / tables.js
    chart_factory.js         — create_chart() / update_chart()
    config_helpers.js        — shared Chart.js config builders
  graph_data/
    stats.js                 — get_stats_data(), get_suite_stats_data(), get_test_stats_data(), get_keyword_stats_data()
    duration.js / statistics.js / graph_config.js / ...
  admin_page/                — separate bundle for the server /admin page only
```

---

## Variables

### Shared state lives in `js/variables/globals.js`
- Runtime state that many modules read/write: `filteredRuns`, `filteredSuites`, `filteredTests`, `filteredKeywords`, `gridEditMode`, `inFullscreen`, `inFullscreenGraph`, grid references (`gridRun`, `gridSuite`, etc.), toggle booleans.
- Cross-module constants: `CARDS_PER_ROW`, `DEFAULT_DURATION_PERCENTAGE`, `MERGE_ROW_DEFS`.

### Settings live in `js/variables/settings.js`
- The `settings` object is the single source of truth for user preferences. It is loaded from localStorage at startup and deep-merged with defaults.
- Persisted keys: `layouts`, `libraries`, `theme`, `filterProfiles`, `statWidgets`.

### Module-local constants stay in their own file
- A `const` that is only used within one file stays in that file (e.g. `TIME_PROPS` in `statwidgets.js`).
- A `const` shared across multiple files belongs in `js/variables/`.

---

## Function Naming

- All functions use `snake_case` (e.g. `create_run_statistics_graph`, `update_suite_stat_widgets`).
- Graph creation functions follow: `create_<section>_<name>_graph()` / `update_<section>_<name>_graph()`.
- Build functions (produce a Chart.js config object) are named `build_<section>_<name>_config()`.
- Stat widget functions: `create_<section>_stat_widgets()` / `update_<section>_stat_widgets()`.
- Lifecycle convention in graph_creation: every graph has a `create_*` (first render) and `update_*` (re-render); `update_*` typically delegates to `create_*`.

---

## Bundling and Scope

Because all modules are concatenated into one `<script>`:
- There is no private scope — every named function/variable is accessible globally at runtime.
- Functions intended to be internal helpers (not called from other files) are distinguished by documentation/comments, not by language-level privacy.
- `window[name]` patterns are used for the GridStack grid instances and graph instances (e.g. `window['gridRun']`, `window['runStatisticsGraph']`), populated via `graphVars` in `graphs.js`.

---

## LocalStorage

- All persistence goes through `set_local_storage_item(key, value)` in `localstorage.js`.
- Keys are dot-notated: `'statWidgets'`, `'notices.statWidgets'`, `'layouts'`.
- On startup, the stored object is deep-merged with `settings` defaults using `merge_deep()`, which preserves user layout/profile/theme data while picking up new defaults.

---

## GridStack

- Each dashboard section has one GridStack instance stored in a `window[gridId]` variable.
- Grid items are added with `gridStack.makeWidget(el)`.
- `gridEditMode` (in `globals.js`) tracks whether the layout is in edit/customize mode.
- Custom stat widgets are added to grids via `render_custom_stat_widgets()` and `render_add_stat_widget_tile()` in `statwidgets.js`.

---

## Chart.js

- Every chart is created via `create_chart(id, configFn, registerGraph?)` and updated via `update_chart(id, configFn)` in `chart_factory.js`.
- Config functions are named `build_<section>_<name>_config()` and return a full Chart.js config object.
- Graph metadata (type, view options, fullscreen flag, default size/minSize) is centrally declared in `variables/graphmetadata.js`.
