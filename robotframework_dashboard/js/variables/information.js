const informationMap = {
    "rflogo": "Robot Framework",
    "filters": "Filters",
    "customizeLayout": "Customize Layout",
    "saveLayout": "Save Layout",
    "undoLayout": "Undo Layout Change",
    "redoLayout": "Redo Layout Change",
    "settings": "Settings",
    "themeLight": "Theme",
    "themeDark": "Theme",
    "database": "Database Summary",
    "versionInformation": '"placeholder_version"',
    "bug": "Report a bug or request a feature",
    "github": "Github",
    "docs": "Docs",
    "amount": "Amount of runs that are shown. Only the most recent x runs are shown after applying the other filters.",
    "amountLabel": "Amount of runs that are shown. Only the most recent x runs are shown after applying the other filters.",
    "overviewTotalInformation": `Shows aggregate statistics across all projects:
- Passed/Failed/Skipped Runs: total counts by status
- Average Duration: mean across all runs
- Average Pass Rate: mean pass rate across all runs
See Settings > Overview for display options.`,
    "overviewLatestInformation": "Shows the latest run per project. Click a card to apply a project filter and open the dashboard.",
    "overviewLatestPercentageInfo": "Duration color threshold: green if the run is at least X% faster than average, red if X% slower.",
    "overviewLatestVersionsInfo": "Filter overview cards by project version. 'All' shows all versions.",
    "overviewLatestSortInfo": "Sort project cards by: Most Recent, Oldest, Most Failed, Most Skipped, or Most Passed.",
    "unifiedStatisticsInformation": `Unified view combining data from all projects into one dashboard.
- Use the top filters to focus on specific projects, versions, or timeframes.
- Use the section filters to drill down into suites, tests, or keywords.
- Use 'Customize Layout' to choose which graphs are shown and their order.`,
    "suiteStatisticsInformation": `Suite section: statistics, duration and folder charts for all suites.`,
    "suiteSectionFolderFilter": "Click any row in the folder chart to drill down into that folder. Shows the active folder filter.",
    "suiteSectionSuiteFilter": "Select a specific suite to focus the statistics and duration graphs. 'All' shows all suites.",
    "suiteSectionPathsFilter": "Show full suite paths instead of just suite names — useful when duplicate names exist across different folders.",
    "testStatisticsInformation": `Test section: statistics, duration and deviation charts per test.`,
    "testSectionSuiteFilter": "Filter tests to those in the selected suite. Applies to Statistics, Duration and Duration Deviation graphs.",
    "testSectionPathsFilter": "Show full suite paths instead of just suite names — useful when duplicate names exist across different folders.",
    "testSectionTestFilter": "Zoom in on a specific test. Applies to Statistics, Duration and Duration Deviation graphs.",
    "testSectionTagFilter": "Filter tests by tag. Applies to Statistics, Duration and Duration Deviation graphs.",
    "keywordStatisticsInformation": `Keyword section: statistics and duration charts per keyword.`,
    "keywordSectionKeywordFilter": "Zoom in on a specific keyword. Applies to Statistics, Times Run, and all Duration graphs.",
    "keywordSectionLibNamesFilter": "Include the library name as a prefix in the keyword dropdown.",
    "runStatisticsGraphPercentages": "Percentages: Displays the distribution of passed, failed, skipped tests per run, where 100% equals all tests combined",
    "runStatisticsGraphAmount": "Amount: Displays the actual number of passed, failed, skipped tests per run",
    "runStatisticsGraphLine": "Line: Displays the same data but over a time axis, useful for spotting failure patterns on specific dates or times",
    "runDonutGraphDonut": `This graph contains two donut charts:
- The first donut displays the percentage of passed, failed, and skipped tests for the most recent run..
- The second donut displays the total percentage of passed, failed, and skipped tests across all runs`,
    "runStatsGraphStats": `Key statistics across all runs:
- Executed: total counts of Runs, Suites, Tests, and Keywords.
- Unique Tests: distinct test cases across all runs.
- Outcomes: total Passed, Failed, Skipped with percentages.
- Duration: cumulative runtime, average per run, and average per test.
- Pass Rate: average run-level pass rate over time.`,
    "runDurationGraphBar": "Bar: Displays total run durations represented as vertical bars",
    "runDurationGraphLine": "Displays the same data but over a time axis for clearer trend analysis",
    "runHeatmapGraphHeatmap": `Heatmap of when tests are executed:
- All: tests run during each hour/minute of the week.
- Status: only tests with the selected status.
- Hour: zoom into a specific hour for per-minute detail.`,
    "suiteFolderDonutGraphDonut": `Two donut charts for suite folders:
- First donut: top-level folders and the number of tests each contains.
- Second donut: same structure but only for the most recent run's failed tests.
- Click a folder slice to zoom into its subfolders/suites.
- Navigating also updates Suite Statistics and Suite Duration.
- Go Up: navigate to the parent folder level.
- Only Failed: show only folders with failing tests.`,
    "suiteStatisticsGraphPercentages": "Percentages: Displays the passed, failed, skipped rate of test suites per run",
    "suiteStatisticsGraphAmount": "Amount: Displays the actual number of passed, failed, skipped suites per run",
    "suiteStatisticsGraphLine": "Line: Displays the same data but over a time axis, useful for spotting failure patterns on specific dates or times",
    "suiteDurationGraphBar": "Bar: Displays total suite durations represented as vertical bars",
    "suiteDurationGraphLine": "Line: Displays the same data but over a time axis for clearer trend analysis",
    "suiteMostFailedGraphBar": "Bar: Displays suites ranked by number of failures represented as vertical bars. The default view shows the Top 10 most failed suites; fullscreen expands this to the Top 50.",
    "suiteMostFailedGraphTimeline": "Timeline: Displays when failures occurred to identify clustering over time. The default view shows the Top 10 most failed suites; fullscreen expands this to the Top 50",
    "suiteMostTimeConsumingGraphBar": "Bar: suites ranked by how often they were the slowest suite in a run (Top 10; Top 50 in fullscreen). When 'Only Last Run' is on, shows the Top 10/50 slowest suites in the latest run by duration.",
    "suiteMostTimeConsumingGraphTimeline": "Timeline: the slowest suite per run over time (Top 10; Top 50 in fullscreen). When 'Only Last Run' is on, shows the latest run's slowest suites.",
    "testStatisticsGraphTimeline": `Timeline of test statuses across runs.
- Status: show only tests with the selected status and no changes.
- Only Changes: show only tests whose status changed at some point.
Tip: avoid using Status and Only Changes together — the result will be empty.`,
    "testStatisticsGraphLine": `Scatter: test results as dots on a time axis, one row per test.
- Green = passed, red = failed, yellow = skipped.
- Horizontal spacing is proportional to actual time between executions.
- Hover a dot to see test name, status, run, duration, and failure message.
- Useful for spotting failures clustered at the same timestamp.
- Status and Only Changes filters apply here too.`,
    "testDurationGraphBar": "Bar: Displays test durations represented as vertical bars",
    "testDurationGraphLine": "Line: Displays the same data but over a time axis for clearer trend analysis",
    "testDurationDeviationGraphBar": `This boxplot chart displays how much test durations deviate from the average, represented as vertical bars.
It helps identify tests with inconsistent execution times, which might be flaky or worth investigating`,
    "testMessagesGraphBar": `Bar: Displays messages ranked by number of occurrences represented as vertical bars
- The regular view shows the Top 10 most frequent messages; fullscreen mode expands this to the Top 50.
- To generalize messages (e.g., group similar messages), use the -m/--messageconfig option in the CLI (--help or README).`,
    "testMessagesGraphTimeline": `Timeline: Displays when those messages occurred to reveal problem spikes
- The regular view shows the Top 10 most frequent messages; fullscreen mode expands this to the Top 50.
- To generalize messages (e.g., group similar messages), use the -m/--messageconfig option in the CLI (--help or README).`,
    "testMostFlakyGraphBar": `Bar: Displays tests ranked by frequency of status changes represented as vertical bars
- The regular view shows the Top 10 flaky tests; fullscreen mode expands the list to the Top 50.
- Ignore Skips: filters to only count passed/failed as status flips and not skips.`,
    "testMostFlakyGraphTimeline": `Timeline: Displays when the status changes occurred across runs
- The regular view shows the Top 10 flaky tests; fullscreen mode expands the list to the Top 50.
- Ignore Skips: filters to only count passed/failed as status flips and not skips.`,
    "testRecentMostFlakyGraphBar": `Bar: Displays tests ranked by frequency of recent status changes represented as vertical bars
- The regular view shows the Top 10 flaky tests; fullscreen mode expands the list to the Top 50.
- Ignore Skips: filters to only count passed/failed as status flips and not skips.`,
    "testRecentMostFlakyGraphTimeline": `Timeline: Displays when the status changes occurred across runs
- The regular view shows the Top 10 flaky tests; fullscreen mode expands the list to the Top 50.
- Ignore Skips: filters to only count passed/failed as status flips and not skips.`,
    "testMostFailedGraphBar": `Bar: Displays tests ranked by total number of failures represented as vertical bars. The regular view shows the Top 10 most failed tests; fullscreen mode expands the list to the Top 50.`,
    "testMostFailedGraphTimeline": `Displays when failures occurred across runs. The regular view shows the Top 10 most failed tests; fullscreen mode expands the list to the Top 50.`,
    "testRecentMostFailedGraphBar": `Bar: Displays recent tests ranked by total number of failures represented as vertical bars. The regular view shows the Top 10 most failed tests; fullscreen mode expands the list to the Top 50.`,
    "testRecentMostFailedGraphTimeline": `Displays when most recent failures occurred across runs. The regular view shows the Top 10 most failed tests; fullscreen mode expands the list to the Top 50.`,
    "testMostTimeConsumingGraphBar": "Bar: tests ranked by how often they were the slowest test in a run (Top 10; Top 50 in fullscreen). When 'Only Last Run' is on, shows the Top 10/50 slowest tests in the latest run by duration.",
    "testMostTimeConsumingGraphTimeline": "Timeline: the slowest test per run over time (Top 10; Top 50 in fullscreen). When 'Only Last Run' is on, shows the latest run's slowest tests.",
    "keywordStatisticsGraphPercentages": "Percentages: Displays the distribution of passed, failed, skipped statuses for each keyword per run",
    "keywordStatisticsGraphAmount": "Amount: Displays raw counts of each status per run",
    "keywordStatisticsGraphLine": "Line: Displays the same data but over a time axis",
    "keywordTimesRunGraphBar": "Bar: Displays times run per keyword represented as vertical bars",
    "keywordTimesRunGraphLine": "Line: Displays the same data but over a time axis",
    "keywordTotalDurationGraphBar": "Bar: Displays the cumulative time each keyword ran during each run represented as vertical bars",
    "keywordTotalDurationGraphLine": "Line: Displays the same data but over a time axis",
    "keywordAverageDurationGraphBar": "Bar: Displays the average duration for each keyword represented as vertical bars",
    "keywordAverageDurationGraphLine": "Line: Displays the same data but over a time axis",
    "keywordMinDurationGraphBar": "Bar: Displays minimum durations represented as vertical bars",
    "keywordMinDurationGraphLine": "Line: Displays the same data but over a time axis",
    "keywordMaxDurationGraphBar": "Bar: Displays maximum durations represented as vertical bars",
    "keywordMaxDurationGraphLine": "Line: Displays the same data but over a time axis",
    "keywordMostFailedGraphBar": "Bar: Displays keywords ranked by total number of failures represented as vertical bars. The regular view shows the Top 10 most failed keywords; fullscreen mode expands the list to the Top 50.",
    "keywordMostFailedGraphTimeline": "Timeline: Displays when failures occurred across runs. The regular view shows the Top 10 most failed keywords; fullscreen mode expands the list to the Top 50.",
    "keywordMostTimeConsumingGraphBar": "Bar: keywords ranked by how often they were the slowest keyword in a run (Top 10; Top 50 in fullscreen). When 'Only Last Run' is on, shows the Top 10/50 slowest keywords in the latest run by duration.",
    "keywordMostTimeConsumingGraphTimeline": "Timeline: the slowest keyword per run over time (Top 10; Top 50 in fullscreen). When 'Only Last Run' is on, shows the latest run's slowest keywords.",
    "keywordMostUsedGraphBar": "Bar: keywords ranked by total usage frequency across all runs (Top 10; Top 50 in fullscreen). When 'Only Last Run' is on, shows the most-used keywords in the latest run.",
    "keywordMostUsedGraphTimeline": "Timeline: keyword usage trends across runs (Top 10; Top 50 in fullscreen). When 'Only Last Run' is on, shows the latest run's most-used keywords.",
    "filterProfileInformation": `Filter Profiles let you save and reapply named filter combinations.
- Add Profile: name a new profile and choose which filters to include.
- Save Profile: saves the current filter values under that name.
- Apply Profile: opens the saved profiles list — click a name to apply it.
- A dot means the active profile's filters have been modified since it was applied.
- Update Profile: overwrites the saved profile with the current filter values.
- Merge Profiles: combine two profiles using the widest coverage for each filter.`,
    "filterRunsInformation": "Filter by project name. 'All' includes every project.",
    "filterRunTagsInformation": `Filter by run tags. 'All' disables the filter.
- AND mode (default): run must have all selected tags.
- OR mode: run needs at least one selected tag.
- A dot indicates the filter is active.`,
    "filterVersionsInformation": `Filter by project version. 'All' disables the filter.
- 'None' covers runs without a version label.
- A dot indicates the filter is active.`,
    "filterFromDateInformation": "Show only runs that started on or after this date.",
    "filterFromTimeInformation": "Show only runs that started at or after this time (combined with From Date).",
    "filterToDateInformation": "Show only runs that started on or before this date.",
    "filterToTimeInformation": "Show only runs that started at or before this time (combined with To Date).",
    "filterMetadataInformation": "Filter by a metadata value attached to the run. Only shown when runs have metadata.",
    "filterAmountInformation": "Limit to the most recent X runs after all other filters are applied. 'All Runs' sets this to the total matching count.",
    "compareStatisticsGraphBar": "This graph displays the overall statistics of the selected runs",
    "compareSuiteDurationGraphRadar": "This graph displays the duration per suite in a radar format",
    "compareTestsGraphTimeline": `Timeline of test statuses across the selected runs.
- Status: show only tests with the selected status and no changes.
- Only Changes: show only tests whose status changed at some point.
Tip: avoid using Status and Only Changes together — the result will be empty.`,
    "settingUnified": "Show all dashboard sections (run, suite, test, keyword) in a single unified view instead of separate tabs.",
    "settingLegends": "Show or hide graph legends. Useful to disable when graphs contain many data series.",
    "settingAxisTitles": "Show axis labels on graphs (e.g. Run Time, Pass/Fail Count). Disable for a cleaner look.",
    "settingLabels": "Show run start timestamps or aliases directly on graph axes. Disable for a cleaner look.",
    "settingRunLabel": "Which label identifies runs across graphs, tooltips and axes: Run Start (timestamp), Alias (from output filename), or Run Name (suite name from output file). Duplicate names get a numeric suffix.",
    "settingMilliseconds": "Add millisecond precision to run_start timestamps shown on graph axes and tooltips.",
    "settingAnimations": "Enable animated graph rendering when charts are drawn or updated.",
    "settingAnimationDuration": "Duration of graph draw animations in milliseconds, e.g. 1500.",
    "settingBarRounding": "Corner rounding for bar chart edges in pixels. 0 = square, 8 = fully rounded.",
    "settingTimezones": "Show or hide the timezone offset suffix (e.g. +02:00) on run_start timestamps. Only affects runs with a stored timezone.",
    "settingConvertTimezone": "Convert stored run_start timestamps to your browser's local timezone. Only applies to runs that have a stored timezone offset.",
    "settingSuiteStatsDefault": "Default suite shown in the Suite Statistics tab when the dashboard opens.",
    "settingTestStatsDefault": "Default suite shown in the Test Statistics tab when the dashboard opens.",
    "settingLatestRuns": "Show the Latest Runs bar with the most recent run per project, color-coded by duration.",
    "settingTotalStats": "Show the Total Stats bar with aggregate pass/fail/skip counts and average pass rates per project.",
    "settingProjectsByName": "Group and display projects on the Overview by their Robot Framework run name.",
    "settingProjectsByTag": "Group and display projects on the Overview by custom project_ tags. See the docs for project tagging.",
    "settingPrefixes": "Show or hide the 'project_' prefix on tag-based project names on the Overview.",
    "settingPercentageFilters": "Show the duration percentage threshold filter used to color-code run durations on the Overview.",
    "settingVersionFilters": "Show the version filter for per-project version selection on the Overview.",
    "settingSortFilters": "Show the sort controls for ordering Overview project bars.",
    "settingBackgroundColor": "Main page background color for the current theme.",
    "settingCardColor": "Background color for graph cards and content panels.",
    "settingHighlightColor": "Accent color used for hover states and interactive elements.",
    "settingTextColor": "Primary text color across the dashboard.",
    "settingCustomTitle": "Text label shown in the nav bar next to the logo. Leave blank to hide. The --dashboardtitle CLI flag takes priority over this.",
    "settingCustomLogo": "Upload a PNG to replace the Robot Framework logo in the nav bar. Also used as the browser favicon. Click Reset to restore the default.",
};

