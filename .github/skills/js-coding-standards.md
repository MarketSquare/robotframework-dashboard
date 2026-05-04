---
description: Use when writing new JavaScript (or reviewing existing JS) for this project. Prescriptive coding standards and rules to follow.
---

# JavaScript Coding Standards

## Naming

- **All functions and variables use `snake_case`** — not camelCase, not PascalCase.
  - ✅ `create_run_stat_widgets`, `filteredRuns`, `get_stat_value`
  - ❌ `createRunStatWidgets`, `FilteredRuns`, `_getStatValue`
- **Never start a function or variable name with `_`**. There is no language-level privacy here (everything is bundled into one script), so the `_` prefix is misleading. Name helpers descriptively without a prefix.
  - ✅ `build_widget_html`, `update_values_for_section`, `handle_delete_widget`
  - ❌ `_build_widget_html`, `_update_values_for_section`, `_handle_delete_widget`
- **Constants that are conceptually global enumerations use UPPER_SNAKE_CASE** (e.g. `STAT_WIDGET_DEFS`, `MERGE_ROW_DEFS`, `TIME_PROPS`).
- **Boolean state variables should read like predicates**: `gridEditMode`, `inFullscreen`, `ignoreSkips`.

---

## Where to Put New Variables

| Variable type | Where it belongs |
|---|---|
| Shared mutable runtime state (updated during the session) | `js/variables/globals.js` |
| Shared constants used by ≥ 2 files | `js/variables/globals.js` or a dedicated `js/variables/*.js` |
| Graph/widget type definitions shared across files | `js/variables/statwidgetdefs.js`, `js/variables/graphmetadata.js` |
| Module-local constant used only in one file | Top of that file — **do not move to `variables/`** |
| User settings / persisted preferences | `js/variables/settings.js` `settings` object |

---

## Adding New Modules

1. Create the file under `js/` (or a relevant subdirectory).
2. `import` it from at least one existing module so `DependencyProcessor` can discover it.
3. `export` any symbols other files need.
4. Do **not** register the file anywhere else — the Python bundler resolves order automatically from the import graph.

---

## Function Patterns

### Graph creation
Every chart or widget must have:
- `create_<section>_<name>()` — called on first tab load; builds from scratch.
- `update_<section>_<name>()` — called on filter/run changes; typically delegates to `create_*`.

```js
function create_run_duration_graph() { create_chart("runDurationGraph", build_run_duration_config); }
function update_run_duration_graph() { update_chart("runDurationGraph", build_run_duration_config); }
```

### Config builders
Functions that return a Chart.js config object are named `build_<section>_<name>_config()` and called only from `create_chart` / `update_chart`.

### Stat widget values
- Values that represent raw seconds must pass through `format_duration()` before display.
- DOM element updates use the pattern: `const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };`

---

## Scope and Privacy

- All JS is merged into one `<script>` block — there is no module scope at runtime.
- Do not rely on closures to hide state from the rest of the bundle. Name private helpers clearly so they are recognisable.
- Never use `var` for new code; prefer `const` (for values that don't change) and `let` (for reassigned variables). Legacy `var` in `globals.js` for filtered-data vars is intentional (they are assigned externally).

---

## LocalStorage

- Always use `set_local_storage_item(key, value)` to persist data — never write to `localStorage` directly.
- Keys that must survive `merge_deep` (i.e. that only exist in localStorage, not in the `settings` defaults) must be whitelisted in the exclusion check inside `merge_deep()` in `localstorage.js`.
- New persisted structures should be added to the `settings` object defaults in `settings.js` so they are properly initialised on first load.

---

## HTML / DOM

- Use `document.getElementById` for single elements with known IDs.
- Use `document.querySelector` / `querySelectorAll` for CSS-selector based lookups.
- Guard every DOM read: `const el = document.getElementById(id); if (el) el.innerText = val;`
- Build HTML strings with template literals; always escape user-provided content before insertion.

---

## Code Style

- Use `const` / `let`; avoid `var`.
- Prefer arrow functions for short callbacks: `(x) => x * 2`.
- Keep functions small and focused on one task.
- One-liner functions are acceptable for simple delegation: `function update_run_stat_widgets() { create_run_stat_widgets(); }`
- Do not add JSDoc comments or TypeScript annotations.
- No trailing commas required, but consistent with surrounding code.
