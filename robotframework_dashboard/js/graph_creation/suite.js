import { get_donut_folder_graph_data, get_donut_folder_fail_graph_data } from '../graph_data/donut.js';
import { get_statistics_graph_data } from '../graph_data/statistics.js';
import { get_duration_graph_data } from '../graph_data/duration.js';
import { get_most_failed_data } from '../graph_data/failed.js';
import { get_most_time_consuming_or_most_used_data } from '../graph_data/time_consuming.js';
import { get_graph_config } from '../graph_data/graph_config.js';
import { open_log_from_label, open_log_file } from '../log.js';
import { format_duration } from '../common.js';
import { update_height } from '../graph_data/helpers.js';
import { setup_suites_in_suite_select } from '../filter.js';
import { dataLabelConfig } from '../variables/chartconfig.js';
import { settings } from '../variables/settings.js';
import { inFullscreen, inFullscreenGraph, filteredSuites } from '../variables/globals.js';

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

// function to create suite last failed donut
function create_suite_folder_fail_donut_graph() {
    console.log("creating_suite_folder_fail_donut_graph");
    if (suiteFolderFailDonutGraph) { suiteFolderFailDonutGraph.destroy(); }
    suiteFolderFailDonutGraph = new Chart("suiteFolderFailDonutGraph", _build_suite_folder_fail_donut_config());
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

// function to create suite statistics graph in the suite section
function create_suite_statistics_graph() {
    console.log("creating_suite_statistics_graph");
    if (suiteStatisticsGraph) { suiteStatisticsGraph.destroy(); }
    suiteStatisticsGraph = new Chart("suiteStatisticsGraph", _build_suite_statistics_config());
    suiteStatisticsGraph.canvas.addEventListener("click", (event) => {
        open_log_from_label(suiteStatisticsGraph, event)
    });
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

// function to create suite duration graph in the suite section
function create_suite_duration_graph() {
    console.log("creating_suite_duration_graph");
    if (suiteDurationGraph) { suiteDurationGraph.destroy(); }
    suiteDurationGraph = new Chart("suiteDurationGraph", _build_suite_duration_config());
    suiteDurationGraph.canvas.addEventListener("click", (event) => {
        open_log_from_label(suiteDurationGraph, event)
    });
}

// build config for suite most failed graph
function _build_suite_most_failed_config() {
    const data = get_most_failed_data("suite", settings.graphTypes.suiteMostFailedGraphType, filteredSuites, false);
    const graphData = data[0];
    const callbackData = data[1];
    var config;
    const limit = inFullscreen && inFullscreenGraph.includes("suiteMostFailed") ? 50 : 10;
    if (settings.graphTypes.suiteMostFailedGraphType == "bar") {
        config = get_graph_config("bar", graphData, `Top ${limit}`, "Suite", "Fails");
        config.options.plugins.legend = { display: false };
        config.options.plugins.tooltip = {
            callbacks: {
                label: function (tooltipItem) {
                    return callbackData[tooltipItem.label];
                },
            },
        };
        delete config.options.onClick
    } else if (settings.graphTypes.suiteMostFailedGraphType == "timeline") {
        config = get_graph_config("timeline", graphData, `Top ${limit}`, "Run", "Suite");
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
    update_height("suiteMostFailedVertical", config.data.labels.length, settings.graphTypes.suiteMostFailedGraphType);
    return config;
}

// function to create suite most failed graph in the suite section
function create_suite_most_failed_graph() {
    console.log("creating_suite_most_failed_graph");
    if (suiteMostFailedGraph) { suiteMostFailedGraph.destroy(); }
    suiteMostFailedGraph = new Chart("suiteMostFailedGraph", _build_suite_most_failed_config());
    suiteMostFailedGraph.canvas.addEventListener("click", (event) => {
        open_log_from_label(suiteMostFailedGraph, event)
    });
}

// build config for suite most time consuming graph
function _build_suite_most_time_consuming_config() {
    const onlyLastRun = document.getElementById("onlyLastRunSuite").checked;
    const data = get_most_time_consuming_or_most_used_data("suite", settings.graphTypes.suiteMostTimeConsumingGraphType, filteredSuites, onlyLastRun);
    const graphData = data[0]
    const callbackData = data[1];
    var config;
    const limit = inFullscreen && inFullscreenGraph.includes("suiteMostTimeConsuming") ? 50 : 10;
    if (settings.graphTypes.suiteMostTimeConsumingGraphType == "bar") {
        config = get_graph_config("bar", graphData, `Top ${limit}`, "Suite", "Most Time Consuming");
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
    } else if (settings.graphTypes.suiteMostTimeConsumingGraphType == "timeline") {
        config = get_graph_config("timeline", graphData, `Top ${limit}`, "Run", "Suite");
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
    update_height("suiteMostTimeConsumingVertical", config.data.labels.length, settings.graphTypes.suiteMostTimeConsumingGraphType);
    return config;
}

// function to create the most time consuming suite graph in the suite section
function create_suite_most_time_consuming_graph() {
    console.log("creating_suite_most_time_consuming_graph");
    if (suiteMostTimeConsumingGraph) { suiteMostTimeConsumingGraph.destroy(); }
    suiteMostTimeConsumingGraph = new Chart("suiteMostTimeConsumingGraph", _build_suite_most_time_consuming_config());
    suiteMostTimeConsumingGraph.canvas.addEventListener("click", (event) => {
        open_log_from_label(suiteMostTimeConsumingGraph, event)
    });
}


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

// update function for suite folder fail donut graph - updates existing chart in-place
function update_suite_folder_fail_donut_graph() {
    console.log("updating_suite_folder_fail_donut_graph");
    if (!suiteFolderFailDonutGraph) { create_suite_folder_fail_donut_graph(); return; }
    const config = _build_suite_folder_fail_donut_config();
    suiteFolderFailDonutGraph.data = config.data;
    suiteFolderFailDonutGraph.options = config.options;
    suiteFolderFailDonutGraph.update();
}

// update function for suite statistics graph - updates existing chart in-place
function update_suite_statistics_graph() {
    console.log("updating_suite_statistics_graph");
    if (!suiteStatisticsGraph) { create_suite_statistics_graph(); return; }
    const config = _build_suite_statistics_config();
    suiteStatisticsGraph.data = config.data;
    suiteStatisticsGraph.options = config.options;
    suiteStatisticsGraph.update();
}

// update function for suite duration graph - updates existing chart in-place
function update_suite_duration_graph() {
    console.log("updating_suite_duration_graph");
    if (!suiteDurationGraph) { create_suite_duration_graph(); return; }
    const config = _build_suite_duration_config();
    suiteDurationGraph.data = config.data;
    suiteDurationGraph.options = config.options;
    suiteDurationGraph.update();
}

// update function for suite most failed graph - updates existing chart in-place
function update_suite_most_failed_graph() {
    console.log("updating_suite_most_failed_graph");
    if (!suiteMostFailedGraph) { create_suite_most_failed_graph(); return; }
    const config = _build_suite_most_failed_config();
    suiteMostFailedGraph.data = config.data;
    suiteMostFailedGraph.options = config.options;
    suiteMostFailedGraph.update();
}

// update function for suite most time consuming graph - updates existing chart in-place
function update_suite_most_time_consuming_graph() {
    console.log("updating_suite_most_time_consuming_graph");
    if (!suiteMostTimeConsumingGraph) { create_suite_most_time_consuming_graph(); return; }
    const config = _build_suite_most_time_consuming_config();
    suiteMostTimeConsumingGraph.data = config.data;
    suiteMostTimeConsumingGraph.options = config.options;
    suiteMostTimeConsumingGraph.update();
}


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