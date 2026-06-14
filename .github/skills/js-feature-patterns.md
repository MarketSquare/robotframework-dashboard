---
description: Use when adding a new feature to the JavaScript front-end: new widget types, new GridStack tiles, new localStorage-persisted data, or new modal dialogs. Contains the complete end-to-end checklist and all architectural patterns needed to add features without re-exploring the codebase from scratch.
---

# JavaScript Feature Patterns

This skill covers the recurring patterns used when adding new features to the dashboard front-end. Reading this file (plus `js-patterns.md` for structure and `js-coding-standards.md` for style rules) is sufficient to implement most features without additional codebase exploration.

---

## 1. The "Custom Widget" Pattern (GridStack tile + localStorage + modal)

Every custom widget type in the dashboard follows the same 6-part pattern. Existing examples: **stat widget** (`statwidgets.js`) and **link widget** (`linkwidgets.js`).

### Part 1 — New JS module (`js/<name>widgets.js`)

Must contain:

| Function | Description |
|---|---|
| `render_custom_<name>_widgets(gridStack, sectionKey, editMode)` | Filters `settings.<name>Widgets` by `section === sectionKey`, creates `grid-stack-item` elements with `data-gs-id="custom<Name>Widget-<id>"`, calls `gridStack.makeWidget(item)`. Reads saved positions from `settings.layouts[grid<Section>]`. |
| `build_<name>_widget_html(widget, editMode)` | Returns the inner HTML string for one widget card. Includes a delete button only when `editMode === true`. |
| `add_custom_<name>_widget(section, ...fields)` | Generates a random ID with `generate_id()`, builds the widget object, appends to `settings.<name>Widgets`, calls `set_local_storage_item('<name>Widgets', list)`. Returns the widget object. |
| `remove_custom_<name>_widget(id)` | Filters `settings.<name>Widgets` to exclude `id`, persists. |
| `render_add_<name>_widget_tile(gridStack, sectionKey)` | Adds a 2×2 non-resizable dashed-border "add" tile. Uses `data-gs-id="add<Name>WidgetTile-<section>"`. Click opens the modal. |
| `wire_<name>_delete_buttons(gridStack, sectionKey)` | After `render_custom_<name>_widgets` in edit mode, wires `click` on all `.delete-custom-<name>-widget` buttons. |
| `handle_delete_<name>_widget(id, gridStack)` | Calls `gridStack.removeWidget(el)`, then `remove_custom_<name>_widget(id)`, then `document.dispatchEvent(new CustomEvent("layout-user-action"))`. |
| `setup_add_<name>_widget_modal()` | Populates all modal form elements, wires the confirm button (reads modal state → calls `add_custom_<name>_widget` → calls `grid.makeWidget` live → dispatches `layout-user-action` → closes modal). Called **once** from `setup_dashboard_section_layout_buttons()` in `layout.js`. |
| `open_add_<name>_widget_modal(sectionKey)` | Stores `sectionKey` in `modal.dataset.pendingSection` then calls `bootstrap.Modal.getOrCreateInstance(modal).show()`. |

**Import the new module from `layout.js`** — the bundler discovers it via the import graph from `main.js`.

### Part 2 — CSS (`css/components.css`)

Required CSS classes:

| Class | Description |
|---|---|
| `.add-<name>-widget-tile` | Dashed-border clickable tile (copy from `.add-stat-widget-tile`). |
| `.add-<name>-widget-tile-inner` / `.add-<name>-widget-plus` / `.add-<name>-widget-tile-label` | Inner content layout (copy from stat equivalents). |
| `.<name>-widget-inner` | `position: relative; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 0.25rem; height: 100%; overflow: hidden;` |
| `.<name>-widget-title` (or label) | `margin: 0; font-weight: 600; font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: calc(100% - 20px);` |
| `.delete-custom-<name>-widget` | `position: absolute; top: 5px; right: 5px; z-index: 1;` |
| `.grid-stack-item-content:has(.<name>-widget-inner)` | `padding: 8px 12px;` (same as stat widget) |
| h=1 compact row rules | Mirror the `gs-h="1"` and `data-gs-h="1"` row-layout overrides from stat widget. |

