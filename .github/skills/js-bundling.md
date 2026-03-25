---
description: Use when adding, modifying, or debugging JavaScript modules, CSS, external dependencies, or the HTML embedding process.
---

# JavaScript and CSS Bundling

## Overview

There is **no Node.js bundler** (no webpack, Vite, Rollup, or esbuild) for the dashboard. All JS and CSS bundling happens in Python at dashboard generation time inside `robotframework_dashboard/dependencies.py`, executed by `DashboardGenerator` in `robotframework_dashboard/dashboard.py`.

The result is a single `<script>` block and a single `<style>` block inlined into the generated HTML. The browser receives one file with everything inside it.

---

## File Locations

| Source | Directory |
|---|---|
| Dashboard JS modules | `robotframework_dashboard/js/` |
| Dashboard CSS | `robotframework_dashboard/css/` |
| Admin page JS/CSS | `robotframework_dashboard/js/admin_page/` |
| Third-party local copies | `robotframework_dashboard/dependencies/` |
| HTML templates | `robotframework_dashboard/templates/` |

---

## How JS Modules Are Bundled (`DependencyProcessor`)

The class `DependencyProcessor` in `dependencies.py` performs these steps for dashboard JS:

### Step 1 — Collect
All `.js` files under `robotframework_dashboard/js/` are collected recursively, **excluding** the `admin_page/` subdirectory (that has its own separate bundle).

### Step 2 — Parse the Dependency Graph
Each file is scanned for `import ... from '...'` statements. The relative paths in those imports are resolved to build an adjacency list representing which file depends on which other file.

### Step 3 — Topological Sort (DFS)
A depth-first topological sort determines the correct concatenation order so that every module is defined before the files that depend on it. `js/main.js` is the root that everything ultimately imports from.

### Step 4 — Strip Module Syntax
Because the output is a plain `<script>` block (not an ES module), all `import`, `export`, and `export default` statements are stripped with regex. Variables and functions that were exported remain in the global script scope, accessible to all other code in the same block.

### Step 5 — Concatenate and Wrap
All files are concatenated with `// === filename.js ===` section comments between them, then wrapped:

```html
<script>
// MERGED MODULES
// === variables/data.js ===
...
// === main.js ===
...
</script>
```

This block replaces `<!-- placeholder_javascript -->` in `templates/dashboard.html`.

---

## How CSS Is Bundled

`DependencyProcessor._inline_css_files()` reads all `.css` files under `robotframework_dashboard/css/` in sorted order (`base.css`, `colors.css`, `components.css`, `dark.css`) and concatenates them into a single `<style>` block that replaces `<!-- placeholder_css -->`.

---

## Third-Party Dependencies

The `DEPENDENCIES` dict in `dependencies.py` declares every third-party library. Each entry specifies:
- A CDN URL (jsdelivr, cdnjs, unpkg, datatables.net)
- A local file path under `dependencies/` for offline fallback
- Whether it is CSS or JS
- Whether it is `admin_page`-only (Bootstrap, DataTables, jQuery — excluded from the standalone dashboard)

### Online Mode (default)
Emits `<script src="cdn-url">` or `<link rel="stylesheet" href="cdn-url">` tags that replace `<!-- placeholder_dependencies -->`. The browser fetches these from the CDN.

### Offline Mode (`--offlinedependencies`)
Reads each local file from `robotframework_dashboard/dependencies/` and embeds it inline as a `<script>` or `<style>` block. The dashboard works with no internet access.

Current third-party libraries:

| Library | Purpose |
|---|---|
| Chart.js | All charts |
| chartjs-plugin-datalabels | Data label annotations on charts |
| chartjs-adapter-date-fns | Date/time axis formatting |
| @sgratzl/chartjs-chart-boxplot | Box plot chart type |
| chartjs-chart-matrix | Matrix/heatmap chart type |
| GridStack | Drag-and-drop dashboard layout |
| Pako | `pako.inflate()` — decompress embedded data in the browser |
| Bootstrap *(admin only)* | Admin page UI |
| DataTables *(admin only)* | Admin page tables |

---

## JS Module Structure

```
js/
  variables/
    data.js          ← decodes compressed runs/suites/tests/keywords data
    globals.js       ← mutable global state (active filters, selected runs)
    settings.js      ← settings state
    graphs.js        ← graph instance registry
    graphmetadata.js ← graph metadata (title, tab, build function)
    chartconfig.js   ← Chart.js base config factory
    information.js   ← DOM element lookups
    svg.js           ← inline SVG icon strings
  graph_creation/
    chart_factory.js ← create_chart() / update_chart() — Chart.js lifecycle
    overview.js      ← overview page chart builders
    run.js           ← run-level chart builders
    suite.js         ← suite-level chart builders
    test.js          ← test-level chart builders
    keyword.js       ← keyword-level chart builders
    compare.js       ← comparison page chart builders
    tables.js        ← DataTables initializers
    config_helpers.js
    all.js           ← calls all tab section builders
  graph_data/        ← pure data transformation (statistics, duration, heatmap, donut, ...)
  common.js          ← shared utilities
  database.js        ← DB statistics display
  eventlisteners.js  ← modal/filter/settings event wiring
  filter.js          ← filtering logic applied to global data arrays
  information.js     ← element setup helpers
  layout.js          ← GridStack layout initialization
  localstorage.js    ← settings/layout persistence
  log.js             ← log.html link generation
  menu.js            ← navbar and tab setup
  theme.js           ← dark/light theme switching
  main.js            ← startup entry point (imports and calls all setup functions)
  admin_page/        ← separate bundle for the FastAPI /admin page
```

---

## Adding a New JS Module

1. Create the `.js` file anywhere under `robotframework_dashboard/js/` (except `admin_page/` unless it is admin-only).
2. Add `import { something } from './your-module.js'` in an existing module that should use it (e.g. `main.js` or one of the `graph_creation/` files).
3. Use `export` or `export default` for any symbols other files need.
4. `DependencyProcessor` will automatically discover the file via the import graph, topologically sort it, and include it in the bundled `<script>`.

**Do not** manually list JS files anywhere. The dependency graph is the only required registration.

---

## Data Encoding (Python → HTML → Browser)

Robot Framework data is embedded in the HTML as compressed strings:

**Python (generation time):**
```python
json.dumps(data).encode("utf-8")  # serialize
→ zlib.compress(...)              # compress  
→ base64.b64encode(...).decode()  # encode to ASCII string
→ embedded as "placeholder_runs" literal in template
```

**JavaScript (browser):**
```javascript
// js/variables/data.js
const runs = decode_and_decompress("placeholder_runs");
// atob() → Uint8Array → pako.inflate() → JSON.parse()
```

Pako (the JS zlib port) is the only dependency required to decode data, so it must always be loaded before `data.js` runs.
