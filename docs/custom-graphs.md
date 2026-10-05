---
outline: deep
---

# Custom Graphs

Custom graphs let you build your own charts on top of the dashboard data, next to the built-in graphs. You choose what data to look at, how to filter and group it, what to calculate and how to draw it. Everything is calculated in the browser from the data that is already in the dashboard, so custom graphs work in the static HTML file, in server mode and with `--offlinedependencies`.

## Adding a custom graph

1. Enter **Customize view** mode.
2. Click the **"Add custom graph"** icon (a bar chart) in the header of the section the graph should be placed in. Custom graphs can be added to the Run, Suite, Test and Keyword sections and to [Unified View](/settings#defaults-settings-defaults-tab). The section only decides where the graph is placed: a graph about tests can live in the Run section.
3. Pick a starting point in the **Gallery** tab, or **Start from scratch**.
4. Adjust the graph in the **Builder** tab. The preview on the right updates while you change it.
5. Click **Add Graph**, then **Save** the layout.

The graph tile can be dragged and resized like any other graph.

## The gallery

| Preset | What it shows |
|---|---|
| Statistics per run | Passed, failed and skipped tests per run, with a tag filter to fill in |
| Duration trend of one test | The duration of a single test across runs, with a test name to fill in |
| Most failed tests | The 10 tests that failed most often |
| Most flaky tests | The 10 tests that switch between pass and fail most often |
| Slowest tests | The 10 tests with the highest average duration |
| Pass rate per project version | The test pass rate of every project version |
| Pass rate per tag | The 10 test tags with the lowest pass rate |
| Keyword time per library | How the total keyword duration is spread over the libraries |
| Top failure messages | The 10 most common messages of failed tests |
| Failure heatmap | Which tests failed in which of the last 30 runs |
| Retried tests per run | How many tests needed more than one attempt in every run |

Presets that need input (a test name, a tag) put the cursor in that field when you pick them.

## The builder

| Field | Meaning |
|---|---|
| **Title** | Shown above the graph (up to 60 characters). |
| **Data** | The rows the graph is built from: runs, suites, tests, keywords or exceptions. |
| **Filters** | Conditions a row must meet, all of them have to match. Empty conditions are ignored. Value fields suggest the values that exist in your data. |
| **X axis** | What to group the rows on. *None* puts everything in one bar. |
| **Split by** | An optional second grouping: one line or bar color per value (at most 10, the rest is reported above the graph). |
| **Metric** | What to calculate per group. |
| **Order and limit** | How the X axis is sorted and how many values are kept. |
| **Chart** | Line, bar, stacked bar, horizontal bar, donut, heatmap or table. Bar charts with a split by can show percentages per column, for metrics that add up (count, sum, distinct count, passed, failed, skipped, flips). |
| **Apply the global filters** | On (default): the graph follows the [filter modal](filtering.md) like every other graph. Off: the graph always uses all runs. |
| **Follow the section filters** | Only in the Suite, Test and Keyword sections, off by default. See [Section filters](#section-filters). |

### Fields

Every data source offers the fields of its own rows plus the fields of the run it belongs to.

| Source | Fields |
|---|---|
| All sources | Run, run date, run name, run tags, project version, metadata (`key`), custom filter (`key`) |
| Runs | Status, passed, failed, skipped, total, duration |
| Suites | Suite name, suite full name, parent suite, status, passed, failed, skipped, total, duration |
| Tests | Test, test name, test full name, suite, test tags, message, status, passed, failed, skipped, duration, attempts |
| Keywords | Keyword name, library, status, passed, failed, skipped, times run, total/average/min/max duration |
| Exceptions | Exception message, amount |

- **Test** is the test name, or the full name when **Use Suite Paths** is on in the Test section, the same as the built-in test graphs. With suite paths on, two tests with the same name in different suites stay apart. The gallery presets use this field.
- **Run date** can be grouped per day, week (starting on Monday) or month. Run dates are compared as the run's own local time, and *in the last N days* counts from the clock of the browser.
- **Metadata** and **custom filter** take a key, e.g. metadata `Browser` or custom filter `Pipeline`.
- **Tags**: a test with several tags counts once for every tag when you group on tags.
- **Status** of a run, suite or keyword is *failed* when it has a failure, *skipped* when it only has skips, and *passed* otherwise. Grouping runs, suites or keywords on status uses their passed/failed/skipped counts, so "statistics per run" gives the same numbers from runs as from tests. A run with both passed and failed tests is part of both groups, so these groupings only offer the metrics count, passed, failed and skipped: the *Failed* value of the *Passed* group is 0. Tests have a single status and can use every metric.

### Filter operators

| Field type | Operators |
|---|---|
| Text | is, is not, contains, does not contain, matches regex (case insensitive, at most 100 characters) |
| Number / duration | =, ≠, >, ≥, <, ≤ (durations in seconds) |
| Status | is, is not |
| Tags | has, does not have, has a tag containing |
| Metadata / custom filter | is, is not, contains |
| Run date | on or after, before, in the last N days |

A regular expression that repeats a group which already repeats, like `(a+)+`, is refused: on some messages it can take so long that the dashboard freezes.

### Metrics

| Metric | Calculates |
|---|---|
| Count | The number of rows (or the passed/failed/skipped counts when split by status) |
| Sum, Average, Minimum, Maximum, Median, 90th / 95th percentile | Over a number or duration field |
| Distinct count | The number of different values of a field, e.g. distinct tests per run |
| Pass rate (%) | passed / (passed + failed + skipped), or without skipped when **Ignore skipped** is on |
| Passed, Failed, Skipped | The sum of that status column (only the matching status group when grouped on status) |
| Status flips (flakiness) | How often the same test (or suite/keyword) changed between pass and fail in consecutive runs; skips are left out |

### Section filters

A graph placed in the Suite, Test or Keyword section can follow the filters in that section's header, with the same rules as the built-in graphs of the section. Changing a section filter redraws the graphs that follow it.

| Section | Filters | Narrows down |
|---|---|---|
| Suite | Folder (donut navigation), Suite, Use Suite Paths | Suite data, and test data by the suite the test is in |
| Test | Suite, Test, Test Tags, Use Suite Paths | Test data, and suite data by the selected suite |
| Keyword | Keyword, Use Library Names | Keyword data |

Data the section filters do not relate to (runs and exceptions, or keywords in the Test section) is not affected. The *Filters affect top graphs* switch of a section belongs to the built-in graphs and does not change custom graphs.

### Heatmap

A heatmap shows the X axis as columns, the split by as rows and the metric as the colour of each cell, e.g. tests (split by test name) per run with the *Failed* metric. It needs both an X axis and a split by, and shows up to 50 rows. With a count metric (count, failed, flips, …) rows that are 0 everywhere are left out, so a failure heatmap only lists tests that failed. Failures are drawn red, skips yellow, the pass rate from red to green and every other metric blue; small heatmaps print the value in every cell. The rows are sorted from the highest total down.

### Order and limit

*Automatic* sorts a run or date axis chronologically and keeps the most recent values when a limit is set; any other axis is ranked from highest to lowest value. A ranking of counts (most failed, most flaky) leaves out the items with a value of 0. The other orders are *highest value first*, *lowest value first* and *alphabetical*.

With a split by, values that add up are ranked on their total, and the other metrics (average, percentiles, pass rate, …) on the average of the series.

## Working with custom graphs

In **Customize view** mode every custom graph has buttons to **edit** (pencil), **duplicate**, **copy graph definition** (copies the graph as JSON to the clipboard), move to first/last and **remove** it. Adding, editing, duplicating and removing can be undone with the undo button.

Outside Customize view mode a custom graph has two buttons:

- **Show data / graph** switches between the chart and a table with the numbers behind it.
- **Fullscreen** shows the graph over the whole window. A graph with a limit shows five times as many values in fullscreen (a top 10 becomes a top 50), like the built-in graphs. A graph that follows the section filters takes them along into fullscreen. Close it with the close button or Escape.

Clicking a bar or point of a graph with runs on the X axis opens the log of that run, like the built-in graphs.

## Sharing graphs as JSON

The **JSON** tab of the builder shows the graph definition. Paste a definition someone else copied to get the same graph. Invalid JSON or unknown fields are reported below the text area and block saving.

```json
{
  "v": 1,
  "title": "Smoke tests per run",
  "source": "tests",
  "where": [{ "field": "tags", "op": "has", "value": "smoke" }],
  "x": { "field": "run" },
  "series": { "field": "status" },
  "metric": { "agg": "count" },
  "order": "auto",
  "limit": 0,
  "viz": { "type": "stacked_bar", "percent": false },
  "useGlobalFilters": true,
  "useSectionFilters": false
}
```

Custom graphs are stored in localStorage under `customGraphs` and are part of the settings JSON, so they can be shipped to a whole team with [`--jsonconfig` / `--forcejsonconfig`](settings.md). A graph in a JSON config may leave out `id` and `section`: it is then placed in the Run section and given an id when the dashboard loads.

`v` is the version of the graph definition. A definition with a higher version than the dashboard knows was made with a newer dashboard and is not drawn; the tile says so instead.
