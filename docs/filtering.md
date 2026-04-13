---
outline: deep
---

# Filtering

RobotFramework Dashboard provides flexible filtering options across different pages. This guide explains all filter types, how they interact, and how to use them to narrow down test data efficiently.

> Each filter label in the Filters modal has an **ⓘ info icon** next to it. Hovering over it shows a short description of what that filter does and any special behaviour.

## Overview Page

The **Overview** page does not have global filters. However, it offers a few **display settings**:

- **Display By Name** – Toggle whether to display the names of projects in the statistics.
- **Display By Tag** – Toggle whether to use custom project tags if defined in your test run metadata. (See [Advanced CLI & Examples](advanced-cli-examples.md#project-tagging) for more information on Tags!)
- **Duration Percentage Threshold** – Adjust the percentage threshold used to color-code durations (faster/slower runs).
- **Select Versions** – Filter the displayed runs by their associated versions.

> These settings affect only the way the statistics are presented on the Overview page.

## Dashboard Page

The **Dashboard** page provides both **global filters** and **section-specific filters**.

### Global Filters

Global filters are applied to the entire dashboard, affecting all sections and graphs. Open the filter modal using the filter icon in the top navigation bar.

#### 1. Runs

- Filters the dashboard to only show data for runs of the selected project (run name).
- **All** (default) shows runs from every project.
- Each option in the dropdown corresponds to a distinct run name present in the data.

#### 2. Run Tags

- Filters runs by their assigned tags. Only runs that have at least one matching tag are included.
- Click **Select Tags** to open the tag list; tick one or more tags to activate the filter.
- **All** (ticked by default) means no tag filter is applied — all runs are shown.
- **AND mode** (default): a run must have **all** selected tags to be included.
- **OR mode** (toggle *Use OR*): a run needs at least **one** of the selected tags.
- A dot next to the label indicates the filter is active (i.e. *All* is not selected).
- Use the search box inside the dropdown to quickly find a tag by name.

#### 3. Versions

- Filters runs by their project version label.
- Click **Select Versions** to open the version list; tick one or more versions to narrow down the data.
- **All** (ticked by default) means no version filter is applied.
- **None** covers runs that have no version label set.
- A dot next to the label indicates the filter is active.
- Use the search box inside the dropdown to quickly find a version by name.

#### 4. From Date / From Time

- Sets the earliest point in time a run must have started at to be included.
- Runs that started before this date and time are excluded.
- Defaults to the date and time of the oldest run in the data (with a small margin to account for seconds and daylight saving time).

#### 5. To Date / To Time

- Sets the latest point in time a run must have started at to be included.
- Runs that started after this date and time are excluded.
- Defaults to the date and time of the most recent run in the data (with a small margin).

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

#### 7. Amount

- After all other filters have been applied, limits the dashboard to the **most recent X runs**.
- Use **All Runs** to set the value to the total number of runs currently matching the other filters.
- Useful for focusing on recent history without changing the date filters.

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

#### Test Section
- **Suite Filter** – Select one or multiple suites from a dropdown.
- **Suite Paths Toggle** – Same logic as the Suite section; allows distinguishing duplicate suite names.
- **Test Selection Dropdown** – Zoom in on a specific test.
- **Test Tag Dropdown** – Filter tests by tags.

#### Keyword Section
- **Keyword Dropdown** – Select a specific keyword to zoom in on.
- **Library Names Toggle** – Include library names in the keyword selection dropdown.

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
- Amount

> These filters let you zoom into specific runs, suites, tests, or keywords for precise analysis of raw data in the tables.

## Summary

| Page | Filter support |
|------|---------------|
| **Overview** | Display-only settings (name, tag, duration threshold, versions) |
| **Dashboard** | Full global filters + section-specific filters + Filter Profiles |
| **Compare** | Run selection dropdowns + suite paths toggle |
| **Tables** | Same global filters as Dashboard |

> By combining global filters, section-specific filters, and saved filter profiles, you can quickly focus on the most relevant parts of your test data and identify trends, failures, or performance issues.
