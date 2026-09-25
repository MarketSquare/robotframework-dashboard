import { settings } from '../variables/settings.js';
import { runs, suites } from '../variables/data.js';
import { apply_custom_filter_dimension, apply_date_filter, apply_metadata_filter, apply_project_version_filter, apply_run_name_filter, apply_runtag_filter, build_date_range, collect_custom_filter_dimensions, convert_timezone, get_custom_filter_value, get_hidden_custom_filters, get_project_version_value, remove_milliseconds, remove_timezones } from './pipeline.js';
import { get_metadata_options } from './modal_options.js';
import { apply_suite_path_run_filter } from './suite_path.js';
import { capture_current_filters } from './profiles.js';

// Filter option availability: every filter option shows how many runs it would still match
// given the other filters, and options that cannot match anything are greyed out. Without this
// a dropdown keeps offering values that belong to runs another filter already excluded.
// The counts follow the usual faceted-search rule: the count of an option in filter X is
// computed with every filter except X applied, so selecting a value in X never makes the other
// values of X disappear. The amount filter ("last X runs") is not a category and is left out.
let filterBaseRunsCache = { key: null, runs: null, suites: null };

// key of the settings that change run_start representation, and with it which runs a date
// range matches and which suites belong to which run
function get_filter_base_cache_key() {
    return `${settings.show.milliseconds}|${settings.show.convertTimezone}|${settings.show.timezones}`;
}

function apply_run_start_transformations(data) {
    return remove_timezones(convert_timezone(remove_milliseconds(data)));
}

// all runs with the same run_start transformations the filter pipeline applies, so the
// availability computation compares the same timestamps as the real filters do
function get_filter_base_runs() {
    const key = get_filter_base_cache_key();
    if (filterBaseRunsCache.key !== key) {
        filterBaseRunsCache = { key: key, runs: apply_run_start_transformations(runs), suites: null };
    }
    return filterBaseRunsCache.runs;
}

// suites are only needed while a suite path is selected, so they are transformed on demand
function get_filter_base_suites() {
    get_filter_base_runs();
    if (filterBaseRunsCache.suites === null) {
        filterBaseRunsCache.suites = apply_run_start_transformations(suites);
    }
    return filterBaseRunsCache.suites;
}

// turn the profile object of capture_current_filters() into the selection shape the apply_*
// functions take
function normalize_filter_selections(profile) {
    const checked_values = (items, key) => new Set((items || []).filter(item => item.checked).map(item => item[key]));
    const hiddenCustomFilters = get_hidden_custom_filters();
    const customFilters = {};
    for (const [dimName, items] of Object.entries(profile.customFilters || {})) {
        // a custom filter hidden on this page is not applied, so it may not shape the counts either
        if (hiddenCustomFilters.includes(dimName)) continue;
        customFilters[dimName] = {
            values: checked_values(items, "value"),
            mode: (profile.customFilterModes || {})[dimName] ?? "OR",
        };
    }
    return {
        runs: profile.runs ?? "All",
        runTags: Array.from(checked_values(profile.runTags, "id")),
        tagMode: profile.tagMode ?? "AND",
        projectVersions: checked_values(profile.projectVersions, "value"),
        metadata: profile.metadata ?? "All",
        suitePath: profile.suitePath ?? "All",
        dateRange: build_date_range(profile.fromDate, profile.fromTime, profile.toDate, profile.toTime),
        customFilters: customFilters,
    };
}

// apply every run level filter except the one whose options are being counted
function apply_filters_except(runList, selections, facet, dimName = null, suiteList = null) {
    let result = runList;
    if (facet !== "runs") { result = apply_run_name_filter(result, selections.runs); }
    if (facet !== "runTags") { result = apply_runtag_filter(result, selections.runTags, selections.tagMode); }
    if (facet !== "metadata") { result = apply_metadata_filter(result, selections.metadata); }
    if (facet !== "projectVersions") { result = apply_project_version_filter(result, selections.projectVersions); }
    for (const [dim, dimSelection] of Object.entries(selections.customFilters)) {
        if (facet === "customFilters" && dim === dimName) { continue; }
        result = apply_custom_filter_dimension(result, dim, dimSelection.values, dimSelection.mode);
    }
    // the suite path has no option list to count, so it always applies. The date range applies
    // too, except for the date histogram, which draws the runs the window is chosen from.
    if (facet !== "dates" && selections.dateRange) {
        result = apply_date_filter(result, selections.dateRange.from, selections.dateRange.to);
    }
    if (selections.suitePath && selections.suitePath !== "All") {
        result = apply_suite_path_run_filter(result, selections.suitePath, suiteList ?? get_filter_base_suites());
    }
    return result;
}

