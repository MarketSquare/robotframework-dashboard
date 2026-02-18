import { settings } from "../variables/settings.js";
import { inFullscreen, inFullscreenGraph } from "../variables/globals.js";
import { get_statistics_graph_data } from "../graph_data/statistics.js";
import { get_duration_graph_data } from "../graph_data/duration.js";
import { get_most_failed_data } from "../graph_data/failed.js";
import { get_most_time_consuming_or_most_used_data } from "../graph_data/time_consuming.js";
import { get_graph_config } from "../graph_data/graph_config.js";
import { open_log_from_label, open_log_file } from "../log.js";
import { format_duration } from "../common.js";
import { update_height } from "../graph_data/helpers.js";

// build config for keyword statistics graph
function _build_keyword_statistics_config() {
    const data = get_statistics_graph_data("keyword", settings.graphTypes.keywordStatisticsGraphType, filteredKeywords);
    const graphData = data[0]
    var config;
    if (settings.graphTypes.keywordStatisticsGraphType == "line") {
        config = get_graph_config("line", graphData, "", "Date", "Amount", false);
    } else if (settings.graphTypes.keywordStatisticsGraphType == "amount") {
        config = get_graph_config("bar", graphData, "", "Run", "Amount");
    } else if (settings.graphTypes.keywordStatisticsGraphType == "percentages") {
        config = get_graph_config("bar", graphData, "", "Run", "Percentage");
    }
    if (!settings.show.dateLabels) { config.options.scales.x.ticks.display = false }
    return config;
}

// function to keyword statistics graph in the keyword section
function create_keyword_statistics_graph() {
    console.log("creating_keyword_statistics_graph");
    if (keywordStatisticsGraph) { keywordStatisticsGraph.destroy(); }
    keywordStatisticsGraph = new Chart("keywordStatisticsGraph", _build_keyword_statistics_config());
    keywordStatisticsGraph.canvas.addEventListener("click", (event) => {
        open_log_from_label(keywordStatisticsGraph, event)
    });
}

// build config for keyword times run graph
function _build_keyword_times_run_config() {
    const graphData = get_duration_graph_data("keyword", settings.graphTypes.keywordTimesRunGraphType, "times_run", filteredKeywords);
    var config;
    if (settings.graphTypes.keywordTimesRunGraphType == "bar") {
        const limit = inFullscreen && inFullscreenGraph.includes("keywordTimesRun") ? 100 : 30;
        config = get_graph_config("bar", graphData, `Max ${limit} Bars`, "Run", "Times Run");
    } else if (settings.graphTypes.keywordTimesRunGraphType == "line") {
        config = get_graph_config("line", graphData, "", "Date", "Times Run");
    }
    if (!settings.show.dateLabels) { config.options.scales.x.ticks.display = false }
    return config;
}

// function to keyword times run graph in the keyword section
function create_keyword_times_run_graph() {
    console.log("creating_keyword_times_run_graph");
    if (keywordTimesRunGraph) { keywordTimesRunGraph.destroy(); }
    keywordTimesRunGraph = new Chart("keywordTimesRunGraph", _build_keyword_times_run_config());
    keywordTimesRunGraph.canvas.addEventListener("click", (event) => {
        open_log_from_label(keywordTimesRunGraph, event)
    });
}

// build config for keyword total duration graph
function _build_keyword_total_duration_config() {
    const graphData = get_duration_graph_data("keyword", settings.graphTypes.keywordTotalDurationGraphType, "total_time_s", filteredKeywords);
    var config;
    if (settings.graphTypes.keywordTotalDurationGraphType == "bar") {
        const limit = inFullscreen && inFullscreenGraph.includes("keywordTotalDuration") ? 100 : 30;
        config = get_graph_config("bar", graphData, `Max ${limit} Bars`, "Run", "Duration");
    } else if (settings.graphTypes.keywordTotalDurationGraphType == "line") {
        config = get_graph_config("line", graphData, "", "Date", "Duration");
    }
    if (!settings.show.dateLabels) { config.options.scales.x.ticks.display = false }
    return config;
}

// function to keyword total time graph in the keyword section
function create_keyword_total_duration_graph() {
    console.log("creating_keyword_total_duration_graph");
    if (keywordTotalDurationGraph) { keywordTotalDurationGraph.destroy(); }
    keywordTotalDurationGraph = new Chart("keywordTotalDurationGraph", _build_keyword_total_duration_config());
    keywordTotalDurationGraph.canvas.addEventListener("click", (event) => {
        open_log_from_label(keywordTotalDurationGraph, event)
    });
}

