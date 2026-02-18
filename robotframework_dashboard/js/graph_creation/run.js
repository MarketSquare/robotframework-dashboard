import { get_graph_config } from '../graph_data/graph_config.js';
import { get_statistics_graph_data } from '../graph_data/statistics.js';
import { get_donut_graph_data, get_donut_total_graph_data } from '../graph_data/donut.js';
import { get_duration_graph_data } from '../graph_data/duration.js';
import { get_heatmap_graph_data } from '../graph_data/heatmap.js';
import { get_stats_data } from '../graph_data/stats.js';
import { format_duration } from '../common.js';
import { open_log_file, open_log_from_label } from '../log.js';
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

// build config for run statistics graph
function _build_run_statistics_config() {
    const data = get_statistics_graph_data("run", settings.graphTypes.runStatisticsGraphType, filteredRuns);
    const graphData = data[0]
    var config;
    if (settings.graphTypes.runStatisticsGraphType == "line") {
        config = get_graph_config("line", graphData, "", "Date", "Amount", false);
    } else if (settings.graphTypes.runStatisticsGraphType == "amount") {
        config = get_graph_config("bar", graphData, "", "Run", "Amount Of Tests");
    } else if (settings.graphTypes.runStatisticsGraphType == "percentages") {
        config = get_graph_config("bar", graphData, "", "Run", "Percentage");
    }
    if (!settings.show.dateLabels) { config.options.scales.x.ticks.display = false }
    return config;
}

// function to create run statistics graph in the run section
function create_run_statistics_graph() {
    console.log("creating_run_statistics_graph");
    if (runStatisticsGraph) { runStatisticsGraph.destroy(); }
    runStatisticsGraph = new Chart("runStatisticsGraph", _build_run_statistics_config());
    runStatisticsGraph.canvas.addEventListener("click", (event) => {
        open_log_from_label(runStatisticsGraph, event)
    });
}

// build config for run donut graph
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

// function to create run donut graph in the run section
function create_run_donut_graph() {
    console.log("creating_run_donut_graph");
    if (runDonutGraph) { runDonutGraph.destroy(); }
    runDonutGraph = new Chart("runDonutGraph", _build_run_donut_config());
}

// build config for run donut total graph
function _build_run_donut_total_config() {
    const data = get_donut_total_graph_data("run", filteredRuns);
    const graphData = data[0]
    var config = get_graph_config("donut", graphData, `Total Status`);
    delete config.options.onClick;
    return config;
}

// function to create run donut total graph in the run section
function create_run_donut_total_graph() {
    console.log("creating_run_donut_total_graph");
    if (runDonutTotalGraph) { runDonutTotalGraph.destroy(); }
    runDonutTotalGraph = new Chart("runDonutTotalGraph", _build_run_donut_total_config());
}

// function to create the run stats section in the run section
function create_run_stats_graph() {
    console.log("creating_run_stats_graph");
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

// build config for run duration graph
function _build_run_duration_config() {
    var graphData = get_duration_graph_data("run", settings.graphTypes.runDurationGraphType, "elapsed_s", filteredRuns);
    var config;
    if (settings.graphTypes.runDurationGraphType == "bar") {
        const limit = inFullscreen && inFullscreenGraph.includes("runDuration") ? 100 : 30;
        config = get_graph_config("bar", graphData, `Max ${limit} Bars`, "Run", "Duration");
    } else if (settings.graphTypes.runDurationGraphType == "line") {
        config = get_graph_config("line", graphData, "", "Date", "Duration");
    }
    if (!settings.show.dateLabels) { config.options.scales.x.ticks.display = false }
    return config;
}

// function to create run duration graph in the run section
function create_run_duration_graph() {
    console.log("creating_run_duration_graph");
    if (runDurationGraph) { runDurationGraph.destroy(); }
    runDurationGraph = new Chart("runDurationGraph", _build_run_duration_config());
    runDurationGraph.canvas.addEventListener("click", (event) => {
        open_log_from_label(runDurationGraph, event)
    });
}

// build config for run heatmap graph
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

// function to create the run heatmap
function create_run_heatmap_graph() {
    console.log("creating_run_heatmap_graph");
    if (runHeatmapGraph) { runHeatmapGraph.destroy(); }
    runHeatmapGraph = new Chart("runHeatmapGraph", _build_run_heatmap_config());
}

// update function for run statistics graph - updates existing chart in-place
function update_run_statistics_graph() {
    console.log("updating_run_statistics_graph");
    if (!runStatisticsGraph) { create_run_statistics_graph(); return; }
    const config = _build_run_statistics_config();
    runStatisticsGraph.data = config.data;
    runStatisticsGraph.options = config.options;
    runStatisticsGraph.update();
}

// update function for run donut graph - updates existing chart in-place
function update_run_donut_graph() {
    console.log("updating_run_donut_graph");
    if (!runDonutGraph) { create_run_donut_graph(); return; }
    const config = _build_run_donut_config();
    runDonutGraph.data = config.data;
    runDonutGraph.options = config.options;
    runDonutGraph.update();
}

// update function for run donut total graph - updates existing chart in-place
function update_run_donut_total_graph() {
    console.log("updating_run_donut_total_graph");
    if (!runDonutTotalGraph) { create_run_donut_total_graph(); return; }
    const config = _build_run_donut_total_config();
    runDonutTotalGraph.data = config.data;
    runDonutTotalGraph.options = config.options;
    runDonutTotalGraph.update();
}

// update function for run stats - same as create since it only updates DOM text
function update_run_stats_graph() {
    console.log("updating_run_stats_graph");
    create_run_stats_graph();
}

// update function for run duration graph - updates existing chart in-place
function update_run_duration_graph() {
    console.log("updating_run_duration_graph");
    if (!runDurationGraph) { create_run_duration_graph(); return; }
    const config = _build_run_duration_config();
    runDurationGraph.data = config.data;
    runDurationGraph.options = config.options;
    runDurationGraph.update();
}

// update function for run heatmap graph - updates existing chart in-place
function update_run_heatmap_graph() {
    console.log("updating_run_heatmap_graph");
    if (!runHeatmapGraph) { create_run_heatmap_graph(); return; }
    const config = _build_run_heatmap_config();
    runHeatmapGraph.data = config.data;
    runHeatmapGraph.options = config.options;
    runHeatmapGraph.update();
}

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