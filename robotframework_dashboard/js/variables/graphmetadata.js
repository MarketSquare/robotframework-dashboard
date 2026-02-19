// View option to CSS class mapping
const viewOptionClassMap = {
    "Percentages": "percentage-graph",
    "Amount": "bar-graph",
    "Bar": "bar-graph",
    "Line": "line-graph",
    "Timeline": "timeline-graph",
    "Donut": "pie-graph",
    "Heatmap": "heatmap-graph",
    "Stats": "stats-graph",
    "Radar": "radar-graph",
};

// Generate standard graph HTML template
function _graphHtml(key, title, viewOptions, { hasVertical = false, titleId = true, viewClassOverrides = {} } = {}) {
    const controls = viewOptions.map(opt => {
        const cls = viewClassOverrides[opt] || viewOptionClassMap[opt];
        return `<a class="${cls} information" id="${key}Graph${opt}"></a>`;
    }).join('\n                        ');
    const titleTag = titleId ? `<h6 id="${key}Title">${title}</h6>` : `<h6>${title}</h6>`;
    const canvas = hasVertical
        ? `<div id="${key}Vertical" class="w-100 vertical"><canvas id="${key}Graph"></canvas></div>`
        : `<canvas id="${key}Graph"></canvas>`;
    return `<div class="graph-header">
                    ${titleTag}
                    <div class="graph-controls">
                        ${controls}
                        <a class="fullscreen-graph information" id="${key}Fullscreen"></a>
                        <a class="close-graph information" id="${key}Close" hidden></a>
                        <a class="shown-graph information" id="${key}Shown" showGraphHidden></a>
                        <a class="hidden-graph information" id="${key}Hidden" hideGraphHidden></a>
                    </div>
                </div>
                <div class="graph-body">
                    ${canvas}
                </div>`;
}

// Generate standard table HTML template
function _tableHtml(key, displayName) {
    return `<div class="col table-section" id="${key}Canvas">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <h6 class="mb-0">${displayName} Table</h6>
                        <div>
                            <a class="move-up-table information" id="${key}MoveUp" moveUpHidden></a>
                            <a class="move-down-table information" id="${key}MoveDown" moveDownHidden></a>
                            <a class="shown-graph information" id="${key}Shown" showGraphHidden></a>
                            <a class="hidden-graph information" id="${key}Hidden" hideGraphHidden></a>
                        </div>
                    </div>
                    <table class="table table-striped" id="${key}"></table>
                </div>`;
}

