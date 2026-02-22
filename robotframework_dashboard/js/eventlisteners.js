import { runs, keywords, filteredAmount, filteredAmountDefault, server } from './variables/data.js';
import { settings } from "./variables/settings.js";
import {
    showingRunTags,
    ignoreSkips,
    ignoreSkipsRecent,
    onlyFailedFolders,
    heatMapHourAll,
    inFullscreen,
    inFullscreenGraph,
    lastScrollY,
    previousFolder,
    showingProjectVersionDialogue,
} from "./variables/globals.js";
import { arrowDown, arrowRight } from "./variables/svg.js";
import { fullscreenButtons, graphChangeButtons, compareRunIds } from "./variables/graphs.js";
import { add_alert } from "./common.js";
import { toggle_theme, apply_theme_colors } from "./theme.js";
import { setup_data_and_graphs, update_menu } from "./menu.js";
import {
    setup_run_amount_filter,
    setup_lowest_highest_dates,
    clear_all_filters,
    setup_project_versions_in_select_filter_buttons,
    update_overview_version_select_list,
    setup_metadata_filter
} from "./filter.js"
import { camelcase_to_underscore, underscore_to_camelcase } from "./common.js";
import {
    update_switch_local_storage,
    set_local_storage_item,
    update_graph_type,
} from "./localstorage.js";
import {
    create_overview_latest_graphs,
    create_overview_total_graphs,
    update_overview_latest_heading,
    update_overview_total_heading,
    update_overview_sections_visibility,
    update_projectbar_visibility,
    set_filter_show_current_project,
    set_filter_show_current_version,
    update_overview_filter_visibility,
} from "./graph_creation/overview.js";
import { create_run_donut_total_graph, create_run_heatmap_graph } from "./graph_creation/run.js";
import {
    create_suite_duration_graph,
    create_suite_statistics_graph,
    create_suite_most_failed_graph,
    create_suite_most_time_consuming_graph,
    create_suite_folder_donut_graph,
    create_suite_folder_fail_donut_graph,
} from "./graph_creation/suite.js";
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
} from "./graph_creation/test.js";
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
} from "./graph_creation/keyword.js";
import {
    create_compare_statistics_graph,
    create_compare_suite_duration_graph,
    create_compare_tests_graph,
} from "./graph_creation/compare.js";

// function to setup filter modal eventlisteners
function setup_filter_modal() {
    // eventlistener to catch the closing of the filter modal
    $("#filtersModal").on("hidden.bs.modal", function () {
        setup_data_and_graphs();
    });
    // eventlistener to reset the filters
    document.getElementById("resetFilters").addEventListener("click", function () {
        clear_all_filters();
        add_alert("Filters have been set to default values!", "success")
    });
    // eventlistener for all runs button
    document.getElementById("allRuns").addEventListener("click", function () {
        document.getElementById("amount").value = Object.keys(runs).length;
    });
    // eventlistener for the runTags
    function show_checkboxes() {
        const checkboxes = document.getElementById("runTagCheckBoxes");
        showingRunTags = !showingRunTags;
        checkboxes.style.display = showingRunTags ? "block" : "none";
    }
    const checkboxesElement = document.getElementById("runTagCheckBoxes");
    const runTagsSelectElement = document.getElementById("selectRunTags");
    // eventlistener for click events on body to hide the run checkboxes when clicking outside of the select/checkboxes elements
    document.getElementById("selectRunTags").addEventListener("click", show_checkboxes);
    document.body.addEventListener("click", function (event) {
        if (showingRunTags == true && !checkboxesElement.contains(event.target) && !runTagsSelectElement.contains(event.target)) {
            show_checkboxes()
        }
    });
    // eventlistener for the project version filter popup
    const projectVersionCheckboxes = document.getElementById("projectVersionCheckBoxes");
    const projectVersionSelectElement = document.getElementById("selectProjectVersion");
    function toggle_project_version_filter_dialogue() {
        showingProjectVersionDialogue = !showingProjectVersionDialogue;
        projectVersionCheckboxes.style.display = showingProjectVersionDialogue ? "block" : "none";
    }
    projectVersionSelectElement.addEventListener("pointerdown", toggle_project_version_filter_dialogue);
    document.body.addEventListener("pointerdown", function (event) {
        if (showingProjectVersionDialogue && !projectVersionCheckboxes.contains(event.target) && !projectVersionSelectElement.contains(event.target)) {
            toggle_project_version_filter_dialogue();
        }
    });
    // amount filter setup
    filteredAmountDefault = filteredAmount
    document.getElementById("amount").value = filteredAmount
    if (server) {
        document.getElementById("openDashboard").hidden = false
    }
    // fill the filters with default values
    setup_run_amount_filter();
    setup_lowest_highest_dates();
    setup_metadata_filter();
    setup_runs_in_select_filter_buttons();
    setup_runtags_in_select_filter_buttons();
    setup_project_versions_in_select_filter_buttons();
}

