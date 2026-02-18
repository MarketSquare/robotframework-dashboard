import { get_test_statistics_data } from "../graph_data/statistics.js";
import { get_duration_graph_data } from "../graph_data/duration.js";
import { get_messages_data } from "../graph_data/messages.js";
import { get_duration_deviation_data } from "../graph_data/duration_deviation.js";
import { get_most_flaky_data } from "../graph_data/flaky.js";
import { get_most_failed_data } from "../graph_data/failed.js";
import { get_most_time_consuming_or_most_used_data } from "../graph_data/time_consuming.js";
import { get_graph_config } from "../graph_data/graph_config.js";
import { update_height } from "../graph_data/helpers.js";
import { open_log_file, open_log_from_label } from "../log.js";
import { format_duration } from "../common.js";
import { inFullscreen, inFullscreenGraph, ignoreSkips, ignoreSkipsRecent, filteredTests } from "../variables/globals.js";
import { settings } from "../variables/settings.js";

// build config for test statistics graph
function _build_test_statistics_config() {
    const data = get_test_statistics_data(filteredTests);
    const graphData = data[0]
    const runStarts = data[1]
    var config = get_graph_config("timeline", graphData, "", "Run", "Test");
    config.options.plugins.tooltip = {
        callbacks: {
            label: function (context) {
                return runStarts[context.raw.x[0]];
            },
        },
    };
    config.options.scales.x = {
        ticks: {
            minRotation: 45,
            maxRotation: 45,
            stepSize: 1,
            callback: function (value, index, ticks) {
                return runStarts[this.getLabelForValue(value)];
            },
        },
        title: {
            display: settings.show.axisTitles,
            text: "Run",
        },
    };
    config.options.onClick = (event, chartElement) => {
        if (chartElement.length) {
            open_log_file(event, chartElement, runStarts)
        }
    };
    if (!settings.show.dateLabels) { config.options.scales.x.ticks.display = false }
    update_height("testStatisticsVertical", config.data.labels.length, "timeline");
    return config;
}

// function to create test statistics graph in the test section
function create_test_statistics_graph() {
    console.log("creating_test_statistics_graph");
    if (testStatisticsGraph) { testStatisticsGraph.destroy(); }
    testStatisticsGraph = new Chart("testStatisticsGraph", _build_test_statistics_config());
    testStatisticsGraph.canvas.addEventListener("click", (event) => {
        open_log_from_label(testStatisticsGraph, event)
    });
}

// build config for test duration graph
function _build_test_duration_config() {
    var graphData = get_duration_graph_data("test", settings.graphTypes.testDurationGraphType, "elapsed_s", filteredTests);
    var config;
    if (settings.graphTypes.testDurationGraphType == "bar") {
        const limit = inFullscreen && inFullscreenGraph.includes("testDuration") ? 100 : 30;
        config = get_graph_config("bar", graphData, `Max ${limit} Bars`, "Run", "Duration");
    } else if (settings.graphTypes.testDurationGraphType == "line") {
        config = get_graph_config("line", graphData, "", "Date", "Duration");
    }
    if (!settings.show.dateLabels) { config.options.scales.x.ticks.display = false }
    return config;
}

// function to create test duration graph in the test section
function create_test_duration_graph() {
    console.log("creating_test_duration_graph");
    if (testDurationGraph) { testDurationGraph.destroy(); }
    testDurationGraph = new Chart("testDurationGraph", _build_test_duration_config());
    testDurationGraph.canvas.addEventListener("click", (event) => {
        open_log_from_label(testDurationGraph, event)
    });
}