const graphMetadata = [
    {
        key: "runStatistics",
        label: "Run Statistics",
        defaultType: "percentages",
        viewOptions: ["Percentages", "Line", "Amount"],
        hasFullscreenButton: true,
        html: _graphHtml("runStatistics", "Statistics", ["Percentages", "Line", "Amount"]),
    },
    {
        key: "runDonut",
        label: "Run Donut",
        defaultType: "donut",
        viewOptions: ["Donut"],
        hasFullscreenButton: true,
        html: `<div class="graph-header">
                    <h6 id="runDonutTitle">Donut</h6>
                    <div class="graph-controls">
                        <a class="pie-graph information" id="runDonutGraphDonut"></a>
                        <a class="fullscreen-graph information" id="runDonutFullscreen"></a>
                        <a class="close-graph information" id="runDonutClose" hidden></a>
                        <a class="shown-graph information" id="runDonutShown" showGraphHidden></a>
                        <a class="hidden-graph information" id="runDonutHidden" hideGraphHidden></a>
                    </div>
                </div>
                <div class="graph-body" style="height:90%;">
                    <div class="row w-100 h-100">
                        <div class="col-md-6 w-50 h-100">
                            <canvas id="runDonutGraph"></canvas>
                        </div>
                        <div class="col-md-6 w-50 h-100">
                            <canvas id="runDonutTotalGraph"></canvas>
                        </div>
                    </div>
                </div>`,
    },
    {
        key: "runDonutTotal",
        label: "Run Donut Total",
        defaultType: "donut",
        viewOptions: ["Donut"],
        hasFullscreenButton: false,
        information: null,
    },
    {
        key: "runStats",
        label: "Run Stats",
        defaultType: "stats",
        viewOptions: ["Stats"],
        hasFullscreenButton: true,
        html: `<div class="graph-header">
                    <h6 id="runStatsTitle">Stats</h6>
                    <div class="graph-controls">
                        <a class="stats-graph information" id="runStatsGraphStats"></a>
                        <a class="fullscreen-graph information" id="runStatsFullscreen"></a>
                        <a class="close-graph information" id="runStatsClose" hidden></a>
                        <a class="shown-graph information" id="runStatsShown" showGraphHidden></a>
                        <a class="hidden-graph information" id="runStatsHidden" hideGraphHidden></a>
                    </div>
                </div>
                <div class="graph-body">
                    <div class="w-100 h-100">
                        <div class="d-flex flex-column justify-content-between h-100">
                            <div class="row text-center mb-4">
                                <div class="col">
                                    <div class="stat-label">Executed Runs</div>
                                    <div class="stat-value blue-text" id="totalRuns"></div>
                                </div>
                                <div class="col">
                                    <div class="stat-label">Executed Suites</div>
                                    <div class="stat-value blue-text" id="totalSuites"></div>
                                </div>
                                <div class="col">
                                    <div class="stat-label">Executed Tests</div>
                                    <div class="stat-value blue-text" id="totalTests"></div>
                                </div>
                                <div class="col">
                                    <div class="stat-label">Executed Keywords</div>
                                    <div class="stat-value blue-text" id="totalKeywords"></div>
                                </div>
                            </div>
                            <div class="row text-center mb-4">
                                <div class="col">
                                    <div class="stat-label">Unique Tests</div>
                                    <div class="stat-value white-text" id="totalUniqueTests"></div>
                                </div>
                                <div class="col">
                                    <div class="stat-label">Passed</div>
                                    <div class="stat-value green-text" id="totalPassed"></div>
                                </div>
                                <div class="col">
                                    <div class="stat-label">Failed</div>
                                    <div class="stat-value red-text" id="totalFailed"></div>
                                </div>
                                <div class="col">
                                    <div class="stat-label">Skipped</div>
                                    <div class="stat-value yellow-text" id="totalSkipped"></div>
                                </div>
                            </div>
                            <div class="row text-center">
                                <div class="col">
                                    <div class="stat-label">Total Run Time</div>
                                    <div class="stat-value white-text" id="totalRunTime"></div>
                                </div>
                                <div class="col">
                                    <div class="stat-label">Avg Run Time</div>
                                    <div class="stat-value white-text" id="averageRunTime"></div>
                                </div>
                                <div class="col">
                                    <div class="stat-label">Avg Test Time</div>
                                    <div class="stat-value white-text" id="averageTestTime"></div>
                                </div>
                                <div class="col">
                                    <div class="stat-label">Avg Run Pass Rate</div>
                                    <div class="stat-value green-text" id="averagePassRate"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>`,
    },
    {
        key: "runDuration",
        label: "Run Duration",
        defaultType: "line",
        viewOptions: ["Bar", "Line"],
        hasFullscreenButton: true,
        html: _graphHtml("runDuration", "Duration", ["Bar", "Line"]),
    },
    {
        key: "runHeatmap",
        label: "Run Heatmap",
        defaultType: "heatmap",
        viewOptions: ["Heatmap"],
        hasFullscreenButton: true,
        html: `<div class="graph-header">
                    <h6 id="runHeatmapTitle">Heatmap</h6>
                    <div class="graph-controls">
                        <div class="btn-group">
                            <label class="form-check-label" for="heatMapTestType">Status</label>
                        </div>
                        <div class="btn-group">
                            <select class="form-select form-select-sm" id="heatMapTestType">
                                <option value="All">All</option>
                                <option value="Passed">Passed</option>
                                <option value="Failed">Failed</option>
                                <option value="Skipped">Skipped</option>
                            </select>
                        </div>
                        <div class="btn-group">
                            <label class="form-check-label" for="heatMapHour">Hour</label>
                        </div>
                        <div class="btn-group">
                            <select class="form-select form-select-sm" id="heatMapHour">
                                <option value="All">All</option>
                                <option value="0">00:00</option>
                                <option value="1">01:00</option>
                                <option value="2">02:00</option>
                                <option value="3">03:00</option>
                                <option value="4">04:00</option>
                                <option value="5">05:00</option>
                                <option value="6">06:00</option>
                                <option value="7">07:00</option>
                                <option value="8">08:00</option>
                                <option value="9">09:00</option>
                                <option value="10">10:00</option>
                                <option value="11">11:00</option>
                                <option value="12">12:00</option>
                                <option value="13">13:00</option>
                                <option value="14">14:00</option>
                                <option value="15">15:00</option>
                                <option value="16">16:00</option>
                                <option value="17">17:00</option>
                                <option value="18">18:00</option>
                                <option value="19">19:00</option>
                                <option value="20">20:00</option>
                                <option value="21">21:00</option>
                                <option value="22">22:00</option>
                                <option value="23">23:00</option>
                            </select>
                        </div>
                        <a class="heatmap-graph information" id="runHeatmapGraphHeatmap"></a>
                        <a class="fullscreen-graph information" id="runHeatmapFullscreen"></a>
                        <a class="close-graph information" id="runHeatmapClose" hidden></a>
                        <a class="shown-graph information" id="runHeatmapShown" showGraphHidden></a>
                        <a class="hidden-graph information" id="runHeatmapHidden" hideGraphHidden></a>
                    </div>
                </div>
                <div class="graph-body">
                    <canvas id="runHeatmapGraph"></canvas>
                </div>`,
    },
    {
        key: "suiteFolderDonut",
        label: "Suite Folder Donut",
        defaultType: "donut",
        viewOptions: ["Donut"],
        hasFullscreenButton: true,
        html: `<div class="graph-header">
                    <h6 id="suiteFolderDonutTitle">Folders</h6>
                    <div class="graph-controls">
                        <div class="btn-group">
                            <label class="form-check-label" for="onlyFailedFolders">Only Failed</label>
                        </div>
                        <div class="btn-group form-switch">
                            <input class="form-check-input" type="checkbox" role="switch" id="onlyFailedFolders">
                        </div>
                        <button class="btn btn-outline-light btn-sm" id="suiteFolderDonutGoUp">Go Up</button>
                        <a class="pie-graph information" id="suiteFolderDonutGraphDonut"></a>
                        <a class="fullscreen-graph information" id="suiteFolderDonutFullscreen"></a>
                        <a class="close-graph information" id="suiteFolderDonutClose" hidden></a>
                        <a class="shown-graph information" id="suiteFolderDonutShown" showGraphHidden></a>
                        <a class="hidden-graph information" id="suiteFolderDonutHidden" hideGraphHidden></a>
                    </div>
                </div>
                <div class="graph-body">
                    <div class="row w-100 h-100">
                        <div class="col-md-6 w-50 h-100">
                            <canvas id="suiteFolderDonutGraph" class="w-100 h-100"></canvas>
                        </div>
                        <div class="col-md-6 w-50 h-100">
                            <canvas id="suiteFolderFailDonutGraph" class="w-100 h-100"></canvas>
                        </div>
                    </div>
                </div>`,
    },
    {
        key: "suiteFolderFailDonut",
        label: "Suite Folder Fail Donut",
        defaultType: "donut",
        viewOptions: ["Donut"],
        hasFullscreenButton: false,
        information: null,
    },
    {
        key: "suiteStatistics",
        label: "Suite Statistics",
        defaultType: "percentages",
        viewOptions: ["Percentages", "Line", "Amount"],
        hasFullscreenButton: true,
        html: _graphHtml("suiteStatistics", "Statistics", ["Percentages", "Line", "Amount"]),
    },
    {
        key: "suiteDuration",
        label: "Suite Duration",
        defaultType: "line",
        viewOptions: ["Bar", "Line"],
        hasFullscreenButton: true,
        html: _graphHtml("suiteDuration", "Duration", ["Bar", "Line"]),
    },
    {
        key: "suiteMostFailed",
        label: "Suite Most Failed",
        defaultType: "bar",
        viewOptions: ["Bar", "Timeline"],
        hasFullscreenButton: true,
        html: _graphHtml("suiteMostFailed", "Most Failed", ["Bar", "Timeline"], { hasVertical: true }),
    },
    {
        key: "suiteMostTimeConsuming",
        label: "Suite Most Time Consuming",
        defaultType: "timeline",
        viewOptions: ["Bar", "Timeline"],
        hasFullscreenButton: true,
        html: `<div class="graph-header">
                    <h6 id="suiteMostTimeConsumingTitle">Most Time Consuming</h6>
                    <div class="graph-controls">
                        <div class="btn-group">
                            <label class="form-check-label" for="onlyLastRunSuite">Only Last Run</label>
                        </div>
                        <div class="btn-group form-switch">
                            <input class="form-check-input" type="checkbox" role="switch" id="onlyLastRunSuite">
                        </div>
                        <a class="bar-graph information" id="suiteMostTimeConsumingGraphBar"></a>
                        <a class="timeline-graph information" id="suiteMostTimeConsumingGraphTimeline"></a>
                        <a class="fullscreen-graph information" id="suiteMostTimeConsumingFullscreen"></a>
                        <a class="close-graph information" id="suiteMostTimeConsumingClose" hidden></a>
                        <a class="shown-graph information" id="suiteMostTimeConsumingShown" showGraphHidden></a>
                        <a class="hidden-graph information" id="suiteMostTimeConsumingHidden" hideGraphHidden></a>
                    </div>
                </div>
                <div class="graph-body">
                    <div id="suiteMostTimeConsumingVertical" class="w-100 vertical">
                        <canvas id="suiteMostTimeConsumingGraph"></canvas>
                    </div
                </div>`,
    },
    {
        key: "testStatistics",
        label: "Test Statistics",
        defaultType: "timeline",
        viewOptions: ["Timeline"],
        hasFullscreenButton: true,
        html: `<div class="graph-header">
                    <h6 id="testStatisticsTitle">Statistics</h6>
                    <div class="graph-controls">
                        <div class="btn-group">
                            <label class="form-check-label" for="testNoChanges">Status</label>
                        </div>
                        <div class="btn-group">
                            <select class="form-select form-select-sm" id="testNoChanges">
                                <option value="All">All</option>
                                <option value="Passed">Passed</option>
                                <option value="Failed">Failed</option>
                                <option value="Skipped">Skipped</option>
                            </select>
                        </div>
                        <div class="btn-group">
                            <label class="form-check-label" for="testOnlyChanges">Only Changes</label>
                        </div>
                        <div class="btn-group form-switch">
                            <input class="form-check-input" type="checkbox" role="switch" id="testOnlyChanges">
                        </div>
                        <a class="timeline-graph information" id="testStatisticsGraphTimeline"></a>
                        <a class="fullscreen-graph information" id="testStatisticsFullscreen"></a>
                        <a class="close-graph information" id="testStatisticsClose" hidden></a>
                        <a class="shown-graph information" id="testStatisticsShown" showGraphHidden></a>
                        <a class="hidden-graph information" id="testStatisticsHidden" hideGraphHidden></a>
                    </div>
                </div>
                <div class="graph-body">
                    <div id="testStatisticsVertical" class="w-100 vertical">
                        <canvas id="testStatisticsGraph"></canvas>
                    </div>
                </div>`,
    },
    {
        key: "testDuration",
        label: "Test Duration",
        defaultType: "line",
        viewOptions: ["Bar", "Line"],
        hasFullscreenButton: true,
        html: _graphHtml("testDuration", "Duration", ["Bar", "Line"]),
    },
    {
        key: "testDurationDeviation",
        label: "Test Duration Deviation",
        defaultType: "bar",
        viewOptions: ["Bar"],
        hasFullscreenButton: true,
        html: _graphHtml("testDurationDeviation", "Duration Deviation", ["Bar"], { viewClassOverrides: { "Bar": "boxplot-graph" } }),
    },
    {
        key: "testMessages",
        label: "Test Messages",
        defaultType: "timeline",
        viewOptions: ["Bar", "Timeline"],
        hasFullscreenButton: true,
        html: _graphHtml("testMessages", "Messages", ["Bar", "Timeline"], { hasVertical: true }),
    },
    {
        key: "testMostFlaky",
        label: "Test Most Flaky",
        defaultType: "timeline",
        viewOptions: ["Bar", "Timeline"],
        hasFullscreenButton: true,
        html: `<div class="graph-header">
                    <h6 id="testMostFlakyTitle">Most Flaky</h6>
                    <div class="graph-controls">
                        <div class="btn-group">
                            <label class="form-check-label" for="ignoreSkips">Ignore Skips</label>
                        </div>
                        <div class="btn-group form-switch">
                            <input class="form-check-input" type="checkbox" role="switch" id="ignoreSkips">
                        </div>
                        <a class="bar-graph information" id="testMostFlakyGraphBar"></a>
                        <a class="timeline-graph information" id="testMostFlakyGraphTimeline"></a>
                        <a class="fullscreen-graph information" id="testMostFlakyFullscreen"></a>
                        <a class="close-graph information" id="testMostFlakyClose" hidden></a>
                        <a class="shown-graph information" id="testMostFlakyShown" showGraphHidden></a>
                        <a class="hidden-graph information" id="testMostFlakyHidden" hideGraphHidden></a>
                    </div>
                </div>
                <div class="graph-body">
                    <div id="testMostFlakyVertical" class="w-100 vertical">
                        <canvas id="testMostFlakyGraph"></canvas>
                    </div>
                </div>`,
    },
    {
        key: "testRecentMostFlaky",
        label: "Test Recent Most Flaky",
        defaultType: "timeline",
        viewOptions: ["Bar", "Timeline"],
        hasFullscreenButton: true,
        html: `<div class="graph-header">
                    <h6 id="testRecentMostFlakyTitle">Recent Most Flaky</h6>
                    <div class="graph-controls">
                        <div class="btn-group">
                            <label class="form-check-label" for="ignoreSkipsRecent">Ignore Skips</label>
                        </div>
                        <div class="btn-group form-switch">
                            <input class="form-check-input" type="checkbox" role="switch" id="ignoreSkipsRecent">
                        </div>
                        <a class="bar-graph information" id="testRecentMostFlakyGraphBar"></a>
                        <a class="timeline-graph information" id="testRecentMostFlakyGraphTimeline"></a>
                        <a class="fullscreen-graph information" id="testRecentMostFlakyFullscreen"></a>
                        <a class="close-graph information" id="testRecentMostFlakyClose" hidden></a>
                        <a class="shown-graph information" id="testRecentMostFlakyShown" showGraphHidden></a>
                        <a class="hidden-graph information" id="testRecentMostFlakyHidden" hideGraphHidden></a>
                    </div>
                </div>
                <div class="graph-body">
                    <div id="testRecentMostFlakyVertical" class="w-100 vertical">
                        <canvas id="testRecentMostFlakyGraph"></canvas>
                    </div>
                </div>`,
    },
    {
        key: "testMostFailed",
        label: "Test Most Failed",
        defaultType: "timeline",
        viewOptions: ["Bar", "Timeline"],
        hasFullscreenButton: true,
        html: _graphHtml("testMostFailed", "Most Failed", ["Bar", "Timeline"], { hasVertical: true }),
    },
    {
        key: "testRecentMostFailed",
        label: "Test Recent Most Failed",
        defaultType: "timeline",
        viewOptions: ["Bar", "Timeline"],
        hasFullscreenButton: true,
        html: _graphHtml("testRecentMostFailed", "Recent Most Failed", ["Bar", "Timeline"], { hasVertical: true }),
    },
    {
        key: "testMostTimeConsuming",
        label: "Test Most Time Consuming",
        defaultType: "timeline",
        viewOptions: ["Bar", "Timeline"],
        hasFullscreenButton: true,
        html: `<div class="graph-header">
                    <h6 id="testMostTimeConsumingTitle">Most Time Consuming</h6>
                    <div class="graph-controls">
                        <div class="btn-group">
                            <label class="form-check-label" for="onlyLastRunTest">Only Last Run</label>
                        </div>
                        <div class="btn-group form-switch">
                            <input class="form-check-input" type="checkbox" role="switch" id="onlyLastRunTest">
                        </div>
                        <a class="bar-graph information" id="testMostTimeConsumingGraphBar"></a>
                        <a class="timeline-graph information" id="testMostTimeConsumingGraphTimeline"></a>
                        <a class="fullscreen-graph information" id="testMostTimeConsumingFullscreen"></a>
                        <a class="close-graph information" id="testMostTimeConsumingClose" hidden></a>
                        <a class="shown-graph information" id="testMostTimeConsumingShown" showGraphHidden></a>
                        <a class="hidden-graph information" id="testMostTimeConsumingHidden" hideGraphHidden></a>
                    </div>
                </div>
                <div class="graph-body">
                    <div id="testMostTimeConsumingVertical" class="w-100 vertical">
                        <canvas id="testMostTimeConsumingGraph"></canvas>
                    </div
                </div>`,
    },
    {
        key: "keywordStatistics",
        label: "Keyword Statistics",
        defaultType: "percentages",
        viewOptions: ["Percentages", "Line", "Amount"],
        hasFullscreenButton: true,
        html: _graphHtml("keywordStatistics", "Statistics", ["Percentages", "Line", "Amount"]),
    },
    {
        key: "keywordTimesRun",
        label: "Keyword Times Run",
        defaultType: "line",
        viewOptions: ["Bar", "Line"],
        hasFullscreenButton: true,
        html: _graphHtml("keywordTimesRun", "Times Run", ["Bar", "Line"]),
    },
    {
        key: "keywordTotalDuration",
        label: "Keyword Total Duration",
        defaultType: "line",
        viewOptions: ["Bar", "Line"],
        hasFullscreenButton: true,
        html: _graphHtml("keywordTotalDuration", "Total Duration", ["Bar", "Line"]),
    },
    {
        key: "keywordAverageDuration",
        label: "Keyword Average Duration",
        defaultType: "line",
        viewOptions: ["Bar", "Line"],
        hasFullscreenButton: true,
        html: _graphHtml("keywordAverageDuration", "Average Duration", ["Bar", "Line"]),
    },
    {
        key: "keywordMinDuration",
        label: "Keyword Min Duration",
        defaultType: "line",
        viewOptions: ["Bar", "Line"],
        hasFullscreenButton: true,
        html: _graphHtml("keywordMinDuration", "Min Duration", ["Bar", "Line"]),
    },
    {
        key: "keywordMaxDuration",
        label: "Keyword Max Duration",
        defaultType: "line",
        viewOptions: ["Bar", "Line"],
        hasFullscreenButton: true,
        html: _graphHtml("keywordMaxDuration", "Max Duration", ["Bar", "Line"]),
    },
    {
        key: "keywordMostFailed",
        label: "Keyword Most Failed",
        defaultType: "timeline",
        viewOptions: ["Bar", "Timeline"],
        hasFullscreenButton: true,
        html: _graphHtml("keywordMostFailed", "Most Failed", ["Bar", "Timeline"], { hasVertical: true }),
    },
    {
        key: "keywordMostTimeConsuming",
        label: "Keyword Most Time Consuming",
        defaultType: "timeline",
        viewOptions: ["Bar", "Timeline"],
        hasFullscreenButton: true,
        html: `<div class="graph-header">
                    <h6 id="keywordMostTimeConsumingTitle">Most Time Consuming</h6>
                    <div class="graph-controls">
                        <div class="btn-group">
                            <label class="form-check-label" for="onlyLastRunKeyword">Only Last Run</label>
                        </div>
                        <div class="btn-group form-switch">
                            <input class="form-check-input" type="checkbox" role="switch" id="onlyLastRunKeyword">
                        </div>
                        <a class="bar-graph information" id="keywordMostTimeConsumingGraphBar"></a>
                        <a class="timeline-graph information" id="keywordMostTimeConsumingGraphTimeline"></a>
                        <a class="fullscreen-graph information" id="keywordMostTimeConsumingFullscreen"></a>
                        <a class="close-graph information" id="keywordMostTimeConsumingClose" hidden></a>
                        <a class="shown-graph information" id="keywordMostTimeConsumingShown" showGraphHidden></a>
                        <a class="hidden-graph information" id="keywordMostTimeConsumingHidden" hideGraphHidden></a>
                    </div>
                </div>
                <div class="graph-body">
                    <div id="keywordMostTimeConsumingVertical" class="w-100 vertical">
                        <canvas id="keywordMostTimeConsumingGraph"></canvas>
                    </div
                </div>`,
    },
    {
        key: "keywordMostUsed",
        label: "Keyword Most Used",
        defaultType: "timeline",
        viewOptions: ["Bar", "Timeline"],
        hasFullscreenButton: true,
        html: `<div class="graph-header">
                    <h6 id="keywordMostUsedTitle">Most Used</h6>
                    <div class="graph-controls">
                        <div class="btn-group">
                            <label class="form-check-label" for="onlyLastRunKeywordMostUsed">Only Last Run</label>
                        </div>
                        <div class="btn-group form-switch">
                            <input class="form-check-input" type="checkbox" role="switch" id="onlyLastRunKeywordMostUsed">
                        </div>
                        <a class="bar-graph information" id="keywordMostUsedGraphBar"></a>
                        <a class="timeline-graph information" id="keywordMostUsedGraphTimeline"></a>
                        <a class="fullscreen-graph information" id="keywordMostUsedFullscreen"></a>
                        <a class="close-graph information" id="keywordMostUsedClose" hidden></a>
                        <a class="shown-graph information" id="keywordMostUsedShown" showGraphHidden></a>
                        <a class="hidden-graph information" id="keywordMostUsedHidden" hideGraphHidden></a>
                    </div>
                </div>
                <div class="graph-body">
                    <div id="keywordMostUsedVertical" class="w-100 vertical">
                        <canvas id="keywordMostUsedGraph"></canvas>
                    </div
                </div>`,
    },
    {
        key: "compareStatistics",
        label: "Compare Statistics",
        defaultType: "bar",
        viewOptions: ["Bar"],
        hasFullscreenButton: true,
        html: _graphHtml("compareStatistics", "Statistics", ["Bar"], { titleId: false }),
    },
    {
        key: "compareSuiteDuration",
        label: "Compare Suite Duration",
        defaultType: "radar",
        viewOptions: ["Radar"],
        hasFullscreenButton: true,
        html: _graphHtml("compareSuiteDuration", "Suite Duration", ["Radar"], { titleId: false }),
    },
    {
        key: "compareTests",
        label: "Compare Tests",
        defaultType: "timeline",
        viewOptions: ["Timeline"],
        hasFullscreenButton: true,
        html: `<div class="graph-header">
                    <h6>Tests</h6>
                    <div class="graph-controls">
                        <div class="btn-group">
                            <label class="form-check-label" for="compareNoChanges">Status</label>
                        </div>
                        <div class="btn-group">
                            <select class="form-select form-select-sm" id="compareNoChanges">
                                <option value="All">All</option>
                                <option value="Passed">Passed</option>
                                <option value="Failed">Failed</option>
                                <option value="Skipped">Skipped</option>
                            </select>
                        </div>
                        <div class="btn-group">
                            <label class="form-check-label" for="compareOnlyChanges">Only Changes</label>
                        </div>
                        <div class="btn-group form-switch">
                            <input class="form-check-input" type="checkbox" role="switch" id="compareOnlyChanges">
                        </div>
                        <a class="timeline-graph information" id="compareTestsGraphTimeline"></a>
                        <a class="fullscreen-graph information" id="compareTestsFullscreen"></a>
                        <a class="close-graph information" id="compareTestsClose" hidden></a>
                        <a class="shown-graph information" id="compareTestsShown" showGraphHidden></a>
                        <a class="hidden-graph information" id="compareTestsHidden" hideGraphHidden></a>
                    </div>
                </div>
                <div class="graph-body">
                    <div id="compareTestsVertical" class="w-100 vertical">
                        <canvas id="compareTestsGraph"></canvas>
                    </div>
                </div>`,
    },
    {
        key: "runTable",
        label: "Table Run",
        defaultType: "table",
        viewOptions: ["Table"],
        hasFullscreenButton: false,
        information: null,
        html: _tableHtml("runTable", "Run"),
    },
    {
        key: "suiteTable",
        label: "Table Suite",
        defaultType: "table",
        viewOptions: ["Table"],
        hasFullscreenButton: false,
        information: null,
        html: _tableHtml("suiteTable", "Suite"),
    },
    {
        key: "testTable",
        label: "Table Test",
        defaultType: "table",
        viewOptions: ["Table"],
        hasFullscreenButton: false,
        information: null,
        html: _tableHtml("testTable", "Test"),
    },
    {
        key: "keywordTable",
        label: "Table Keyword",
        defaultType: "table",
        viewOptions: ["Table"],
        hasFullscreenButton: false,
        information: null,
        html: _tableHtml("keywordTable", "Keyword"),
    },
];

export { graphMetadata };