### Part 3 — localStorage whitelist (`js/localstorage.js`)

Add the new key name to the preserved-keys exclusion in `merge_deep()`:

```js
// before:
if (key !== "layouts" && key !== "libraries" && key !== "theme" && key !== "filterProfiles" && key !== "statWidgets" && key !== "customSections" && ...
// after — add your key:
&& key !== "<name>Widgets" && ...
```

**Also** add the `data-gs-id` prefix to the `merge_layout()` allowlist in the same file, or saved widget positions will be silently dropped on every page load:

```js
// In merge_layout(), inside the arr.filter(...) call:
(typeof item.id === 'string' && item.id.startsWith('custom<Name>Widget-')) ||
```

Without this second whitelist entry, `merge_layout` strips any layout position whose ID doesn't match a known graph — so widgets always revert to their default GridStack position after refresh.

### Part 4 — Undo/Redo snapshots (`js/layout.js`)

Add `<name>Widgets` to **all three** snapshot/restore functions:

```js
// capture_settings_snapshot()
<name>Widgets: JSON.parse(JSON.stringify(settings.<name>Widgets || [])),

// capture_dom_snapshot()
<name>Widgets: JSON.parse(JSON.stringify(settings.<name>Widgets || [])),

// apply_layout_snapshot(snapshot)
set_local_storage_item('<name>Widgets', JSON.parse(JSON.stringify(snapshot.<name>Widgets || [])));
```

Missing any one of these three causes widgets to be lost or not properly undone.

### Part 5 — Render calls (`js/layout.js` → `setup_graph_order`)

In the `setup_graph_order` function, immediately after the stat-widget block:

```js
// Render custom <name> widgets for this section
render_custom_<name>_widgets(window[grid], sectionKey, gridEditMode);
if (gridEditMode) {
    wire_<name>_delete_buttons(window[grid], sectionKey);
    render_add_<name>_widget_tile(window[grid], sectionKey);
}
```

This block runs for all sections **except "Compare"**. Unified section uses `sectionKey = "unified"` and `window[grid] = window.gridUnified`.

### Part 6 — Modal HTML (`templates/dashboard.html`)

Add the modal `<div>` in the `<!-- modals -->` area, before `<!-- placeholder_javascript -->`. Use Bootstrap 5 modal structure (same as `#addStatWidgetModal`). Wire it via `setup_add_<name>_widget_modal()` called in `setup_dashboard_section_layout_buttons()`.

---

## 2. Section Key → GridStack Instance Mapping

The `sectionKey` (lowercase string) maps to:

| `sectionKey` | `window[grid]` | Layout key |
|---|---|---|
| `"run"` | `window.gridRun` | `settings.layouts.gridRun` |
| `"suite"` | `window.gridSuite` | `settings.layouts.gridSuite` |
| `"test"` | `window.gridTest` | `settings.layouts.gridTest` |
| `"keyword"` | `window.gridKeyword` | `settings.layouts.gridKeyword` |
| `"unified"` | `window.gridUnified` | `settings.layouts.gridUnified` |
| `"compare"` | (excluded from custom widgets) | `settings.layouts.gridCompare` |

The `window[grid]` pattern uses `"grid" + section.charAt(0).toUpperCase() + section.slice(1)`.

---

## 3. GridStack Item Lifecycle

### Creating an item
```js
const item = document.createElement('div');
item.classList.add('grid-stack-item');
item.setAttribute('gs-w', w);
item.setAttribute('gs-h', h);
item.setAttribute('gs-min-w', 1); item.setAttribute('gs-min-h', 1);
item.setAttribute('gs-max-w', 12); item.setAttribute('gs-max-h', 12);
item.setAttribute('data-gs-id', 'myWidget-<id>');  // must be unique
item.innerHTML = `<div class="grid-stack-item-content">${innerHtml}</div>`;
gridStack.makeWidget(item);
```

