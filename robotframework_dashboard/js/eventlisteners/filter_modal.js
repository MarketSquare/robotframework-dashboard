import { runs, filteredAmount, filteredAmountDefault, server, no_auto_update } from "../variables/data.js";
import { settings } from "../variables/settings.js";
import { showingRunTags, showingProjectVersionDialogue } from "../variables/globals.js";
import { add_alert, show_loading_overlay, hide_loading_overlay } from "../common.js";
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
import { clear_all_filters } from "../filter/controls.js";
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
import { confirm_action } from "./confirm_modal.js";
import { setup_merge_profiles_modal } from "./merge_profiles.js";

function update_filters_button_indicator() {
    const indicator = document.getElementById("filtersActiveIndicator");
    if (!indicator) return;
    // a hidden custom filter is not applied, so its dot must not mark the button as active
    const anyActive = [...document.querySelectorAll("#filtersModal .version-selected-dot")]
        .some(el => el.style.display !== "none" && !el.closest("[hidden]"));
    indicator.style.display = anyActive ? "inline-block" : "none";
}

// function to setup filter modal eventlisteners
function setup_filter_modal() {
    // eventlistener to catch the closing of the filter modal
    // Only recompute filtered data and update graphs in-place (no layout rebuild needed)
    document.getElementById("filtersModal").addEventListener("hide.bs.modal", function () {
        // no more writing into the modal while it fades out
        set_filter_modal_open(false);
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
    setup_suite_path_navigator("All");
    setup_custom_filters_in_select_filter_buttons();
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
    filterModal.addEventListener("change", function () {
        update_profile_select_display();
        update_filters_button_indicator();
        schedule_filter_option_availability_refresh();
    });
    filterModal.addEventListener("input", function () {
        update_profile_select_display();
        update_filters_button_indicator();
        schedule_filter_option_availability_refresh();
    });
}

export { setup_filter_modal, update_filters_button_indicator };
