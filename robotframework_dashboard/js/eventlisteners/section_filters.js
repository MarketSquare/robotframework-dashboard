import { settings } from "../variables/settings.js";
import { compareRunIds } from "../variables/graphs.js";
import { show_loading_overlay, hide_loading_overlay, update_graphs_with_loading } from "../common.js";
import { update_switch_local_storage } from "../localstorage.js";
import { setup_overview_section_menu_buttons } from "../menu.js";
import {
    setup_suites_in_suite_select,
    setup_suites_in_test_select,
    setup_tests_in_select,
    setup_testtags_in_select,
    setup_keywords_in_select,
} from "../filter/section_selects.js";
import {
    create_overview_latest_graphs,
    create_overview_total_graphs,
    update_overview_latest_heading,
    update_overview_total_heading,
    update_overview_sections_visibility,
    update_overview_filter_visibility,
    update_projectbar_visibility,
} from "../graph_creation/overview.js";
import {
    update_suite_duration_graph,
    update_suite_statistics_graph,
    update_suite_most_failed_graph,
    update_suite_most_time_consuming_graph,
    update_suite_folder_donut_graph,
} from "../graph_creation/suite.js";
import {
    update_test_statistics_graph,
    update_test_duration_graph,
    update_test_duration_deviation_graph,
    update_test_messages_graph,
    update_test_most_flaky_graph,
    update_test_recent_most_flaky_graph,
    update_test_most_failed_graph,
    update_test_recent_most_failed_graph,
    update_test_most_time_consuming_graph,
} from "../graph_creation/test.js";
import {
    update_keyword_statistics_graph,
    update_keyword_times_run_graph,
    update_keyword_total_duration_graph,
    update_keyword_average_duration_graph,
    update_keyword_min_duration_graph,
    update_keyword_max_duration_graph,
    update_keyword_most_failed_graph,
    update_keyword_most_time_consuming_graph,
    update_keyword_most_used_graph,
} from "../graph_creation/keyword.js";
import {
    update_compare_statistics_graph,
    update_compare_suite_duration_graph,
    update_compare_tests_graph,
} from "../graph_creation/compare.js";

