import { runs } from '../variables/data.js';
import { overviewProjectNavFilter, selectedRunSetting, selectedTagSetting } from '../variables/globals.js';
import { collect_custom_filter_dimensions } from './pipeline.js';
import { setup_lowest_highest_dates } from './modal_options.js';
import { clear_suite_path_filter } from './suite_path.js';
import { schedule_filter_option_availability_refresh } from './availability.js';

// show filter active indicator if checkBoxElement unchecked
function setup_filter_active_indicator(checkBoxElement, filterActiveIndicatorId) {
    checkBoxElement.addEventListener("change", () => {
        update_filter_active_indicator(checkBoxElement.id, filterActiveIndicatorId);
    });
}

function update_filter_active_indicator(allCheckBoxId, filterActiveIndicatorId) {
    const filterActiveIndicator = document.getElementById(filterActiveIndicatorId);
    const allCheckBox = document.getElementById(allCheckBoxId);
    filterActiveIndicator.style.display = allCheckBox.checked ? "none" : "inline-block";
}

function unselect_checkboxes(checkBoxesToUnselect) {
    for (const checkBox of checkBoxesToUnselect) {
        checkBox.checked = false;
    }
}

// for runTag/version filter popup and overview
function setup_filter_checkbox_handler_listeners(
    checkBoxContainerElement,
    allCheckBox,
    filterActiveIndicatorId = null,
    additionalCheckBoxFunc = null //for overview version selector
) {
    const inputItemQueryString = "input.form-check-input:not([role='switch'])"; //not and/or switch
    const nonAllCheckBoxes = Array
        .from(
            checkBoxContainerElement
                .querySelectorAll(inputItemQueryString)
        ).filter(checkBox => checkBox !== allCheckBox);
    allCheckBox.addEventListener('change', () => {
        if (allCheckBox.checked) {
            unselect_checkboxes(nonAllCheckBoxes);
            additionalCheckBoxFunc && additionalCheckBoxFunc();
        } else {
            allCheckBox.checked = true; //prevent unselecting All if no other checkboxes checked
        }
        filterActiveIndicatorId && update_filter_active_indicator(allCheckBox.id, filterActiveIndicatorId);
    });
    for (const checkBox of nonAllCheckBoxes) {
        checkBox.addEventListener('change', () => {
            if (checkBox.checked) {
                allCheckBox.checked = false; //uncheck All if other checkbox checked
                filterActiveIndicatorId && update_filter_active_indicator(allCheckBox.id, filterActiveIndicatorId);
            } else if (!nonAllCheckBoxes.some(checkBox => checkBox.checked)) {
                allCheckBox.checked = true;
                filterActiveIndicatorId && update_filter_active_indicator(allCheckBox.id, filterActiveIndicatorId);
            }
            additionalCheckBoxFunc && additionalCheckBoxFunc();
        });
    }
}

