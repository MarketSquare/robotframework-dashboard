import { get_graph_config } from '../graph_data/graph_config.js';
import { get_statistics_graph_data } from '../graph_data/statistics.js';
import { get_donut_graph_data, get_donut_total_graph_data } from '../graph_data/donut.js';
import { get_duration_graph_data } from '../graph_data/duration.js';
import { get_heatmap_graph_data } from '../graph_data/heatmap.js';
import { get_stats_data } from '../graph_data/stats.js';
import { build_tooltip_meta, lookup_tooltip_meta, format_status } from '../graph_data/tooltip_helpers.js';
import { format_duration } from '../common.js';
import { open_log_file } from '../log.js';
import { settings } from '../variables/settings.js';
import {
    inFullscreen,
    inFullscreenGraph,
    heatMapHourAll,
    filteredKeywords,
    filteredRuns,
    filteredSuites,
    filteredTests
} from '../variables/globals.js';
import { create_chart, update_chart } from './chart_factory.js';

// build functions
function _build_run_statistics_config() {
    const data = get_statistics_graph_data("run", settings.graphTypes.runStatisticsGraphType, filteredRuns);
    const graphData = data[0]
    const tooltipMeta = build_tooltip_meta(filteredRuns);
    var config;
    if (settings.graphTypes.runStatisticsGraphType == "line") {
        config = get_graph_config("line", graphData, "", "Date", "Amount", false);
    } else if (settings.graphTypes.runStatisticsGraphType == "amount") {
        config = get_graph_config("bar", graphData, "", "Run", "Amount Of Tests");
    } else if (settings.graphTypes.runStatisticsGraphType == "percentages") {
        config = get_graph_config("bar", graphData, "", "Run", "Percentage");
    }
    config.options.plugins.tooltip = config.options.plugins.tooltip || {};
    config.options.plugins.tooltip.callbacks = config.options.plugins.tooltip.callbacks || {};
    config.options.plugins.tooltip.callbacks.footer = function(tooltipItems) {
        const meta = lookup_tooltip_meta(tooltipMeta, tooltipItems);
        if (meta) return `Duration: ${format_duration(meta.elapsed_s)}`;
        return '';
    };
    if (!settings.show.dateLabels) { config.options.scales.x.ticks.display = false }
    return config;
}

function _build_run_donut_config() {
    const data = get_donut_graph_data("run", filteredRuns);
    const graphData = data[0]
    const callbackData = data[1]
    var config = get_graph_config("donut", graphData, `Last Run Status`);
    config.options.onClick = (event, chartElement) => {
        if (chartElement.length) {
            open_log_file(event, chartElement, callbackData)
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

function _build_run_donut_total_config() {
    const data = get_donut_total_graph_data("run", filteredRuns);
    const graphData = data[0]
    var config = get_graph_config("donut", graphData, `Total Status`);
    delete config.options.onClick;
    return config;
}

function _build_run_duration_config() {
    var graphData = get_duration_graph_data("run", settings.graphTypes.runDurationGraphType, "elapsed_s", filteredRuns);
    const tooltipMeta = build_tooltip_meta(filteredRuns);
    var config;
    if (settings.graphTypes.runDurationGraphType == "bar") {
        const limit = inFullscreen && inFullscreenGraph.includes("runDuration") ? 100 : 30;
        config = get_graph_config("bar", graphData, `Max ${limit} Bars`, "Run", "Duration");
    } else if (settings.graphTypes.runDurationGraphType == "line") {
        config = get_graph_config("line", graphData, "", "Date", "Duration");
    }
    config.options.plugins.tooltip.callbacks.footer = function(tooltipItems) {
        const meta = lookup_tooltip_meta(tooltipMeta, tooltipItems);
        if (meta) return format_status(meta);
        return '';
    };
    if (!settings.show.dateLabels) { config.options.scales.x.ticks.display = false }
    return config;
}

function _build_run_heatmap_config() {
    const data = get_heatmap_graph_data(filteredTests);
    const graphData = data[0]
    const callbackData = data[1]
    var config = get_graph_config("heatmap", graphData, "", "Hour", "Day");
    delete config.options.onClick;
    config.options.plugins.tooltip = {
        callbacks: {
            title: () => null,
            label: ctx => {
                const { x, y, v } = ctx.raw;
                if (heatMapHourAll) {
                    return `Day: ${callbackData[Math.floor(y - 0.5)]}, Hour: ${Math.floor(x - 0.5)}, Amount: ${v}`;
                } else {
                    return `Day: ${callbackData[Math.floor(y - 0.5)]}, Minute: ${Math.floor(x - 0.5)}, Amount: ${v}`;
                }
            }
        }
    }
    config.options.scales.y.ticks = {
        stepSize: 1,
        callback: val => callbackData[val] || ''
    }
    return config;
}

// create functions
function create_run_statistics_graph() { create_chart("runStatisticsGraph", _build_run_statistics_config); }
function create_run_donut_graph() { create_chart("runDonutGraph", _build_run_donut_config, false); }
function create_run_donut_total_graph() { create_chart("runDonutTotalGraph", _build_run_donut_total_config, false); }
function create_run_stats_graph() {
    const data = get_stats_data(filteredRuns, filteredSuites, filteredTests, filteredKeywords);
    document.getElementById('totalRuns').innerText = data.totalRuns
    document.getElementById('totalSuites').innerText = data.totalSuites
    document.getElementById('totalTests').innerText = data.totalTests
    document.getElementById('totalKeywords').innerText = data.totalKeywords
    document.getElementById('totalUniqueTests').innerText = data.totalUniqueTests
    document.getElementById('totalPassed').innerText = data.totalPassed
    document.getElementById('totalFailed').innerText = data.totalFailed
    document.getElementById('totalSkipped').innerText = data.totalSkipped
    document.getElementById('totalRunTime').innerText = format_duration(data.totalRunTime)
    document.getElementById('averageRunTime').innerText = format_duration(data.averageRunTime)
    document.getElementById('averageTestTime').innerText = format_duration(data.averageTestTime)
    document.getElementById('averagePassRate').innerText = data.averagePassRate
}
function create_run_duration_graph() { create_chart("runDurationGraph", _build_run_duration_config); }
function create_run_heatmap_graph() { create_chart("runHeatmapGraph", _build_run_heatmap_config, false); }

// update functions
function update_run_statistics_graph() { update_chart("runStatisticsGraph", _build_run_statistics_config); }
function update_run_donut_graph() { update_chart("runDonutGraph", _build_run_donut_config, false); }
function update_run_donut_total_graph() { update_chart("runDonutTotalGraph", _build_run_donut_total_config, false); }
function update_run_stats_graph() {
    create_run_stats_graph();
}
function update_run_duration_graph() { update_chart("runDurationGraph", _build_run_duration_config); }
function update_run_heatmap_graph() { update_chart("runHeatmapGraph", _build_run_heatmap_config, false); }

export {
    create_run_statistics_graph,
    create_run_donut_graph,
    create_run_donut_total_graph,
    create_run_stats_graph,
    create_run_duration_graph,
    create_run_heatmap_graph,
    update_run_statistics_graph,
    update_run_donut_graph,
    update_run_donut_total_graph,
    update_run_stats_graph,
    update_run_duration_graph,
    update_run_heatmap_graph
};