import { settings } from "../variables/settings.js";

import { 
    create_overview_latest_graphs,
    create_overview_total_graphs,
    update_donut_charts
} from "./overview.js";
import {
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
} from "./run.js";
import {
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
} from "./suite.js";
import {
    create_test_statistics_graph,
    create_test_duration_graph,
    create_test_duration_deviation_graph,
    create_test_messages_graph,
    create_test_most_flaky_graph,
    create_test_recent_most_flaky_graph,
    create_test_most_failed_graph,
    create_test_recent_most_failed_graph,
    create_test_most_time_consuming_graph,
    update_test_statistics_graph,
    update_test_duration_graph,
    update_test_duration_deviation_graph,
    update_test_messages_graph,
    update_test_most_flaky_graph,
    update_test_recent_most_flaky_graph,
    update_test_most_failed_graph,
    update_test_recent_most_failed_graph,
    update_test_most_time_consuming_graph
} from "./test.js";
import {
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
} from "./keyword.js";
import {
    create_compare_statistics_graph,
    create_compare_suite_duration_graph,
    create_compare_tests_graph,
    update_compare_statistics_graph,
    update_compare_suite_duration_graph,
    update_compare_tests_graph
} from "./compare.js";
import {
    create_run_table,
    create_suite_table,
    create_test_table,
    create_keyword_table,
    update_run_table,
    update_suite_table,
    update_test_table,
    update_keyword_table
} from "./tables.js";

// function that creates all graphs from scratch - used on first load of each tab
function create_dashboard_graphs() {
    if (settings.menu.overview) {
        create_overview_latest_graphs();
        create_overview_total_graphs();
        update_donut_charts();
    } else if (settings.menu.dashboard) {
        create_run_statistics_graph();
        create_run_donut_graph();
        create_run_donut_total_graph();
        create_run_stats_graph();
        create_run_duration_graph();
        create_run_heatmap_graph();
        create_suite_statistics_graph();
        create_suite_folder_donut_graph();
        create_suite_folder_fail_donut_graph();
        create_suite_duration_graph();
        create_suite_most_failed_graph();
        create_suite_most_time_consuming_graph();
        create_test_statistics_graph();
        create_test_duration_graph();
        create_test_duration_deviation_graph();
        create_test_messages_graph();
        create_test_most_flaky_graph();
        create_test_recent_most_flaky_graph();
        create_test_most_failed_graph();
        create_test_recent_most_failed_graph();
        create_test_most_time_consuming_graph();
        create_keyword_statistics_graph();
        create_keyword_times_run_graph();
        create_keyword_total_duration_graph();
        create_keyword_average_duration_graph();
        create_keyword_min_duration_graph();
        create_keyword_max_duration_graph();
        create_keyword_most_failed_graph();
        create_keyword_most_time_consuming_graph();
        create_keyword_most_used_graph();
    } else if (settings.menu.compare) {
        create_compare_statistics_graph();
        create_compare_suite_duration_graph();
        create_compare_tests_graph();
    } else if (settings.menu.tables) {
        create_run_table();
        create_suite_table();
        create_test_table();
        create_keyword_table();
    }
}

// function that updates existing graphs in-place with new data - avoids costly destroy/recreate cycle
// each update function falls back to create if the chart doesn't exist yet
function update_dashboard_graphs() {
    if (settings.menu.overview) {
        create_overview_latest_graphs();
        create_overview_total_graphs();
        update_donut_charts();
    } else if (settings.menu.dashboard) {
        update_run_statistics_graph();
        update_run_donut_graph();
        update_run_donut_total_graph();
        update_run_stats_graph();
        update_run_duration_graph();
        update_run_heatmap_graph();
        update_suite_statistics_graph();
        update_suite_folder_donut_graph();
        update_suite_folder_fail_donut_graph();
        update_suite_duration_graph();
        update_suite_most_failed_graph();
        update_suite_most_time_consuming_graph();
        update_test_statistics_graph();
        update_test_duration_graph();
        update_test_duration_deviation_graph();
        update_test_messages_graph();
        update_test_most_flaky_graph();
        update_test_recent_most_flaky_graph();
        update_test_most_failed_graph();
        update_test_recent_most_failed_graph();
        update_test_most_time_consuming_graph();
        update_keyword_statistics_graph();
        update_keyword_times_run_graph();
        update_keyword_total_duration_graph();
        update_keyword_average_duration_graph();
        update_keyword_min_duration_graph();
        update_keyword_max_duration_graph();
        update_keyword_most_failed_graph();
        update_keyword_most_time_consuming_graph();
        update_keyword_most_used_graph();
    } else if (settings.menu.compare) {
        update_compare_statistics_graph();
        update_compare_suite_duration_graph();
        update_compare_tests_graph();
    } else if (settings.menu.tables) {
        update_run_table();
        update_suite_table();
        update_test_table();
        update_keyword_table();
    }
}

// backward-compatible alias - always creates from scratch
function setup_dashboard_graphs() {
    create_dashboard_graphs();
}

export {
    setup_dashboard_graphs,
    create_dashboard_graphs,
    update_dashboard_graphs
};