function count_option(counts, value) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
}

// every option of a filter starts at 0, so options that no longer match any run are part of
// the result instead of missing from it
function seed_option_counts(values) {
    const counts = new Map();
    for (const value of values) { counts.set(value, 0); }
    return counts;
}

// In NOT mode an option excludes its runs instead of selecting them, so its count is the
// number of runs that would be left over. "All" means "no filtering" in every mode and keeps
// the total. This way a count always answers the same question: how many runs remain if this
// option is the selection of this filter.
function invert_counts_for_not_mode(counts, mode, total) {
    if (mode !== "NOT") { return counts; }
    for (const [value, count] of counts) {
        if (value !== "All") { counts.set(value, total - count); }
    }
    return counts;
}

// how many runs every option of every filter would match, as {facet: Map(option -> count)}.
// Multi valued filters (run tags, metadata) count a run for each of its values, so their
// counts do not add up to the total, which is what the "All" option holds.
function compute_filter_option_availability(runList, selections, suiteList = null) {
    const availability = { customFilters: {} };

    availability.runs = seed_option_counts(runList.map(run => run.name));
    const runNameBase = apply_filters_except(runList, selections, "runs", null, suiteList);
    availability.runs.set("All", runNameBase.length);
    for (const run of runNameBase) { count_option(availability.runs, run.name); }

    const all_tags = (run) => run.tags.split(",").filter(tag => tag);
    availability.runTags = seed_option_counts(runList.flatMap(all_tags));
    const runTagBase = apply_filters_except(runList, selections, "runTags", null, suiteList);
    availability.runTags.set("All", runTagBase.length);
    for (const run of runTagBase) {
        for (const tag of all_tags(run)) { count_option(availability.runTags, tag); }
    }
    invert_counts_for_not_mode(availability.runTags, selections.tagMode, runTagBase.length);

    availability.projectVersions = seed_option_counts(runList.map(get_project_version_value));
    const versionBase = apply_filters_except(runList, selections, "projectVersions", null, suiteList);
    availability.projectVersions.set("All", versionBase.length);
    for (const run of versionBase) { count_option(availability.projectVersions, get_project_version_value(run)); }

    // the metadata filter matches its value against the whole metadata string of a run, so the
    // count of an option has to use the same substring check instead of the parsed items
    availability.metadata = new Map();
    const metadataBase = apply_filters_except(runList, selections, "metadata", null, suiteList);
    availability.metadata.set("All", metadataBase.length);
    for (const option of get_metadata_options(runList)) {
        availability.metadata.set(option, apply_metadata_filter(metadataBase, option).length);
    }

    for (const [dimName, dimSelection] of Object.entries(selections.customFilters)) {
        const counts = seed_option_counts(runList.map(run => get_custom_filter_value(run, dimName)));
        const dimBase = apply_filters_except(runList, selections, "customFilters", dimName, suiteList);
        counts.set("All", dimBase.length);
        for (const run of dimBase) { count_option(counts, get_custom_filter_value(run, dimName)); }
        availability.customFilters[dimName] = invert_counts_for_not_mode(counts, dimSelection.mode, dimBase.length);
    }

    return availability;
}

// the runs the date histogram draws: every run level filter except the date range itself,
// so the bars still cover the runs outside the window and widening it brings them back. The
// amount filter is left out for the same reason it is left out of the option counts.
function get_runs_for_date_histogram() {
    const selections = normalize_filter_selections(capture_current_filters());
    return apply_filters_except(get_filter_base_runs(), selections, "dates");
}