// function to create customized view eventlisteners
function setup_settings_modal() {
    // function to catch the closing of the settings modal
    $("#settingsModal").on("hidden.bs.modal", function () {
        setup_data_and_graphs();
    });
    // function to catch the closing of the settings modal
    $("#settingsModal").on("shown.bs.modal", function () {
        const libraries = [...new Set(
            keywords
                .map(item => item.owner)
                .filter(owner => owner) // remove null, undefined, or empty string
        )];
        const keywordPrefs = settings.libraries ?? {};
        function render_keyword_libraries() {
            const container = document.getElementById("keywordLibraryList");
            container.innerHTML = "";
            libraries.forEach(lib => {
                const isChecked = keywordPrefs[lib] ?? true;
                const item = document.createElement("div");
                item.className = "list-group-item d-flex justify-content-between align-items-center";
                item.innerHTML = `
                    <span>${lib}</span>
                    <div class="form-check form-switch mb-0">
                        <input class="form-check-input" type="checkbox" id="keyword-${lib}"
                            ${isChecked ? "checked" : ""}>
                    </div>
                `;
                container.appendChild(item);
                document.getElementById(`keyword-${lib}`).addEventListener("change", e => {
                    keywordPrefs[lib] = e.target.checked;
                    set_local_storage_item("libraries", keywordPrefs)
                });
            });
        }
        render_keyword_libraries();
    });
    // function to create setting toggle handlers
    function create_toggle_handler({ key, elementId, isNumber = false }) {
        return function (load = false) {
            const element = document.getElementById(elementId);
            if (load) {
                const storedValue = key.split(".").reduce((acc, k) => acc?.[k], settings);
                if (isNumber) {
                    if (typeof storedValue === "number") {
                        element.value = storedValue;
                    }
                } else {
                    if (typeof storedValue === "boolean") {
                        element.checked = storedValue;
                    }
                }
            } else {
                let newValue;
                if (isNumber) {
                    newValue = parseInt(element.value);
                } else {
                    const currentValue = key.split(".").reduce((acc, k) => acc?.[k], settings);
                    newValue = !currentValue;
                    element.checked = newValue;
                }
                set_local_storage_item(key, newValue);
            }
        };
    }

    const toggle_unified = create_toggle_handler({
        key: "show.unified",
        elementId: "toggleUnified"
    });

    const toggle_labels = create_toggle_handler({
        key: "show.dateLabels",
        elementId: "toggleLabels"
    });

    const toggle_legends = create_toggle_handler({
        key: "show.legends",
        elementId: "toggleLegends"
    });

    const toggle_aliases = create_toggle_handler({
        key: "show.aliases",
        elementId: "toggleAliases"
    });

    const toggle_milliseconds = create_toggle_handler({
        key: "show.milliseconds",
        elementId: "toggleMilliseconds"
    });

    const toggle_axis_titles = create_toggle_handler({
        key: "show.axisTitles",
        elementId: "toggleAxisTitles"
    });

    const toggle_animations = create_toggle_handler({
        key: "show.animation",
        elementId: "toggleAnimations"
    });

    const toggle_animation_duration = create_toggle_handler({
        key: "show.duration",
        elementId: "toggleAnimationDuration",
        isNumber: true
    });

    const toggle_bar_rounding = create_toggle_handler({
        key: "show.rounding",
        elementId: "toggleBarRounding",
        isNumber: true
    });

    const toggle_prefixes = create_toggle_handler({
        key: "show.prefixes",
        elementId: "togglePrefixes"
    });

    // Initial load
    toggle_unified(true);
    toggle_labels(true);
    toggle_legends(true);
    toggle_aliases(true);
    toggle_milliseconds(true);
    toggle_axis_titles(true);
    toggle_animations(true);
    toggle_animation_duration(true);
    toggle_bar_rounding(true);
    toggle_prefixes(true);

    // Add event listeners
    document.getElementById("toggleUnified").addEventListener("click", () => toggle_unified());
    document.getElementById("toggleLabels").addEventListener("click", () => toggle_labels());
    document.getElementById("toggleLegends").addEventListener("click", () => toggle_legends());
    document.getElementById("toggleAliases").addEventListener("click", () => toggle_aliases());
    document.getElementById("toggleMilliseconds").addEventListener("click", () => toggle_milliseconds());
    document.getElementById("toggleAxisTitles").addEventListener("click", () => toggle_axis_titles());
    document.getElementById("toggleAnimations").addEventListener("click", () => toggle_animations());
    document.getElementById("toggleAnimationDuration").addEventListener("change", () => toggle_animation_duration());
    document.getElementById("toggleBarRounding").addEventListener("change", () => toggle_bar_rounding());
    document.getElementById("togglePrefixes").addEventListener("click", () => toggle_prefixes());
    document.getElementById("themeLight").addEventListener("click", () => toggle_theme());
    document.getElementById("themeDark").addEventListener("click", () => toggle_theme());

    // Convert any CSS color string to #rrggbb hex for <input type="color">
    function to_hex_color(color) {
        // Handle rgba/rgb strings by parsing components directly
        const rgbaMatch = color.match(/^rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/);
        if (rgbaMatch) {
            const [, r, g, b] = rgbaMatch.map(Number);
            return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
        }
        // For hex shorthand (#eee) and other CSS colors, use canvas normalization
        const ctx = document.createElement('canvas').getContext('2d');
        ctx.fillStyle = color;
        return ctx.fillStyle;
    }

    function create_theme_color_handler(colorKey, elementId) {
        function load_color() {
            const element = document.getElementById(elementId);
            const isDarkMode = document.documentElement.classList.contains("dark-mode");
            const themeMode = isDarkMode ? 'dark' : 'light';
            
            // Check if user has custom colors for this theme mode
            const customColors = settings.theme_colors?.custom?.[themeMode];
            const storedColor = customColors?.[colorKey];
            
            if (storedColor) {
                element.value = to_hex_color(storedColor);
            } else {
                // Use default from settings for current theme mode
                const defaults = settings.theme_colors[themeMode];
                element.value = to_hex_color(defaults[colorKey]);
            }
        }

        function update_color() {
            const element = document.getElementById(elementId);
            const newColor = element.value;
            const isDarkMode = document.documentElement.classList.contains("dark-mode");
            const themeMode = isDarkMode ? 'dark' : 'light';
            
            if (!settings.theme_colors.custom) {
                settings.theme_colors.custom = { light: {}, dark: {} };
            }
            if (!settings.theme_colors.custom[themeMode]) {
                settings.theme_colors.custom[themeMode] = {};
            }
            
            settings.theme_colors.custom[themeMode][colorKey] = newColor;
            set_local_storage_item(`theme_colors.custom.${themeMode}.${colorKey}`, newColor);
            apply_theme_colors();
        }

        function reset_color() {
            const element = document.getElementById(elementId);
            const isDarkMode = document.documentElement.classList.contains("dark-mode");
            const themeMode = isDarkMode ? 'dark' : 'light';
            
            // Reset to default from settings
            const defaults = settings.theme_colors[themeMode];
            element.value = to_hex_color(defaults[colorKey]);
            
            if (settings.theme_colors?.custom?.[themeMode]) {
                delete settings.theme_colors.custom[themeMode][colorKey];
                set_local_storage_item('theme_colors.custom', settings.theme_colors.custom);
            }
            
            apply_theme_colors();
        }

        return { load_color, update_color, reset_color };
    }

    const backgroundColorHandler = create_theme_color_handler('background', 'themeBackgroundColor');
    const cardColorHandler = create_theme_color_handler('card', 'themeCardColor');
    const highlightColorHandler = create_theme_color_handler('highlight', 'themeHighlightColor');
    const textColorHandler = create_theme_color_handler('text', 'themeTextColor');

    // Load colors on modal open
    $("#settingsModal").on("shown.bs.modal", function () {
        backgroundColorHandler.load_color();
        cardColorHandler.load_color();
        highlightColorHandler.load_color();
        textColorHandler.load_color();
    });

    // Add event listeners for color inputs
    document.getElementById('themeBackgroundColor').addEventListener('change', () => backgroundColorHandler.update_color());
    document.getElementById('themeCardColor').addEventListener('change', () => cardColorHandler.update_color());
    document.getElementById('themeHighlightColor').addEventListener('change', () => highlightColorHandler.update_color());
    document.getElementById('themeTextColor').addEventListener('change', () => textColorHandler.update_color());

    // Add event listeners for reset buttons
    document.getElementById('resetBackgroundColor').addEventListener('click', () => backgroundColorHandler.reset_color());
    document.getElementById('resetCardColor').addEventListener('click', () => cardColorHandler.reset_color());
    document.getElementById('resetHighlightColor').addEventListener('click', () => highlightColorHandler.reset_color());
    document.getElementById('resetTextColor').addEventListener('click', () => textColorHandler.reset_color());

    function show_settings_in_textarea() {
        const textArea = document.getElementById("settingsTextArea");
        textArea.value = JSON.stringify(settings, null, 2);
    }

    function copy_settings_to_clipboard() {
        const textArea = document.getElementById("settingsTextArea");
        textArea.select();
        textArea.setSelectionRange(0, 99999);
        navigator.clipboard.writeText(textArea.value);
        add_alert("Copied settings to clipboard!", "success")
    }

    async function reset_settings_to_default() {
        const confirmed = await confirm_action(`Are you sure you want to resset all settings?<br><br>
                    This may override:<br>
                    - Graph settings<br>
                    - Custom layouts (e.g., moved or resized graphs)<br>
                    - Hidden graphs
                    If you only want to update a few small settings it is recommended to update the settings json and re-apply it.
                `);
        if (confirmed) {
            localStorage.removeItem("settings");
            location.reload();
        }
    }

    async function apply_settings_from_textarea() {
        const confirmed = await confirm_action(`Are you sure you want to apply the new settings?<br><br>
                    This may override:<br>
                    - Graph settings<br>
                    - Custom layouts (e.g., moved or resized graphs)<br>
                    - Hidden graphs
                `);
        if (confirmed) {
            try {
                const input = document.getElementById("settingsTextArea").value;
                const newSettings = JSON.parse(input);
                settings = newSettings
                localStorage.setItem("settings", JSON.stringify(newSettings));
                location.reload();
            } catch (e) {
                add_alert("Failed to update json config: " + e, "danger")
            }
        }
    }
    document.getElementById("copySettings").addEventListener("click", copy_settings_to_clipboard);
    document.getElementById("resetSettings").addEventListener("click", reset_settings_to_default);
    document.getElementById("applySettings").addEventListener("click", apply_settings_from_textarea);
    document.getElementById("settingsModal").addEventListener("shown.bs.modal", show_settings_in_textarea);
}