// build config for keyword average duration graph
function _build_keyword_average_duration_config() {
    const graphData = get_duration_graph_data("keyword", settings.graphTypes.keywordAverageDurationGraphType, "average_time_s", filteredKeywords);
    var config;
    if (settings.graphTypes.keywordAverageDurationGraphType == "bar") {
        const limit = inFullscreen && inFullscreenGraph.includes("keywordAverageDuration") ? 100 : 30;
        config = get_graph_config("bar", graphData, `Max ${limit} Bars`, "Run", "Duration");
    } else if (settings.graphTypes.keywordAverageDurationGraphType == "line") {
        config = get_graph_config("line", graphData, "", "Date", "Duration");
    }
    if (!settings.show.dateLabels) { config.options.scales.x.ticks.display = false }
    return config;
}

// function to keyword average time graph in the keyword section
function create_keyword_average_duration_graph() {
    console.log("creating_keyword_average_duration_graph");
    if (keywordAverageDurationGraph) { keywordAverageDurationGraph.destroy(); }
    keywordAverageDurationGraph = new Chart("keywordAverageDurationGraph", _build_keyword_average_duration_config());
    keywordAverageDurationGraph.canvas.addEventListener("click", (event) => {
        open_log_from_label(keywordAverageDurationGraph, event)
    });
}

// build config for keyword min duration graph
function _build_keyword_min_duration_config() {
    const graphData = get_duration_graph_data("keyword", settings.graphTypes.keywordMinDurationGraphType, "min_time_s", filteredKeywords);
    var config;
    if (settings.graphTypes.keywordMinDurationGraphType == "bar") {
        const limit = inFullscreen && inFullscreenGraph.includes("keywordMinDuration") ? 100 : 30;
        config = get_graph_config("bar", graphData, `Max ${limit} Bars`, "Run", "Duration");
    } else if (settings.graphTypes.keywordMinDurationGraphType == "line") {
        config = get_graph_config("line", graphData, "", "Date", "Duration");
    }
    if (!settings.show.dateLabels) { config.options.scales.x.ticks.display = false }
    return config;
}

// function to keyword min time graph in the keyword section
function create_keyword_min_duration_graph() {
    console.log("creating_keyword_min_duration_graph");
    if (keywordMinDurationGraph) { keywordMinDurationGraph.destroy(); }
    keywordMinDurationGraph = new Chart("keywordMinDurationGraph", _build_keyword_min_duration_config());
    keywordMinDurationGraph.canvas.addEventListener("click", (event) => {
        open_log_from_label(keywordMinDurationGraph, event)
    });
}

// build config for keyword max duration graph
function _build_keyword_max_duration_config() {
    const graphData = get_duration_graph_data("keyword", settings.graphTypes.keywordMaxDurationGraphType, "max_time_s", filteredKeywords);
    var config;
    if (settings.graphTypes.keywordMaxDurationGraphType == "bar") {
        const limit = inFullscreen && inFullscreenGraph.includes("keywordMaxDuration") ? 100 : 30;
        config = get_graph_config("bar", graphData, `Max ${limit} Bars`, "Run", "Duration");
    } else if (settings.graphTypes.keywordMaxDurationGraphType == "line") {
        config = get_graph_config("line", graphData, "", "Date", "Duration");
    }
    if (!settings.show.dateLabels) { config.options.scales.x.ticks.display = false }
    return config;
}

// function to keyword max time graph in the keyword section
function create_keyword_max_duration_graph() {
    console.log("creating_keyword_max_duration_graph");
    if (keywordMaxDurationGraph) { keywordMaxDurationGraph.destroy(); }
    keywordMaxDurationGraph = new Chart("keywordMaxDurationGraph", _build_keyword_max_duration_config());
    keywordMaxDurationGraph.canvas.addEventListener("click", (event) => {
        open_log_from_label(keywordMaxDurationGraph, event)
    });
}

