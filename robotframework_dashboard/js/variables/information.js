const informationMap = {
    "rflogo": "Robot Framework",
    "filters": "Filters",
    "customizeLayout": "Customize Layout",
    "saveLayout": "Save Layout",
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
    "overviewTotalInformation": `This section displays aggregate statistics across all runs:
- Passed/Failed/Skipped Runs: total count of runs with each status
- Average Duration: the mean duration across all runs in the project
- Average Pass Rate: the mean pass rate across all runs in the project
- Check out all options in the settings: 'Gear Icon' > 'Overview'`,
    "overviewLatestInformation": `This section displays the latest run for each project:
- Duration color indicates performance relative to the average: green if more than x% faster, red if more than x% slower. You can adjust this threshold using the Percentage toggle. Version filters do not affect this.
- Passed runs represent the percentage of runs with zero failures.
- The 'Select Versions' dropdown menu allows filtering by desired versions. Click 'All' to quickly deselect all other checkboxes.
- The runs can also be filtered to only those whose version contains the text entered in the 'Version Filter...' input.
- Clicking on the run card applies a filter for that project and switches to dashboard
- Check out all options in the settings: 'Gear Icon' > 'Overview'`,
    "unifiedStatisticsInformation": `This section provides unified statistics across all projects and runs:
- It combines run/suite/test/keyword data from all projects into a single dashboard view.
- You can apply the filters (menu filter icon) to focus on specific projects, versions, or timeframes.
- You can also apply specific suite/test/keyword filters (section filters) to drill down into particular areas of interest.
- Use the 'Customize Layout' option to tailor which graphs are displayed and their order.`,
    "suiteStatisticsInformation": `This section provides statistics on the suite level:
- Folder Filter: Click on folder donuts to "zoom in" on specific suites. (Applies to Folders, Statistics and Duration Graphs)
- Suite Selection Dropdown: Choose a specific suite or all suites. (Applies to Statistics and Duration Graphs)
- Full Suite Paths Toggle: When enabled, shows the full suite path instead of only the suite name. Useful if there are duplicate suite names in different folders. (Applies to all Suite Graphs)`,
    "testStatisticsInformation": `This section provides statistics on the test level:
- Suite Filter: Select one or multiple suites from a dropdown. (Applies to Statistics, Duration and Duration Deviation Graphs)
- Suite Paths Toggle: Same logic as the Suite section; allows distinguishing duplicate suite names. (Applies to all Test Graphs)
- Test Selection Dropdown: Zoom in on a specific test. (Applies to Statistics, Duration and Duration Deviation Graphs)
- Test Tag Dropdown: Filter tests by tags. (Applies to Statistics, Duration and Duration Deviation Graphs)`,
    "keywordStatisticsInformation": `This section provides statistics on the keyword level:
- Keyword Dropdown: Select a specific keyword to zoom in on. (Applies to Statistics, Times Run, Total Duration, Average Duration, Min Duration, Max Duration Graphs)
- Library Names Toggle: Include library names in the keyword selection dropdown. (Applies to all Keyword Graphs)`,
    "runStatisticsGraphPercentages": "Percentages: Displays the distribution of passed, failed, skipped tests per run, where 100% equals all tests combined",
    "runStatisticsGraphAmount": "Amount: Displays the actual number of passed, failed, skipped tests per run",
    "runStatisticsGraphLine": "Line: Displays the same data but over a time axis, useful for spotting failure patterns on specific dates or times",
    "runDonutGraphDonut": `This graph contains two donut charts:
- The first donut displays the percentage of passed, failed, and skipped tests for the most recent run..
- The second donut displays the total percentage of passed, failed, and skipped tests across all runs`,
    "runStatsGraphStats": `This section provides key statistics:
- Executed: Total counts of Runs, Suites, Tests, and Keywords that have been executed.
- Unique Tests: Displays the number of distinct test cases across all runs.
- Outcomes: Total Passed, Failed, and Skipped tests, including their percentages relative to the full test set.
- Duration: Displays the cumulative runtime of all runs, the average runtime per run, and the average duration of individual tests.
- Pass Rate: Displays the average run-level pass rate, helping evaluate overall reliability over time.`,
    "runDurationGraphBar": "Bar: Displays total run durations represented as vertical bars",
    "runDurationGraphLine": "Displays the same data but over a time axis for clearer trend analysis",
    "runHeatmapGraphHeatmap": `This graph visualizes a heatmap of when tests are executed the most:
- All: Displays how many tests ran during the hours or minutes of the week days.
- Status: Displays only tests of the selected status.
- Hour: Displays only that hour so you get insights per minute.`,
    "suiteFolderDonutGraphDonut": `This graph contains two donut charts:
- The first donut displays the top-level folders of the suites and the amount of tests each folder contains.
- The second donut displays the same folder structure but only for the most recent run and only includes failed tests.
- Clicking on a folder updates the chart with the subfolders/suites it contains.
- Navigating folders also updates Suite Statistics and Suite Duration.
- Go Up: navigates to the parent folder level.
- Only Failed: filters to show only folders with failing tests.`,
    "suiteStatisticsGraphPercentages": "Percentages: Displays the passed, failed, skipped rate of test suites per run",
    "suiteStatisticsGraphAmount": "Amount: Displays the actual number of passed, failed, skipped suites per run",
    "suiteStatisticsGraphLine": "Line: Displays the same data but over a time axis, useful for spotting failure patterns on specific dates or times",
    "suiteDurationGraphBar": "Bar: Displays total suite durations represented as vertical bars",
    "suiteDurationGraphLine": "Line: Displays the same data but over a time axis for clearer trend analysis",
    "suiteMostFailedGraphBar": "Bar: Displays suites ranked by number of failures represented as vertical bars. The default view shows the Top 10 most failed suites; fullscreen expands this to the Top 50.",
    "suiteMostFailedGraphTimeline": "Timeline: Displays when failures occurred to identify clustering over time. The default view shows the Top 10 most failed suites; fullscreen expands this to the Top 50",
    "suiteMostTimeConsumingGraphBar": "Bar: Displays suites ranked by how often they were the slowest (most time-consuming) suite in a run. Each bar represents how many times a suite was the single slowest one across all runs. The regular view shows the Top 10; fullscreen mode expands the list to the Top 50. When 'Only Last Run' is enabled, this graph instead shows the Top 10 (or Top 50 in fullscreen) most time-consuming suites *within the latest run only*, ranked by duration.",
    "suiteMostTimeConsumingGraphTimeline": "Timeline: Displays the slowest suite for each run on a timeline. For every run, only the single most time-consuming suite is shown. The regular view shows the Top 10 most frequently slowest suites; fullscreen mode expands the list to the Top 50. When 'Only Last Run' is enabled, the timeline shows only the latest run, highlighting its Top 10 (or Top 50 in fullscreen) most time-consuming suites by duration.",
    "testStatisticsGraphTimeline": `This graph displays the statistics of the tests in a timeline format
Status: Displays only tests don't have any status changes and have the selected status
Only Changes: Displays only tests that have changed statuses at some point in time
Tip: Don't use Status and Only Changes at the same time as it will result in an empty graph`,
    "testStatisticsGraphLine": `Scatter: Displays test results as dots on a time axis, with each row representing a different test
- Green dots indicate passed, red dots indicate failed, and yellow dots indicate skipped tests
- The horizontal spacing between dots is proportional to the actual time between executions
- Hover over a dot to see the test name, status, run, duration and failure message
- Useful for spotting environmental issues where multiple tests fail at the same timestamp
- Status and Only Changes filters apply to this view as well`,
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
    "testMostTimeConsumingGraphBar": "Bar: Displays tests ranked by how often they were the slowest (most time-consuming) test in a run. Each bar represents how many times a test was the single slowest one across all runs. The regular view shows the Top 10; fullscreen mode expands the list to the Top 50. When 'Only Last Run' is enabled, this graph instead shows the Top 10 (or Top 50 in fullscreen) most time-consuming tests *within the latest run only*, ranked by duration.",
    "testMostTimeConsumingGraphTimeline": "Timeline: Displays the slowest test for each run on a timeline. For every run, only the single most time-consuming test is shown. The regular view shows the Top 10 most frequently slowest tests; fullscreen mode expands the list to the Top 50. When 'Only Last Run' is enabled, the timeline shows only the latest run, highlighting its Top 10 (or Top 50 in fullscreen) most time-consuming tests by duration.",
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
    "keywordMostTimeConsumingGraphBar": "Bar: Displays keywords ranked by how often they were the slowest (most time-consuming) keyword in a run. Each bar represents how many times a keyword was the single slowest one across all runs. The regular view shows the Top 10; fullscreen mode expands the list to the Top 50. When 'Only Last Run' is enabled, this graph instead shows the Top 10 (or Top 50 in fullscreen) most time-consuming keywords *within the latest run only*, ranked by duration.",
    "keywordMostTimeConsumingGraphTimeline": "Timeline: Displays the slowest keyword for each run on a timeline. For every run, only the single most time-consuming keyword is shown. The regular view shows the Top 10 most frequently slowest keywords; fullscreen mode expands the list to the Top 50. When 'Only Last Run' is enabled, the timeline shows only the latest run, highlighting its Top 10 (or Top 50 in fullscreen) most time-consuming keywords by duration.",
    "keywordMostUsedGraphBar": "Bar: Displays keywords ranked by how frequently they were used across all runs. Each bar represents how many times a keyword appeared in total. The regular view shows the Top 10 most used keywords; fullscreen mode expands the list to the Top 50. When 'Only Last Run' is enabled, this graph instead shows the Top 10 (or Top 50 in fullscreen) most used keywords *within the latest run only*, ranked by occurrence count.",
    "keywordMostUsedGraphTimeline": "Timeline: Displays keyword usage trends over time. For each run, the most frequently used keyword (or keywords) is shown, illustrating how keyword usage changes across runs. The regular view highlights the Top 10 most frequently used keywords overall; fullscreen mode expands the list to the Top 50. When 'Only Last Run' is enabled, the timeline shows only the latest run, highlighting its Top 10 (or Top 50 in fullscreen) most used keywords by frequency.",
    "compareStatisticsGraphBar": "This graph displays the overall statistics of the selected runs",
    "compareSuiteDurationGraphRadar": "This graph displays the duration per suite in a radar format",
    "compareTestsGraphTimeline": `This graph displays the statistics of the tests in a timeline format
Status: Displays only tests don't have any status changes and have the selected status
Only Changes: Displays only tests that have changed statuses at some point in time
Tip: Don't use Status and Only Changes at the same time as it will result in an empty graph`,
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