// function to setup eventlisteners for filter buttons
function setup_sections_filters() {
    update_switch_local_storage("switch.runTags", settings.switch.runTags, true);
    update_switch_local_storage("switch.runName", settings.switch.runName, true);
    update_switch_local_storage("switch.totalStats", settings.switch.totalStats, true);
    update_switch_local_storage("switch.latestRuns", settings.switch.latestRuns, true);
    update_switch_local_storage("switch.sortFilters", settings.switch.sortFilters, true);
    document.getElementById("switchRunTags").addEventListener("click", function () {
        settings.switch.runTags = !settings.switch.runTags
        update_switch_local_storage("switch.runTags", settings.switch.runTags);
        show_loading_overlay();
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                // create latest and total bars and set visibility
                create_overview_latest_graphs();
                update_overview_latest_heading();
                create_overview_total_graphs();
                update_overview_total_heading();
                update_overview_sections_visibility();
                // update all tagged bars
                update_projectbar_visibility();
                setup_overview_section_menu_buttons();
                hide_loading_overlay();
            });
        });
    });
    document.getElementById("switchRunName").addEventListener("click", function () {
        settings.switch.runName = !settings.switch.runName
        update_switch_local_storage("switch.runName", settings.switch.runName);
        show_loading_overlay();
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                // create latest and total bars and set visibility
                create_overview_latest_graphs();
                update_overview_latest_heading();
                create_overview_total_graphs();
                update_overview_total_heading();
                update_overview_sections_visibility();
                // update all named project bars
                update_projectbar_visibility();
                setup_overview_section_menu_buttons();
                hide_loading_overlay();
            });
        });
    });
    document.getElementById("switchLatestRuns").addEventListener("click", function () {
        settings.switch.latestRuns = !settings.switch.latestRuns
        update_switch_local_storage("switch.latestRuns", settings.switch.latestRuns);
        update_overview_sections_visibility();
        setup_overview_section_menu_buttons();
    });
    document.getElementById("switchTotalStats").addEventListener("click", function () {
        settings.switch.totalStats = !settings.switch.totalStats
        update_switch_local_storage("switch.totalStats", settings.switch.totalStats);
        update_overview_sections_visibility();
        setup_overview_section_menu_buttons();
    });
    document.getElementById("switchSortFilters").addEventListener("click", function () {
        settings.switch.sortFilters = !settings.switch.sortFilters
        update_switch_local_storage("switch.sortFilters", settings.switch.sortFilters);
        update_overview_filter_visibility();
    });
    document.getElementById("suiteSelectSuites").addEventListener("change", () => {
        const mostGraphIds = settings.switch.sectionFiltersApplySuite
            ? ["suiteMostFailedGraph", "suiteMostTimeConsumingGraph"]
            : [];
        update_graphs_with_loading(["suiteStatisticsGraph", "suiteDurationGraph", ...mostGraphIds], () => {
            update_suite_duration_graph();
            update_suite_statistics_graph();
            if (settings.switch.sectionFiltersApplySuite) {
                update_suite_most_failed_graph();
                update_suite_most_time_consuming_graph();
            }
        });
    });
    update_switch_local_storage("switch.suitePathsSuiteSection", settings.switch.suitePathsSuiteSection, true);
    document.getElementById("switchSuitePathsSuiteSection").addEventListener("change", (e) => {
        settings.switch.suitePathsSuiteSection = !settings.switch.suitePathsSuiteSection;
        update_switch_local_storage("switch.suitePathsSuiteSection", settings.switch.suitePathsSuiteSection);
        update_graphs_with_loading(
            ["suiteStatisticsGraph", "suiteDurationGraph", "suiteMostFailedGraph", "suiteMostTimeConsumingGraph"],
            () => {
                setup_suites_in_suite_select();
                update_suite_statistics_graph();
                update_suite_duration_graph();
                update_suite_most_failed_graph();
                update_suite_most_time_consuming_graph();
            }
        );
    });
    update_switch_local_storage("switch.sectionFiltersApplySuite", settings.switch.sectionFiltersApplySuite, true);
    document.getElementById("switchSectionFiltersApplySuite").addEventListener("change", () => {
        settings.switch.sectionFiltersApplySuite = !settings.switch.sectionFiltersApplySuite;
        update_switch_local_storage("switch.sectionFiltersApplySuite", settings.switch.sectionFiltersApplySuite);
        update_graphs_with_loading(
            ["suiteMostFailedGraph", "suiteMostTimeConsumingGraph"],
            () => {
                update_suite_most_failed_graph();
                update_suite_most_time_consuming_graph();
            }
        );
    });
    document.getElementById("resetSuiteFolder").addEventListener("click", () => {
        update_graphs_with_loading(["suiteFolderDonutGraph", "suiteFolderFailDonutGraph", "suiteStatisticsGraph", "suiteDurationGraph"], () => {
            update_suite_folder_donut_graph("");
        });
    });
    document.getElementById("suiteSelectTests").addEventListener("change", () => {
        const mostGraphIds = settings.switch.sectionFiltersApplyTest
            ? ["testMessagesGraph", "testMostFlakyGraph", "testRecentMostFlakyGraph",
               "testMostFailedGraph", "testRecentMostFailedGraph", "testMostTimeConsumingGraph"]
            : [];
        update_graphs_with_loading(
            ["testStatisticsGraph", "testDurationGraph", "testDurationDeviationGraph", ...mostGraphIds],
            () => {
                setup_testtags_in_select();
                setup_tests_in_select();
                update_test_statistics_graph();
                update_test_duration_graph();
                update_test_duration_deviation_graph();
                if (settings.switch.sectionFiltersApplyTest) {
                    update_test_messages_graph();
                    update_test_most_flaky_graph();
                    update_test_recent_most_flaky_graph();
                    update_test_most_failed_graph();
                    update_test_recent_most_failed_graph();
                    update_test_most_time_consuming_graph();
                }
            }
        );
    });
    update_switch_local_storage("switch.suitePathsTestSection", settings.switch.suitePathsTestSection, true);
    document.getElementById("switchSuitePathsTestSection").addEventListener("change", () => {
        settings.switch.suitePathsTestSection = !settings.switch.suitePathsTestSection;
        update_switch_local_storage("switch.suitePathsTestSection", settings.switch.suitePathsTestSection);
        update_graphs_with_loading(
            ["testStatisticsGraph", "testDurationGraph", "testDurationDeviationGraph", "testMessagesGraph",
                "testMostFlakyGraph", "testRecentMostFlakyGraph", "testMostFailedGraph",
                "testRecentMostFailedGraph", "testMostTimeConsumingGraph"],
            () => {
                setup_suites_in_test_select();
                update_test_statistics_graph();
                update_test_duration_graph();
                update_test_duration_deviation_graph();
                update_test_messages_graph();
                update_test_most_flaky_graph();
                update_test_recent_most_flaky_graph();
                update_test_most_failed_graph();
                update_test_recent_most_failed_graph();
                update_test_most_time_consuming_graph();
            }
        );
    });
    update_switch_local_storage("switch.sectionFiltersApplyTest", settings.switch.sectionFiltersApplyTest, true);
    document.getElementById("switchSectionFiltersApplyTest").addEventListener("change", () => {
        settings.switch.sectionFiltersApplyTest = !settings.switch.sectionFiltersApplyTest;
        update_switch_local_storage("switch.sectionFiltersApplyTest", settings.switch.sectionFiltersApplyTest);
        update_graphs_with_loading(
            ["testMessagesGraph", "testMostFlakyGraph", "testRecentMostFlakyGraph",
             "testMostFailedGraph", "testRecentMostFailedGraph", "testMostTimeConsumingGraph"],
            () => {
                update_test_messages_graph();
                update_test_most_flaky_graph();
                update_test_recent_most_flaky_graph();
                update_test_most_failed_graph();
                update_test_recent_most_failed_graph();
                update_test_most_time_consuming_graph();
            }
        );
    });
    document.getElementById("testTagsSelect").addEventListener("change", () => {
        const mostGraphIds = settings.switch.sectionFiltersApplyTest
            ? ["testMessagesGraph", "testMostFlakyGraph", "testRecentMostFlakyGraph",
               "testMostFailedGraph", "testRecentMostFailedGraph", "testMostTimeConsumingGraph"]
            : [];
        update_graphs_with_loading(
            ["testStatisticsGraph", "testDurationGraph", "testDurationDeviationGraph", ...mostGraphIds],
            () => {
                setup_tests_in_select();
                update_test_statistics_graph();
                update_test_duration_graph();
                update_test_duration_deviation_graph();
                if (settings.switch.sectionFiltersApplyTest) {
                    update_test_messages_graph();
                    update_test_most_flaky_graph();
                    update_test_recent_most_flaky_graph();
                    update_test_most_failed_graph();
                    update_test_recent_most_failed_graph();
                    update_test_most_time_consuming_graph();
                }
            }
        );
    });
    document.getElementById("testSelect").addEventListener("change", () => {
        const mostGraphIds = settings.switch.sectionFiltersApplyTest
            ? ["testMessagesGraph", "testMostFlakyGraph", "testRecentMostFlakyGraph",
               "testMostFailedGraph", "testRecentMostFailedGraph", "testMostTimeConsumingGraph"]
            : [];
        update_graphs_with_loading(
            ["testStatisticsGraph", "testDurationGraph", "testDurationDeviationGraph", ...mostGraphIds],
            () => {
                update_test_statistics_graph();
                update_test_duration_graph();
                update_test_duration_deviation_graph();
                if (settings.switch.sectionFiltersApplyTest) {
                    update_test_messages_graph();
                    update_test_most_flaky_graph();
                    update_test_recent_most_flaky_graph();
                    update_test_most_failed_graph();
                    update_test_recent_most_failed_graph();
                    update_test_most_time_consuming_graph();
                }
            }
        );
    });
    document.getElementById("keywordSelect").addEventListener("change", () => {
        const mostGraphIds = settings.switch.sectionFiltersApplyKeyword
            ? ["keywordMostFailedGraph", "keywordMostTimeConsumingGraph", "keywordMostUsedGraph"]
            : [];
        update_graphs_with_loading(
            ["keywordStatisticsGraph", "keywordTimesRunGraph", "keywordTotalDurationGraph",
                "keywordAverageDurationGraph", "keywordMinDurationGraph", "keywordMaxDurationGraph", ...mostGraphIds],
            () => {
                update_keyword_statistics_graph();
                update_keyword_times_run_graph();
                update_keyword_total_duration_graph();
                update_keyword_average_duration_graph();
                update_keyword_min_duration_graph();
                update_keyword_max_duration_graph();
                if (settings.switch.sectionFiltersApplyKeyword) {
                    update_keyword_most_failed_graph();
                    update_keyword_most_time_consuming_graph();
                    update_keyword_most_used_graph();
                }
            }
        );
    });
    update_switch_local_storage("switch.sectionFiltersApplyKeyword", settings.switch.sectionFiltersApplyKeyword, true);
    document.getElementById("switchSectionFiltersApplyKeyword").addEventListener("change", () => {
        settings.switch.sectionFiltersApplyKeyword = !settings.switch.sectionFiltersApplyKeyword;
        update_switch_local_storage("switch.sectionFiltersApplyKeyword", settings.switch.sectionFiltersApplyKeyword);
        update_graphs_with_loading(
            ["keywordMostFailedGraph", "keywordMostTimeConsumingGraph", "keywordMostUsedGraph"],
            () => {
                update_keyword_most_failed_graph();
                update_keyword_most_time_consuming_graph();
                update_keyword_most_used_graph();
            }
        );
    });
    update_switch_local_storage("switch.useLibraryNames", settings.switch.useLibraryNames, true);
    document.getElementById("switchUseLibraryNames").addEventListener("change", () => {
        settings.switch.useLibraryNames = !settings.switch.useLibraryNames;
        update_switch_local_storage("switch.useLibraryNames", settings.switch.useLibraryNames);
        update_graphs_with_loading(
            ["keywordStatisticsGraph", "keywordTimesRunGraph", "keywordTotalDurationGraph",
                "keywordAverageDurationGraph", "keywordMinDurationGraph", "keywordMaxDurationGraph",
                "keywordMostFailedGraph", "keywordMostTimeConsumingGraph", "keywordMostUsedGraph"],
            () => {
                setup_keywords_in_select();
                update_keyword_statistics_graph();
                update_keyword_times_run_graph();
                update_keyword_total_duration_graph();
                update_keyword_average_duration_graph();
                update_keyword_min_duration_graph();
                update_keyword_max_duration_graph();
                update_keyword_most_failed_graph();
                update_keyword_most_time_consuming_graph();
                update_keyword_most_used_graph();
            }
        );
    });
    // compare filters
    compareRunIds.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', () => {
                update_graphs_with_loading(
                    ["compareStatisticsGraph", "compareSuiteDurationGraph", "compareTestsGraph"],
                    () => {
                        update_compare_statistics_graph();
                        update_compare_suite_duration_graph();
                        update_compare_tests_graph();
                    }
                );
            });
        }
    });
    update_switch_local_storage("switch.suitePathsCompareSection", settings.switch.suitePathsCompareSection, true);
    document.getElementById("switchSuitePathsCompareSection").addEventListener("change", (e) => {
        settings.switch.suitePathsCompareSection = !settings.switch.suitePathsCompareSection;
        update_switch_local_storage("switch.suitePathsCompareSection", settings.switch.suitePathsCompareSection);
        update_graphs_with_loading(
            ["compareStatisticsGraph", "compareSuiteDurationGraph", "compareTestsGraph"],
            () => {
                update_compare_statistics_graph();
                update_compare_suite_duration_graph();
                update_compare_tests_graph();
            }
        );
    });
}

