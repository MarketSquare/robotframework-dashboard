import { settings } from "../variables/settings.js";
import { inFullscreen, inFullscreenGraph } from "../variables/globals.js";
import { get_statistics_graph_data } from "../graph_data/statistics.js";
import { get_duration_graph_data } from "../graph_data/duration.js";
import { get_graph_config } from "../graph_data/graph_config.js";
import { create_chart, update_chart } from "./chart_factory.js";
import { build_most_failed_config, build_most_time_consuming_config } from "./config_helpers.js";

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

// build config for keyword duration graphs (times run, total, average, min, max)
function _build_keyword_duration_config(graphKey, field, yLabel) {
    const graphData = get_duration_graph_data("keyword", settings.graphTypes[`${graphKey}GraphType`], field, filteredKeywords);
    var config;
    if (settings.graphTypes[`${graphKey}GraphType`] == "bar") {
        const limit = inFullscreen && inFullscreenGraph.includes(graphKey) ? 100 : 30;
        config = get_graph_config("bar", graphData, `Max ${limit} Bars`, "Run", yLabel);
    } else if (settings.graphTypes[`${graphKey}GraphType`] == "line") {
        config = get_graph_config("line", graphData, "", "Date", yLabel);
    }
    if (!settings.show.dateLabels) { config.options.scales.x.ticks.display = false }
    return config;
}

function _build_keyword_times_run_config() { return _build_keyword_duration_config("keywordTimesRun", "times_run", "Times Run"); }
function _build_keyword_total_duration_config() { return _build_keyword_duration_config("keywordTotalDuration", "total_time_s", "Duration"); }
function _build_keyword_average_duration_config() { return _build_keyword_duration_config("keywordAverageDuration", "average_time_s", "Duration"); }
function _build_keyword_min_duration_config() { return _build_keyword_duration_config("keywordMinDuration", "min_time_s", "Duration"); }
function _build_keyword_max_duration_config() { return _build_keyword_duration_config("keywordMaxDuration", "max_time_s", "Duration"); }

function _build_keyword_most_failed_config() {
    return build_most_failed_config("keywordMostFailed", "keyword", "Keyword", filteredKeywords, false);
}
function _build_keyword_most_time_consuming_config() {
    return build_most_time_consuming_config("keywordMostTimeConsuming", "keyword", "Keyword", filteredKeywords, "onlyLastRunKeyword");
}
function _build_keyword_most_used_config() {
    return build_most_time_consuming_config("keywordMostUsed", "keyword", "Keyword", filteredKeywords, "onlyLastRunKeywordMostUsed", "Most Used", true, (info, name) => `${name}: ran ${info.timesRun} times`);
}

// create functions
function create_keyword_statistics_graph() { create_chart("keywordStatisticsGraph", _build_keyword_statistics_config); }
function create_keyword_times_run_graph() { create_chart("keywordTimesRunGraph", _build_keyword_times_run_config); }
function create_keyword_total_duration_graph() { create_chart("keywordTotalDurationGraph", _build_keyword_total_duration_config); }
function create_keyword_average_duration_graph() { create_chart("keywordAverageDurationGraph", _build_keyword_average_duration_config); }
function create_keyword_min_duration_graph() { create_chart("keywordMinDurationGraph", _build_keyword_min_duration_config); }
function create_keyword_max_duration_graph() { create_chart("keywordMaxDurationGraph", _build_keyword_max_duration_config); }
function create_keyword_most_failed_graph() { create_chart("keywordMostFailedGraph", _build_keyword_most_failed_config); }
function create_keyword_most_time_consuming_graph() { create_chart("keywordMostTimeConsumingGraph", _build_keyword_most_time_consuming_config); }
function create_keyword_most_used_graph() { create_chart("keywordMostUsedGraph", _build_keyword_most_used_config); }

// update functions
function update_keyword_statistics_graph() { update_chart("keywordStatisticsGraph", _build_keyword_statistics_config); }
function update_keyword_times_run_graph() { update_chart("keywordTimesRunGraph", _build_keyword_times_run_config); }
function update_keyword_total_duration_graph() { update_chart("keywordTotalDurationGraph", _build_keyword_total_duration_config); }
function update_keyword_average_duration_graph() { update_chart("keywordAverageDurationGraph", _build_keyword_average_duration_config); }
function update_keyword_min_duration_graph() { update_chart("keywordMinDurationGraph", _build_keyword_min_duration_config); }
function update_keyword_max_duration_graph() { update_chart("keywordMaxDurationGraph", _build_keyword_max_duration_config); }
function update_keyword_most_failed_graph() { update_chart("keywordMostFailedGraph", _build_keyword_most_failed_config); }
function update_keyword_most_time_consuming_graph() { update_chart("keywordMostTimeConsumingGraph", _build_keyword_most_time_consuming_config); }
function update_keyword_most_used_graph() { update_chart("keywordMostUsedGraph", _build_keyword_most_used_config); }

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