// build config for keyword most failed graph
function _build_keyword_most_failed_config() {
    const data = get_most_failed_data("keyword", settings.graphTypes.keywordMostFailedGraphType, filteredKeywords, false);
    const graphData = data[0]
    const callbackData = data[1];
    var config;
    const limit = inFullscreen && inFullscreenGraph.includes("keywordMostFailed") ? 50 : 10;
    if (settings.graphTypes.keywordMostFailedGraphType == "bar") {
        config = get_graph_config("bar", graphData, `Top ${limit}`, "Keyword", "Fails");
        config.options.plugins.legend = { display: false };
        config.options.plugins.tooltip = {
            callbacks: {
                label: function (tooltipItem) {
                    return callbackData[tooltipItem.label];
                },
            },
        };
        delete config.options.onClick
    } else if (settings.graphTypes.keywordMostFailedGraphType == "timeline") {
        config = get_graph_config("timeline", graphData, `Top ${limit}`, "Run", "Keyword");
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
    update_height("keywordMostFailedVertical", config.data.labels.length, settings.graphTypes.keywordMostFailedGraphType);
    return config;
}

// function to create test most failed graph in the keyword section
function create_keyword_most_failed_graph() {
    console.log("creating_keyword_most_failed_graph");
    if (keywordMostFailedGraph) { keywordMostFailedGraph.destroy(); }
    keywordMostFailedGraph = new Chart("keywordMostFailedGraph", _build_keyword_most_failed_config());
    keywordMostFailedGraph.canvas.addEventListener("click", (event) => {
        open_log_from_label(keywordMostFailedGraph, event)
    });
}

// build config for keyword most time consuming graph
function _build_keyword_most_time_consuming_config() {
    const onlyLastRun = document.getElementById("onlyLastRunKeyword").checked;
    const data = get_most_time_consuming_or_most_used_data("keyword", settings.graphTypes.keywordMostTimeConsumingGraphType, filteredKeywords, onlyLastRun);
    const graphData = data[0]
    const callbackData = data[1];
    var config;
    const limit = inFullscreen && inFullscreenGraph.includes("keywordMostTimeConsuming") ? 50 : 10;
    if (settings.graphTypes.keywordMostTimeConsumingGraphType == "bar") {
        config = get_graph_config("bar", graphData, `Top ${limit}`, "Keyword", "Most Time Consuming");
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
    } else if (settings.graphTypes.keywordMostTimeConsumingGraphType == "timeline") {
        config = get_graph_config("timeline", graphData, `Top ${limit}`, "Run", "Keyword");
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
    update_height("keywordMostTimeConsumingVertical", config.data.labels.length, settings.graphTypes.keywordMostTimeConsumingGraphType);
    return config;
}

// function to create the most time consuming keyword graph in the keyword section
function create_keyword_most_time_consuming_graph() {
    console.log("creating_keyword_most_time_consuming_graph");
    if (keywordMostTimeConsumingGraph) { keywordMostTimeConsumingGraph.destroy(); }
    keywordMostTimeConsumingGraph = new Chart("keywordMostTimeConsumingGraph", _build_keyword_most_time_consuming_config());
    keywordMostTimeConsumingGraph.canvas.addEventListener("click", (event) => {
        open_log_from_label(keywordMostTimeConsumingGraph, event)
    });
}

// build config for keyword most used graph
function _build_keyword_most_used_config() {
    const onlyLastRun = document.getElementById("onlyLastRunKeywordMostUsed").checked;
    const data = get_most_time_consuming_or_most_used_data("keyword", settings.graphTypes.keywordMostUsedGraphType, filteredKeywords, onlyLastRun, true);
    const graphData = data[0]
    const callbackData = data[1];
    var config;
    const limit = inFullscreen && inFullscreenGraph.includes("keywordMostUsed") ? 50 : 10;
    if (settings.graphTypes.keywordMostUsedGraphType == "bar") {
        config = get_graph_config("bar", graphData, `Top ${limit}`, "Keyword", "Most Used");
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
                        return `${displayName}: ran ${info.timesRun} times`;
                    });
                }
            },
        };
        delete config.options.onClick
    } else if (settings.graphTypes.keywordMostUsedGraphType == "timeline") {
        config = get_graph_config("timeline", graphData, `Top ${limit}`, "Run", "Keyword");
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
                    return `${displayName}: ran ${info.timesRun} times`;
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
    update_height("keywordMostUsedVertical", config.data.labels.length, settings.graphTypes.keywordMostUsedGraphType);
    return config;
}

// function to create the most used keyword graph in the keyword section
function create_keyword_most_used_graph() {
    console.log("creating_keyword_most_used_graph");
    if (keywordMostUsedGraph) { keywordMostUsedGraph.destroy(); }
    keywordMostUsedGraph = new Chart("keywordMostUsedGraph", _build_keyword_most_used_config());
    keywordMostUsedGraph.canvas.addEventListener("click", (event) => {
        open_log_from_label(keywordMostUsedGraph, event)
    });
}

