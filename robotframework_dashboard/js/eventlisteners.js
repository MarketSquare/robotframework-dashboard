import { runs, keywords, filteredAmount, filteredAmountDefault, server, no_auto_update } from './variables/data.js';
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
    lastMergeResult,
    filterRows,
} from "./variables/globals.js";
import { arrowDown, arrowRight } from "./variables/svg.js";
import { fullscreenButtons, graphChangeButtons, compareRunIds } from "./variables/graphs.js";
import { toggle_theme, apply_theme_colors, apply_custom_branding } from "./theme.js";
import { add_alert, show_graph_loading, hide_graph_loading, update_graphs_with_loading, show_loading_overlay, hide_loading_overlay } from "./common.js";
import { setup_data_and_graphs, update_menu } from "./menu.js";
import { update_dashboard_graphs } from "./graph_creation/all.js";
import {
    setup_filtered_data_and_filters,
    setup_run_amount_filter,
    setup_lowest_highest_dates,
    clear_all_filters,
    setup_project_versions_in_select_filter_buttons,
    update_overview_version_select_list,
    setup_metadata_filter,
    build_profile_from_checks,
    apply_filter_profile,
    save_filter_profile_to_storage,
    delete_filter_profile,
    populate_filter_profile_select,
    enter_profile_edit_mode,
    exit_profile_edit_mode,
    update_profile_select_display,
    update_active_profile,
    clear_active_profile,
    capture_default_filters,
    merge_two_profiles,
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
import { update_run_donut_total_graph, update_run_heatmap_graph } from "./graph_creation/run.js";
import {
    update_suite_duration_graph,
    update_suite_statistics_graph,
    update_suite_most_failed_graph,
    update_suite_most_time_consuming_graph,
    update_suite_folder_donut_graph,
    update_suite_folder_fail_donut_graph,
} from "./graph_creation/suite.js";
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
} from "./graph_creation/test.js";
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
} from "./graph_creation/keyword.js";
import {
    update_compare_statistics_graph,
    update_compare_suite_duration_graph,
    update_compare_tests_graph,
} from "./graph_creation/compare.js";

// ---- Merge profiles modal helpers ----

// Render the per-field checkbox list for one side of the merge modal
function render_merge_profile_settings(profile, side) {
    const rows = filterRows
        .filter(def => def.present(profile))
        .map(def => {
            const checkId = `mergeCheck_${side}_${def.key}`;
            return `<div class="form-check mb-1">
                <input class="form-check-input merge-setting-check" type="checkbox"
                    id="${checkId}" data-side="${side}" data-key="${def.key}" checked>
                <label class="form-check-label small" for="${checkId}">
                    <span class="fw-semibold">${def.label}:</span> ${def.valueHtml(profile)}
                </label>
            </div>`;
        });
    return rows.length
        ? rows.join('')
        : '<p class="text-muted small mb-0">No settings in this profile.</p>';
}

// Extract only the fields whose checkboxes are checked for a given side
function get_checked_partial_profile(side, fullProfile) {
    const result = {};
    for (const def of filterRows) {
        const el = document.getElementById(`mergeCheck_${side}_${def.key}`);
        if (el && el.checked) {
            def.fields.forEach(f => {
                if (fullProfile[f] !== undefined) result[f] = fullProfile[f];
            });
        }
    }
    return result;
}

// Render the "Resulting Filters" preview section
function render_merge_result_html(result) {
    if (!Object.keys(result).length) {
        return '<span class="text-muted small">Select profiles and settings above to preview.</span>';
    }
    const rows = filterRows
        .filter(def => def.present(result))
        .map(def => `<dt class="col-sm-3 small fw-semibold">${def.label}</dt><dd class="col-sm-9 small mb-1">${def.valueHtml(result)}</dd>`);
    return `<dl class="row mb-0">${rows.join('')}</dl>`;
}

