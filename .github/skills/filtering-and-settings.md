---
description: Use when working on dashboard filters, settings, localStorage persistence, the JSON config system, graph layout, or the GridStack drag-and-drop layout editor.
---

# Filtering, Settings, and Layout

## Overview

The dashboard front-end has three tightly coupled systems:
1. **Settings** — a single `settings` object that controls all display preferences, persisted in `localStorage`
2. **Filtering** — a 10-stage pipeline that produces `filteredRuns/Suites/Tests/Keywords` from the raw decoded data
3. **Layout** — GridStack-based drag-and-drop positioning + section ordering, also persisted in `settings`

Key files: `js/variables/settings.js`, `js/variables/globals.js`, `js/filter.js`, `js/localstorage.js`, `js/eventlisteners.js`, `js/layout.js`

---

## Settings Object (`js/variables/settings.js`)

The `settings` object is the single source of truth for all dashboard configuration. Top-level keys:

| Key | Type | Contents |
|---|---|---|
| `switch` | Object | Feature toggles (booleans): run tags, total stats, latest runs, percentage filters, suite paths visibility, etc. |
| `show` | Object | Display settings: date labels, legends, aliases, milliseconds, axis titles, animation, duration, rounding, timezone conversion |
| `theme_colors` | Object | `light`, `dark`, and `custom: {light, dark}` sub-objects with color values |
| `branding` | Object | `title`, `logo` |
| `menu` | Object | Which tabs are visible: `overview`, `dashboard`, `compare`, `tables` |
| `graphTypes` | Object | Per-graph chart type (e.g. `"bar"`, `"line"`, `"percentages"`) |
| `view` | Object | Per-page `sections: {show, hide}` and `graphs: {show, hide}` lists for overview, unified, dashboard, compare, tables |

**localStorage-only keys** (not in the defaults object but always preserved during merge):
- `layouts` — GridStack position data per section
- `libraries` — keyword library show/hide toggles
- `theme` — `"dark"` or `"light"`
- `filterProfiles` — named filter state snapshots

---

## localStorage Persistence (`js/localstorage.js`)

`setup_local_storage()` resolves settings on every page load using this priority:

1. `force_json_config && hasJsonConfig` → use provided JSON config (overrides localStorage)
2. `storedSettings` in localStorage → deserialize and deep-merge with current defaults
3. `!force_json_config && hasJsonConfig` → use JSON config as first-time default only
4. Fallback → use hardcoded `settings` defaults

After resolving, always writes back to `localStorage.setItem('settings', JSON.stringify(settings))`.

`set_local_storage_item(path, value)` — updates the live `settings` object using a dot-separated path (e.g. `"show.legends"`) and persists immediately. Used by all settings toggle handlers.

### Deep Merge Behavior (`merge_deep`)

When merging persisted settings with current defaults:
- `view` → `merge_view()`: preserves `show`/`hide` lists, **purges** entries for graphs/sections that no longer exist
- `layouts` → `merge_layout()`: removes graph IDs that no longer exist in `collect_allowed_graphs()`
- `theme_colors` → `merge_theme_colors()`: preserves the `custom` sub-key
- Keys in localStorage that don't exist in defaults are **dropped** (schema migration) — **except** the four localStorage-only keys above

---

## JSON Config (`--jsonconfig` / `--forcejsonconfig`)

`-j / --jsonconfig path` provides an initial settings JSON file. It is embedded into the generated HTML as `placeholder_json_config` and exposed as the `json_config` JS variable.

`--forcejsonconfig` (boolean, default `False`) — when `True`, the JSON config overrides localStorage on every page load (`force_json_config` JS variable is `"true"`).

In `localstorage.js`: if the placeholder string was not replaced (i.e. the string still contains `"placeholder_"`), `hasJsonConfig` is `false` and the JSON config branch is skipped entirely.

---

## Filtering Pipeline (`js/filter.js`)

`setup_filtered_data_and_filters()` is called when the filter modal closes or on initial load. It runs these 10 stages in order:

| Stage | What it does |
|---|---|
| 1. Remove milliseconds | Strips sub-second precision from `run_start` if `settings.show.milliseconds` is false |
| 2. Convert timezone | Converts `run_start` timestamps to viewer's local timezone if `settings.show.convertTimezone` is true |
| 3. Remove timezone display | Strips `+HH:MM` suffix if `settings.show.timezones` is false |
| 4. `filter_runs()` | Filter by run name, `#runs` dropdown (`"All"` or specific name) |
| 5. `filter_runtags()` | Filter by run tag checkboxes (`#runTag`); AND/OR logic via `#useOrTags`; returns empty if no tags selected |
| 6. `filter_dates()` | Date range via `#fromDate`, `#fromTime`, `#toDate`, `#toTime`; validates range |
| 7. `filter_amount()` | Keep last N runs (`#amount` input); handles edge cases (empty, negative, decimal/comma) |
| 8. `filter_metadata()` | Filter by metadata key:value (`#metadata` dropdown; exact match against `run.metadata`) |
| 9. `filter_project_versions()` | Filter by project version checkboxes (`#projectVersionList`); `"None"` covers runs with null version |
| 10. `filter_data()` | Filter suites/tests/keywords to only include entries whose `run_start` is in `filteredRuns`; applies `settings.libraries` to exclude disabled keyword libraries |

