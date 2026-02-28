---
outline: deep
---

# Graphs & Tables

Discover the graphs and tables included in the Dashboard. This page explains how each visualization works, the data it represents, and the filtering or interaction options available.

## Overview Tab

The Overview tab provides a high-level summary of all test runs across projects. It consists of special sections and a statistics graph. The visibility of each element can be controlled via [Settings - Overview Tab](/settings#overview-settings-overview-tab).

### Sections

| Section | Description |
|---------|-------------|
| **Latest Runs** | Displays the most recent run for each project as a card. Each card shows pass/fail/skip counts and duration, color-coded to indicate performance relative to previous runs. Clicking a project card filters the Overview to that project. |
| **Total Stats** | Shows aggregate statistics across all runs grouped by project: total passed, failed, skipped runs, average duration, and average pass rate. |

### Graphs

| Graph Name          | Views       | Views Description                                                                                                | Notes |
| ------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------- | ----- |
| Run Donut           | Percentages | Displays the distribution of passed, failed, skipped tests per run.                                              | -     |

### Display Toggles

The Overview page supports several display toggles (configured in [Settings - Overview Tab](/settings#overview-settings-overview-tab)):

| Toggle | Description |
|--------|-------------|
| **Projects by Name** | Groups runs by their project name. |
| **Projects by Tag** | Groups runs by `project_` tags instead of name. See [Project Tagging](/advanced-cli-examples#project-tagging). |
| **Prefixes** | Shows or hides the `project_` prefix text on tag-based names. |
| **Percentage Filters** | Enables the duration percentage threshold control for color-coding. |
| **Version Filters** | Enables per-project version filtering with checkbox selectors. |
| **Sort Filters** | Enables sort controls on the Overview page. |

## Dashboard Tab

### Run Section
| Graph Name     | Views                         | Views Description                                                                                                                                                                                                                                        | Notes |
| -------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| Run Statistics | Percentages<br>Amount<br>Line | Percentages: Displays the distribution of passed, failed, skipped tests per run.<br>Amount: Displays the actual number of passed, failed, skipped tests per run.<br>Line: Displays the same data over a time axis, useful for spotting failure patterns. | -     |
| Run Donut      | Donut                         | Two donut charts: first for the most recent run, second for totals across all runs.                                                                                                                                                                      | -     |
| Run Duration   | Bar<br>Line                   | Bar: Displays total run durations represented as vertical bars.<br>Line: Displays run durations over a time axis for trend analysis.                                                                                                                     | -     |
| Run Heatmap    | Heatmap<br>Status<br>Hour     | Heatmap: Shows how many tests ran during hours/minutes of weekdays.                                                         | Status: Filters to display only tests with the selected status.<br>Hour: Zoom in on a specific hour to see activity per minute.    |
| Run Stats | Stats                              | High-level summary of projects and associated runs, including duration, pass rates, and custom project grouping.                                                                                                                                         | -     |


### Suite Section

| Graph Name                | Views                         | Views Description                                                                                                                                                                                              | Notes                                                                                      |
| ------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Suite Folder Donut        | Donut                         | First donut: top-level folders and number of tests.<br>Second donut: only most recent run, failed tests.<br>Clicking navigates subfolders.                                                                     | Go Up, Only Failed Tests                                                                   |
| Suite Statistics          | Percentages<br>Amount<br>Line | Percentages: Displays pass/fail/skip rate of test suites per run.<br>Amount: Displays actual number of passed, failed, skipped suites per run.<br>Line: Displays suite statistics over a time axis for trends. | -                                                                                          |
| Suite Duration            | Bar<br>Line                   | Bar: Shows total suite durations represented as vertical bars.<br>Line: Shows suite durations over a time axis for trend analysis.                                                                             | -                                                                                          |
| Suite Most Failed         | Bar<br>Timeline               | Bar: Ranks suites by number of failures.<br>Timeline: Shows when failures occurred over time.                                                                                                                  | Top 10 default, Top 50 fullscreen                                                          |
| Suite Most Time-Consuming | Bar<br>Timeline               | Bar: Displays suites ranked by how often they were the slowest (most time-consuming) suite in a run.<br>Timeline: Displays the slowest suite for each run on a timeline.                                       | Top 10 default, Top 50 fullscreen; "Only Last Run" option for showing only latest run data |

### Test Section

| Graph Name               | Views                    | Views Description                                                                                                                  | Notes                                                                         |
| ------------------------ | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Test Statistics          | Timeline<br>Line | Timeline: Displays statistics of tests in timeline format.<br>Line: Displays test results as a scatter plot with a timestamp-based x-axis and one row per test, colored by status (pass/fail/skip). Useful for spotting patterns across many runs.  | Status: Displays only tests that don't have any status changes and have the selected status.<br>Only Changes: Displays only tests that changed status at some point.<br>Tip: Don't use Status and Only Changes at the same time as it will result in an empty graph.                                        |
| Test Duration            | Bar<br>Line              | Bar: Displays test durations represented as vertical bars.<br>Line: Displays test durations over a time axis.                      | -                                                                             |
| Test Duration Deviation  | Boxplot                  | Shows deviations of test durations from average, highlighting flaky tests.                                                         | -                                                                             |
| Test Messages            | Bar<br>Timeline          | Bar: Displays messages ranked by frequency.<br>Timeline: Displays when messages occurred to reveal spikes.                         | Top 10 default, Top 50 fullscreen                                             |
| Test Most Flaky          | Bar<br>Timeline          | Bar: Tests ranked by frequency of status changes.<br>Timeline: Shows when status changes occurred over runs.                       | Top 10 default, Top 50 fullscreen, Ignore Skips option                        |
| Test Recent Most Flaky   | Bar<br>Timeline          | Bar: Recent tests ranked by frequency of status changes.<br>Timeline: Shows when recent status changes occurred.                   | Top 10 default, Top 50 fullscreen, Ignore Skips option                        |
| Test Most Failed         | Bar<br>Timeline          | Bar: Tests ranked by total number of failures.<br>Timeline: Displays when failures occurred across runs.                           | Top 10 default, Top 50 fullscreen                                             |
| Test Recent Most Failed  | Bar<br>Timeline          | Bar: Recent tests ranked by total number of failures.<br>Timeline: Shows when most recent failures occurred.                       | Top 10 default, Top 50 fullscreen                                             |
| Test Most Time-Consuming | Bar<br>Timeline          | Bar: Ranked by how often a test was the slowest in a run.<br>Timeline: Slowest test per run shown on timeline.                     | Top 10 default, Top 50 fullscreen; "Only Last Run" option for latest run only |

### Keyword Section

| Graph Name                  | Views                         | Views Description                                                                                                          | Notes                                                                         |
| --------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Keyword Statistics          | Percentages<br>Amount<br>Line | Percentages: Displays pass/fail/skip rate per run.<br>Amount: Shows raw counts.<br>Line: Displays keyword stats over time. | -                                                                             |
| Keyword Times Run           | Bar<br>Line                   | Bar: Number of times each keyword ran per run.<br>Line: Keyword execution counts over a time axis.                         | -                                                                             |
| Keyword Total Duration      | Bar<br>Line                   | Bar: Cumulative time each keyword ran per run.<br>Line: Displays cumulative keyword durations over time.                   | -                                                                             |
| Keyword Average Duration    | Bar<br>Line                   | Bar: Shows average duration per keyword.<br>Line: Displays average duration over a time axis.                              | -                                                                             |
| Keyword Min Duration        | Bar<br>Line                   | Bar: Displays minimum durations per keyword.<br>Line: Minimum durations over a time axis.                                  | -                                                                             |
| Keyword Max Duration        | Bar<br>Line                   | Bar: Displays maximum durations per keyword.<br>Line: Maximum durations over a time axis.                                  | -                                                                             |
| Keyword Most Failed         | Bar<br>Timeline               | Bar: Keywords ranked by total failures.<br>Timeline: Shows when failures occurred across runs.                             | Top 10 default, Top 50 fullscreen                                             |
| Keyword Most Time-Consuming | Bar<br>Timeline               | Bar: Ranked by how often a keyword was the slowest in a run.<br>Timeline: Slowest keyword per run on timeline.             | Top 10 default, Top 50 fullscreen; "Only Last Run" option for latest run only |
| Keyword Most Used           | Bar<br>Timeline               | Bar: Ranked by how frequently keywords were used.<br>Timeline: Shows keyword usage trends over time.                       | Top 10 default, Top 50 fullscreen; "Only Last Run" option for latest run only |


## Compare Tab
| Graph Name             | Views                    | Views Description                                                     | Notes                                  |
| ---------------------- | ------------------------ | ----------------------------------------------------------------------| -------------------------------------- |
| Compare Statistics     | Bar                      | Displays overall statistics of the selected runs.                     | -                                      |
| Compare Suite Duration | Radar                    | Shows suite durations in radar format for multiple runs.              | -                                      |
| Compare Tests          | Timeline                 | Timeline: Displays test statistics over time.                         | Status: Displays only tests that don't have any status changes and have the selected status.<br>Only Changes: Displays only tests that changed status at some point.<br>Tip: Don't use Status and Only Changes at the same time as it will result in an empty graph. |


## Tooltips

Many graphs include enhanced tooltips that display additional information when hovering over data points:

- **Run Statistics & Run Duration**: Tooltips show total run duration and pass/fail/skip status.
- **Suite Statistics & Suite Duration**: Tooltips show suite duration and pass/fail/skip status.
- **Test Statistics (Timeline)**: Tooltips show the run label, test status, duration, and failure messages (if any).
- **Test Statistics (Line)**: Tooltips show the test name, status, run start, duration, and failure messages.
- **Test Duration**: Tooltips show the test status and failure messages.
- **Compare Tests**: Tooltips show the run label, test status, duration, and failure messages.

These enhanced tooltips make it easier to understand test results without needing to navigate to individual log files.

## Tables Tab
| Table Name | Columns                                                                                                                     | Description                                                                   | Notes |
| ---------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----- |
| Runs       | run_start, full_name, name, total, passed, failed, skipped, elapsed_s, start_time, tags, run_alias, path, metadata          | Contains run-level data.                                                      | -     |
| Suites     | run_start, full_name, name, total, passed, failed, skipped, elapsed_s, start_time, run_alias, id                            | Contains suite-level data.                                                    | -     |
| Tests      | run_start, full_name, name, passed, failed, skipped, elapsed_s, start_time, message, tags, run_alias, id                    | Contains test-level data.                                                     | -     |
| Keywords   | run_start, name, passed, failed, skipped, times_run, total_time_s, average_time_s, min_time_s, max_time_s, run_alias, owner | Contains keyword-level data.                                                  | -     |
