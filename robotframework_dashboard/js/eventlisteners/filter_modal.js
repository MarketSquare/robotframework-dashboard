import { escape_html } from "../escape.js";
import { runs, filteredAmount, filteredAmountDefault, server, no_auto_update } from "../variables/data.js";
import { settings } from "../variables/settings.js";
import { showingRunTags, showingProjectVersionDialogue } from "../variables/globals.js";
import { add_alert, debounce, show_loading_overlay, hide_loading_overlay } from "../common.js";
import { update_dashboard_graphs } from "../graph_creation/all.js";
import { setup_filtered_data_and_filters } from "../filter/pipeline.js";
import {
    setup_run_amount_filter,
    setup_lowest_highest_dates,
    setup_metadata_filter,
    setup_runs_in_select_filter_buttons,
    setup_runtags_in_select_filter_buttons,
    setup_project_versions_in_select_filter_buttons,
    setup_custom_filters_in_select_filter_buttons,
} from "../filter/modal_options.js";
import { setup_suite_path_navigator } from "../filter/suite_path.js";
import { clear_all_filters, set_filter_dropdown_visible, update_filters_button_indicator } from "../filter/controls.js";
import {
    capture_default_filters,
    populate_filter_profile_select,
    enter_profile_edit_mode,
    exit_profile_edit_mode,
    build_profile_from_checks,
    save_filter_profile_to_storage,
    delete_filter_profile,
    apply_filter_profile,
    update_active_profile,
    clear_active_profile,
    update_profile_select_display,
} from "../filter/profiles.js";
import {
    schedule_filter_option_availability_refresh,
    set_filter_modal_open,
} from "../filter/availability.js";
import {
    render_date_histogram,
    schedule_date_histogram_refresh,
    setup_date_histogram,
} from "../filter/date_histogram.js";
import { confirm_action } from "./confirm_modal.js";
import { setup_merge_profiles_modal } from "./merge_profiles.js";

// every control of the filter modal, so closing it without a change can skip the re-filter
function capture_filter_modal_state() {
    return JSON.stringify([...document.querySelectorAll("#filtersModal input, #filtersModal select")]
        .map(el => (el.type === "checkbox" || el.type === "radio" ? el.checked : el.value)));
}
let filterModalStateOnOpen = null;