// helper functions to save and restore section filter values across fullscreen transitions
function save_section_filter_values() {
    const saved = {};
    const suiteFolder = document.getElementById("suiteFolder");
    if (suiteFolder) saved.suiteFolder = suiteFolder.innerText;
    ["suiteSelectSuites", "suiteSelectTests", "testSelect", "testTagsSelect", "keywordSelect",
        "compareRun1", "compareRun2", "compareRun3", "compareRun4"].forEach(id => {
            const el = document.getElementById(id);
            if (el) saved[id] = el.value;
        });
    return saved;
}

function restore_section_filter_values(saved) {
    const suiteFolder = document.getElementById("suiteFolder");
    if (suiteFolder && saved.suiteFolder !== undefined) suiteFolder.innerText = saved.suiteFolder;
    ["suiteSelectSuites", "suiteSelectTests", "testSelect", "testTagsSelect", "keywordSelect",
        "compareRun1", "compareRun2", "compareRun3", "compareRun4"].forEach(id => {
            const el = document.getElementById(id);
            if (el && saved[id] !== undefined) {
                const optionExists = Array.from(el.options).some(opt => opt.value === saved[id]);
                if (optionExists) el.value = saved[id];
            }
        });
}

export { setup_sections_filters, save_section_filter_values, restore_section_filter_values };
