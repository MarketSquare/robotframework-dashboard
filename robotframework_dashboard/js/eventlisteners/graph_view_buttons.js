import { settings } from "../variables/settings.js";
import {
    ignoreSkips,
    ignoreSkipsRecent,
    onlyFailedFolders,
    heatMapHourAll,
    inFullscreen,
    inFullscreenGraph,
    lastScrollY,
    previousFolder,
} from "../variables/globals.js";
import { fullscreenButtons, graphChangeButtons } from "../variables/graphs.js";
import {
    camelcase_to_underscore,
    underscore_to_camelcase,
    show_graph_loading,
    hide_graph_loading,
    update_graphs_with_loading,
} from "../common.js";
import { set_local_storage_item, update_graph_type } from "../localstorage.js";
import { update_run_donut_total_graph, update_run_heatmap_graph } from "../graph_creation/run.js";
import {
    update_suite_most_time_consuming_graph,
    update_suite_folder_donut_graph,
    update_suite_folder_fail_donut_graph,
} from "../graph_creation/suite.js";
import {
    update_test_statistics_graph,
    update_test_messages_graph,
    update_test_most_flaky_graph,
    update_test_recent_most_flaky_graph,
    update_test_most_failed_graph,
    update_test_recent_most_failed_graph,
    update_test_most_time_consuming_graph,
} from "../graph_creation/test.js";
import {
    update_keyword_most_time_consuming_graph,
    update_keyword_most_used_graph,
} from "../graph_creation/keyword.js";
import { update_compare_tests_graph } from "../graph_creation/compare.js";
import { save_section_filter_values, restore_section_filter_values } from "./section_filters.js";