// function to setup filter modal eventlisteners
function setup_filter_modal() {
    // eventlistener to catch the closing of the filter modal
    // Only recompute filtered data and update graphs in-place (no layout rebuild needed)
    document.getElementById("filtersModal").addEventListener("hide.bs.modal", function () {
        // no more writing into the modal while it fades out
        set_filter_modal_open(false);
        if (filterModalStateOnOpen !== null && capture_filter_modal_state() === filterModalStateOnOpen) return;
        show_loading_overlay();
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setup_filtered_data_and_filters();
                update_dashboard_graphs();
                hide_loading_overlay();
            });
        });
    });
    // count the runs behind every filter option and grey out the ones that match nothing,
    // also picking up filters that were set while the modal was closed (overview drill down)
    document.getElementById("filtersModal").addEventListener("show.bs.modal", function () {
        set_filter_modal_open(true);
        filterModalStateOnOpen = capture_filter_modal_state();
    });
    // Chart.js cannot size a canvas inside a hidden element, so the histogram waits for the modal
    // to be on screen instead of drawing on show.bs.modal
    document.getElementById("filtersModal").addEventListener("shown.bs.modal", function () {
        render_date_histogram();
    });
    // eventlistener to reset the filters
    document.getElementById("resetFilters").addEventListener("click", function () {
        clear_all_filters();
        clear_active_profile();
        schedule_date_histogram_refresh();
        add_alert("Filters have been set to default values!", "success")
        update_profile_select_display();
    });
    // eventlistener for all runs button
    document.getElementById("allRuns").addEventListener("click", function () {
        document.getElementById("amount").value = runs.length;
    });
    // eventlistener for the runTags
    function show_checkboxes() {
        showingRunTags = !showingRunTags;
        set_filter_dropdown_visible(runTagsSelectElement, checkboxesElement, showingRunTags);
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
        set_filter_dropdown_visible(projectVersionSelectElement, projectVersionCheckboxes, showingProjectVersionDialogue);
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
            document.getElementById("refreshDashboard").addEventListener("click", async function () {
                document.getElementById("refreshDashboardSpinner").hidden = false
                let response;
                try {
                    const answer = await fetch("/refresh-dashboard", {
                        method: "POST",
                        headers: { "Content-Type": "application/json; charset=UTF-8" },
                        body: JSON.stringify({}),
                    });
                    const text = await answer.text();
                    if (!answer.ok) throw new Error(`Error: ${answer.status}, ${text}`);
                    response = JSON.parse(text);
                } catch (error) {
                    add_alert(escape_html(error.message), "danger")
                    return
                } finally {
                    document.getElementById("refreshDashboardSpinner").hidden = true
                }
                if (response.success == "1") {
                    console.log(response.console)
                    add_alert(`${escape_html(response.message)} Reloading dashboard in 3 seconds!`, "success")
                    setTimeout(() => {
                        location.reload();
                    }, 3000);
                } else {
                    add_alert(escape_html(response.message), "danger")
                    console.log(response.console)
                }
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
    setup_suite_path_navigator("All");
    setup_custom_filters_in_select_filter_buttons();
    setup_date_histogram();
    // snapshot the default/initial filter state so profile checkboxes can reflect changes
    capture_default_filters();
    // filter profiles setup
    populate_filter_profile_select();
    let showingFilterProfiles = false;
    function toggle_filter_profiles() {
        showingFilterProfiles = !showingFilterProfiles;
        set_filter_dropdown_visible(selectFilterProfileElement, filterProfileCheckBoxes, showingFilterProfiles);
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
        add_alert(`Filter profile "${escape_html(name)}" saved!`, "success");
    });
    document.getElementById("filterProfileList").addEventListener("click", async function (event) {
        const applyEl = event.target.closest(".filter-profile-apply");
        const deleteEl = event.target.closest(".filter-profile-delete");
        if (deleteEl) {
            event.preventDefault();
            event.stopPropagation();
            const name = deleteEl.dataset.profile;
            const confirmed = await confirm_action(`Are you sure you want to delete filter profile "${escape_html(name)}"?`);
            if (confirmed) {
                delete_filter_profile(name);
                clear_active_profile();
                populate_filter_profile_select();
                update_profile_select_display();
                add_alert(`Filter profile "${escape_html(name)}" deleted!`, "success");
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
                schedule_date_histogram_refresh();
                add_alert(`Filter profile "${escape_html(name)}" applied`, "success");
                update_profile_select_display();
                populate_filter_profile_select();
                update_filters_button_indicator();
            }
        }
    });
    document.getElementById("updateFilterProfile").addEventListener("click", function () {
        update_active_profile();
        populate_filter_profile_select();
        add_alert(`Filter profile updated!`, "success");
    });
    setup_merge_profiles_modal();
    document.getElementById("runs").addEventListener("change", function () {
        const indicator = document.getElementById("filterRunSelectedIndicator");
        if (indicator) indicator.style.display = this.value !== "All" ? "inline-block" : "none";
        update_filters_button_indicator();
    });
    const filterModal = document.getElementById("filtersModal");
    const refresh_filter_modal_state = () => {
        update_profile_select_display();
        update_filters_button_indicator();
        schedule_filter_option_availability_refresh();
    };
    filterModal.addEventListener("change", refresh_filter_modal_state);
    // typing in a text or number field fires on every key; the profile comparison waits for a pause
    filterModal.addEventListener("input", debounce(refresh_filter_modal_state, 150));
}

export { setup_filter_modal };
