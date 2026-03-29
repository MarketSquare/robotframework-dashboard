---
name: js-unit-tests
description: 'Run, analyze, fix, and write JavaScript unit tests in tests/javascript/. Use when: working on, running, or reasoning about JS unit tests; JS tests are failing; adding tests for JS modules; debugging Vitest errors. DO NOT USE FOR: Python unit tests (tests/python/), acceptance tests (tests/robot/), or Robot Framework test suites.'
argument-hint: 'Optional: specific test file or test name to focus on'
---

# JavaScript Unit Tests

## How to run

**Windows:**
```bat
scripts\jstests.bat
```

**Linux / macOS:**
```bash
bash scripts/jstests.sh
```

Both scripts run `npx vitest run --reporter=verbose`.

**Targeted runs:**
```bash
npx vitest run tests/javascript/graph_data/failed.test.js
npx vitest run --reporter=verbose -t "sorts by total failures"
```

## Framework and config

- **Vitest 4.1.1** — test runner and assertion library (`describe`, `it`, `expect`, `vi`).
- **jsdom 29.0.1** — available as a devDependency for DOM-dependent tests (not currently used; environment is `node`).
- Config is in `vitest.config.js`. Key setting: the `@js` path alias resolves to `robotframework_dashboard/js/`, so `import '@js/variables/settings.js'` works the same in tests as in source modules.

## Test layout

```
tests/javascript/
├── mocks/            # shared mock modules (see below)
│   ├── chartconfig.js
│   ├── data.js
│   ├── globals.js
│   └── graphs.js
├── common.test.js
├── filter.test.js
├── localstorage.test.js
└── graph_data/       # one file per graph_data source module
    ├── donut.test.js
    ├── failed.test.js
    ├── flaky.test.js
    ├── graph_config.test.js
    ├── helpers.test.js
    ├── messages.test.js
    ├── time_consuming.test.js
    └── tooltip_helpers.test.js
```

| File | What it covers |
|---|---|
| `common.test.js` | `format_duration`, `strip_tz_suffix`, `format_name` |
| `filter.test.js` | `filter_data_by_name`, `filter_data_by_tag`, `merge_filter_profile`, `get_searchable_keys`, `convert_timezone` |
| `localstorage.test.js` | `merge_deep`, `merge_view`, `merge_view_section_or_graph`, `merge_theme_colors`, `merge_layout`, `collect_allowed_graphs` |
| `graph_data/helpers.test.js` | `convert_timeline_data` |
| `graph_data/tooltip_helpers.test.js` | `build_tooltip_meta`, `lookup_tooltip_meta`, `format_status` |
| `graph_data/failed.test.js` | `get_most_failed_data` (bar + timeline modes) |
| `graph_data/flaky.test.js` | `get_most_flaky_data` (bar + timeline modes) |
| `graph_data/donut.test.js` | `get_donut_graph_data`, `get_donut_total_graph_data` |
| `graph_data/time_consuming.test.js` | `get_most_time_consuming_or_most_used_data` |
| `graph_data/messages.test.js` | `get_messages_data` (bar + timeline modes) |
| `graph_data/graph_config.test.js` | `get_graph_config` (bar, line, timeline, boxplot, radar, common options) |

## What is testable

Only **pure functions** (no DOM access, no Chart.js instances, no DataTables) should be tested with Vitest. Many JS modules in this project create or manipulate DOM elements and cannot be unit-tested in a `node` environment:

| Classification | Examples |
|---|---|
| **Pure / testable** | `common.js`, `filter.js`, `localstorage.js`, `graph_data/tooltip_helpers.js`, `graph_data/failed.js`, `graph_data/flaky.js`, `graph_data/donut.js`, `graph_data/messages.js`, `graph_data/time_consuming.js`, `graph_data/graph_config.js`, `graph_data/helpers.js` |
| **DOM-dependent / not testable** | `graph_data/statistics.js`, `graph_data/duration.js`, `graph_data/heatmap.js`, `graph_data/duration_deviation.js`, `graph_creation/*.js`, `js/main.js`, `js/admin_page/*.js` |

If a module has **some** pure functions and **some** DOM-dependent functions, test only the pure ones. Do not attempt to mock `document`, `window.Chart`, or DataTables.

## Mocking pattern

Every `graph_data` module imports globals (`settings`, `globals`, `chartconfig`, etc.). These must be mocked with `vi.mock()` **at the top of each test file, before importing the module under test**.