// build config for test messages graph
function _build_test_messages_config() {
    const data = get_messages_data("test", settings.graphTypes.testMessagesGraphType, filteredTests);
    const graphData = data[0];
    const callbackData = data[1];
    var config;
    const limit = inFullscreen && inFullscreenGraph.includes("testMessages") ? 50 : 10;
    if (settings.graphTypes.testMessagesGraphType == "bar") {
        config = get_graph_config("bar", graphData, `Top ${limit}`, "Message", "Times");
        config.options.plugins.legend = { display: false };
        config.options.plugins.tooltip = {
            callbacks: {
                label: function (tooltipItem) {
                    return callbackData[tooltipItem.label];
                },
            },
        };
        config.options.scales.x = {
            ticks: {
                minRotation: 45,
                maxRotation: 45,
                callback: function (value, index) {
                    return this.getLabelForValue(value).slice(0, 40);
                },
            },
            title: {
                display: settings.show.axisTitles,
                text: "Message",
            },
        };
        delete config.options.onClick
    } else if (settings.graphTypes.testMessagesGraphType == "timeline") {
        config = get_graph_config("timeline", graphData, `Top ${limit}`, "Run", "Message");
        config.options.plugins.tooltip = {
            callbacks: {
                label: function (context) {
                    return callbackData[context.raw.x[0]];
                },
            },
        };
        config.options.scales.x = {
            ticks: {
                minRotation: 45,
                maxRotation: 45,
                stepSize: 1,
                callback: function (value, index, ticks) {
                    return callbackData[this.getLabelForValue(value)];
                },
            },
            title: {
                display: settings.show.axisTitles,
                text: "Run",
            },
        };
        config.options.onClick = (event, chartElement) => {
            if (chartElement.length) {
                open_log_file(event, chartElement, callbackData)
            }
        };
        config.options.scales.y.ticks = {
            callback: function (value, index, ticks) {
                return this.getLabelForValue(value).slice(0, 40);
            },
        };
        if (!settings.show.dateLabels) { config.options.scales.x.ticks.display = false }
    }
    update_height("testMessagesVertical", config.data.labels.length, settings.graphTypes.testMessagesGraphType);
    return config;
}

// function to create test messages graph in the test section
function create_test_messages_graph() {
    console.log("creating_test_messages_graph");
    if (testMessagesGraph) { testMessagesGraph.destroy(); }
    testMessagesGraph = new Chart("testMessagesGraph", _build_test_messages_config());
    testMessagesGraph.canvas.addEventListener("click", (event) => {
        open_log_from_label(testMessagesGraph, event)
    });
}

// build config for test duration deviation graph
function _build_test_duration_deviation_config() {
    const graphData = get_duration_deviation_data("test", settings.graphTypes.testDurationDeviationGraphType, filteredTests)
    const config = get_graph_config("boxplot", graphData, "", "Test", "Duration");
    delete config.options.onClick
    return config;
}

// function to create test duration deviation graph in test section
function create_test_duration_deviation_graph() {
    console.log("creating_test_duration_deviation_graph");
    if (testDurationDeviationGraph) { testDurationDeviationGraph.destroy(); }
    testDurationDeviationGraph = new Chart("testDurationDeviationGraph", _build_test_duration_deviation_config());
    testDurationDeviationGraph.canvas.addEventListener("click", (event) => {
        open_log_from_label(testDurationDeviationGraph, event)
    });
}

// build config for test most flaky graph
function _build_test_most_flaky_config() {
    const data = get_most_flaky_data("test", settings.graphTypes.testMostFlakyGraphType, filteredTests, ignoreSkips, false);
    const graphData = data[0]
    const callbackData = data[1];
    var config;
    const limit = inFullscreen && inFullscreenGraph.includes("testMostFlaky") ? 50 : 10;
    if (settings.graphTypes.testMostFlakyGraphType == "bar") {
        config = get_graph_config("bar", graphData, `Top ${limit}`, "Test", "Status Flips");
        config.options.plugins.legend = false
        delete config.options.onClick
    } else if (settings.graphTypes.testMostFlakyGraphType == "timeline") {
        config = get_graph_config("timeline", graphData, `Top ${limit}`, "Run", "Test");
        config.options.plugins.tooltip = {
            callbacks: {
                label: function (context) {
                    return callbackData[context.raw.x[0]];
                },
            },
        };
        config.options.scales.x = {
            ticks: {
                minRotation: 45,
                maxRotation: 45,
                stepSize: 1,
                callback: function (value, index, ticks) {
                    return callbackData[this.getLabelForValue(value)];
                },
            },
            title: {
                display: settings.show.axisTitles,
                text: "Run",
            },
        };
        config.options.onClick = (event, chartElement) => {
            if (chartElement.length) {
                open_log_file(event, chartElement, callbackData)
            }
        };
        if (!settings.show.dateLabels) { config.options.scales.x.ticks.display = false }
    }
    update_height("testMostFlakyVertical", config.data.labels.length, settings.graphTypes.testMostFlakyGraphType);
    return config;
}