// function to setup eventlisteners for changing the graph view buttons
function setup_graph_view_buttons() {
    // eventlisteners for fullscreen buttons
    for (let fullscreenButton of fullscreenButtons) {
        const fullscreenId = `${fullscreenButton}Fullscreen`;
        const closeId = `${fullscreenButton}Close`;
        const graphFunctionName = `update_${camelcase_to_underscore(fullscreenButton)}_graph`;

        const toggleFullscreen = (entering) => {
            const fullscreen = document.getElementById(fullscreenId);
            const close = document.getElementById(closeId);
            const content = fullscreen.closest(".grid-stack-item-content");
            const canvasId = `${fullscreenButton}Graph`;

            const savedFilterValues = save_section_filter_values();

            show_graph_loading(canvasId);
            inFullscreen = entering;
            fullscreen.hidden = entering;
            close.hidden = !entering;
            content.classList.toggle("fullscreen", entering);
            document.body.classList.toggle("lock-scroll", entering);
            document.documentElement.classList.toggle("html-scroll", !entering);

            setTimeout(() => {
                const graphBody = content.querySelector('.graph-body');
                let section = null;
                if (fullscreenButton.includes("suite")) {
                    section = "suite";
                } else if (fullscreenButton.includes("test")) {
                    section = "test";
                } else if (fullscreenButton.includes("keyword")) {
                    section = "keyword";
                } else if (fullscreenButton.includes("compare")) {
                    section = "compare";
                }
                if (section) {
                    const filters = document.getElementById(`${section}SectionFilters`);
                    const originalContainer = document.getElementById(`${section}SectionFiltersContainer`);
                    if (entering) {
                        const fullscreenHeader = document.querySelector('.grid-stack-item-content.fullscreen');
                        fullscreenHeader.insertBefore(filters, fullscreenHeader.firstChild);
                    } else {
                        originalContainer.insertBefore(filters, originalContainer.firstChild);
                    }
                }

                // Lock graph-body height to prevent Chart.js resize feedback loop
                if (entering && graphBody) {
                    graphBody.style.height = graphBody.clientHeight + 'px';
                } else if (graphBody) {
                    graphBody.style.height = '';
                }

                if (typeof window[graphFunctionName] === "function") {
                    if (fullscreenButton === "suiteFolderDonut") {
                        // Pass the saved folder so the donut and related graphs rebuild correctly
                        const currentFolder = savedFilterValues.suiteFolder;
                        window[graphFunctionName](currentFolder === "All" ? "" : currentFolder);
                    } else {
                        window[graphFunctionName]();
                    }
                }

                if (fullscreenButton === "runDonut") {
                    update_run_donut_total_graph();
                }

                restore_section_filter_values(savedFilterValues);

                hide_graph_loading(canvasId);
            }, 0);
        };

        document.getElementById(fullscreenId).addEventListener("click", () => {
            inFullscreenGraph = fullscreenId;
            lastScrollY = window.scrollY;
            document.getElementById("navigation").style.display = "none";
            toggleFullscreen(true);
        });

        document.getElementById(closeId).addEventListener("click", () => {
            inFullscreenGraph = ""
            document.getElementById("navigation").style.display = "";
            toggleFullscreen(false);
            window.scrollTo({ top: lastScrollY, behavior: "auto" });
        });
    }
    // close fullscreen on Escape key
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && inFullscreen) {
            const closeBtn = document.querySelector(`.close-graph[id$="Close"]:not([hidden])`);
            if (closeBtn) closeBtn.click();
        }
    });
    // has to be added after the creation of the sections and graphs
    document.getElementById("suiteFolderDonutGoUp").addEventListener("click", function () {
        function remove_last_folder(path) {
            const parts = path.split(".");
            parts.pop();
            return parts.length > 0 ? parts.join('.') : "";
        }
        const folder = remove_last_folder(previousFolder)
        if (previousFolder == "" && folder == "") { return }
        update_graphs_with_loading(["suiteFolderDonutGraph", "suiteFolderFailDonutGraph", "suiteStatisticsGraph", "suiteDurationGraph"], () => {
            update_suite_folder_donut_graph(folder)
        });
    });
    // ignore skip button eventlisteners
    document.getElementById("ignoreSkips").checked = settings.switch.ignoreSkips;
    ignoreSkips = settings.switch.ignoreSkips;
    document.getElementById("ignoreSkipsRecent").checked = settings.switch.ignoreSkipsRecent;
    ignoreSkipsRecent = settings.switch.ignoreSkipsRecent;
    document.getElementById("onlyFailedFolders").checked = settings.switch.onlyFailedFolders;
    onlyFailedFolders = settings.switch.onlyFailedFolders;

    document.getElementById("ignoreSkips").addEventListener("change", () => {
        ignoreSkips = !ignoreSkips;
        set_local_storage_item("switch.ignoreSkips", ignoreSkips);
        update_graphs_with_loading(["testMostFlakyGraph"], () => {
            update_test_most_flaky_graph();
        });
    });
    document.getElementById("ignoreSkipsRecent").addEventListener("change", () => {
        ignoreSkipsRecent = !ignoreSkipsRecent;
        set_local_storage_item("switch.ignoreSkipsRecent", ignoreSkipsRecent);
        update_graphs_with_loading(["testRecentMostFlakyGraph"], () => {
            update_test_recent_most_flaky_graph();
        });
    });
    document.getElementById("onlyFailedFolders").addEventListener("change", () => {
        onlyFailedFolders = !onlyFailedFolders;
        set_local_storage_item("switch.onlyFailedFolders", onlyFailedFolders);
        update_graphs_with_loading(["suiteFolderDonutGraph", "suiteFolderFailDonutGraph", "suiteStatisticsGraph", "suiteDurationGraph"], () => {
            update_suite_folder_donut_graph("");
        });
    });

    [
        ["onlyLastRunSuite", "switch.onlyLastRunSuite"],
        ["onlyLastRunTest", "switch.onlyLastRunTest"],
        ["onlyLastRunKeyword", "switch.onlyLastRunKeyword"],
        ["onlyLastRunKeywordMostUsed", "switch.onlyLastRunKeywordMostUsed"],
        ["testOnlyChanges", "switch.testOnlyChanges"],
        ["compareOnlyChanges", "switch.compareOnlyChanges"],
    ].forEach(([elementId, settingsKey]) => {
        const value = settingsKey.split(".").reduce((acc, k) => acc?.[k], settings);
        if (typeof value === "boolean") {
            document.getElementById(elementId).checked = value;
        }
    });

    [
        ["heatMapTestType", "switch.heatmapStatus"],
        ["heatMapHour", "switch.heatmapHour"],
        ["testNoChanges", "switch.testStatusFilter"],
        ["testRerunView", "switch.testRerunView"],
        ["compareNoChanges", "switch.compareStatusFilter"],
        ["compareRerunView", "switch.compareRerunView"],
    ].forEach(([elementId, settingsKey]) => {
        const value = settingsKey.split(".").reduce((acc, k) => acc?.[k], settings);
        if (typeof value === "string") {
            document.getElementById(elementId).value = value;
        }
    });
    heatMapHourAll = document.getElementById("heatMapHour").value === "All";

    [
        ["heatMapTestType", "runHeatmapGraph", update_run_heatmap_graph, "switch.heatmapStatus", "select"],
        ["testOnlyChanges", "testStatisticsGraph", update_test_statistics_graph, "switch.testOnlyChanges", "checkbox"],
        ["testNoChanges", "testStatisticsGraph", update_test_statistics_graph, "switch.testStatusFilter", "select"],
        ["compareOnlyChanges", "compareTestsGraph", update_compare_tests_graph, "switch.compareOnlyChanges", "checkbox"],
        ["compareNoChanges", "compareTestsGraph", update_compare_tests_graph, "switch.compareStatusFilter", "select"],
        ["compareRerunView", "compareTestsGraph", update_compare_tests_graph, "switch.compareRerunView", "select"],
        ["onlyLastRunSuite", "suiteMostTimeConsumingGraph", update_suite_most_time_consuming_graph, "switch.onlyLastRunSuite", "checkbox"],
        ["onlyLastRunTest", "testMostTimeConsumingGraph", update_test_most_time_consuming_graph, "switch.onlyLastRunTest", "checkbox"],
        ["onlyLastRunKeyword", "keywordMostTimeConsumingGraph", update_keyword_most_time_consuming_graph, "switch.onlyLastRunKeyword", "checkbox"],
        ["onlyLastRunKeywordMostUsed", "keywordMostUsedGraph", update_keyword_most_used_graph, "switch.onlyLastRunKeywordMostUsed", "checkbox"],
    ].forEach(([elementId, graphId, updateFn, settingsKey, type]) => {
        document.getElementById(elementId).addEventListener("change", () => {
            const el = document.getElementById(elementId);
            const newValue = type === "select" ? el.value : el.checked;
            set_local_storage_item(settingsKey, newValue);
            update_graphs_with_loading([graphId], updateFn);
        });
    });
    // the rerun view (mark reruns / final result / first attempt) is read by every test graph that
    // marks re-executed tests or resolves their status, not only by the test statistics graph
    document.getElementById("testRerunView").addEventListener("change", () => {
        set_local_storage_item("switch.testRerunView", document.getElementById("testRerunView").value);
        update_graphs_with_loading(
            ["testStatisticsGraph", "testMessagesGraph", "testMostFlakyGraph", "testRecentMostFlakyGraph",
                "testMostFailedGraph", "testRecentMostFailedGraph"],
            () => {
                update_test_statistics_graph();
                update_test_messages_graph();
                update_test_most_flaky_graph();
                update_test_recent_most_flaky_graph();
                update_test_most_failed_graph();
                update_test_recent_most_failed_graph();
            }
        );
    });
    document.getElementById("heatMapHour").addEventListener("change", () => {
        heatMapHourAll = document.getElementById("heatMapHour").value === "All";
        set_local_storage_item("switch.heatmapHour", document.getElementById("heatMapHour").value);
        update_graphs_with_loading(["runHeatmapGraph"], () => {
            update_run_heatmap_graph();
        });
    });
    // graph layout changes
    document.querySelectorAll(".shown-graph").forEach(btn => {
        btn.addEventListener("click", () => {
            btn.hidden = true;
            document.getElementById(`${btn.id.replace("Shown", "Hidden")}`).hidden = false;
            document.dispatchEvent(new CustomEvent("layout-user-action"));
        })
    });
    document.querySelectorAll(".hidden-graph").forEach(btn => {
        btn.addEventListener("click", () => {
            btn.hidden = true;
            document.getElementById(`${btn.id.replace("Hidden", "Shown")}`).hidden = false;
            document.dispatchEvent(new CustomEvent("layout-user-action"));
        })
    });
    // table layout changes
    document.querySelectorAll(".move-up-table").forEach(btn => {
        btn.addEventListener("click", () => {
            const section = btn.closest(".table-section");
            const previous = section.previousElementSibling;
            if (previous && previous.classList.contains("table-section")) {
                section.parentElement.insertBefore(section, previous);
                document.dispatchEvent(new CustomEvent("layout-user-action"));
            }
        });
    });
    document.querySelectorAll(".move-down-table").forEach(btn => {
        btn.addEventListener("click", () => {
            const section = btn.closest(".table-section");
            const next = section.nextElementSibling;
            if (next && next.classList.contains("table-section")) {
                section.parentElement.insertBefore(next, section);
                document.dispatchEvent(new CustomEvent("layout-user-action"));
            }
        });
    });
    function update_active_graph_type_buttons(graphChangeButton, activeGraphType) {
        const camelButtonName = underscore_to_camelcase(graphChangeButton);
        const buttonTypes = graphChangeButtons[graphChangeButton].split(",");
        buttonTypes.forEach((graphType) => {
            const buttonId = `${camelButtonName}Graph${graphType}`;
            const buttonElement = document.getElementById(buttonId);
            buttonElement.classList.remove("active");
            if (graphType.toLowerCase() === activeGraphType) {
                buttonElement.classList.add("active");
            }
        });
    }
    function handle_graph_change_type_button_click(graphChangeButton, graphType, camelButtonName) {
        const canvasId = `${camelButtonName}Graph`;
        show_graph_loading(canvasId);
        setTimeout(() => {
            update_graph_type(`${camelButtonName}GraphType`, graphType)
            window[`create_${graphChangeButton}_graph`]();
            update_active_graph_type_buttons(graphChangeButton, graphType);
            if (graphChangeButton == 'run_donut') { update_run_donut_total_graph(); }
            if (graphChangeButton == 'suite_folder_donut') { update_suite_folder_fail_donut_graph(); }
            hide_graph_loading(canvasId);
        }, 0);
    }
    function add_graph_eventlisteners(graphChangeButton, buttonTypes) {
        const camelButtonName = underscore_to_camelcase(graphChangeButton);
        const graphTypes = buttonTypes.split(",");
        graphTypes.forEach((graphType, index) => {
            const buttonId = `${camelButtonName}Graph${graphType}`;
            if (document.getElementById(buttonId)) {
                document.getElementById(buttonId).addEventListener("click", () => {
                    handle_graph_change_type_button_click(graphChangeButton, graphType.toLowerCase(), camelButtonName);
                });
            }
        });
    }
    Object.entries(graphChangeButtons).forEach(([graphChangeButton, buttonTypes]) => {
        add_graph_eventlisteners(graphChangeButton, buttonTypes);
    });
    Object.entries(graphChangeButtons).forEach(([graphChangeButton, buttonTypes]) => {
        if (graphChangeButton.includes("table")) { return; }
        const camelButtonName = underscore_to_camelcase(graphChangeButton);
        const storedGraphType = settings?.graphTypes?.[`${camelButtonName}GraphType`];
        const defaultGraphType = buttonTypes.split(",")[0].toLowerCase();
        const activeGraphType = storedGraphType || defaultGraphType;
        update_active_graph_type_buttons(graphChangeButton, activeGraphType);
    });

    document.getElementById("sectionFiltersModal").addEventListener("show.bs.modal", function () {
        ["suite", "test", "keyword"].forEach(section => {
            const filters = document.getElementById(`${section}SectionFilters`);
            const cardBody = document.getElementById(`${section}SectionFiltersCardBody`);
            if (filters && cardBody) cardBody.appendChild(filters);
        });
    });

    document.getElementById("sectionFiltersModal").addEventListener("hide.bs.modal", function () {
        ["suite", "test", "keyword"].forEach(section => {
            const filters = document.getElementById(`${section}SectionFilters`);
            const container = document.getElementById(`${section}SectionFiltersContainer`);
            if (filters && container) container.insertBefore(filters, container.firstChild);
        });
    });
}

export { setup_graph_view_buttons };
