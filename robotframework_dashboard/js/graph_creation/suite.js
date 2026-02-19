import { get_donut_folder_graph_data, get_donut_folder_fail_graph_data } from '../graph_data/donut.js';
import { get_statistics_graph_data } from '../graph_data/statistics.js';
import { get_duration_graph_data } from '../graph_data/duration.js';
import { get_graph_config } from '../graph_data/graph_config.js';
import { setup_suites_in_suite_select } from '../filter.js';
import { dataLabelConfig } from '../variables/chartconfig.js';
import { settings } from '../variables/settings.js';
import { inFullscreen, inFullscreenGraph, filteredSuites } from '../variables/globals.js';
import { create_chart, update_chart } from './chart_factory.js';
import { build_most_failed_config, build_most_time_consuming_config } from './config_helpers.js';

// build config for suite folder donut graph
function _build_suite_folder_donut_config(folder) {
    const data = get_donut_folder_graph_data("suite", filteredSuites, folder);
    const graphData = data[0]
    const callbackData = data[1]
    const labels = graphData.labels
    var config = get_graph_config("donut", graphData, "All Folders");
    config.options.plugins.tooltip.callbacks = {
        label: function (context) {
            const label = labels[context.dataIndex]
            const passed = callbackData[label].passed
            const failed = callbackData[label].failed
            const skipped = callbackData[label].skipped
            return [`Total: ${context.raw}`, `Passed: ${passed}`, `Failed: ${failed}`, `Skipped: ${skipped}`];
        },
        title: function (tooltipItems) {
            const fullTitle = tooltipItems[0].label;
            const maxLineLength = 30;
            const lines = fullTitle.match(new RegExp('.{1,' + maxLineLength + '}', 'g')) || [fullTitle];
            return lines;
        }
    }
    config.options.onClick = (event) => {
        if (event.chart.tooltip.title) {
            setTimeout(() => {
                update_suite_folder_donut_graph(event.chart.tooltip.title.join(''));
            }, 0);
        }
    };
    config.options.onHover = function (event, chartElement) {
        const targetCanvas = event.native.target;
        if (chartElement.length > 0) {
            targetCanvas.style.cursor = 'pointer';
        } else {
            targetCanvas.style.cursor = 'default';
        }
    };
    return config;
}

// function to create suite folder donut
function create_suite_folder_donut_graph(folder) {
    console.log("creating_suite_folder_donut_graph");
    const suiteFolder = document.getElementById("suiteFolder")
    suiteFolder.innerText = folder == "" || folder == undefined ? "All" : folder;
    if (folder || folder == "") { // not first load so update the graphs accordingly as well
        setup_suites_in_suite_select();
        update_suite_folder_fail_donut_graph();
        update_suite_statistics_graph();
        update_suite_duration_graph();
    }
    if (suiteFolderDonutGraph) { suiteFolderDonutGraph.destroy(); }
    suiteFolderDonutGraph = new Chart("suiteFolderDonutGraph", _build_suite_folder_donut_config(folder));
}

// build config for suite folder fail donut graph
function _build_suite_folder_fail_donut_config() {
    const data = get_donut_folder_fail_graph_data("suite", filteredSuites);
    const graphData = data[0]
    const callbackData = data[1]
    const labels = graphData.labels
    if (graphData.labels.length == 0) {
        graphData.labels = ["No Failed Folders In Last Run"]
        graphData.datasets = [{
            data: [1],
            backgroundColor: ["grey"],
        }]
    }
    var config = get_graph_config("donut", graphData, "Last Run");
    config.options.plugins.tooltip.callbacks = {
        label: function (context) {
            if (context.label == "No Failed Folders In Last Run") { return null }
            const label = labels[context.dataIndex]
            const passed = callbackData[label].passed
            const failed = callbackData[label].failed
            const skipped = callbackData[label].skipped
            return [`Passed: ${passed}`, `Failed: ${failed}`, `Skipped: ${skipped}`];
        },
        title: function (tooltipItem) {
            return tooltipItem.label;
        }
    }
    config.options.plugins.datalabels = {
        ...dataLabelConfig,
        formatter: function (value, context) {
            if (value === 0) return null;
            const total = graphData.datasets[0].data.reduce((a, b) => a + b, 0);
            const percentage = Math.round((value / total) * 100);
            if (percentage <= 5) return null;
            const label = graphData.labels[context.dataIndex].split(".").pop();
            return `${label}: ${value} (${percentage}%)`;
        }
    };
    config.options.onClick = (event) => {
        if (event.chart.tooltip.title) {
            setTimeout(() => {
                update_suite_folder_donut_graph(event.chart.tooltip.title.join(''));
            }, 0);
        }
    };
    config.options.onHover = function (event, chartElement) {
        const targetCanvas = event.native.target;
        if (chartElement.length > 0) {
            targetCanvas.style.cursor = 'pointer';
        } else {
            targetCanvas.style.cursor = 'default';
        }
    };
    return config;
}

