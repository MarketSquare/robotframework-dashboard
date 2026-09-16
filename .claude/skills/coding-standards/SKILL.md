---
name: coding-standards
description: Naming, structure, and style rules for Python, JavaScript, HTML, and CSS in this repo, plus how the existing JavaScript is organised (module layout, where variables live, function naming, localStorage, GridStack, Chart.js conventions). Use when writing or reviewing any code, or when you need to find where something belongs in js/.
---

# Coding Standards

## Python

- Targets Python 3.8+.
- `snake_case` everywhere; keep functions small; raise clear exceptions.
- Keep the pipeline intact: parse → DB → HTML via `RobotDashboard` methods — do not reimplement pieces of it.
- All SQL lives as constants in `queries.py`.

## HTML (templates)

- Semantic, minimal markup; label form controls.
- Templates use **string placeholder tokens**, not Jinja. Never rename `placeholder_*` tokens or `<!-- placeholder_* -->` comments — replacement is positional string substitution in `dashboard.py`.

## CSS

- Files: `css/base.css`, `colors.css`, `components.css`, `dark.css` — concatenated in sorted order at generation time.
- Reuse existing Bootstrap/DataTables class conventions, keep selectors shallow, prefer CSS variables for theme values.

## Docs

- User-facing behaviour change → update `docs/` (see the `documentation` skill).

---

# JavaScript

## Naming (as the codebase actually does it)

| Thing | Convention | Examples |
|---|---|---|
| Functions | `snake_case` | `create_run_statistics_graph`, `update_suite_stat_widgets`, `filter_runtags` |
| Variables (const/let/var) | `camelCase` | `filteredRuns`, `gridEditMode`, `tagElements`, `selectedTagSetting` |
| Global enumerations / definition tables | `UPPER_SNAKE_CASE` | `STAT_WIDGET_DEFS`, `MERGE_ROW_DEFS`, `TIME_PROPS` |
| Booleans | read as predicates | `gridEditMode`, `inFullscreen`, `ignoreSkips` |
| DOM ids | `camelCase`, often prefixed by feature | `runTagCheckBox<tag>`, `overviewLatest<project>Card0`, `filterRunTagSelectedIndicator` |

- Do **not** prefix helpers with `_`. Everything is bundled into one `<script>`, so there is no privacy to signal; a handful of legacy `_build_compare_*` functions exist — don't add more.
- `const`/`let` for new code. The `var` declarations in `variables/globals.js` are intentional (they are reassigned from other modules after bundling).
- Arrow functions for short callbacks; no JSDoc, no TypeScript annotations; match the surrounding file's comment density.

## Module system and bundling

ES `import`/`export` syntax in source, but the Python `DependencyProcessor` strips it and concatenates every module into one `<script>` block (details: `js-bundling` skill). Consequences:

- Every top-level function/variable is global at runtime. Name things descriptively enough to be unique.
- A new file is discovered **only** through the import graph from `js/main.js` — import it from an existing module, never register it anywhere else.
- `window[name]` is used for GridStack instances (`window.gridRun`) and chart instances (`window['runStatisticsGraph']`), populated via `graphVars` in `variables/graphs.js`.

## Directory layout (`robotframework_dashboard/js/`)

```
main.js                  startup entry; imports and calls all setup functions
common.js                shared utilities (format_duration, add_alert, path helpers, …)
filter.js                filter pipeline + filter profiles
localstorage.js          settings persistence, merge_deep / merge_view / merge_layout
layout.js                GridStack setup, customize/save layout, undo/redo snapshots
menu.js                  tab/page switching (update_menu)
eventlisteners.js        wires every modal/filter/settings listener on load
statwidgets.js           custom stat widgets (CRUD, render, modal)
linkwidgets.js           custom link widgets (same pattern)
customsections.js        user-defined dashboard sections
log.js                   log.html link generation / open_log_file
theme.js                 dark/light switching
database.js              DB statistics display
information.js           element setup helpers
variables/
  data.js                decodes the base64+zlib payload into runs/suites/tests/keywords
  globals.js             shared mutable state (filteredRuns, gridEditMode, selected*Setting, …)
  settings.js            `settings` defaults (merged with localStorage on load)
  graphs.js              graph registry, section lists, show/hide lists
  graphmetadata.js       per-graph metadata (label, key, type, viewOptions, sizes)
  statwidgetdefs.js      STAT_WIDGET_DEFS / colours
  chartconfig.js         Chart.js colour/config constants
  information.js         tooltip/info text per graph key
  svg.js                 inline SVG icon strings
graph_creation/          one file per section: overview, run, suite, test, keyword, compare, tables
  all.js                 create_dashboard_graphs() / update_dashboard_graphs()
  chart_factory.js       create_chart() / update_chart()
  config_helpers.js      shared Chart.js config builders
graph_data/              pure data transforms: statistics, stats, duration, duration_deviation,
                         donut, heatmap, messages, failed, flaky, time_consuming, tooltip_helpers,
                         graph_config, helpers
admin_page/              separate bundle for the server /admin page only
```

## Where a new variable belongs

| Variable type | Location |
|---|---|
| Shared mutable runtime state | `variables/globals.js` |
| Constant used by ≥ 2 files | `variables/globals.js` or a dedicated `variables/*.js` |
| Constant used by one file | top of that file — do **not** move to `variables/` |
| User preference / persisted setting | `settings` object in `variables/settings.js` |
| Graph / widget definitions | `variables/graphmetadata.js`, `variables/statwidgetdefs.js` |

## Function patterns

- Every graph or widget has `create_<section>_<name>()` (first render) and `update_<section>_<name>()` (re-render on filter change, usually delegates to `create_*`).
- Chart config builders are `build_<section>_<name>_config()` and are only called through `create_chart(id, buildFn)` / `update_chart(id, buildFn)` in `chart_factory.js`.
- Stat widgets: `create_<section>_stat_widgets()` / `update_<section>_stat_widgets()`; raw seconds go through `format_duration()` before display.
- Guard DOM reads: `const el = document.getElementById(id); if (el) el.innerText = val;`
- `document.getElementById` for known ids; `querySelector(All)` for selector-based lookups. Build HTML with template literals and escape user-provided content.

## localStorage

- Persist only through `set_local_storage_item(path, value)` (dot path, e.g. `"switch.ignoreSkips"`) — never touch `localStorage` directly.
- Keys that exist **only** in localStorage (not in `settings` defaults) must be whitelisted in `merge_deep()` in `localstorage.js`, or they are dropped on next load. Current list: `layouts`, `libraries`, `theme`, `filterProfiles`, `statWidgets`, `linkWidgets`, `customSections`.
- New persisted structures should get defaults in `settings.js` so first load initialises them.

## GridStack and Chart.js

- One GridStack instance per section in `window[gridId]`; items added with `gridStack.makeWidget(el)`; `gridEditMode` (globals) says whether Customize mode is active.
- Do not wrap a GridStack item in an `<a>` — it breaks dragging. Use a `div` + `data-href` + click handler that checks `gridEditMode`.
- After any state change that should be undoable, dispatch `document.dispatchEvent(new CustomEvent("layout-user-action"))`.
- Full checklist for adding a widget type / persisted feature: `js-features` skill.
