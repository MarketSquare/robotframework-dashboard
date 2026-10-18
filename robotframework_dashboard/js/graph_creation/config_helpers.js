import { get_most_failed_data } from "../graph_data/failed.js";
import { get_most_flaky_data } from "../graph_data/flaky.js";
import { get_most_time_consuming_or_most_used_data } from "../graph_data/time_consuming.js";
import { get_graph_config } from "../graph_data/graph_config.js";
import { update_height, format_attempt_lines, get_run_label_by_run_start, truncate_message } from "../graph_data/helpers.js";
import { open_log_file } from "../log.js";
import { format_duration } from "../common.js";
import { settings } from "../variables/settings.js";
import { inFullscreen, inFullscreenGraph } from "../variables/globals.js";
import { set_chart_note_target, timeline_test_note_target, test_note_lines } from "../notes/chart_notes.js";

// the run axis of a timeline graph: one column per run, labelled by labelFn(column index).
// TimelineScale (main.js) centres each label between its tick and the next one.
function apply_timeline_run_axis(config, runStarts, { labelFn = null, logClick = true } = {}) {
    const runLabelAt = labelFn || (index => get_run_label_by_run_start(runStarts[index]));
    config.options.scales.x = {
        ticks: {
            minRotation: 45,
            maxRotation: 45,
            stepSize: 1,
            display: settings.show.dateLabels,
            callback: function (value) {
                return runLabelAt(this.getLabelForValue(value));
            },
        },
        title: {
            display: settings.show.axisTitles,
            text: "Run",
        },
        type: "timelineScale",
    };
    if (!logClick) {
        delete config.options.onClick;
        return;
    }
    config.options.onClick = (event, chartElement) => {
        if (chartElement.length) {
            open_log_file(event, chartElement, runStarts);
        }
    };
    // the run of every column for a click on its axis label (open_log_from_label)
    config.data.runStarts = runStarts;
}

// tooltip lines of one timeline point; "message" is the test messages graph, which shows no
// attempts or notes
function get_timeline_point_lines(meta, dataType) {
    const isTest = dataType === "test" || dataType === "message";
    const lines = [];
    if (isTest) {
        lines.push(`Status: ${meta.status}`);
    } else if (dataType === "suite") {
        lines.push(`Passed: ${meta.passed}, Failed: ${meta.failed}, Skipped: ${meta.skipped}`);
    }
    lines.push(`Duration: ${format_duration(parseFloat(meta.elapsed_s))}`);
    if (isTest && meta.message) lines.push(`Message: ${truncate_message(meta.message)}`);
    if (dataType === "test") {
        lines.push(...format_attempt_lines(meta.attempts));
        lines.push(...test_note_lines(meta));
    }
    return lines;
}

// run axis plus the tooltip of a timeline whose points are looked up as "<y label>::<column>"
function apply_timeline_defaults(config, runStarts, pointMeta = null, dataType = null) {
    config.options.plugins.tooltip = {
        callbacks: {
            label: function (context) {
                const runLabel = get_run_label_by_run_start(runStarts[context.raw.x[0]]);
                if (!pointMeta) return runLabel;
                const pointLabel = context.raw.y || context.dataset.label;
                const meta = pointMeta[`${pointLabel}::${context.raw.x[0]}`];
                if (!meta) return `Run: ${runLabel}`;
                return [`Run: ${runLabel}`, ...get_timeline_point_lines(meta, dataType)];
            },
        },
    };
    apply_timeline_run_axis(config, runStarts);
}

function build_most_failed_config(graphKey, dataType, dataLabel, filteredData, isRecent) {
    const graphType = settings.graphTypes[`${graphKey}GraphType`];
    const data = get_most_failed_data(dataType, graphType, filteredData, isRecent);
    const graphData = data[0];
    const callbackData = data[1];
    const pointMeta = data[2] || null;
    const limit = inFullscreen && inFullscreenGraph.includes(graphKey) ? 50 : 10;
    set_chart_note_target(`${graphKey}Graph`, null);
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
        apply_timeline_defaults(config, callbackData, pointMeta, dataType);
        config.options.scales.y.ticks.autoSkip = false;
        if (dataType === "test") set_chart_note_target(`${graphKey}Graph`, timeline_test_note_target(pointMeta, callbackData.map(get_run_label_by_run_start)));
    }
    update_height(`${graphKey}Vertical`, config.data.labels.length, graphType);
    return config;
}

function build_most_flaky_config(graphKey, dataType, filteredData, ignoreSkipsVal, isRecent) {
    const graphType = settings.graphTypes[`${graphKey}GraphType`];
    const limit = inFullscreen && inFullscreenGraph === `${graphKey}Fullscreen` ? 50 : 10;
    const data = get_most_flaky_data(dataType, graphType, filteredData, ignoreSkipsVal, isRecent, limit);
    const graphData = data[0];
    const callbackData = data[1];
    const pointMeta = data[2] || null;
    set_chart_note_target(`${graphKey}Graph`, null);
    var config;
    if (graphType == "bar") {
        config = get_graph_config("bar", graphData, `Top ${limit}`, "Test", "Status Flips");
        config.options.plugins.legend = false;
        delete config.options.onClick;
    } else if (graphType == "timeline") {
        config = get_graph_config("timeline", graphData, `Top ${limit}`, "Run", "Test");
        apply_timeline_defaults(config, callbackData, pointMeta, dataType);
        config.options.scales.y.ticks.autoSkip = false;
        set_chart_note_target(`${graphKey}Graph`, timeline_test_note_target(pointMeta, callbackData.map(get_run_label_by_run_start)));
    }
    update_height(`${graphKey}Vertical`, config.data.labels.length, graphType);
    return config;
}

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
                    const namesToShow = cb.aliases[key] || runStarts;
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
                    const key = context.raw.y;
                    const runIndex = context.raw.x[0];
                    const runStart = callbackData.runs[runIndex];
                    const info = callbackData.details[key][runStart];
                    const displayName = callbackData.aliases[runIndex];
                    if (!info) return `${displayName}: (no data)`;
                    const lines = [
                        `Run: ${displayName}`,
                        `Duration: ${format_duration(info.duration)}`,
                    ];
                    if (info.passed !== undefined) {
                        lines.push(`Passed: ${info.passed}, Failed: ${info.failed}, Skipped: ${info.skipped}`);
                    }
                    return lines;
                }
            },
        };
        apply_timeline_run_axis(config, callbackData.runs, { labelFn: index => callbackData.aliases[index] });
        config.options.scales.y.ticks.autoSkip = false;
    }
    update_height(`${graphKey}Vertical`, config.data.labels.length, graphType);
    return config;
}

export {
    apply_timeline_defaults,
    apply_timeline_run_axis,
    build_most_failed_config,
    build_most_flaky_config,
    build_most_time_consuming_config,
};