// function to create test most flaky graph in test section
function create_test_most_flaky_graph() {
    console.log("creating_test_most_flaky_graph");
    if (testMostFlakyGraph) { testMostFlakyGraph.destroy(); }
    testMostFlakyGraph = new Chart("testMostFlakyGraph", _build_test_most_flaky_config());
    testMostFlakyGraph.canvas.addEventListener("click", (event) => {
        open_log_from_label(testMostFlakyGraph, event)
    });
}

// build config for test recent most flaky graph
function _build_test_recent_most_flaky_config() {
    const data = get_most_flaky_data("test", settings.graphTypes.testRecentMostFlakyGraphType, filteredTests, ignoreSkipsRecent, true);
    const graphData = data[0];
    const callbackData = data[1];
    var config;
    const limit = inFullscreen && inFullscreenGraph.includes("testRecentMostFlaky") ? 50 : 10;
    if (settings.graphTypes.testRecentMostFlakyGraphType == "bar") {
        config = get_graph_config("bar", graphData, `Top ${limit}`, "Test", "Status Flips");
        config.options.plugins.legend = false
        delete config.options.onClick
    } else if (settings.graphTypes.testRecentMostFlakyGraphType == "timeline") {
        config = get_graph_config("timeline", graphData, `Top ${limit}`, "Run", "Test");
        config.options.plugins.tooltip = {
            callbacks: {
                label: function (context) {
                    return callbackData[context.raw.x[0]];
                },
            },
        };
        config.options.scales.x = {
            ticks: {
                minRotation: 45,
                maxRotation: 45,
                stepSize: 1,
                callback: function (value, index, ticks) {
                    return callbackData[this.getLabelForValue(value)];
                },
            },
            title: {
                display: settings.show.axisTitles,
                text: "Run",
            },
        };
        config.options.onClick = (event, chartElement) => {
            if (chartElement.length) {
                open_log_file(event, chartElement, callbackData)
            }
        };
        if (!settings.show.dateLabels) { config.options.scales.x.ticks.display = false }
    }
    update_height("testRecentMostFlakyVertical", config.data.labels.length, settings.graphTypes.testRecentMostFlakyGraphType);
    return config;
}

// function to create test recent most flaky graph in test section
function create_test_recent_most_flaky_graph() {
    console.log("creating_test_recent_most_flaky_graph");
    if (testRecentMostFlakyGraph) { testRecentMostFlakyGraph.destroy(); }
    testRecentMostFlakyGraph = new Chart("testRecentMostFlakyGraph", _build_test_recent_most_flaky_config());
    testRecentMostFlakyGraph.canvas.addEventListener("click", (event) => {
        open_log_from_label(testRecentMostFlakyGraph, event)
    });
}