// build config for suite statistics graph
function _build_suite_statistics_config() {
    const data = get_statistics_graph_data("suite", settings.graphTypes.suiteStatisticsGraphType, filteredSuites);
    const graphData = data[0]
    const callbackData = data[1]
    var config;
    if (settings.graphTypes.suiteStatisticsGraphType == "line") {
        config = get_graph_config("line", graphData, "", "Date", "amount", false);
        config.options.plugins.tooltip = {
            callbacks: {
                title: function (tooltipItem) {
                    return `${tooltipItem[0].label}: ${callbackData[tooltipItem[0].dataIndex]}`
                }
            }
        }
    } else if (settings.graphTypes.suiteStatisticsGraphType == "amount") {
        config = get_graph_config("bar", graphData, "", "Run", "Amount Of Tests");
        const filter = config.options.plugins.tooltip.filter
        config.options.plugins.tooltip = {
            filter,
            callbacks: {
                title: function (tooltipItem) {
                    return `${tooltipItem[0].label}: ${callbackData[tooltipItem[0].dataIndex]}`
                }
            }
        }
    } else if (settings.graphTypes.suiteStatisticsGraphType == "percentages") {
        config = get_graph_config("bar", graphData, "", "Run", "Percentage");
        const filter = config.options.plugins.tooltip.filter
        config.options.plugins.tooltip = {
            filter,
            callbacks: {
                title: function (tooltipItem) {
                    return `${tooltipItem[0].label}: ${callbackData[tooltipItem[0].dataIndex]}`
                }
            }
        }
    }
    if (!settings.show.dateLabels) { config.options.scales.x.ticks.display = false }
    return config;
}

// build config for suite duration graph
function _build_suite_duration_config() {
    const graphData = get_duration_graph_data("suite", settings.graphTypes.suiteDurationGraphType, "elapsed_s", filteredSuites);
    var config;
    if (settings.graphTypes.suiteDurationGraphType == "bar") {
        const limit = inFullscreen && inFullscreenGraph.includes("suiteDuration") ? 100 : 30;
        config = get_graph_config("bar", graphData, `Max ${limit} Bars`, "Run", "Duration");
    } else if (settings.graphTypes.suiteDurationGraphType == "line") {
        config = get_graph_config("line", graphData, "", "Date", "Duration");
    }
    if (!settings.show.dateLabels) { config.options.scales.x.ticks.display = false }
    return config;
}

// build config for suite most failed graph
function _build_suite_most_failed_config() {
    return build_most_failed_config("suiteMostFailed", "suite", "Suite", filteredSuites, false);
}

// build config for suite most time consuming graph
function _build_suite_most_time_consuming_config() {
    return build_most_time_consuming_config("suiteMostTimeConsuming", "suite", "Suite", filteredSuites, "onlyLastRunSuite");
}

// create functions
function create_suite_statistics_graph() { create_chart("suiteStatisticsGraph", _build_suite_statistics_config); }
function create_suite_duration_graph() { create_chart("suiteDurationGraph", _build_suite_duration_config); }
function create_suite_most_failed_graph() { create_chart("suiteMostFailedGraph", _build_suite_most_failed_config); }
function create_suite_most_time_consuming_graph() { create_chart("suiteMostTimeConsumingGraph", _build_suite_most_time_consuming_config); }
function create_suite_folder_fail_donut_graph() { create_chart("suiteFolderFailDonutGraph", _build_suite_folder_fail_donut_config, false); }

// update function for suite folder donut graph - updates existing chart in-place
function update_suite_folder_donut_graph(folder) {
    console.log("updating_suite_folder_donut_graph");
    const suiteFolder = document.getElementById("suiteFolder")
    suiteFolder.innerText = folder == "" || folder == undefined ? "All" : folder;
    if (folder || folder == "") {
        setup_suites_in_suite_select();
        update_suite_folder_fail_donut_graph();
        update_suite_statistics_graph();
        update_suite_duration_graph();
    }
    if (!suiteFolderDonutGraph) { create_suite_folder_donut_graph(folder); return; }
    const config = _build_suite_folder_donut_config(folder);
    suiteFolderDonutGraph.data = config.data;
    suiteFolderDonutGraph.options = config.options;
    suiteFolderDonutGraph.update();
}

// update functions
function update_suite_folder_fail_donut_graph() { update_chart("suiteFolderFailDonutGraph", _build_suite_folder_fail_donut_config, false); }
function update_suite_statistics_graph() { update_chart("suiteStatisticsGraph", _build_suite_statistics_config); }
function update_suite_duration_graph() { update_chart("suiteDurationGraph", _build_suite_duration_config); }
function update_suite_most_failed_graph() { update_chart("suiteMostFailedGraph", _build_suite_most_failed_config); }
function update_suite_most_time_consuming_graph() { update_chart("suiteMostTimeConsumingGraph", _build_suite_most_time_consuming_config); }


export {
    create_suite_statistics_graph,
    create_suite_folder_donut_graph,
    create_suite_folder_fail_donut_graph,
    create_suite_duration_graph,
    create_suite_most_failed_graph,
    create_suite_most_time_consuming_graph,
    update_suite_statistics_graph,
    update_suite_folder_donut_graph,
    update_suite_folder_fail_donut_graph,
    update_suite_duration_graph,
    update_suite_most_failed_graph,
    update_suite_most_time_consuming_graph
};