function confirm_action(message = "Are you sure?") {
    return new Promise((resolve) => {
        const settingsModal = document.getElementById("settingsModal");
        const modalEl = document.getElementById("confirmModal");
        const modalBody = document.getElementById("confirmModalMessage");
        const cancelBtn = document.getElementById("confirmCancel");
        const okBtn = document.getElementById("confirmOk");

        settingsModal.classList.add("dimmed");
        modalBody.innerHTML = message;

        const modal = new bootstrap.Modal(modalEl);
        const onCancel = () => {
            resolve(false);
            modal.hide();
        };
        const onConfirm = () => {
            resolve(true);
            modal.hide();
        };
        const onHidden = () => {
            cleanup();
        };
        const cleanup = () => {
            cancelBtn.removeEventListener("click", onCancel);
            okBtn.removeEventListener("click", onConfirm);
            modalEl.removeEventListener("hidden.bs.modal", onHidden);
            settingsModal.classList.remove("dimmed");
        };

        cancelBtn.addEventListener("click", onCancel);
        okBtn.addEventListener("click", onConfirm);
        modalEl.addEventListener("hidden.bs.modal", onHidden);
        modal.show();
    });
}

// function to setup eventlisteners for filter buttons
function setup_sections_filters() {
    update_switch_local_storage("switch.runTags", settings.switch.runTags, true);
    update_switch_local_storage("switch.runName", settings.switch.runName, true);
    update_switch_local_storage("switch.totalStats", settings.switch.totalStats, true);
    update_switch_local_storage("switch.latestRuns", settings.switch.latestRuns, true);
    update_switch_local_storage("switch.percentageFilters", settings.switch.percentageFilters, true);
    update_switch_local_storage("switch.versionFilters", settings.switch.versionFilters, true);
    update_switch_local_storage("switch.sortFilters", settings.switch.sortFilters, true);
    document.getElementById("switchRunTags").addEventListener("click", function () {
        settings.switch.runTags = !settings.switch.runTags
        update_switch_local_storage("switch.runTags", settings.switch.runTags);
        // create latest and total bars and set visibility
        create_overview_latest_graphs();
        update_overview_latest_heading();
        create_overview_total_graphs();
        update_overview_total_heading();
        update_overview_sections_visibility();
        // update all tagged bars
        update_overview_version_select_list();
        update_projectbar_visibility();
    });
    document.getElementById("switchRunName").addEventListener("click", function () {
        settings.switch.runName = !settings.switch.runName
        update_switch_local_storage("switch.runName", settings.switch.runName);
        // create latest and total bars and set visibility
        create_overview_latest_graphs();
        update_overview_latest_heading();
        create_overview_total_graphs();
        update_overview_total_heading();
        update_overview_sections_visibility();
        // update all named project bars
        update_overview_version_select_list();
        update_projectbar_visibility();
    });
    document.getElementById("switchLatestRuns").addEventListener("click", function () {
        settings.switch.latestRuns = !settings.switch.latestRuns
        update_switch_local_storage("switch.latestRuns", settings.switch.latestRuns);
        update_overview_sections_visibility();
    });
    document.getElementById("switchTotalStats").addEventListener("click", function () {
        settings.switch.totalStats = !settings.switch.totalStats
        update_switch_local_storage("switch.totalStats", settings.switch.totalStats);
        update_overview_sections_visibility();
    });
    document.getElementById("switchPercentageFilters").addEventListener("click", function () {
        settings.switch.percentageFilters = !settings.switch.percentageFilters
        update_switch_local_storage("switch.percentageFilters", settings.switch.percentageFilters);
        update_overview_filter_visibility();
    });
    document.getElementById("switchSortFilters").addEventListener("click", function () {
        settings.switch.sortFilters = !settings.switch.sortFilters
        update_switch_local_storage("switch.sortFilters", settings.switch.sortFilters);
        update_overview_filter_visibility();
    });
    document.getElementById("switchVersionFilters").addEventListener("click", function () {
        settings.switch.versionFilters = !settings.switch.versionFilters
        update_switch_local_storage("switch.versionFilters", settings.switch.versionFilters);
        update_overview_filter_visibility();
    });
    document.getElementById("suiteSelectSuites").addEventListener("change", () => {
        create_suite_duration_graph();
        create_suite_statistics_graph();
    });
    update_switch_local_storage("switch.suitePathsSuiteSection", settings.switch.suitePathsSuiteSection, true);
    document.getElementById("switchSuitePathsSuiteSection").addEventListener("change", (e) => {
        settings.switch.suitePathsSuiteSection = !settings.switch.suitePathsSuiteSection;
        update_switch_local_storage("switch.suitePathsSuiteSection", settings.switch.suitePathsSuiteSection);
        setup_suites_in_suite_select();
        create_suite_statistics_graph();
        create_suite_duration_graph();
        create_suite_most_failed_graph();
        create_suite_most_time_consuming_graph();
    });
    document.getElementById("resetSuiteFolder").addEventListener("click", () => {
        create_suite_folder_donut_graph("");
    });
    document.getElementById("suiteSelectTests").addEventListener("change", () => {
        setup_testtags_in_select();
        setup_tests_in_select();
        create_test_statistics_graph();
        create_test_duration_graph();
        create_test_duration_deviation_graph();
    });
    update_switch_local_storage("switch.suitePathsTestSection", settings.switch.suitePathsTestSection, true);
    document.getElementById("switchSuitePathsTestSection").addEventListener("change", () => {
        settings.switch.suitePathsTestSection = !settings.switch.suitePathsTestSection;
        update_switch_local_storage("switch.suitePathsTestSection", settings.switch.suitePathsTestSection);
        setup_suites_in_test_select();
        create_test_statistics_graph();
        create_test_duration_graph();
        create_test_duration_deviation_graph();
        create_test_messages_graph();
        create_test_most_flaky_graph();
        create_test_recent_most_flaky_graph();
        create_test_most_failed_graph();
        create_test_recent_most_failed_graph();
        create_test_most_time_consuming_graph();
    });
    document.getElementById("testTagsSelect").addEventListener("change", () => {
        setup_tests_in_select();
        create_test_statistics_graph();
        create_test_duration_graph();
        create_test_duration_deviation_graph();
    });
    document.getElementById("testSelect").addEventListener("change", () => {
        create_test_statistics_graph();
        create_test_duration_graph();
        create_test_duration_deviation_graph();
    });
    document.getElementById("keywordSelect").addEventListener("change", () => {
        create_keyword_statistics_graph();
        create_keyword_times_run_graph();
        create_keyword_total_duration_graph();
        create_keyword_average_duration_graph();
        create_keyword_min_duration_graph();
        create_keyword_max_duration_graph();
    });
    update_switch_local_storage("switch.useLibraryNames", settings.switch.useLibraryNames, true);
    document.getElementById("switchUseLibraryNames").addEventListener("change", () => {
        settings.switch.useLibraryNames = !settings.switch.useLibraryNames;
        update_switch_local_storage("switch.useLibraryNames", settings.switch.useLibraryNames);
        setup_keywords_in_select();
        create_keyword_statistics_graph();
        create_keyword_times_run_graph();
        create_keyword_total_duration_graph();
        create_keyword_average_duration_graph();
        create_keyword_min_duration_graph();
        create_keyword_max_duration_graph();
        create_keyword_most_failed_graph();
        create_keyword_most_time_consuming_graph();
        create_keyword_most_used_graph();
    });
    // compare filters
    compareRunIds.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', () => {
                create_compare_statistics_graph();
                create_compare_suite_duration_graph();
                create_compare_tests_graph();
            });
        }
    });
    update_switch_local_storage("switch.suitePathsCompareSection", settings.switch.suitePathsCompareSection, true);
    document.getElementById("switchSuitePathsCompareSection").addEventListener("change", (e) => {
        settings.switch.suitePathsCompareSection = !settings.switch.suitePathsCompareSection;
        update_switch_local_storage("switch.suitePathsCompareSection", settings.switch.suitePathsCompareSection);
        create_compare_statistics_graph();
        create_compare_suite_duration_graph();
        create_compare_tests_graph();
    });
}