// build config for test most failed graph
function _build_test_most_failed_config() {
    const data = get_most_failed_data("test", settings.graphTypes.testMostFailedGraphType, filteredTests, false);
    const graphData = data[0]
    const callbackData = data[1];
    var config;
    const limit = inFullscreen && inFullscreenGraph.includes("testMostFailed") ? 50 : 10;
    if (settings.graphTypes.testMostFailedGraphType == "bar") {
        config = get_graph_config("bar", graphData, `Top ${limit}`, "Test", "Fails");
        config.options.plugins.legend = { display: false };
        config.options.plugins.tooltip = {
            callbacks: {
                label: function (tooltipItem) {
                    return callbackData[tooltipItem.label];
                },
            },
        };
        delete config.options.onClick
    } else if (settings.graphTypes.testMostFailedGraphType == "timeline") {
        config = get_graph_config("timeline", graphData, `Top ${limit}`, "Run", "Test");
        config.options.plugins.tooltip = {
            callbacks: {
                label: function (context) {
                    return callbackData[context.raw.x[0]];
                },
            },
        };
        config.options.scales.x = {
            ticks: {
                minRotation: 45,
                maxRotation: 45,
                stepSize: 1,
                callback: function (value, index, ticks) {
                    return callbackData[this.getLabelForValue(value)];
                },
            },
            title: {
                display: settings.show.axisTitles,
                text: "Run",
            },
        };
        config.options.onClick = (event, chartElement) => {
            if (chartElement.length) {
                open_log_file(event, chartElement, callbackData)
            }
        };
        if (!settings.show.dateLabels) { config.options.scales.x.ticks.display = false }
    }
    update_height("testMostFailedVertical", config.data.labels.length, settings.graphTypes.testMostFailedGraphType);
    return config;
}

// function to create test most failed graph in the test section
function create_test_most_failed_graph() {
    console.log("creating_test_most_failed_graph");
    if (testMostFailedGraph) { testMostFailedGraph.destroy(); }
    testMostFailedGraph = new Chart("testMostFailedGraph", _build_test_most_failed_config());
    testMostFailedGraph.canvas.addEventListener("click", (event) => {
        open_log_from_label(testMostFailedGraph, event)
    });
}

// build config for test recent most failed graph
function _build_test_recent_most_failed_config() {
    const data = get_most_failed_data("test", settings.graphTypes.testRecentMostFailedGraphType, filteredTests, true);
    const graphData = data[0]
    const callbackData = data[1];
    var config;
    const limit = inFullscreen && inFullscreenGraph.includes("testRecentMostFailed") ? 50 : 10;
    if (settings.graphTypes.testRecentMostFailedGraphType == "bar") {
        config = get_graph_config("bar", graphData, `Top ${limit}`, "Test", "Fails");
        config.options.plugins.legend = { display: false };
        config.options.plugins.tooltip = {
            callbacks: {
                label: function (tooltipItem) {
                    return callbackData[tooltipItem.label];
                },
            },
        };
        delete config.options.onClick
    } else if (settings.graphTypes.testRecentMostFailedGraphType == "timeline") {
        config = get_graph_config("timeline", graphData, `Top ${limit}`, "Run", "Test");
        config.options.plugins.tooltip = {
            callbacks: {
                label: function (context) {
                    return callbackData[context.raw.x[0]];
                },
            },
        };
        config.options.scales.x = {
            ticks: {
                minRotation: 45,
                maxRotation: 45,
                stepSize: 1,
                callback: function (value, index, ticks) {
                    return callbackData[this.getLabelForValue(value)];
                },
            },
            title: {
                display: settings.show.axisTitles,
                text: "Run",
            },
        };
        config.options.onClick = (event, chartElement) => {
            if (chartElement.length) {
                open_log_file(event, chartElement, callbackData)
            }
        };
        if (!settings.show.dateLabels) { config.options.scales.x.ticks.display = false }
    }
    update_height("testRecentMostFailedVertical", config.data.labels.length, settings.graphTypes.testRecentMostFailedGraphType);
    return config;
}

// function to create test recent most failed graph in the test section
function create_test_recent_most_failed_graph() {
    console.log("creating_test_recent_most_failed_graph");
    if (testRecentMostFailedGraph) { testRecentMostFailedGraph.destroy(); }
    testRecentMostFailedGraph = new Chart("testRecentMostFailedGraph", _build_test_recent_most_failed_config());
    testRecentMostFailedGraph.canvas.addEventListener("click", (event) => {
        open_log_from_label(testRecentMostFailedGraph, event)
    });
}

