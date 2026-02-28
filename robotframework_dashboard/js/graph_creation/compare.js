import { get_test_statistics_data, get_compare_statistics_graph_data } from "../graph_data/statistics.js";
import { get_compare_suite_duration_data } from "../graph_data/duration.js";
import { get_graph_config } from "../graph_data/graph_config.js";
import { update_height } from "../graph_data/helpers.js";
import { open_log_file } from "../log.js";
import { format_duration } from "../common.js";
import { filteredRuns, filteredSuites, filteredTests } from "../variables/globals.js";
import { settings } from "../variables/settings.js";
import { create_chart, update_chart } from "./chart_factory.js";

// build functions
function _build_compare_statistics_config() {
    const graphData = get_compare_statistics_graph_data(filteredRuns);
    const config = get_graph_config("bar", graphData, "", "Run", "Amount");
    config.options.scales.y.stacked = false;
    return config;
}

function _build_compare_suite_duration_config() {
    const graphData = get_compare_suite_duration_data(filteredSuites);
    return get_graph_config("radar", graphData, "");
}

function _build_compare_tests_config() {
    const data = get_test_statistics_data(filteredTests);
    const graphData = data[0]
    const runStarts = data[1]
    const testMetaMap = data[2]
    var config = get_graph_config("timeline", graphData, "", "Run", "Test");
    config.options.plugins.tooltip = {
        callbacks: {
            label: function (context) {
                const runLabel = runStarts[context.raw.x[0]];
                const testLabel = context.raw.y;
                const key = `${testLabel}::${context.raw.x[0]}`;
                const meta = testMetaMap[key];
                const lines = [`Run: ${runLabel}`];
                if (meta) {
                    lines.push(`Status: ${meta.status}`);
                    lines.push(`Duration: ${format_duration(parseFloat(meta.elapsed_s))}`);
                    if (meta.message) {
                        const truncated = meta.message.length > 120 ? meta.message.substring(0, 120) + "..." : meta.message;
                        lines.push(`Message: ${truncated}`);
                    }
                }
                return lines;
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

// create functions
function create_compare_statistics_graph() { create_chart("compareStatisticsGraph", _build_compare_statistics_config, false); }
function create_compare_suite_duration_graph() { create_chart("compareSuiteDurationGraph", _build_compare_suite_duration_config, false); }
function create_compare_tests_graph() { create_chart("compareTestsGraph", _build_compare_tests_config); }

// update functions
function update_compare_statistics_graph() { update_chart("compareStatisticsGraph", _build_compare_statistics_config, false); }
function update_compare_suite_duration_graph() { update_chart("compareSuiteDurationGraph", _build_compare_suite_duration_config, false); }
function update_compare_tests_graph() { update_chart("compareTestsGraph", _build_compare_tests_config); }

export {
    create_compare_statistics_graph,
    create_compare_suite_duration_graph,
    create_compare_tests_graph,
    update_compare_statistics_graph,
    update_compare_suite_duration_graph,
    update_compare_tests_graph
};