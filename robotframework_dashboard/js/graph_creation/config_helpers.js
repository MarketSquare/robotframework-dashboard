import { get_most_failed_data } from "../graph_data/failed.js";
import { get_most_flaky_data } from "../graph_data/flaky.js";
import { get_most_time_consuming_or_most_used_data } from "../graph_data/time_consuming.js";
import { get_graph_config } from "../graph_data/graph_config.js";
import { update_height } from "../graph_data/helpers.js";
import { open_log_file } from "../log.js";
import { format_duration } from "../common.js";
import { settings } from "../variables/settings.js";
import { inFullscreen, inFullscreenGraph } from "../variables/globals.js";

// Shared timeline scale/tooltip config used by most failed, flaky, and time consuming graphs
function _apply_timeline_defaults(config, callbackData, callbackLookup = null) {
    const lookupFn = callbackLookup || ((val) => callbackData[val]);
    config.options.plugins.tooltip = {
        callbacks: {
            label: function (context) {
                return lookupFn(context.raw.x[0]);
            },
        },
    };
    config.options.scales.x = {
        ticks: {
            minRotation: 45,
            maxRotation: 45,
            stepSize: 1,
            callback: function (value) {
                return lookupFn(this.getLabelForValue(value));
            },
        },
        title: {
            display: settings.show.axisTitles,
            text: "Run",
        },
    };
    config.options.onClick = (event, chartElement) => {
        if (chartElement.length) {
            open_log_file(event, chartElement, callbackData);
        }
    };
    if (!settings.show.dateLabels) { config.options.scales.x.ticks.display = false; }
}

// Build config for "most failed" graphs (test/suite/keyword, regular and recent)
function build_most_failed_config(graphKey, dataType, dataLabel, filteredData, isRecent) {
    const graphType = settings.graphTypes[`${graphKey}GraphType`];
    const data = get_most_failed_data(dataType, graphType, filteredData, isRecent);
    const graphData = data[0];
    const callbackData = data[1];
    const limit = inFullscreen && inFullscreenGraph.includes(graphKey) ? 50 : 10;
    var config;
    if (graphType == "bar") {
        config = get_graph_config("bar", graphData, `Top ${limit}`, dataLabel, "Fails");
        config.options.plugins.legend = { display: false };
        config.options.plugins.tooltip = {
            callbacks: {
                label: function (tooltipItem) {
                    return callbackData[tooltipItem.label];
                },
            },
        };
        delete config.options.onClick;
    } else if (graphType == "timeline") {
        config = get_graph_config("timeline", graphData, `Top ${limit}`, "Run", dataLabel);
        _apply_timeline_defaults(config, callbackData);
    }
    update_height(`${graphKey}Vertical`, config.data.labels.length, graphType);
    return config;
}

// Build config for "most flaky" graphs (test regular and recent)
function build_most_flaky_config(graphKey, dataType, filteredData, ignoreSkipsVal, isRecent) {
    const graphType = settings.graphTypes[`${graphKey}GraphType`];
    const data = get_most_flaky_data(dataType, graphType, filteredData, ignoreSkipsVal, isRecent);
    const graphData = data[0];
    const callbackData = data[1];
    const limit = inFullscreen && inFullscreenGraph.includes(graphKey) ? 50 : 10;
    var config;
    if (graphType == "bar") {
        config = get_graph_config("bar", graphData, `Top ${limit}`, "Test", "Status Flips");
        config.options.plugins.legend = false;
        delete config.options.onClick;
    } else if (graphType == "timeline") {
        config = get_graph_config("timeline", graphData, `Top ${limit}`, "Run", "Test");
        _apply_timeline_defaults(config, callbackData);
    }
    update_height(`${graphKey}Vertical`, config.data.labels.length, graphType);
    return config;
}

// Build config for "most time consuming" / "most used" graphs (test/suite/keyword)
function build_most_time_consuming_config(graphKey, dataType, dataLabel, filteredData, checkboxId, barYLabel = "Most Time Consuming", isMostUsed = false, formatDetail = null) {
    const onlyLastRun = document.getElementById(checkboxId).checked;
    const graphType = settings.graphTypes[`${graphKey}GraphType`];
    const data = get_most_time_consuming_or_most_used_data(dataType, graphType, filteredData, onlyLastRun, isMostUsed);
    const graphData = data[0];
    const callbackData = data[1];
    const limit = inFullscreen && inFullscreenGraph.includes(graphKey) ? 50 : 10;
    const detailFormatter = formatDetail || ((info, displayName) => `${displayName}: ${format_duration(info.duration)}`);
    var config;
    if (graphType == "bar") {
        config = get_graph_config("bar", graphData, `Top ${limit}`, dataLabel, barYLabel);
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
                        return detailFormatter(info, displayName);
                    });
                }
            },
        };
        delete config.options.onClick;
    } else if (graphType == "timeline") {
        config = get_graph_config("timeline", graphData, `Top ${limit}`, "Run", dataLabel);
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
                    return detailFormatter(info, displayName);
                }
            },
        };
        config.options.scales.x = {
            ticks: {
                minRotation: 45,
                maxRotation: 45,
                stepSize: 1,
                callback: function (value) {
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
                open_log_file(event, chartElement, callbackData.runs);
            }
        };
        if (!settings.show.dateLabels) { config.options.scales.x.ticks.display = false; }
    }
    update_height(`${graphKey}Vertical`, config.data.labels.length, graphType);
    return config;
}

export { build_most_failed_config, build_most_flaky_config, build_most_time_consuming_config };