After filtering: updates count headlines (`#runTitle`, etc.), repopulates all dropdown selects (compare run selects, suite/test/keyword selects, test tag selects), then calls `sort_wall_clock()` to re-sort all four arrays chronologically.

---

## Filter Profiles

Named snapshots of the filter modal state, stored in `settings.filterProfiles` (localStorage-only).

- `build_profile_from_checks()` — captures all checkbox/input/select states from the filter modal
- `apply_filter_profile(name)` — restores a saved profile into the modal's UI and triggers filtering
- The active profile name and whether it has been modified since last save is shown in the profile dropdown

---

## Global State (`js/variables/globals.js`)

Key mutable globals used across modules:

| Global | Description |
|---|---|
| `filteredRuns`, `filteredSuites`, `filteredTests`, `filteredKeywords` | Current filtered data arrays (reassigned by `filter.js` after each filter pass) |
| `filteredAmount` | Total count before amount-slicing (shown as "showing X of N runs") |
| `gridUnified`, `gridRun`, `gridSuite`, `gridTest`, `gridKeyword`, `gridCompare` | GridStack instances per section |
| `gridEditMode` | Boolean: layout editor is active |
| `inFullscreen`, `inFullscreenGraph` | Fullscreen graph state; increases data limits (Top 10/30 → Top 50/100) |
| `selectedRunSetting`, `selectedTagSetting` | Applied when navigating to dashboard from overview with a pre-selected filter |
| `projects_by_tag`, `projects_by_name`, `latestRunByProjectTag`, `latestRunByProjectName` | Overview page project groupings (populated by `prepare_overview()`) |

---

## Layout System (`js/layout.js`)

### Section Order

`setup_section_order()` reads `settings.view.[page].sections.show` and `.hide` arrays, then uses jQuery `insertAfter()` to rearrange section `<div>` elements relative to DOM anchor elements (`#topDashboardSection`, `#topOverviewSection`). In `gridEditMode`, hidden sections are also rendered with move-up/move-down and show/hide toggle buttons.

### Graph Layout (GridStack)

One `GridStack` instance per section. Config: `cellHeight: 100`, `float: false`, `resizable: { handles: 'all' }`. Grid is disabled (non-draggable/resizable) outside edit mode.

Each graph is a `grid-stack-item` with attributes: `gs-x`, `gs-y`, `gs-w` (default 4), `gs-h` (default 4), min/max constraints (w: 3–12, h: 3–12), and `data-gs-id`.

**Saved positioning**: `settings.layouts.gridRun` (and `.gridSuite`, `.gridTest`, etc.) holds GridStack layout as a JSON string `[{id, x, y, w, h}, ...]`. On load, saved coordinates are applied if present; otherwise sequential left-to-right placement is computed (4 wide, 3 columns, then wrap).

In normal mode, hidden graphs are rendered to a `#[section]DataHidden` container (no GridStack) so their data computations still run.

### Edit Mode Flow

1. User clicks "Customize Layout" → `gridEditMode = true` → full re-render with drag/resize enabled and show/hide buttons visible
2. User drags/resizes graphs, reorders sections, toggles show/hide buttons
3. User clicks "Save Layout" → `save_layout()`:
   - Reads `window[gridId].engine.nodes` for `{x, y, w, h, id}` per widget
   - Reads `.shown-graph`/`.hidden-graph` button visibility for show/hide lists
   - Reads DOM order of `.move-up-section` for section order
   - Persists all to localStorage via `set_local_storage_item`
4. `gridEditMode = false` → full re-render in normal mode

### Layout Merge on Load

`merge_layout()` in `localstorage.js` purges any saved layout entries whose `id` is not in `collect_allowed_graphs()` — prevents stale graph references after settings changes remove graphs.

---

## Event Wiring (`js/eventlisteners.js`)

`setup_filter_modal()` — wires all filter modal controls. The Bootstrap `hidden.bs.modal` event triggers `setup_filtered_data_and_filters()` + `update_dashboard_graphs()` (with a loading overlay and double `requestAnimationFrame` to let the DOM settle before rendering).

`setup_settings_modal()` — data-driven: an array of `{key, elementId, isNumber}` objects creates toggle handlers for all settings checkboxes/inputs. For each: loads stored value on init, attaches change listener that calls `set_local_storage_item(key, value)`. Theme color pickers use `create_theme_color_handler()`, which reads/writes `settings.theme_colors.custom.[light|dark].[colorKey]`.
