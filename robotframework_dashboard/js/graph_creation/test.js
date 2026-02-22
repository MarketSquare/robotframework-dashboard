import { get_test_statistics_data } from "../graph_data/statistics.js";
import { get_duration_graph_data } from "../graph_data/duration.js";
import { get_messages_data } from "../graph_data/messages.js";
import { get_duration_deviation_data } from "../graph_data/duration_deviation.js";
import { get_graph_config } from "../graph_data/graph_config.js";
import { update_height } from "../graph_data/helpers.js";
import { open_log_file } from "../log.js";
import { inFullscreen, inFullscreenGraph, ignoreSkips, ignoreSkipsRecent, filteredTests } from "../variables/globals.js";
import { settings } from "../variables/settings.js";
import { create_chart, update_chart } from "./chart_factory.js";
import { build_most_failed_config, build_most_flaky_config, build_most_time_consuming_config } from "./config_helpers.js";

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
function create_test_statistics_graph() { create_chart("testStatisticsGraph", _build_test_statistics_config); }

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
function create_test_duration_graph() { create_chart("testDurationGraph", _build_test_duration_config); }

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
function create_test_messages_graph() { create_chart("testMessagesGraph", _build_test_messages_config); }

// build config for test duration deviation graph
function _build_test_duration_deviation_config() {
    const graphData = get_duration_deviation_data("test", settings.graphTypes.testDurationDeviationGraphType, filteredTests)
    const config = get_graph_config("boxplot", graphData, "", "Test", "Duration");
    delete config.options.onClick
    return config;
}

// function to create test duration deviation graph in test section
function create_test_duration_deviation_graph() { create_chart("testDurationDeviationGraph", _build_test_duration_deviation_config); }

// build config for test most flaky graph
function _build_test_most_flaky_config() {
    return build_most_flaky_config("testMostFlaky", "test", filteredTests, ignoreSkips, false);
}

// function to create test most flaky graph in test section
function create_test_most_flaky_graph() { create_chart("testMostFlakyGraph", _build_test_most_flaky_config); }

// build config for test recent most flaky graph
function _build_test_recent_most_flaky_config() {
    return build_most_flaky_config("testRecentMostFlaky", "test", filteredTests, ignoreSkipsRecent, true);
}

// function to create test recent most flaky graph in test section
function create_test_recent_most_flaky_graph() { create_chart("testRecentMostFlakyGraph", _build_test_recent_most_flaky_config); }

// build config for test most failed graph
function _build_test_most_failed_config() {
    return build_most_failed_config("testMostFailed", "test", "Test", filteredTests, false);
}

// function to create test most failed graph in the test section
function create_test_most_failed_graph() { create_chart("testMostFailedGraph", _build_test_most_failed_config); }

// build config for test recent most failed graph
function _build_test_recent_most_failed_config() {
    return build_most_failed_config("testRecentMostFailed", "test", "Test", filteredTests, true);
}

// function to create test recent most failed graph in the test section
function create_test_recent_most_failed_graph() { create_chart("testRecentMostFailedGraph", _build_test_recent_most_failed_config); }

// build config for test most time consuming graph
function _build_test_most_time_consuming_config() {
    return build_most_time_consuming_config("testMostTimeConsuming", "test", "Test", filteredTests, "onlyLastRunTest");
}

// function to create the most time consuming test graph in the test section
function create_test_most_time_consuming_graph() { create_chart("testMostTimeConsumingGraph", _build_test_most_time_consuming_config); }

// update function for test statistics graph - updates existing chart in-place
function update_test_statistics_graph() { update_chart("testStatisticsGraph", _build_test_statistics_config); }

// update function for test duration graph - updates existing chart in-place
function update_test_duration_graph() { update_chart("testDurationGraph", _build_test_duration_config); }

// update function for test messages graph - updates existing chart in-place
function update_test_messages_graph() { update_chart("testMessagesGraph", _build_test_messages_config); }

// update function for test duration deviation graph - updates existing chart in-place
function update_test_duration_deviation_graph() { update_chart("testDurationDeviationGraph", _build_test_duration_deviation_config); }

// update function for test most flaky graph - updates existing chart in-place
function update_test_most_flaky_graph() { update_chart("testMostFlakyGraph", _build_test_most_flaky_config); }

// update function for test recent most flaky graph - updates existing chart in-place
function update_test_recent_most_flaky_graph() { update_chart("testRecentMostFlakyGraph", _build_test_recent_most_flaky_config); }

// update function for test most failed graph - updates existing chart in-place
function update_test_most_failed_graph() { update_chart("testMostFailedGraph", _build_test_most_failed_config); }

// update function for test recent most failed graph - updates existing chart in-place
function update_test_recent_most_failed_graph() { update_chart("testRecentMostFailedGraph", _build_test_recent_most_failed_config); }

// update function for test most time consuming graph - updates existing chart in-place
function update_test_most_time_consuming_graph() { update_chart("testMostTimeConsumingGraph", _build_test_most_time_consuming_config); }

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