### Inline mocks (preferred for graph_data tests)

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@js/variables/settings.js', () => ({
    settings: {
        switch: { useLibraryNames: false, suitePathsSuiteSection: false, suitePathsTestSection: false },
        show: { aliases: false, rounding: 6 },
    },
}));
vi.mock('@js/variables/globals.js', () => ({
    inFullscreen: false,
    inFullscreenGraph: '',
}));
vi.mock('@js/variables/chartconfig.js', () => ({
    failedConfig: { backgroundColor: 'rgba(206,62,1,0.7)', borderColor: '#ce3e01' },
}));

// Import AFTER vi.mock calls
import { get_most_failed_data } from '@js/graph_data/failed.js';
```

### Shared mocks (`tests/javascript/mocks/`)

Four reusable mock modules exist in `tests/javascript/mocks/` for modules that are widely imported:

| Mock file | Replaces | Key exports |
|---|---|---|
| `data.js` | `@js/variables/data.js` | `runs`, `suites`, `tests`, `keywords` arrays |
| `globals.js` | `@js/variables/globals.js` | Global state variables (`inFullscreen`, grid refs, etc.) |
| `chartconfig.js` | `@js/variables/chartconfig.js` | Color config objects (e.g. `failedConfig`, `passedConfig`) |
| `graphs.js` | `@js/variables/graphs.js` | `overview_graphs`, `run_graphs`, etc. |

To use a shared mock:
```js
vi.mock('@js/variables/data.js', async () => import('../mocks/data.js'));
```

### When to use inline vs shared mocks

- **Inline** — when the test needs specific settings values or only a few exports. Most `graph_data` tests use inline mocks because each test file needs a tailored `settings` shape.
- **Shared** — when you need a full, realistic copy of the module's exports and don't need to customize values per test.

### Mocking helper modules

Some `graph_data` modules import functions from sibling helpers (e.g. `convert_timeline_data` from `helpers.js`). Mock these with simplified implementations:

```js
vi.mock('@js/graph_data/helpers.js', () => ({
    convert_timeline_data: (datasets) => {
        const grouped = {};
        for (const ds of datasets) {
            const key = `${ds.label}::${ds.backgroundColor}`;
            if (!grouped[key]) grouped[key] = { label: ds.label, data: [], backgroundColor: ds.backgroundColor };
            grouped[key].data.push(...ds.data);
        }
        return Object.values(grouped);
    },
}));
```

## Mutating mock state in tests

When a test needs to change a mocked module's state (e.g. toggle `settings.switch.useLibraryNames`), import the mock object and mutate it directly inside the test. `vi.mock` factory functions return the same object reference for all importers:

```js
import { settings } from '@js/variables/settings.js';

it('uses library names when enabled', () => {
    settings.switch.useLibraryNames = true;
    // ... run function under test ...
    settings.switch.useLibraryNames = false; // restore
});
```

Use `beforeEach` to reset mutable state when multiple tests share the same mock.

## Writing a new test file

1. Create the test file in `tests/javascript/` (or `tests/javascript/graph_data/` for graph data modules).
2. Add `vi.mock()` calls for every import of the source module.
3. Import the function(s) under test **after** the mock calls.
4. Write `describe`/`it` blocks with clear descriptions.
5. Run `npx vitest run <path>` to verify.

### Non-exported helper functions

Some source modules have local helper functions that are not exported. If you need to test one, **re-implement it directly in the test file** rather than modifying the source module's exports. This keeps the production API surface unchanged:

```js
// Re-implement non-exported helper for testing
function format_status(status) {
    if (status === true || status === 'PASS') return 'PASS';
    if (status === false || status === 'FAIL') return 'FAIL';
    if (status === 'SKIP') return 'SKIP';
    return status;
}
```

## CI integration

JS unit tests run as a separate `js-unit-tests` job in `.github/workflows/tests.yml` using Node.js 24. The `robot-tests` job declares `needs: [unit-tests, js-unit-tests]`, so acceptance tests are skipped if either Python or JS unit tests fail.

## Analyzing and fixing failures

| Failure pattern | Likely cause | Action |
|---|---|---|
| `ReferenceError: X is not defined` | Missing `vi.mock()` for a dependency | Add the mock for the missing module |
| `TypeError: X is not a function` | Mock doesn't export the needed function | Update the mock factory to include it |
| `AssertionError` on a changed value | Source logic changed intentionally | Verify the change is correct; update expected values |
| `AssertionError` on a value that shouldn't change | Regression in source code | Fix the source code |
| `Cannot find module '@js/...'` | Path alias issue or renamed file | Check `vitest.config.js` alias and source file paths |
| Mock state leaking between tests | Mutable mock object not reset | Add `beforeEach` to reset mock state |