// Generate standard control entries for all graphs
const graphKeys = [
    "runStatistics", "runDonut", "runStats", "runDuration", "runHeatmap",
    "suiteFolderDonut", "suiteStatistics", "suiteDuration", "suiteMostFailed", "suiteMostTimeConsuming",
    "testStatistics", "testDuration", "testDurationDeviation", "testMessages",
    "testMostFlaky", "testRecentMostFlaky", "testMostFailed", "testRecentMostFailed", "testMostTimeConsuming",
    "keywordStatistics", "keywordTimesRun", "keywordTotalDuration", "keywordAverageDuration",
    "keywordMinDuration", "keywordMaxDuration", "keywordMostFailed", "keywordMostTimeConsuming", "keywordMostUsed",
    "compareStatistics", "compareSuiteDuration", "compareTests",
];
graphKeys.forEach(key => {
    informationMap[`${key}Fullscreen`] = "Fullscreen";
    informationMap[`${key}Close`] = "Close";
    informationMap[`${key}Shown`] = "Hide Graph";
    informationMap[`${key}Hidden`] = "Show Graph";
});

["runTable", "suiteTable", "testTable", "keywordTable"].forEach(key => {
    informationMap[`${key}MoveUp`] = "Move Up";
    informationMap[`${key}MoveDown`] = "Move Down";
    informationMap[`${key}Shown`] = "Hide Table";
    informationMap[`${key}Hidden`] = "Show Table";
});

["runSection", "suiteSection", "testSection", "keywordSection"].forEach(key => {
    informationMap[`${key}MoveUp`] = "Move Up";
    informationMap[`${key}MoveDown`] = "Move Down";
    informationMap[`${key}Shown`] = "Hide Section";
    informationMap[`${key}Hidden`] = "Show Section";
});

export { informationMap };