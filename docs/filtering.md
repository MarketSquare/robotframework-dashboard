---
outline: deep
---

# Filtering

RobotFramework Dashboard provides flexible filtering options across different pages. This guide explains all filter types, how they interact, and how to use them to narrow down test data efficiently.

> Each filter label in the Filters modal has an **ⓘ info icon** next to it. Hovering over it shows a short description of what that filter does and any special behaviour.

## Overview Page

The **Overview** page uses the same **global filters** as the Dashboard page (see below): open the filter modal from the top navigation bar and every project bar, the Latest Runs bar and the Total Stats bar reflect the filtered set of runs. A dot on the filter icon indicates a filter is active.

Two things behave differently here, because the Overview is meant to show *all* your projects:

- The **[Amount filter](#_8-amount-per-project) is applied per project**, so a project that runs less often never disappears behind the runs of a project that runs more often.
- Clicking a **project card** filters the Dashboard to that single project. Navigating **back to the Overview** drops that filter again so all projects are shown. Filters you changed yourself in the filter modal are kept.

In addition, the Overview offers a few **display settings** under **Settings > Overview**:

- **Projects by Name** – Toggle whether to display the names of projects in the statistics.
- **Projects by Tag** – Toggle whether to use custom project tags if defined in your test run metadata. (See [Advanced CLI & Examples](advanced-cli-examples.md#project-tagging) for more information on Tags!)
- **Duration comparison percentage** – Adjust the percentage threshold used to color-code durations (faster/slower runs).

> These settings affect only the way the statistics are presented on the Overview page.

## Dashboard Page

The **Dashboard** page provides both **global filters** and **section-specific filters**.

### Global Filters

Global filters are applied to the entire dashboard, affecting all sections and graphs. Open the filter modal using the filter icon in the top navigation bar.

#### Run Counts and Unavailable Options

Every option of the Runs, Run Tags, Versions, Metadata and Custom Filters dropdowns shows how many runs it still matches:

- The number behind an option is calculated with **all other filters applied**, so it tells you what you get if you select that option. The Amount filter ("most recent X runs") is not included, as it is not a category.
- The count of a filter **ignores that filter itself**. Selecting one Run Tag therefore never changes the counts of the other Run Tags, and they never disappear from the list.
- A count always answers the same question: *how many runs remain if this option is the selection of this filter*. In **NOT** mode an option excludes its runs, so its count is what is left over.
- Options that match no runs at all are **greyed out**. They stay visible and can still be selected (the dashboard then simply shows no runs), so you never lose sight of the values in your data.
- A custom filter that is hidden on the current page (see [Settings - Filters Tab](/settings#filter-settings-filters-tab)) is not applied there, so it does not count towards the numbers of the other filters either.
- Both can be turned off in [Settings](settings.md): *Display Run Counts in Filter Options* and *Grey Out Filter Options Without Runs*.

Example: with two custom filters where `filter_1=A` only ever occurs together with `filter_2=C`, selecting `filter_1=A` shows `filter_2=D (0)` greyed out, because no run has that combination.

#### 1. Runs

- Filters the dashboard to only show data for runs of the selected project (run name).
- **All** (default) shows runs from every project.
- Each option in the dropdown corresponds to a distinct run name present in the data.

#### 2. Run Tags

- Filters runs by their assigned tags. Only runs matching the selected tag mode are included.
- Click **Select Tags** to open the tag list; tick one or more tags to activate the filter.
- **All** (ticked by default) means no tag filter is applied — all runs are shown.
- Use the **Tag Mode** dropdown to control how selected tags are matched:
  - **AND** (default): a run must have **all** selected tags to be included.
  - **OR**: a run needs at least **one** of the selected tags.
  - **NOT**: a run must **not** have any of the selected tags (useful for excluding specific tags from a large set).
- A dot next to the label indicates the filter is active (i.e. *All* is not selected).
- Use the search box inside the dropdown to quickly find a tag by name.

#### 3. Versions

- Filters runs by their project version label.
- Click **Select Versions** to open the version list; tick one or more versions to narrow down the data.
- **All** (ticked by default) means no version filter is applied.
- **None** covers runs that have no version label set.
- A dot next to the label indicates the filter is active.
- Typing in the search box inside the dropdown selects every matching version and unselects the rest (e.g. `1.` selects all `1.x` versions in one go).
- Click the **X** in the search box to clear it while keeping the current selection. Deleting characters one by one instead re-runs the matching on every keystroke.

#### 4. Runs over Time (date histogram)

A bar chart of how many runs started in each time bucket, sitting directly above the date range. It replaces typing dates with dragging, the way Grafana and Kibana let you pick a time range.

- **Bars** show the number of runs per bucket, stacked by run status: red for runs with failures, yellow for runs that only skipped, green for the rest. Vertical separators mark every bucket, so gaps in the data stay readable.
- **Drag across the chart** to select a range. The From/To fields below are filled in and the chart **zooms into the selection**, re-bucketing finer, so dragging again drills further down (a month at a bar per day, then a week at a bar per 6 hours, then a day at a bar per hour).
- **Click a single bar** to select just that bucket.
- **Reset Range** returns to the full span of the data. Widening the From/To fields by hand does the same.
- The bucket size is chosen from the visible range and is printed next to the chart as `1 bar = 1 day`. Hovering a bar shows its exact time range and, per run in it, how many tests passed, failed and were skipped — the same shape as the hover on the run graphs.
- The bars follow every other filter (runs, run tags, versions, metadata, custom filters, suite path) but not the date range itself — the date range is the part of the timeline you are looking at, which is why widening it brings the runs outside it straight back. The *Amount per project* filter is not applied to the bars either.

#### 5. From / To Date and Time

The four fields below the chart are the range itself, and they stay editable by hand.

- **From Date / From Time** set the earliest point in time a run must have started at to be included; runs that started before it are excluded.
- **To Date / To Time** set the latest point in time; runs that started after it are excluded.
- They default to the oldest and most recent run in the data (with a small margin to account for seconds and daylight saving time), which is also what **Reset Range** restores.
- Typing in them moves the histogram above, exactly like dragging moves them.

#### 6. Metadata

- Only visible when at least one run has metadata attached.
- Filters runs by a metadata value attached to the run.
- **All** (default) shows runs regardless of metadata.
- Selecting a specific value limits the view to runs that carry that metadata entry.
- Metadata is collected from the `Metadata` setting in your Robot Framework test suites:
  ```
  *** Settings ***
  Metadata    Browser    Chrome
  Metadata    Environment    Staging
  ```

#### 7. Custom Filters

- Only visible when at least one run has custom filter data attached (added via `--customfilters` at import time or via the server/listener).
- Each unique **key** from the `key=value` pairs becomes its own filter dropdown.
- **All** (ticked by default) means no filter is applied for that dimension.
- **None** covers runs that have no value stored for that key.
- Use the **Mode** dropdown to control matching: **OR** (default), **AND**, or **NOT**.
- A dot next to the label indicates the filter is active.
- Custom filter values are also printed on the Overview run cards, one `key: value` line per attribute the run has.
- Attributes you do not want can be hidden per page under **Settings → Filters**; a hidden attribute gets no dropdown here and is not applied on that page. See [Settings - Filters Tab](/settings#filter-settings-filters-tab).
- See [Advanced CLI & Examples](/advanced-cli-examples#custom-filters) for how to attach custom filter data to runs.

#### 8. Amount per project

- After all other filters have been applied, limits the dashboard to the **most recent X runs per project**.
- A project is a run name and every `project_` run tag, the same grouping the [Overview page](/tabs-pages#overview-page) uses.
- The limit is **not** applied to the combined run list. A run is kept as long as it is one of the most recent X runs of at least one of its projects, which means the total number of shown runs can be higher than X.
- Because of this, a project that runs less often is never pushed out of the Overview (or the Dashboard) by a project that runs more often.
- Use **All Runs** to set the value to the total number of runs currently matching the other filters, which shows every run of every project.
- Useful for focusing on recent history without changing the date filters.

#### 8. Suite Path

- Filters the dashboard to only include runs that contain at least one suite whose path matches the selected path (or any sub-path beneath it).
- **All** (default) disables the path filter — all runs are shown.
- The filter displays a **breadcrumb navigator**: the current path is shown as a breadcrumb trail, and the immediate children are shown as clickable buttons below it.
  - Click a **child button** to drill down into that sub-folder or suite.
  - Click any **breadcrumb segment** to jump back up to that level.
- After the run filter is applied, suites and tests are also narrowed to only those matching the selected path prefix — so all graphs and tables reflect only the chosen path.
- A dot next to the label indicates the filter is active.
- The Suite Path filter is applied after all other run-level filters but before the Amount limit, so "most recent X runs per project" always refers to runs that contain the selected path.

### Filter Profiles

Filter Profiles let you save, name, and reapply a combination of filter settings in one click.

#### Creating a Profile

1. Set your desired filters in the Filters modal.
2. Click **Add Profile** — the profile editor appears.
   - A checkbox is shown next to each filter. Checkboxes are pre-filled based on which filters currently differ from their default (dashboard-load) state, but you can toggle them freely.
   - Checked filters will be saved as part of the profile; unchecked filters are ignored.
3. Enter a name in the **Profile Name** field.
4. Click **Save Profile**.

#### Applying a Profile

- Click the **Apply Filter Profile** selector to expand the saved profiles list.
- Click a profile name to apply all its stored filter values at once.
- The selector displays the active profile name when the current filter state **exactly matches** a saved profile.
- A dot next to the selector means a profile was applied but filters have since been changed away from it.

#### Updating a Profile

- After applying a profile and modifying filters, the **Update Profile** button appears.
- Click it to overwrite the saved profile with the current filter values.

#### Deleting a Profile

- In the profile list, click the **×** next to a profile name.
- A confirmation prompt prevents accidental deletion.

#### Merging Profiles

The **Merge Profiles** button (in the Filters modal header) opens a dedicated modal for combining filter settings from two saved profiles into a new one.

**Layout of the merge modal:**
- A **Profile Name** field and **Add Merged Profile** button sit directly below the title bar.
- Below that, two columns let you independently choose a **Left Profile** and a **Right Profile**.
- Once a profile is selected in a column, its individual filter settings appear as a checklist. Each row is pre-checked; uncheck any row to exclude that setting from the merge.
- A **Resulting Filters** section at the bottom shows a live preview of what the merged profile will contain, updating instantly as you change selections or toggle checkboxes.

**Merge rules** — when the same filter field is checked in both columns, the values are combined as follows:

| Filter | Rule |
|---|---|
| **Run Tags** / **Versions** | Union of all checked entries (OR) |
| **Use OR Tags** | OR wins (more permissive) |
| **Custom Filters** | Union of all checked entries per dimension (OR) |
| **From Date / Time** | The earlier value is kept (widest horizon) |
| **To Date / Time** | The later value is kept (widest horizon) |
| **Amount** | The larger value is kept |
| **Runs** / **Metadata** | Kept if both sides have the same value; otherwise resets to **All** |

Fields checked on only one side pass through unchanged.

You can also use this modal with only one column selected to quickly create a copy of an existing profile under a new name, with any settings individually removed.

### Section Filters on Dashboard

The Dashboard is divided into four sections: **Run, Suite, Test, Keyword**. Each section has specific filtering options that apply only to that section.

#### Run Section
- No additional section-specific filters.

#### Suite Section
- **Folder Filter (Donut Chart)** – Click on folder donuts to "zoom in" on specific suites. Affects the Suite Statistics and Suite Duration graphs.
- **Suite Selection Dropdown** – Choose a specific suite or all suites.
- **Full Suite Paths Toggle** – When enabled, shows the full suite path instead of only the suite name. Useful when duplicate suite names exist in different folders.
- **Filters affect top graphs Toggle** – When enabled, the active suite and folder filters also apply to the Most Failed and Most Time Consuming graphs. When disabled, those graphs always show data across all suites regardless of the selection.

#### Test Section
- **Suite Filter** – Select one or multiple suites from a dropdown.
- **Suite Paths Toggle** – Same logic as the Suite section; allows distinguishing duplicate suite names.
- **Test Selection Dropdown** – Zoom in on a specific test.
- **Test Tag Dropdown** – Filter tests by tags.
- **Filters affect top graphs Toggle** – When enabled, the active suite, test, and tag filters also apply to the Most Failed, Most Flaky, Most Time Consuming, and Error Messages graphs. When disabled, those graphs always show data across all tests regardless of the selection.

#### Keyword Section
- **Keyword Dropdown** – Select a specific keyword to zoom in on.
- **Library Names Toggle** – Include library names in the keyword selection dropdown.
- **Filters affect top graphs Toggle** – When enabled, the active keyword filter also applies to the Most Failed, Most Time Consuming, and Most Used graphs. When disabled, those graphs always show data across all keywords regardless of the selection.

## Compare Page

The **Compare** page is designed to compare runs side by side:

- **Run Selection Dropdowns** – Select up to **4 runs** to compare.
- **Suite Paths Toggle** – Apply full suite path logic to graphs to distinguish duplicate suite names.

> The Compare page does not use global filters; it relies only on the selected runs and the optional suite path toggle.

## Tables Page

The **Tables** page allows for detailed inspection of raw test data and uses the same global filters as the Dashboard page:

- Runs
- Run Tags
- Versions
- From / To Date & Time
- Metadata
- Custom Filters
- Amount

> These filters let you zoom into specific runs, suites, tests, or keywords for precise analysis of raw data in the tables.

## Summary

| Page | Filter support |
|------|---------------|
| **Overview** | Same global filters as Dashboard + display settings (name, tag, duration threshold) |
| **Dashboard** | Full global filters + section-specific filters + Filter Profiles |
| **Compare** | Run selection dropdowns + suite paths toggle |
| **Tables** | Same global filters as Dashboard |

> By combining global filters, section-specific filters, and saved filter profiles, you can quickly focus on the most relevant parts of your test data and identify trends, failures, or performance issues.