// build config for test most time consuming graph
function _build_test_most_time_consuming_config() {
    const onlyLastRun = document.getElementById("onlyLastRunTest").checked;
    const data = get_most_time_consuming_or_most_used_data("test", settings.graphTypes.testMostTimeConsumingGraphType, filteredTests, onlyLastRun);
    const graphData = data[0]
    const callbackData = data[1];
    var config;
    const limit = inFullscreen && inFullscreenGraph.includes("testMostTimeConsuming") ? 50 : 10;
    if (settings.graphTypes.testMostTimeConsumingGraphType == "bar") {
        config = get_graph_config("bar", graphData, `Top ${limit}`, "Test", "Most Time Consuming");
        config.options.plugins.legend = { display: false };
        config.options.plugins.tooltip = {
            callbacks: {
                label: function (tooltipItem) {
                    const key = tooltipItem.label;
                    const cb = callbackData;
                    const runStarts = cb.run_starts[key] || [];
                    const namesToShow = settings.show.aliases ? cb.aliases[key] : runStarts;
                    return runStarts.map((runStart, idx) => {
                        const info = cb.details[key][runStart];
                        const displayName = namesToShow[idx];
                        if (!info) return `${displayName}: (no data)`;
                        return `${displayName}: ${format_duration(info.duration)}`;
                    });
                }
            },
        };
        delete config.options.onClick
    } else if (settings.graphTypes.testMostTimeConsumingGraphType == "timeline") {
        config = get_graph_config("timeline", graphData, `Top ${limit}`, "Run", "Test");
        config.options.plugins.tooltip = {
            callbacks: {
                label: function (context) {
                    const key = context.dataset.label;
                    const runIndex = context.raw.x[0];
                    const runStart = callbackData.runs[runIndex];
                    const info = callbackData.details[key][runStart];
                    const displayName = settings.show.aliases
                        ? callbackData.aliases[runIndex]
                        : runStart;
                    if (!info) return `${displayName}: (no data)`;
                    return `${displayName}: ${format_duration(info.duration)}`;
                }
            },
        };
        config.options.scales.x = {
            ticks: {
                minRotation: 45,
                maxRotation: 45,
                stepSize: 1,
                callback: function (value, index, ticks) {
                    const displayName = settings.show.aliases
                        ? callbackData.aliases[this.getLabelForValue(value)]
                        : callbackData.runs[this.getLabelForValue(value)];
                    return displayName;
                },
            },
            title: {
                display: settings.show.axisTitles,
                text: "Run",
            },
        };
        config.options.onClick = (event, chartElement) => {
            if (chartElement.length) {
                open_log_file(event, chartElement, callbackData.runs)
            }
        };
        if (!settings.show.dateLabels) { config.options.scales.x.ticks.display = false }
    }
    update_height("testMostTimeConsumingVertical", config.data.labels.length, settings.graphTypes.testMostTimeConsumingGraphType);
    return config;
}

// function to create the most time consuming test graph in the test section
function create_test_most_time_consuming_graph() {
    console.log("creating_test_most_time_consuming_graph");
    if (testMostTimeConsumingGraph) { testMostTimeConsumingGraph.destroy(); }
    testMostTimeConsumingGraph = new Chart("testMostTimeConsumingGraph", _build_test_most_time_consuming_config());
    testMostTimeConsumingGraph.canvas.addEventListener("click", (event) => {
        open_log_from_label(testMostTimeConsumingGraph, event)
    });
}

// update function for test statistics graph - updates existing chart in-place
function update_test_statistics_graph() {
    console.log("updating_test_statistics_graph");
    if (!testStatisticsGraph) { create_test_statistics_graph(); return; }
    const config = _build_test_statistics_config();
    testStatisticsGraph.data = config.data;
    testStatisticsGraph.options = config.options;
    testStatisticsGraph.update();
}