// autoSelectMatches: while the search box has text, check every matching checkbox and
// uncheck the rest (e.g. typing "1." selects every 1.x version in one go) instead of only
// narrowing which rows are visible. Clearing the search box leaves the selection as-is.
// An optional ".filter-search-clear" button next to the search box empties it in one step
// (unlike deleting characters one by one, which re-runs the auto-select on every keystroke).
function setup_filter_checkbox_subfilter(parentElementId, autoSelectMatches = false) {
    const container = document.getElementById(parentElementId);
    const searchBar = container.querySelector("input.form-control");
    const clearButton = container.querySelector(".filter-search-clear");
    const checkBoxRows = container.querySelectorAll("li.list-group-item-action");
    const apply_search = () => {
        const filterText = searchBar.value.toLowerCase();
        if (clearButton) clearButton.hidden = !filterText;
        checkBoxRows.forEach(row => {
            const checkbox = row.querySelector("input.form-check-input");
            const rowValue = checkbox.value.toLowerCase();
            const matches = rowValue.includes(filterText);
            row.classList.toggle("d-none", !matches);
            if (autoSelectMatches && filterText && checkbox.value !== "All" && checkbox.checked !== matches) {
                checkbox.checked = matches;
                checkbox.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    };
    searchBar.addEventListener("input", apply_search);
    clearButton?.addEventListener("click", () => {
        searchBar.value = "";
        apply_search();
        searchBar.focus();
    });
}

function clear_all_filters() {
    overviewProjectNavFilter.project = '';
    overviewProjectNavFilter.version = '';
    clear_project_filter();
    clear_version_filter();
    clear_suite_path_filter();
    clear_custom_filters();
    document.getElementById("amount").value = filteredAmountDefault;
    document.getElementById("metadata").value = "All";
    setup_lowest_highest_dates();
    const runsIndicator = document.getElementById("filterRunSelectedIndicator");
    if (runsIndicator) runsIndicator.style.display = "none";
    const filtersActiveIndicator = document.getElementById("filtersActiveIndicator");
    if (filtersActiveIndicator) filtersActiveIndicator.style.display = "none";
    schedule_filter_option_availability_refresh();
}

function clear_custom_filters() {
    const dimensions = collect_custom_filter_dimensions();
    for (const dimName of Object.keys(dimensions)) {
        const listEl = document.getElementById(`customFilter_${dimName}_List`);
        if (!listEl) continue;
        const filterInput = document.getElementById(`customFilter_${dimName}_FilterInput`);
        if (filterInput) filterInput.value = "";
        const inputs = listEl.querySelectorAll("input.form-check-input");
        for (const input of inputs) {
            input.checked = false;
            input.closest("li")?.classList.remove("d-none");
            if (input.value === "All") input.checked = true;
        }
        update_filter_active_indicator(`customFilter_${dimName}_List_All`, `filterCustomFilter_${dimName}_Indicator`);
    }
}

function clear_version_filter() {
    document.getElementById("projectVersionCheckBoxesFilter").value = "";
    document.getElementById("projectVersionCheckBoxesFilterClear").hidden = true;
    const versionElements = document.getElementById("projectVersionList").getElementsByTagName("input");
    for (const input of versionElements) {
        input.checked = false;
        input.parentElement.classList.remove("d-none"); //show filtered rows
        if (input.value == "All") input.checked = true;
    }
    update_filter_active_indicator("projectVersionInputItemAll", "filterVersionSelectedIndicator");
}

// the run/tag filter set by set_filter_show_current_project results in either a single
// selected run name or a single checked run tag, checked here so a filter the user changed
// themselves in the meantime is not mistaken for the one applied by the overview card
function overview_navigation_filter_still_applied(project) {
    if (project.startsWith("project_")) {
        const tagElements = document.getElementById("runTag").getElementsByTagName("input");
        const checkedTags = Array.from(tagElements).filter(input => input.checked);
        return checkedTags.length === 1 && checkedTags[0].value === project;
    }
    return document.getElementById("runs").value === project;
}

// the overview page is meant to show every project, so the single project filter that was
// applied by clicking a project card is dropped again when the user navigates back to the
// overview (issue #348). Filters the user changed themselves are left alone.
function clear_overview_project_navigation_filter() {
    const { project, version } = overviewProjectNavFilter;
    if (!project) { return; }
    overviewProjectNavFilter.project = '';
    overviewProjectNavFilter.version = '';
    // the navigation writes these globals and the next filter pass copies them into the
    // filter modal, so they are dropped here as well: when the pass has not run yet the
    // DOM check below sees the still empty filter and would otherwise leave them pending
    selectedRunSetting = '';
    selectedTagSetting = '';
    if (!overview_navigation_filter_still_applied(project)) { return; }
    clear_project_filter();
    // the version filter is only cleared when the same navigation applied it (version badge)
    if (version) { clear_version_filter(); }
    const runsIndicator = document.getElementById("filterRunSelectedIndicator");
    if (runsIndicator) runsIndicator.style.display = "none";
    // any other filter the user set stays active, so recompute the dot instead of hiding it
    update_filters_button_indicator();
}

function set_filter_show_current_version(version) {
    overviewProjectNavFilter.version = version;
    const projectVersionList = document.getElementById("projectVersionList");
    document.getElementById("projectVersionInputItemAll").checked = false;
    projectVersionList.querySelector(`input[value="${version}"]`).checked = true;
    update_filter_active_indicator("projectVersionInputItemAll", "filterVersionSelectedIndicator");
}

// gap between the select and its dropdown panel (the mt-2 margin) plus breathing room to the viewport edge
const FILTER_DROPDOWN_GAP = 8;
const FILTER_DROPDOWN_EDGE_MARGIN = 16;
const FILTER_DROPDOWN_MIN_HEIGHT = 120;

// decide whether a dropdown panel opens below or above its select and how tall it may get:
// below while the content fits there, otherwise on whichever side has more room
function get_filter_dropdown_placement(spaceBelow, spaceAbove, contentHeight, defaultMaxHeight) {
    const wantedHeight = Math.min(contentHeight, defaultMaxHeight);
    const dropUp = wantedHeight > spaceBelow && spaceAbove > spaceBelow;
    const available = dropUp ? spaceAbove : spaceBelow;
    const maxHeight = Math.max(Math.min(defaultMaxHeight, available), FILTER_DROPDOWN_MIN_HEIGHT);
    return { dropUp, maxHeight };
}

// show or hide a .filterCheckBoxes panel; when shown it flips above the select if there is not
// enough room below, so opening it does not stretch the modal and make the page jump
function set_filter_dropdown_visible(selectElement, panelElement, visible) {
    if (!visible) {
        panelElement.style.display = "none";
        return;
    }
    panelElement.classList.remove("drop-up");
    panelElement.style.display = "block";
    const selectRect = selectElement.getBoundingClientRect();
    const spaceBelow = window.innerHeight - selectRect.bottom - FILTER_DROPDOWN_GAP - FILTER_DROPDOWN_EDGE_MARGIN;
    const spaceAbove = selectRect.top - FILTER_DROPDOWN_GAP - FILTER_DROPDOWN_EDGE_MARGIN;
    const { dropUp, maxHeight } = get_filter_dropdown_placement(
        spaceBelow, spaceAbove, panelElement.scrollHeight, window.innerHeight * 0.5
    );
    panelElement.classList.toggle("drop-up", dropUp);
    panelElement.style.maxHeight = `${maxHeight}px`;
}

export {
    clear_all_filters,
    clear_overview_project_navigation_filter,
    get_filter_dropdown_placement,
    set_filter_dropdown_visible,
    set_filter_show_current_version,
    setup_filter_active_indicator,
    setup_filter_checkbox_handler_listeners,
    setup_filter_checkbox_subfilter,
    update_filter_active_indicator,
};