// update function for keyword statistics graph - updates existing chart in-place
function update_keyword_statistics_graph() {
    console.log("updating_keyword_statistics_graph");
    if (!keywordStatisticsGraph) { create_keyword_statistics_graph(); return; }
    const config = _build_keyword_statistics_config();
    keywordStatisticsGraph.data = config.data;
    keywordStatisticsGraph.options = config.options;
    keywordStatisticsGraph.update();
}

// update function for keyword times run graph - updates existing chart in-place
function update_keyword_times_run_graph() {
    console.log("updating_keyword_times_run_graph");
    if (!keywordTimesRunGraph) { create_keyword_times_run_graph(); return; }
    const config = _build_keyword_times_run_config();
    keywordTimesRunGraph.data = config.data;
    keywordTimesRunGraph.options = config.options;
    keywordTimesRunGraph.update();
}

// update function for keyword total duration graph - updates existing chart in-place
function update_keyword_total_duration_graph() {
    console.log("updating_keyword_total_duration_graph");
    if (!keywordTotalDurationGraph) { create_keyword_total_duration_graph(); return; }
    const config = _build_keyword_total_duration_config();
    keywordTotalDurationGraph.data = config.data;
    keywordTotalDurationGraph.options = config.options;
    keywordTotalDurationGraph.update();
}

// update function for keyword average duration graph - updates existing chart in-place
function update_keyword_average_duration_graph() {
    console.log("updating_keyword_average_duration_graph");
    if (!keywordAverageDurationGraph) { create_keyword_average_duration_graph(); return; }
    const config = _build_keyword_average_duration_config();
    keywordAverageDurationGraph.data = config.data;
    keywordAverageDurationGraph.options = config.options;
    keywordAverageDurationGraph.update();
}

// update function for keyword min duration graph - updates existing chart in-place
function update_keyword_min_duration_graph() {
    console.log("updating_keyword_min_duration_graph");
    if (!keywordMinDurationGraph) { create_keyword_min_duration_graph(); return; }
    const config = _build_keyword_min_duration_config();
    keywordMinDurationGraph.data = config.data;
    keywordMinDurationGraph.options = config.options;
    keywordMinDurationGraph.update();
}

// update function for keyword max duration graph - updates existing chart in-place
function update_keyword_max_duration_graph() {
    console.log("updating_keyword_max_duration_graph");
    if (!keywordMaxDurationGraph) { create_keyword_max_duration_graph(); return; }
    const config = _build_keyword_max_duration_config();
    keywordMaxDurationGraph.data = config.data;
    keywordMaxDurationGraph.options = config.options;
    keywordMaxDurationGraph.update();
}

// update function for keyword most failed graph - updates existing chart in-place
function update_keyword_most_failed_graph() {
    console.log("updating_keyword_most_failed_graph");
    if (!keywordMostFailedGraph) { create_keyword_most_failed_graph(); return; }
    const config = _build_keyword_most_failed_config();
    keywordMostFailedGraph.data = config.data;
    keywordMostFailedGraph.options = config.options;
    keywordMostFailedGraph.update();
}

// update function for keyword most time consuming graph - updates existing chart in-place
function update_keyword_most_time_consuming_graph() {
    console.log("updating_keyword_most_time_consuming_graph");
    if (!keywordMostTimeConsumingGraph) { create_keyword_most_time_consuming_graph(); return; }
    const config = _build_keyword_most_time_consuming_config();
    keywordMostTimeConsumingGraph.data = config.data;
    keywordMostTimeConsumingGraph.options = config.options;
    keywordMostTimeConsumingGraph.update();
}

// update function for keyword most used graph - updates existing chart in-place
function update_keyword_most_used_graph() {
    console.log("updating_keyword_most_used_graph");
    if (!keywordMostUsedGraph) { create_keyword_most_used_graph(); return; }
    const config = _build_keyword_most_used_config();
    keywordMostUsedGraph.data = config.data;
    keywordMostUsedGraph.options = config.options;
    keywordMostUsedGraph.update();
}

export {
    create_keyword_statistics_graph,
    create_keyword_times_run_graph,
    create_keyword_total_duration_graph,
    create_keyword_average_duration_graph,
    create_keyword_min_duration_graph,
    create_keyword_max_duration_graph,
    create_keyword_most_failed_graph,
    create_keyword_most_time_consuming_graph,
    create_keyword_most_used_graph,
    update_keyword_statistics_graph,
    update_keyword_times_run_graph,
    update_keyword_total_duration_graph,
    update_keyword_average_duration_graph,
    update_keyword_min_duration_graph,
    update_keyword_max_duration_graph,
    update_keyword_most_failed_graph,
    update_keyword_most_time_consuming_graph,
    update_keyword_most_used_graph
};