// add or update the "(X)" count of one filter option row. The count is a sibling of the
// label, not a child: the row is the flex container, so only a direct child of the row can
// be pushed into its own right-aligned column.
function set_filter_option_count(rowElement, count) {
    if (!rowElement) { return; }
    let countElement = rowElement.querySelector(".filter-option-count");
    if (!settings.show.filterCounts) {
        countElement?.remove();
        return;
    }
    if (!countElement) {
        countElement = document.createElement("span");
        countElement.className = "filter-option-count";
        rowElement.appendChild(countElement);
    }
    countElement.textContent = `(${count})`;
}

// Unavailable options are only greyed out, never disabled or hidden: the user keeps seeing
// that the option exists and can still select it (which then simply results in no runs).
function apply_availability_to_checkbox_list(listElement, counts) {
    if (!listElement) { return; }
    const inputs = listElement.querySelectorAll("input.form-check-input:not([role='switch'])");
    for (const input of inputs) {
        const count = counts?.get(input.value) ?? 0;
        const row = input.closest("li");
        set_filter_option_count(row, count);
        row?.classList.toggle("filter-option-unavailable", Boolean(counts) && settings.show.filterAvailability && count === 0);
    }
}

function apply_availability_to_select(selectElement, counts) {
    if (!selectElement) { return; }
    for (const option of selectElement.options) {
        const count = counts?.get(option.value) ?? 0;
        option.textContent = (counts && settings.show.filterCounts) ? `${option.value} (${count})` : option.value;
        option.classList.toggle("filter-option-unavailable", Boolean(counts) && settings.show.filterAvailability && count === 0);
    }
}

// walk every filter option list and drop the counts and the greying out
function clear_filter_option_availability() {
    apply_availability_to_select(document.getElementById("runs"), null);
    apply_availability_to_select(document.getElementById("metadata"), null);
    apply_availability_to_checkbox_list(document.getElementById("runTag"), null);
    apply_availability_to_checkbox_list(document.getElementById("projectVersionList"), null);
    for (const dimName of Object.keys(collect_custom_filter_dimensions())) {
        apply_availability_to_checkbox_list(document.getElementById(`customFilter_${dimName}_List`), null);
    }
}

// The refresh writes into the filter modal, which is only safe while the modal is open:
// changing its contents during the closing animation competes with the fade out and can leave
// the modal on screen. Filters can also be set programmatically while the modal is closed
// (overview drill down, filter profiles), so the state is refreshed when it opens.
let filterModalIsOpen = false;

function set_filter_modal_open(isOpen) {
    filterModalIsOpen = isOpen;
    if (isOpen) { refresh_filter_option_availability(); }
}

// recompute the counts of all filter options and grey out the ones that match no runs
function refresh_filter_option_availability() {
    if (!filterModalIsOpen || !document.getElementById("filtersModal")) { return; }
    if (!settings.show.filterAvailability && !settings.show.filterCounts) {
        clear_filter_option_availability();
        return;
    }
    const selections = normalize_filter_selections(capture_current_filters());
    const availability = compute_filter_option_availability(get_filter_base_runs(), selections);
    apply_availability_to_select(document.getElementById("runs"), availability.runs);
    apply_availability_to_select(document.getElementById("metadata"), availability.metadata);
    apply_availability_to_checkbox_list(document.getElementById("runTag"), availability.runTags);
    apply_availability_to_checkbox_list(document.getElementById("projectVersionList"), availability.projectVersions);
    for (const [dimName, counts] of Object.entries(availability.customFilters)) {
        apply_availability_to_checkbox_list(document.getElementById(`customFilter_${dimName}_List`), counts);
    }
}

// The filter modal fires a change event per checkbox, and the version search box checks a whole
// set of them at once, so the refresh is collapsed into one call per frame.
let filterAvailabilityFrame = null;

function schedule_filter_option_availability_refresh() {
    if (filterAvailabilityFrame !== null) { return; }
    filterAvailabilityFrame = requestAnimationFrame(() => {
        filterAvailabilityFrame = null;
        refresh_filter_option_availability();
    });
}

export {
    compute_filter_option_availability,
    get_runs_for_date_histogram,
    normalize_filter_selections,
    refresh_filter_option_availability,
    schedule_filter_option_availability_refresh,
    set_filter_modal_open,
};
