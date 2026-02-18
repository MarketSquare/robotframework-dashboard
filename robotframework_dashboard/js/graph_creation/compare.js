import { get_test_statistics_data, get_compare_statistics_graph_data } from "../graph_data/statistics.js";
import { get_compare_suite_duration_data } from "../graph_data/duration.js";
import { get_graph_config } from "../graph_data/graph_config.js";
import { update_height } from "../graph_data/helpers.js";
import { open_log_file, open_log_from_label } from "../log.js";
import { filteredRuns, filteredSuites, filteredTests } from "../variables/globals.js";
import { settings } from "../variables/settings.js";

// build config for compare statistics graph
function _build_compare_statistics_config() {
    const graphData = get_compare_statistics_graph_data(filteredRuns);
    const config = get_graph_config("bar", graphData, "", "Run", "Amount");
    config.options.scales.y.stacked = false;
    return config;
}

// function to create the compare statistics in the compare section
function create_compare_statistics_graph() {
    console.log("creating_compare_statistics_graph");
    if (compareStatisticsGraph) { compareStatisticsGraph.destroy(); }
    compareStatisticsGraph = new Chart("compareStatisticsGraph", _build_compare_statistics_config());
}

// build config for compare suite duration graph
function _build_compare_suite_duration_config() {
    const graphData = get_compare_suite_duration_data(filteredSuites);
    return get_graph_config("radar", graphData, "");
}

// function to create the compare statistics in the compare section
function create_compare_suite_duration_graph() {
    console.log("creating_compare_suite_duration_graph");
    if (compareSuiteDurationGraph) { compareSuiteDurationGraph.destroy(); }
    compareSuiteDurationGraph = new Chart("compareSuiteDurationGraph", _build_compare_suite_duration_config());
}

// build config for compare tests graph
function _build_compare_tests_config() {
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
    update_height("compareTestsVertical", config.data.labels.length, "timeline");
    return config;
}

// function to create the compare statistics in the compare section
function create_compare_tests_graph() {
    console.log("creating_compare_tests_graph");
    if (compareTestsGraph) { compareTestsGraph.destroy(); }
    compareTestsGraph = new Chart("compareTestsGraph", _build_compare_tests_config());
    compareTestsGraph.canvas.addEventListener("click", (event) => {
        open_log_from_label(compareTestsGraph, event)
    });
}

// update function for compare statistics graph - updates existing chart in-place
function update_compare_statistics_graph() {
    console.log("updating_compare_statistics_graph");
    if (!compareStatisticsGraph) { create_compare_statistics_graph(); return; }
    const config = _build_compare_statistics_config();
    compareStatisticsGraph.data = config.data;
    compareStatisticsGraph.options = config.options;
    compareStatisticsGraph.update();
}

// update function for compare suite duration graph - updates existing chart in-place
function update_compare_suite_duration_graph() {
    console.log("updating_compare_suite_duration_graph");
    if (!compareSuiteDurationGraph) { create_compare_suite_duration_graph(); return; }
    const config = _build_compare_suite_duration_config();
    compareSuiteDurationGraph.data = config.data;
    compareSuiteDurationGraph.options = config.options;
    compareSuiteDurationGraph.update();
}

// update function for compare tests graph - updates existing chart in-place
function update_compare_tests_graph() {
    console.log("updating_compare_tests_graph");
    if (!compareTestsGraph) { create_compare_tests_graph(); return; }
    const config = _build_compare_tests_config();
    compareTestsGraph.data = config.data;
    compareTestsGraph.options = config.options;
    compareTestsGraph.update();
}

export {
    create_compare_statistics_graph,
    create_compare_suite_duration_graph,
    create_compare_tests_graph,
    update_compare_statistics_graph,
    update_compare_suite_duration_graph,
    update_compare_tests_graph
};