// Recompute and re-render the preview whenever selections or checkboxes change
function update_merge_result_preview() {
    const leftName = document.getElementById("mergeProfileLeft").value;
    const rightName = document.getElementById("mergeProfileRight").value;
    const profiles = settings.filterProfiles || {};
    const leftFull = leftName && profiles[leftName] ? profiles[leftName] : {};
    const rightFull = rightName && profiles[rightName] ? profiles[rightName] : {};
    const leftPartial = get_checked_partial_profile('left', leftFull);
    const rightPartial = get_checked_partial_profile('right', rightFull);
    lastMergeResult = merge_two_profiles(leftPartial, rightPartial);
    document.getElementById("mergeResultPreview").innerHTML = render_merge_result_html(lastMergeResult);
}

// ---- end of merge profiles helpers ----

// function to setup filter modal eventlisteners
function setup_filter_modal() {
    // eventlistener to catch the closing of the filter modal
    // Only recompute filtered data and update graphs in-place (no layout rebuild needed)
    $("#filtersModal").on("hide.bs.modal", function () {
        show_loading_overlay();
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setup_filtered_data_and_filters();
                update_dashboard_graphs();
                hide_loading_overlay();
            });
        });
    });
    // eventlistener to reset the filters
    document.getElementById("resetFilters").addEventListener("click", function () {
        clear_all_filters();
        clear_active_profile();
        add_alert("Filters have been set to default values!", "success")
        update_profile_select_display();
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
        if (no_auto_update) {
            document.getElementById("refreshDashboard").hidden = false
            document.getElementById("refreshDashboard").addEventListener("click", function () {
                document.getElementById("refreshDashboardSpinner").hidden = false
                const xhr = new XMLHttpRequest();
                xhr.open("POST", "/refresh-dashboard");
                xhr.setRequestHeader("Content-Type", "application/json; charset=UTF-8");
                xhr.onload = () => {
                    document.getElementById("refreshDashboardSpinner").hidden = true
                    if (xhr.readyState == 4 && xhr.status == 200) {
                        const response = JSON.parse(xhr.responseText);
                        if (response.success == "1") {
                            console.log(response.console)
                            add_alert(`${response.message} Reloading dashboard in 3 seconds!`, "success")
                            setTimeout(() => {
                                location.reload();
                            }, 3000);
                        } else {
                            add_alert(response.message, "danger")
                            console.log(response.console)
                        }
                    } else {
                        add_alert(`Error: ${xhr.status}, ${xhr.responseText}`, "danger")
                    }
                };
                xhr.send(JSON.stringify({}));
            });
        }
    }
    // fill the filters with default values
    setup_run_amount_filter();
    setup_lowest_highest_dates();
    setup_metadata_filter();
    setup_runs_in_select_filter_buttons();
    setup_runtags_in_select_filter_buttons();
    setup_project_versions_in_select_filter_buttons();
    // snapshot the default/initial filter state so profile checkboxes can reflect changes
    capture_default_filters();
    // filter profiles setup
    populate_filter_profile_select();
    let showingFilterProfiles = false;
    function toggle_filter_profiles() {
        showingFilterProfiles = !showingFilterProfiles;
        document.getElementById("filterProfileCheckBoxes").style.display = showingFilterProfiles ? "block" : "none";
    }
    document.getElementById("selectFilterProfile").addEventListener("click", toggle_filter_profiles);
    const filterProfileCheckBoxes = document.getElementById("filterProfileCheckBoxes");
    const selectFilterProfileElement = document.getElementById("selectFilterProfile");
    document.body.addEventListener("click", function (event) {
        if (showingFilterProfiles && !filterProfileCheckBoxes.contains(event.target) && !selectFilterProfileElement.contains(event.target)) {
            toggle_filter_profiles();
        }
    });
    document.getElementById("addFilterProfile").addEventListener("click", function () {
        enter_profile_edit_mode();
    });
    document.getElementById("cancelFilterProfile").addEventListener("click", function () {
        exit_profile_edit_mode();
    });
    document.getElementById("saveFilterProfile").addEventListener("click", function () {
        const name = document.getElementById("filterProfileName").value.trim();
        if (!name) {
            add_alert("Please enter a profile name!", "warning");
            return;
        }
        const profileData = build_profile_from_checks();
        save_filter_profile_to_storage(name, profileData);
        populate_filter_profile_select();
        exit_profile_edit_mode();
        update_profile_select_display();
        add_alert(`Filter profile "${name}" saved!`, "success");
    });
    document.getElementById("filterProfileList").addEventListener("click", async function (event) {
        const applyEl = event.target.closest(".filter-profile-apply");
        const deleteEl = event.target.closest(".filter-profile-delete");
        if (deleteEl) {
            event.preventDefault();
            event.stopPropagation();
            const name = deleteEl.dataset.profile;
            const confirmed = await confirm_action(`Are you sure you want to delete filter profile "${name}"?`);
            if (confirmed) {
                delete_filter_profile(name);
                clear_active_profile();
                populate_filter_profile_select();
                update_profile_select_display();
                add_alert(`Filter profile "${name}" deleted!`, "success");
            }
            return;
        }
        if (applyEl) {
            event.preventDefault();
            const name = applyEl.dataset.profile;
            const profiles = settings.filterProfiles || {};
            const profile = profiles[name];
            if (profile) {
                apply_filter_profile(profile, name);
                add_alert(`Filter profile "${name}" applied`, "success");
                update_profile_select_display();
                populate_filter_profile_select();
            }
        }
    });
    // Update Profile button
    document.getElementById("updateFilterProfile").addEventListener("click", function () {
        update_active_profile();
        populate_filter_profile_select();
        add_alert(`Filter profile updated!`, "success");
    });
    // Merge Profiles button — populates and opens the merge modal
    document.getElementById("mergeFilterProfiles").addEventListener("click", function () {
        const profiles = settings.filterProfiles || {};
        const names = Object.keys(profiles).sort();
        const leftSelect = document.getElementById("mergeProfileLeft");
        const rightSelect = document.getElementById("mergeProfileRight");
        leftSelect.innerHTML = '<option value="">-- Select Profile --</option>';
        rightSelect.innerHTML = '<option value="">-- Select Profile --</option>';
        names.forEach(name => {
            leftSelect.options.add(new Option(name, name));
            rightSelect.options.add(new Option(name, name));
        });
        document.getElementById("mergeProfileNewName").value = "";
        document.getElementById("mergeLeftSettings").innerHTML = "";
        document.getElementById("mergeLeftSettings").style.display = "none";
        document.getElementById("mergeRightSettings").innerHTML = "";
        document.getElementById("mergeRightSettings").style.display = "none";
        update_merge_result_preview();
        const filtersModalEl = document.getElementById("filtersModal");
        const mergeModalEl = document.getElementById("mergeProfilesModal");
        filtersModalEl.classList.add("dimmed");
        const mergeModal = new bootstrap.Modal(mergeModalEl);
        mergeModalEl.addEventListener("hidden.bs.modal", function cleanup() {
            filtersModalEl.classList.remove("dimmed");
            mergeModalEl.removeEventListener("hidden.bs.modal", cleanup);
        });
        mergeModal.show();
    });
    // Left / right profile selects: render per-field checkboxes for the chosen side
    function setup_merge_side_listener(selectId, settingsDivId, side) {
        document.getElementById(selectId).addEventListener("change", function () {
            const profiles = settings.filterProfiles || {};
            const name = this.value;
            const settingsDiv = document.getElementById(settingsDivId);
            if (name && profiles[name]) {
                settingsDiv.innerHTML = render_merge_profile_settings(profiles[name], side);
                settingsDiv.style.display = "";
            } else {
                settingsDiv.innerHTML = "";
                settingsDiv.style.display = "none";
            }
            update_merge_result_preview();
        });
    }
    setup_merge_side_listener("mergeProfileLeft", "mergeLeftSettings", "left");
    setup_merge_side_listener("mergeProfileRight", "mergeRightSettings", "right");
    // Any setting checkbox toggled: refresh preview
    document.getElementById("mergeProfilesModal").addEventListener("change", function (event) {
        if (event.target.classList.contains("merge-setting-check")) {
            update_merge_result_preview();
        }
    });
    // Add Merged Profile button
    document.getElementById("saveMergeProfile").addEventListener("click", function () {
        const leftName = document.getElementById("mergeProfileLeft").value;
        const rightName = document.getElementById("mergeProfileRight").value;
        const newName = document.getElementById("mergeProfileNewName").value.trim();
        if (!newName) {
            add_alert("Please enter a name for the merged profile!", "warning");
            return;
        }
        if (!leftName && !rightName) {
            add_alert("Please select at least one profile!", "warning");
            return;
        }
        const profileData = lastMergeResult;
        if (!Object.keys(profileData).length) {
            add_alert("Please select at least one filter setting!", "warning");
            return;
        }
        save_filter_profile_to_storage(newName, profileData);
        populate_filter_profile_select();
        update_profile_select_display();
        add_alert(`Filter profile "${newName}" saved!`, "success");
        bootstrap.Modal.getInstance(document.getElementById("mergeProfilesModal")).hide();
    });
    // Listen for filter changes to update the profile display
    const filterModal = document.getElementById("filtersModal");
    filterModal.addEventListener("change", function () {
        update_profile_select_display();
    });
    filterModal.addEventListener("input", function () {
        update_profile_select_display();
    });
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
    function create_toggle_handler({ key, elementId, datatype = "boolean" }) {
        return function (load = false) {
            const element = document.getElementById(elementId);
            if (load) {
                const storedValue = key.split(".").reduce((acc, k) => acc?.[k], settings);
                if (datatype == "number") {
                    if (typeof storedValue === "number") {
                        element.value = storedValue;
                    }
                } else if (datatype == "string") {
                    if (typeof storedValue === "string") {
                        element.value = storedValue;
                    }
                } else {
                    if (typeof storedValue === "boolean") {
                        element.checked = storedValue;
                    }
                }
            } else {
                let newValue;
                if (datatype == "number") {
                    newValue = parseInt(element.value);
                } else if (datatype == "string") {
                    newValue = element.value;
                } else {
                    const currentValue = key.split(".").reduce((acc, k) => acc?.[k], settings);
                    newValue = !currentValue;
                    element.checked = newValue;
                }
                set_local_storage_item(key, newValue);
            }
        };
    }

    // Data-driven toggle handlers: create handler, load initial value, attach event listener
    [
        { key: "show.unified", elementId: "toggleUnified" },
        { key: "show.dateLabels", elementId: "toggleLabels" },
        { key: "show.legends", elementId: "toggleLegends" },
        { key: "show.aliases", elementId: "toggleAliases", datatype: "string", event: "change" },
        { key: "show.milliseconds", elementId: "toggleMilliseconds" },
        { key: "show.timezones", elementId: "toggleTimezones" },
        { key: "show.axisTitles", elementId: "toggleAxisTitles" },
        { key: "show.animation", elementId: "toggleAnimations" },
        { key: "show.duration", elementId: "toggleAnimationDuration", datatype: "number", event: "change" },
        { key: "show.rounding", elementId: "toggleBarRounding", datatype: "number", event: "change" },
        { key: "show.prefixes", elementId: "togglePrefixes" },
        { key: "show.convertTimezone", elementId: "toggleTimezone" },
        { key: "show.suitesSelectionInSuiteStats", elementId: "toggleSuitesSelectionInSuiteStats", datatype: "string", event: "change" },
        { key: "show.suitesSelectionInTestStats", elementId: "toggleSuitesSelectionInTestStats", datatype: "string", event: "change" },
    ].forEach(def => {
        const handler = create_toggle_handler(def);
        handler(true);
        document.getElementById(def.elementId).addEventListener(def.event || "click", () => handler());
    });
    // Re-populate the date filter pickers when either timezone toggle changes,
    // since the displayed timestamps change and the defaults need to match.
    document.getElementById("toggleTimezone").addEventListener("click", () => setup_lowest_highest_dates());
    document.getElementById("toggleTimezones").addEventListener("click", () => setup_lowest_highest_dates());
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
        // Load branding state
        document.getElementById('customBrandingTitle').value = settings.branding?.title || "";
        const hasLogo = !!settings.branding?.logo;
        document.getElementById('removeCustomLogo').disabled = !hasLogo;
        document.getElementById('customLogoUpload').value = "";
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

    // Custom title handler
    document.getElementById('customBrandingTitle').addEventListener('input', function () {
        const title = this.value.trim();
        set_local_storage_item('branding.title', title);
        apply_custom_branding();
    });

    document.getElementById('clearCustomTitle').addEventListener('click', function () {
        document.getElementById('customBrandingTitle').value = "";
        set_local_storage_item('branding.title', "");
        apply_custom_branding();
    });

    // Custom logo handler
    document.getElementById('customLogoUpload').addEventListener('change', function () {
        const file = this.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (e) {
            const img = new Image();
            img.onload = function () {
                const size = Math.max(img.width, img.height);
                const canvas = document.createElement('canvas');
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d');
                const offsetX = Math.floor((size - img.width) / 2);
                const offsetY = Math.floor((size - img.height) / 2);
                ctx.drawImage(img, offsetX, offsetY, img.width, img.height);
                const squaredDataUrl = canvas.toDataURL('image/png');
                set_local_storage_item('branding.logo', squaredDataUrl);
                document.getElementById('removeCustomLogo').disabled = false;
                apply_custom_branding();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });

    document.getElementById('removeCustomLogo').addEventListener('click', function () {
        set_local_storage_item('branding.logo', "");
        document.getElementById('customLogoUpload').value = "";
        this.disabled = true;
        apply_custom_branding();
    });

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
        const filtersModal = document.getElementById("filtersModal");
        const modalEl = document.getElementById("confirmModal");
        const modalBody = document.getElementById("confirmModalMessage");
        const cancelBtn = document.getElementById("confirmCancel");
        const okBtn = document.getElementById("confirmOk");

        settingsModal.classList.add("dimmed");
        filtersModal.classList.add("dimmed");
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
            filtersModal.classList.remove("dimmed");
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
                update_overview_version_select_list();
                update_projectbar_visibility();
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
                update_overview_version_select_list();
                update_projectbar_visibility();
                hide_loading_overlay();
            });
        });
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
        update_graphs_with_loading(["suiteStatisticsGraph", "suiteDurationGraph"], () => {
            update_suite_duration_graph();
            update_suite_statistics_graph();
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
    document.getElementById("resetSuiteFolder").addEventListener("click", () => {
        update_graphs_with_loading(["suiteFolderDonutGraph", "suiteFolderFailDonutGraph", "suiteStatisticsGraph", "suiteDurationGraph"], () => {
            update_suite_folder_donut_graph("");
        });
    });
    document.getElementById("suiteSelectTests").addEventListener("change", () => {
        update_graphs_with_loading(
            ["testStatisticsGraph", "testDurationGraph", "testDurationDeviationGraph"],
            () => {
                setup_testtags_in_select();
                setup_tests_in_select();
                update_test_statistics_graph();
                update_test_duration_graph();
                update_test_duration_deviation_graph();
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
    document.getElementById("testTagsSelect").addEventListener("change", () => {
        update_graphs_with_loading(
            ["testStatisticsGraph", "testDurationGraph", "testDurationDeviationGraph"],
            () => {
                setup_tests_in_select();
                update_test_statistics_graph();
                update_test_duration_graph();
                update_test_duration_deviation_graph();
            }
        );
    });
    document.getElementById("testSelect").addEventListener("change", () => {
        update_graphs_with_loading(
            ["testStatisticsGraph", "testDurationGraph", "testDurationDeviationGraph"],
            () => {
                update_test_statistics_graph();
                update_test_duration_graph();
                update_test_duration_deviation_graph();
            }
        );
    });
    document.getElementById("keywordSelect").addEventListener("change", () => {
        update_graphs_with_loading(
            ["keywordStatisticsGraph", "keywordTimesRunGraph", "keywordTotalDurationGraph",
                "keywordAverageDurationGraph", "keywordMinDurationGraph", "keywordMaxDurationGraph"],
            () => {
                update_keyword_statistics_graph();
                update_keyword_times_run_graph();
                update_keyword_total_duration_graph();
                update_keyword_average_duration_graph();
                update_keyword_min_duration_graph();
                update_keyword_max_duration_graph();
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
    // Suite section
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
                // Only restore if the saved value still exists as an option
                const optionExists = Array.from(el.options).some(opt => opt.value === saved[id]);
                if (optionExists) el.value = saved[id];
            }
        });
}

// function to setup eventlisteners for changing the graph view buttons
let graphViewButtonsInitialized = false;
function setup_graph_view_buttons() {
    if (graphViewButtonsInitialized) return;
    graphViewButtonsInitialized = true;
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

            // Save filter values before fullscreen transition to restore after graph updates
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

                // Restore filter values after graph updates
                restore_section_filter_values(savedFilterValues);

                hide_graph_loading(canvasId);
            }, 0);
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
    // close fullscreen on Escape key
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && inFullscreen) {
            const closeBtn = document.querySelector(`[id$="Close"]:not([hidden])`);
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
    // Load initial states from settings
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

    // Load initial states for checkbox switches
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

    // Load initial states for select switches
    [
        ["heatMapTestType", "switch.heatmapStatus"],
        ["heatMapHour", "switch.heatmapHour"],
        ["testNoChanges", "switch.testStatusFilter"],
        ["compareNoChanges", "switch.compareStatusFilter"],
    ].forEach(([elementId, settingsKey]) => {
        const value = settingsKey.split(".").reduce((acc, k) => acc?.[k], settings);
        if (typeof value === "string") {
            document.getElementById(elementId).value = value;
        }
    });
    heatMapHourAll = document.getElementById("heatMapHour").value === "All";

    // Simple graph update listeners: element change triggers single graph update
    [
        ["heatMapTestType", "runHeatmapGraph", update_run_heatmap_graph, "switch.heatmapStatus", "select"],
        ["testOnlyChanges", "testStatisticsGraph", update_test_statistics_graph, "switch.testOnlyChanges", "checkbox"],
        ["testNoChanges", "testStatisticsGraph", update_test_statistics_graph, "switch.testStatusFilter", "select"],
        ["compareOnlyChanges", "compareTestsGraph", update_compare_tests_graph, "switch.compareOnlyChanges", "checkbox"],
        ["compareNoChanges", "compareTestsGraph", update_compare_tests_graph, "switch.compareStatusFilter", "select"],
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
    // Initialize active states for all graph types on first load
    Object.entries(graphChangeButtons).forEach(([graphChangeButton, buttonTypes]) => {
        if (graphChangeButton.includes("table")) { return; }
        const camelButtonName = underscore_to_camelcase(graphChangeButton);
        const storedGraphType = settings?.graphTypes?.[`${camelButtonName}GraphType`];
        const defaultGraphType = buttonTypes.split(",")[0].toLowerCase();
        const activeGraphType = storedGraphType || defaultGraphType;
        update_active_graph_type_buttons(graphChangeButton, activeGraphType);
    });

    // Handle modal show event - move section filters into modal card bodies
    $("#sectionFiltersModal").on("show.bs.modal", function () {
        ["suite", "test", "keyword"].forEach(section => {
            const filters = document.getElementById(`${section}SectionFilters`);
            const cardBody = document.getElementById(`${section}SectionFiltersCardBody`);
            if (filters && cardBody) cardBody.appendChild(filters);
        });
    });

    // Handle modal hide event - return section filters to original containers
    $("#sectionFiltersModal").on("hide.bs.modal", function () {
        ["suite", "test", "keyword"].forEach(section => {
            const filters = document.getElementById(`${section}SectionFilters`);
            const container = document.getElementById(`${section}SectionFiltersContainer`);
            if (filters && container) container.insertBefore(filters, container.firstChild);
        });
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
                show_loading_overlay();
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        create_overview_latest_graphs();
                        hide_loading_overlay();
                    });
                });
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