// update function for test duration graph - updates existing chart in-place
function update_test_duration_graph() {
    console.log("updating_test_duration_graph");
    if (!testDurationGraph) { create_test_duration_graph(); return; }
    const config = _build_test_duration_config();
    testDurationGraph.data = config.data;
    testDurationGraph.options = config.options;
    testDurationGraph.update();
}

// update function for test messages graph - updates existing chart in-place
function update_test_messages_graph() {
    console.log("updating_test_messages_graph");
    if (!testMessagesGraph) { create_test_messages_graph(); return; }
    const config = _build_test_messages_config();
    testMessagesGraph.data = config.data;
    testMessagesGraph.options = config.options;
    testMessagesGraph.update();
}

// update function for test duration deviation graph - updates existing chart in-place
function update_test_duration_deviation_graph() {
    console.log("updating_test_duration_deviation_graph");
    if (!testDurationDeviationGraph) { create_test_duration_deviation_graph(); return; }
    const config = _build_test_duration_deviation_config();
    testDurationDeviationGraph.data = config.data;
    testDurationDeviationGraph.options = config.options;
    testDurationDeviationGraph.update();
}

// update function for test most flaky graph - updates existing chart in-place
function update_test_most_flaky_graph() {
    console.log("updating_test_most_flaky_graph");
    if (!testMostFlakyGraph) { create_test_most_flaky_graph(); return; }
    const config = _build_test_most_flaky_config();
    testMostFlakyGraph.data = config.data;
    testMostFlakyGraph.options = config.options;
    testMostFlakyGraph.update();
}

// update function for test recent most flaky graph - updates existing chart in-place
function update_test_recent_most_flaky_graph() {
    console.log("updating_test_recent_most_flaky_graph");
    if (!testRecentMostFlakyGraph) { create_test_recent_most_flaky_graph(); return; }
    const config = _build_test_recent_most_flaky_config();
    testRecentMostFlakyGraph.data = config.data;
    testRecentMostFlakyGraph.options = config.options;
    testRecentMostFlakyGraph.update();
}

// update function for test most failed graph - updates existing chart in-place
function update_test_most_failed_graph() {
    console.log("updating_test_most_failed_graph");
    if (!testMostFailedGraph) { create_test_most_failed_graph(); return; }
    const config = _build_test_most_failed_config();
    testMostFailedGraph.data = config.data;
    testMostFailedGraph.options = config.options;
    testMostFailedGraph.update();
}

// update function for test recent most failed graph - updates existing chart in-place
function update_test_recent_most_failed_graph() {
    console.log("updating_test_recent_most_failed_graph");
    if (!testRecentMostFailedGraph) { create_test_recent_most_failed_graph(); return; }
    const config = _build_test_recent_most_failed_config();
    testRecentMostFailedGraph.data = config.data;
    testRecentMostFailedGraph.options = config.options;
    testRecentMostFailedGraph.update();
}

// update function for test most time consuming graph - updates existing chart in-place
function update_test_most_time_consuming_graph() {
    console.log("updating_test_most_time_consuming_graph");
    if (!testMostTimeConsumingGraph) { create_test_most_time_consuming_graph(); return; }
    const config = _build_test_most_time_consuming_config();
    testMostTimeConsumingGraph.data = config.data;
    testMostTimeConsumingGraph.options = config.options;
    testMostTimeConsumingGraph.update();
}

export {
    create_test_statistics_graph,
    create_test_duration_graph,
    create_test_duration_deviation_graph,
    create_test_messages_graph,
    create_test_most_flaky_graph,
    create_test_recent_most_flaky_graph,
    create_test_most_failed_graph,
    create_test_recent_most_failed_graph,
    create_test_most_time_consuming_graph,
    update_test_statistics_graph,
    update_test_duration_graph,
    update_test_duration_deviation_graph,
    update_test_messages_graph,
    update_test_most_flaky_graph,
    update_test_recent_most_flaky_graph,
    update_test_most_failed_graph,
    update_test_recent_most_failed_graph,
    update_test_most_time_consuming_graph,
};