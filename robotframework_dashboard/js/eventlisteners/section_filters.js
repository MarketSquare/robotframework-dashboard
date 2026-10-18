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

// [graph id, update function] per section: "filtered" graphs always follow the section filters,
// "most" graphs only when the section's "apply section filters" switch is on
const SECTION_GRAPH_UPDATES = {
    suite: {
        filtered: [
            ["suiteStatisticsGraph", update_suite_statistics_graph],
            ["suiteDurationGraph", update_suite_duration_graph],
        ],
        most: [
            ["suiteMostFailedGraph", update_suite_most_failed_graph],
            ["suiteMostTimeConsumingGraph", update_suite_most_time_consuming_graph],
        ],
    },
    test: {
        filtered: [
            ["testStatisticsGraph", update_test_statistics_graph],
            ["testDurationGraph", update_test_duration_graph],
            ["testDurationDeviationGraph", update_test_duration_deviation_graph],
        ],
        most: [
            ["testMessagesGraph", update_test_messages_graph],
            ["testMostFlakyGraph", update_test_most_flaky_graph],
            ["testRecentMostFlakyGraph", update_test_recent_most_flaky_graph],
            ["testMostFailedGraph", update_test_most_failed_graph],
            ["testRecentMostFailedGraph", update_test_recent_most_failed_graph],
            ["testMostTimeConsumingGraph", update_test_most_time_consuming_graph],
        ],
    },
    keyword: {
        filtered: [
            ["keywordStatisticsGraph", update_keyword_statistics_graph],
            ["keywordTimesRunGraph", update_keyword_times_run_graph],
            ["keywordTotalDurationGraph", update_keyword_total_duration_graph],
            ["keywordAverageDurationGraph", update_keyword_average_duration_graph],
            ["keywordMinDurationGraph", update_keyword_min_duration_graph],
            ["keywordMaxDurationGraph", update_keyword_max_duration_graph],
        ],
        most: [
            ["keywordMostFailedGraph", update_keyword_most_failed_graph],
            ["keywordMostTimeConsumingGraph", update_keyword_most_time_consuming_graph],
            ["keywordMostUsedGraph", update_keyword_most_used_graph],
        ],
    },
    compare: {
        filtered: [
            ["compareStatisticsGraph", update_compare_statistics_graph],
            ["compareSuiteDurationGraph", update_compare_suite_duration_graph],
            ["compareTestsGraph", update_compare_tests_graph],
        ],
        most: [],
    },
};

const SECTION_APPLY_SWITCHES = {
    suite: "sectionFiltersApplySuite",
    test: "sectionFiltersApplyTest",
    keyword: "sectionFiltersApplyKeyword",
};

// all: the "most" graphs also when the apply switch is off; filtered: false leaves the filtered ones out
function get_section_graphs(section, { all = false, filtered = true } = {}) {
    const { filtered: filteredGraphs, most } = SECTION_GRAPH_UPDATES[section];
    const applySwitch = SECTION_APPLY_SWITCHES[section];
    const includeMost = all || (applySwitch && settings.switch[applySwitch]);
    return [...(filtered ? filteredGraphs : []), ...(includeMost ? most : [])];
}

// beforeUpdate runs first, for the section selects the graphs read
function update_section_graphs(graphs, beforeUpdate) {
    update_graphs_with_loading(graphs.map(([id]) => id), () => {
        beforeUpdate?.();
        graphs.forEach(([, update]) => update());
    });
}

// stores the initial state of settings.switch[name] and toggles it on every event of its switch
// (id "switch" + Name, see update_switch_local_storage) before onToggle runs
function setup_switch(name, eventName, onToggle) {
    const key = `switch.${name}`;
    update_switch_local_storage(key, settings.switch[name], true);
    const id = `switch${name.charAt(0).toUpperCase()}${name.slice(1)}`;
    document.getElementById(id).addEventListener(eventName, () => {
        settings.switch[name] = !settings.switch[name];
        update_switch_local_storage(key, settings.switch[name]);
        onToggle();
    });
}

// the run tag and run name switches change which projects the overview bars group by
function rebuild_overview_project_bars() {
    show_loading_overlay();
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            create_overview_latest_graphs();
            update_overview_latest_heading();
            create_overview_total_graphs();
            update_overview_total_heading();
            update_overview_sections_visibility();
            update_projectbar_visibility();
            setup_overview_section_menu_buttons();
            hide_loading_overlay();
        });
    });
}

function update_overview_sections() {
    update_overview_sections_visibility();
    setup_overview_section_menu_buttons();
}

// function to setup eventlisteners for filter buttons
function setup_sections_filters() {
    setup_switch("runTags", "click", rebuild_overview_project_bars);
    setup_switch("runName", "click", rebuild_overview_project_bars);
    setup_switch("totalStats", "click", update_overview_sections);
    setup_switch("latestRuns", "click", update_overview_sections);
    setup_switch("sortFilters", "click", update_overview_filter_visibility);
    document.getElementById("suiteSelectSuites").addEventListener("change", () => {
        update_section_graphs(get_section_graphs("suite"));
    });
    setup_switch("suitePathsSuiteSection", "change", () => {
        update_section_graphs(get_section_graphs("suite", { all: true }), setup_suites_in_suite_select);
    });
    setup_switch("sectionFiltersApplySuite", "change", () => {
        update_section_graphs(get_section_graphs("suite", { all: true, filtered: false }));
    });
    document.getElementById("resetSuiteFolder").addEventListener("click", () => {
        update_graphs_with_loading(["suiteFolderDonutGraph", "suiteFolderFailDonutGraph", "suiteStatisticsGraph", "suiteDurationGraph"], () => {
            update_suite_folder_donut_graph("");
        });
    });
    // each test section select rebuilds the selects below it
    document.getElementById("suiteSelectTests").addEventListener("change", () => {
        update_section_graphs(get_section_graphs("test"), () => {
            setup_testtags_in_select();
            setup_tests_in_select();
        });
    });
    document.getElementById("testTagsSelect").addEventListener("change", () => {
        update_section_graphs(get_section_graphs("test"), setup_tests_in_select);
    });
    document.getElementById("testSelect").addEventListener("change", () => {
        update_section_graphs(get_section_graphs("test"));
    });
    setup_switch("suitePathsTestSection", "change", () => {
        update_section_graphs(get_section_graphs("test", { all: true }), setup_suites_in_test_select);
    });
    setup_switch("sectionFiltersApplyTest", "change", () => {
        update_section_graphs(get_section_graphs("test", { all: true, filtered: false }));
    });
    document.getElementById("keywordSelect").addEventListener("change", () => {
        update_section_graphs(get_section_graphs("keyword"));
    });
    setup_switch("sectionFiltersApplyKeyword", "change", () => {
        update_section_graphs(get_section_graphs("keyword", { all: true, filtered: false }));
    });
    setup_switch("useLibraryNames", "change", () => {
        update_section_graphs(get_section_graphs("keyword", { all: true }), setup_keywords_in_select);
    });
    compareRunIds.forEach(id => {
        document.getElementById(id)?.addEventListener("change", () => {
            update_section_graphs(get_section_graphs("compare"));
        });
    });
    setup_switch("suitePathsCompareSection", "change", () => {
        update_section_graphs(get_section_graphs("compare"));
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