### Restoring saved position
Before `makeWidget`, check `settings.layouts[gridId]` (a JSON string), parse it, find the entry whose `.id` matches `data-gs-id`, and set `gs-x`/`gs-y`/`gs-w`/`gs-h` from the saved entry.

### Removing an item
```js
const el = gridStack.el.querySelector('[data-gs-id="myWidget-<id>"]');
if (el) gridStack.removeWidget(el);
```

### Saving layout (automatic)
`capture_dom_snapshot()` in `layout.js` reads `gridStack.engine.nodes` for all grids and builds a JSON string of `[{id, x, y, w, h}]` entries. This is called automatically on every drag/resize (`dragstop`/`resizestop`) and on every `layout-user-action` event.

---

## 4. The `layout-user-action` Event

Dispatching `document.dispatchEvent(new CustomEvent("layout-user-action"))` after any state-changing operation:
- Takes a DOM snapshot and pushes it onto the undo history stack.
- Is the only mechanism that captures widget add/delete in undo history.
- Must be dispatched after **both** the DOM change and the localStorage change are complete.

---

## 5. localStorage-Only Keys Pattern

Some keys only exist in localStorage (not in the `settings` defaults object). They must be whitelisted in `merge_deep()` in `localstorage.js` or they will be silently dropped on every page load. Current whitelist:

| Key | Module that owns it |
|---|---|
| `layouts` | `layout.js` |
| `libraries` | keyword library toggles |
| `theme` | theme switcher |
| `filterProfiles` | `filter.js` |
| `statWidgets` | `statwidgets.js` |
| `linkWidgets` | `linkwidgets.js` |
| `customSections` | `customsections.js` |

**Rule**: Any new key you persist with `set_local_storage_item` that is not in `settings` defaults must be added to this whitelist, or it will be deleted by `merge_deep` on the next page load.

---

## 6. Adding a New Settings Toggle / Persisted Value

If the new value *is* in `settings` defaults (not localStorage-only):
1. Add it to the `settings` object in `js/variables/settings.js`.
2. Persist changes via `set_local_storage_item('path.to.key', value)`.
3. No whitelist change needed — it's in the defaults, so `merge_deep` handles it.

---

## 7. Color Pickers (Reusing Stat Widget Colors)

The `STAT_WIDGET_COLORS` and `STAT_WIDGET_BG_COLORS` arrays from `js/variables/statwidgetdefs.js` can be reused by any widget type. Use `fill_color_picker(pickerEl, colors, defaultValue)` (or a local copy of it) to populate the buttons:

```js
import { STAT_WIDGET_COLORS, STAT_WIDGET_BG_COLORS } from './variables/statwidgetdefs.js';
```

The color CSS classes they reference (`.white-text`, `.blue-text`, `.blue-bg`, etc.) are defined in `css/components.css` and `css/base.css`.

---

## 8. The `gridEditMode` Guard

`gridEditMode` (in `js/variables/globals.js`) is `true` while the user is in Customize View mode. Use it to suppress interactive behaviour (e.g. link navigation) in edit mode:

```js
if (gridEditMode) return;
```

Do not use an `<a>` tag as the outermost clickable wrapper for GridStack items — it interferes with drag. Use a `<div>` with a `data-href` attribute and a `click` event listener that checks `gridEditMode` before navigating.

---

## 9. Quick-Reference: Files to Touch for a New Widget Type

| File | Change |
|---|---|
| `js/<name>widgets.js` | **Create** — full widget module |
| `js/layout.js` | Import + add to snapshots + render calls + setup call |
| `js/localstorage.js` | (1) Add key to `merge_deep` whitelist AND (2) add `data-gs-id` prefix to `merge_layout` allowlist — **both are required** or positions reset on refresh |
| `css/components.css` | Add all widget CSS classes |
| `templates/dashboard.html` | Add modal HTML |