// function to setup eventlisteners for changing the graph view buttons
function setup_graph_view_buttons() {
    // eventlisteners for fullscreen buttons
    for (let fullscreenButton of fullscreenButtons) {
        const fullscreenId = `${fullscreenButton}Fullscreen`;
        const closeId = `${fullscreenButton}Close`;
        const graphFunctionName = `create_${camelcase_to_underscore(fullscreenButton)}_graph`;

        const toggleFullscreen = (entering) => {
            const fullscreen = document.getElementById(fullscreenId);
            const close = document.getElementById(closeId);
            const content = fullscreen.closest(".grid-stack-item-content");

            inFullscreen = entering;
            fullscreen.hidden = entering;
            close.hidden = !entering;
            content.classList.toggle("fullscreen", entering);
            document.body.classList.toggle("lock-scroll", entering);
            document.documentElement.classList.toggle("html-scroll", !entering)

            if (typeof window[graphFunctionName] === "function") {
                window[graphFunctionName]();
            }

            if (fullscreenButton === "runDonut") {
                create_run_donut_total_graph();
            } else if (fullscreenButton === "suiteFolderDonut") {
                create_suite_folder_fail_donut_graph();
            }

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
        };

        document.getElementById(fullscreenId).addEventListener("click", () => {
            inFullscreenGraph = fullscreenId;
            lastScrollY = window.scrollY;
            $("#navigation").hide();
            toggleFullscreen(true);
        });

        document.getElementById(closeId).addEventListener("click", () => {
            inFullscreenGraph = ""
            $("#navigation").show();
            toggleFullscreen(false);
            window.scrollTo({ top: lastScrollY, behavior: "auto" });
        });
    }
    // has to be added after the creation of the sections and graphs
    document.getElementById("suiteFolderDonutGoUp").addEventListener("click", function () {
        function remove_last_folder(path) {
            const parts = path.split(".");
            parts.pop();
            return parts.length > 0 ? parts.join('.') : "";
        }
        const folder = remove_last_folder(previousFolder)
        if (previousFolder == "" && folder == "") { return }
        create_suite_folder_donut_graph(folder)
    });
    // ignore skip button eventlisteners
    document.getElementById("ignoreSkips").addEventListener("change", () => {
        ignoreSkips = !ignoreSkips;
        create_test_most_flaky_graph();
    });
    document.getElementById("ignoreSkipsRecent").addEventListener("change", () => {
        ignoreSkipsRecent = !ignoreSkipsRecent;
        create_test_recent_most_flaky_graph();
    });
    document.getElementById("onlyFailedFolders").addEventListener("change", () => {
        onlyFailedFolders = !onlyFailedFolders;
        create_suite_folder_donut_graph("");
    });
    document.getElementById("heatMapTestType").addEventListener("change", () => {
        create_run_heatmap_graph();
    });
    document.getElementById("heatMapHour").addEventListener("change", () => {
        heatMapHourAll = document.getElementById("heatMapHour").value == "All" ? true : false;
        create_run_heatmap_graph();
    });
    document.getElementById("testOnlyChanges").addEventListener("change", () => {
        create_test_statistics_graph();
    });
    document.getElementById("testNoChanges").addEventListener("change", () => {
        create_test_statistics_graph();
    });
    document.getElementById("compareOnlyChanges").addEventListener("change", () => {
        create_compare_tests_graph();
    });
    document.getElementById("compareNoChanges").addEventListener("change", () => {
        create_compare_tests_graph();
    });
    // most time consuming only latest run switch event listeners
    document.getElementById("onlyLastRunSuite").addEventListener("change", () => {
        create_suite_most_time_consuming_graph();
    });
    document.getElementById("onlyLastRunTest").addEventListener("change", () => {
        create_test_most_time_consuming_graph();
    });
    document.getElementById("onlyLastRunKeyword").addEventListener("change", () => {
        create_keyword_most_time_consuming_graph();
    });
    document.getElementById("onlyLastRunKeywordMostUsed").addEventListener("change", () => {
        create_keyword_most_used_graph();
    });
    // graph layout changes
    document.querySelectorAll(".shown-graph").forEach(btn => {
        btn.addEventListener("click", () => {
            btn.hidden = true;
            document.getElementById(`${btn.id.replace("Shown", "Hidden")}`).hidden = false;
        })
    });
    document.querySelectorAll(".hidden-graph").forEach(btn => {
        btn.addEventListener("click", () => {
            btn.hidden = true;
            document.getElementById(`${btn.id.replace("Hidden", "Shown")}`).hidden = false;
        })
    });
    // table layout changes
    document.querySelectorAll(".move-up-table").forEach(btn => {
        btn.addEventListener("click", () => {
            const section = btn.closest(".table-section");
            const previous = section.previousElementSibling;
            if (previous && previous.classList.contains("table-section")) {
                section.parentElement.insertBefore(section, previous);
            }
        });
    });
    document.querySelectorAll(".move-down-table").forEach(btn => {
        btn.addEventListener("click", () => {
            const section = btn.closest(".table-section");
            const next = section.nextElementSibling;
            if (next && next.classList.contains("table-section")) {
                section.parentElement.insertBefore(next, section);
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
        update_graph_type(`${camelButtonName}GraphType`, graphType)
        window[`create_${graphChangeButton}_graph`]();
        update_active_graph_type_buttons(graphChangeButton, graphType);
        if (graphChangeButton == 'run_donut') { create_run_donut_total_graph(); }
        if (graphChangeButton == 'suite_folder_donut') { create_suite_folder_fail_donut_graph(); }
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
    // Initialize active states for all graph types on first load
    Object.entries(graphChangeButtons).forEach(([graphChangeButton, buttonTypes]) => {
        if (graphChangeButton.includes("table")) { return; }
        const camelButtonName = underscore_to_camelcase(graphChangeButton);
        const storedGraphType = settings?.graphTypes?.[`${camelButtonName}GraphType`];
        const defaultGraphType = buttonTypes.split(",")[0].toLowerCase();
        const activeGraphType = storedGraphType || defaultGraphType;
        update_active_graph_type_buttons(graphChangeButton, activeGraphType);
    });

    // Handle modal show event - move filters to modal
    $("#sectionFiltersModal").on("show.bs.modal", function () {
        // Move suite filters
        const suiteFilters = document.getElementById('suiteSectionFilters');
        const suiteCardBody = document.getElementById('suiteSectionFiltersCardBody');
        if (suiteFilters && suiteCardBody) {
            suiteCardBody.appendChild(suiteFilters);
        }
        
        // Move test filters
        const testFilters = document.getElementById('testSectionFilters');
        const testCardBody = document.getElementById('testSectionFiltersCardBody');
        if (testFilters && testCardBody) {
            testCardBody.appendChild(testFilters);
        }
        
        // Move keyword filters
        const keywordFilters = document.getElementById('keywordSectionFilters');
        const keywordCardBody = document.getElementById('keywordSectionFiltersCardBody');
        if (keywordFilters && keywordCardBody) {
            keywordCardBody.appendChild(keywordFilters);
        }
    });

    // Handle modal hide event - return filters to original positions
    $("#sectionFiltersModal").on("hide.bs.modal", function () {
        // Return suite filters
        const suiteFilters = document.getElementById('suiteSectionFilters');
        const suiteOriginalContainer = document.getElementById('suiteSectionFiltersContainer');
        if (suiteFilters && suiteOriginalContainer) {
            suiteOriginalContainer.insertBefore(suiteFilters, suiteOriginalContainer.firstChild);
        }
        
        // Return test filters
        const testFilters = document.getElementById('testSectionFilters');
        const testOriginalContainer = document.getElementById('testSectionFiltersContainer');
        if (testFilters && testOriginalContainer) {
            testOriginalContainer.insertBefore(testFilters, testOriginalContainer.firstChild);
        }
        
        // Return keyword filters
        const keywordFilters = document.getElementById('keywordSectionFilters');
        const keywordOriginalContainer = document.getElementById('keywordSectionFiltersContainer');
        if (keywordFilters && keywordOriginalContainer) {
            keywordOriginalContainer.insertBefore(keywordFilters, keywordOriginalContainer.firstChild);
        }
    });
}

// function to setup collapse buttons and icons
function setup_collapsables() {
    document.querySelectorAll(".collapse-icon").forEach(origIcon => {
        // Replace the element with a clone to remove existing listeners
        // required to readd collapsables for overview project sections
        const icon = origIcon.cloneNode(true);
        origIcon.replaceWith(icon);

        const sectionId = icon.id.replace("collapse", "");
        const update_icon = () => {
            const section = document.getElementById(sectionId);
            icon.innerHTML = section.hidden ? arrowRight : arrowDown;
        };
        icon.addEventListener("click", () => {
            const section = document.getElementById(sectionId);
            section.hidden = !section.hidden;
            update_icon();
        });
        update_icon();
    });
}

function attach_run_card_version_listener(versionElement, projectName, projectVersion) {
    versionElement.addEventListener("click", (event) => {
        clear_all_filters();
        set_filter_show_current_project(projectName);
        set_filter_show_current_version(projectVersion);
        event.stopPropagation();
        update_menu("menuDashboard");
    });
}

// this function setups the project bar "sort by" filters eventlisteners
function setup_overview_order_filters() {
    const parseProjectId = (selectId) => selectId.replace(/SectionOrder$/i, "");
    const parseRunStatsFromCard = (cardEl) => {
        const text = cardEl.innerText || "";
        const runMatch = text.match(/#\s*(\d+)/); // e.g., "#8"
        const passedMatch = text.match(/Passed:\s*(\d+)/i);
        const failedMatch = text.match(/Failed:\s*(\d+)/i);
        const skippedMatch = text.match(/Skipped:\s*(\d+)/i);
        return {
            runNumber: runMatch ? parseInt(runMatch[1]) : 0,
            passed: passedMatch ? parseInt(passedMatch[1]) : 0,
            failed: failedMatch ? parseInt(failedMatch[1]) : 0,
            skipped: skippedMatch ? parseInt(skippedMatch[1]) : 0,
        };
    };

    const reorderProjectCards = (projectId, order) => {
        // Determine correct container for both overview and project sections
        const containerId = `${projectId}RunCardsContainer`;
        const container = document.getElementById(containerId);
        if (!container) return; // guard against missing containers
        const cards = Array.from(container.querySelectorAll('.overview-card'));
        if (cards.length === 0) return;
        const enriched = cards.map(card => ({ el: card, stats: parseRunStatsFromCard(card) }));

        const cmpDesc = (a, b, key) => (b.stats[key] - a.stats[key]);
        const cmpAsc = (a, b, key) => (a.stats[key] - b.stats[key]);

        if (order === "oldest" || order.toLowerCase() === "oldest run") {
            enriched.sort((a, b) => cmpAsc(a, b, 'runNumber'));
        } else if (order === "most failed") {
            enriched.sort((a, b) => cmpDesc(a, b, 'failed'));
        } else if (order === "most skipped") {
            enriched.sort((a, b) => cmpDesc(a, b, 'skipped'));
        } else if (order === "most passed") {
            enriched.sort((a, b) => cmpDesc(a, b, 'passed'));
        } else {
            enriched.sort((a, b) => cmpDesc(a, b, 'runNumber'));
        }
        const fragment = document.createDocumentFragment();
        enriched.forEach(item => fragment.appendChild(item.el));
        container.innerHTML = '';
        container.appendChild(fragment);
    };

    document.querySelectorAll('.section-order-filter').forEach(select => {
        const selectId = select.id;
        if (selectId === "overviewLatestSectionOrder") {
            select.addEventListener('change', (e) => {
                create_overview_latest_graphs();
            });
        } else {
            const projectId = parseProjectId(selectId);
            select.addEventListener('change', (e) => {
                const order = (e.target.value || '').toLowerCase();
                reorderProjectCards(projectId, order);
            });
        }
    });
}

export {
    setup_filter_modal,
    setup_settings_modal,
    setup_sections_filters,
    setup_graph_view_buttons,
    setup_collapsables,
    attach_run_card_version_listener,
    setup_overview_order_filters
};