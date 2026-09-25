import { settings } from '../variables/settings.js';
import { exceptions, filteredAmount, keywords, runs, suites, tests, unified_dashboard_title } from '../variables/data.js';
import { get_run_projects, strip_tz_suffix } from '../common.js';
import { filteredExceptions, filteredKeywords, filteredRuns, filteredSuites, filteredTests, selectedRunSetting, selectedTagSetting } from '../variables/globals.js';
import { setup_keywords_in_select, setup_runs_in_compare_selects, setup_suites_in_suite_select, setup_suites_in_test_select, setup_tests_in_select, setup_testtags_in_select } from './section_selects.js';
import { filter_runs_by_suite_path, filter_suite_path_data } from './suite_path.js';

// Sort an array of run objects by wall-clock run_start (timezone offset stripped),
// ensuring correct chronological order when timestamps span mixed timezone offsets.
function sort_wall_clock(data) {
    return [...data].sort((a, b) => {
        const ak = strip_tz_suffix(a.run_start);
        const bk = strip_tz_suffix(b.run_start);
        return ak < bk ? -1 : ak > bk ? 1 : 0;
    });
}

const dashboardPages = ["overview", "dashboard", "compare", "tables"];

function get_active_page() {
    return dashboardPages.find(page => settings.menu[page]) ?? "dashboard";
}

function get_hidden_custom_filters(page = get_active_page()) {
    const key = `hiddenCustomFilters${page.charAt(0).toUpperCase() + page.slice(1)}`;
    return settings.show[key] ?? [];
}

// the rows are built once, so hiding keeps their state for the pages where they are still shown
function apply_custom_filter_visibility() {
    const hiddenCustomFilters = get_hidden_custom_filters();
    for (const dimName of Object.keys(collect_custom_filter_dimensions())) {
        const rowEl = document.getElementById(`customFilter_${dimName}`);
        if (rowEl) rowEl.hidden = hiddenCustomFilters.includes(dimName);
    }
}

// function updates the data in the graphs whenever filters are updated
function setup_filtered_data_and_filters() {
    apply_custom_filter_visibility();
    filteredRuns = remove_milliseconds(runs)
    filteredSuites = remove_milliseconds(suites)
    filteredTests = remove_milliseconds(tests)
    filteredKeywords = remove_milliseconds(keywords)
    filteredExceptions = remove_milliseconds(exceptions)
    // convert timezones if enabled (must run before remove_timezones so the offset is still present)
    filteredRuns = convert_timezone(filteredRuns);
    filteredSuites = convert_timezone(filteredSuites);
    filteredTests = convert_timezone(filteredTests);
    filteredKeywords = convert_timezone(filteredKeywords);
    filteredExceptions = convert_timezone(filteredExceptions);
    // remove timezone display if disabled
    filteredRuns = remove_timezones(filteredRuns);
    filteredSuites = remove_timezones(filteredSuites);
    filteredTests = remove_timezones(filteredTests);
    filteredKeywords = remove_timezones(filteredKeywords);
    filteredExceptions = remove_timezones(filteredExceptions);
    // determine filteredRuns with all run-level filters (suite path + amount last)
    filteredRuns = filter_runs(filteredRuns);
    filteredRuns = filter_runtags(filteredRuns);
    filteredRuns = filter_dates(filteredRuns);
    filteredRuns = filter_metadata(filteredRuns);
    filteredRuns = filter_project_versions(filteredRuns);
    filteredRuns = filter_custom_filters(filteredRuns);
    filteredRuns = filter_runs_by_suite_path(filteredRuns);
    filteredRuns = filter_amount(filteredRuns);
    // single pass: filter each dependent array against the final filteredRuns
    filteredSuites = filter_data(filteredSuites);
    filteredTests = filter_data(filteredTests);
    filteredKeywords = filter_data(filteredKeywords);
    filteredExceptions = filter_data(filteredExceptions);
    // narrow suites/tests to the selected path prefix (runs already reduced above)
    filter_suite_path_data();
    // re-sort all filtered data by wall-clock run_start so mixed-timezone datasets
    // appear in the correct chronological order on graphs (timestamps may have been
    // converted or had their offsets stripped above, so re-sort here is the source of truth)
    filteredRuns = sort_wall_clock(filteredRuns);
    filteredSuites = sort_wall_clock(filteredSuites);
    filteredTests = sort_wall_clock(filteredTests);
    filteredKeywords = sort_wall_clock(filteredKeywords);
    filteredExceptions = sort_wall_clock(filteredExceptions);
    // set titles with amount of filtered items
    const runAmount = Object.keys(filteredRuns).length
    const message = `<h6>showing ${runAmount} of ${filteredAmount} runs</h6>`
    document.getElementById("unifiedTitle").innerHTML
        = `${(unified_dashboard_title && !unified_dashboard_title.includes("Robot Framework Dashboard -"))
            ? unified_dashboard_title
            : "Dashboard Statistics"} (${runAmount}) ${message}`;
    document.getElementById("runTitle").innerHTML = `Run Statistics (${runAmount}) ${message}`;
    document.getElementById("suiteTitle").innerHTML = `Suite Statistics (${Object.keys(filteredSuites).length}) ${message}`;
    document.getElementById("testTitle").innerHTML = `Test Statistics (${Object.keys(filteredTests).length}) ${message}`;
    document.getElementById("keywordTitle").innerHTML = `Keyword Statistics (${Object.keys(filteredKeywords).length}) ${message}`;
    document.getElementById("compareTitle").innerHTML = `Compare Statistics ${message}`;
    document.getElementById("tablesTitle").innerHTML = `Table Statistics (${runAmount}) ${message}`;
    // update filters based on data
    setup_runs_in_compare_selects();
    setup_suites_in_suite_select();
    setup_suites_in_test_select();
    setup_testtags_in_select();
    setup_tests_in_select();
    setup_keywords_in_select();
}

// function to remove milliseconds if needed
function remove_milliseconds(data) {
    if (settings.show.milliseconds) { return data; }

    return data.map(obj => {
        const rs = obj.run_start;
        const datetime = rs.slice(0, 19); // "YYYY-MM-DD HH:MM:SS"
        // Check if the last 6 chars are a timezone offset (+HH:MM or -HH:MM)
        const suffix = rs.slice(-6);
        const hasTz = /^[+-]\d{2}:\d{2}$/.test(suffix);
        return {
            ...obj,
            run_start: hasTz ? datetime + suffix : datetime
        };
    });
}

// function to remove timezone offset from run_start labels if disabled
function remove_timezones(data) {
    if (settings.show.timezones) { return data; }

    return data.map(obj => {
        const rs = obj.run_start;
        // Check if the last 6 chars are a timezone offset (+HH:MM or -HH:MM)
        const suffix = rs.slice(-6);
        const hasTz = /^[+-]\d{2}:\d{2}$/.test(suffix);
        if (!hasTz) { return obj; }
        return {
            ...obj,
            run_start: rs.slice(0, -6)
        };
    });
}

// function to convert run_start timestamps from their stored timezone to the viewer's local timezone
function convert_timezone(data) {
    if (!settings.show.convertTimezone) { return data; }

    return data.map(obj => {
        const rs = obj.run_start;
        // Check if run_start has a timezone offset (+HH:MM or -HH:MM) at the end
        const suffix = rs.slice(-6);
        const hasTz = /^[+-]\d{2}:\d{2}$/.test(suffix);
        if (!hasTz) { return obj; }

        // Parse the run_start with its timezone offset
        const isoStr = rs.replace(" ", "T");
        const date = new Date(isoStr);
        if (isNaN(date.getTime())) { return obj; }

        // Format to viewer's local timezone: YYYY-MM-DD HH:MM:SS+HH:MM
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        const seconds = String(date.getSeconds()).padStart(2, "0");
        // Compute the viewer's local timezone offset
        const tzOffset = -date.getTimezoneOffset();
        const tzSign = tzOffset >= 0 ? "+" : "-";
        const tzHours = String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, "0");
        const tzMins = String(Math.abs(tzOffset) % 60).padStart(2, "0");
        const localTz = `${tzSign}${tzHours}:${tzMins}`;
        // Preserve the full sub-second fractional part from the original string (e.g. ".123456").
        // Timezone offsets are always whole minutes, so the fractional seconds are unchanged by conversion.
        // Using the original string avoids JavaScript Date's 3-digit millisecond precision limit.
        const mainPart = rs.slice(0, -6); // strip the "+HH:MM" suffix
        const subSecond = mainPart.length > 19 ? mainPart.slice(19) : ""; // ".ffffff" or ""
        const localStr = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}${subSecond}${localTz}`;

        return { ...obj, run_start: localStr };
    });
}

// The apply_* functions below hold the actual filter logic and take their selection as an
// argument instead of reading the DOM. The filter_* functions read the filter modal and call
// them, and compute_filter_option_availability reuses them to determine which filter options
// can still produce runs, so both paths always behave identically.
function apply_run_name_filter(runs, selectedRun) {
    if (!selectedRun || selectedRun === "All") { return runs; }
    return Object.values(runs).filter(run => run.name === selectedRun);
}

// function to filter run data based on the runs (aka run name) filter
function filter_runs(runs) {
    if (selectedRunSetting != '') {
        document.getElementById("runs").value = selectedRunSetting
        selectedRunSetting = ''
    }
    return apply_run_name_filter(runs, document.getElementById("runs").value);
}

function apply_runtag_filter(runs, selectedTags, tagMode) {
    if (selectedTags.includes("All")) {
        return runs;
    }
    if (selectedTags.length === 0) {
        return [];
    }
    return runs.filter(run => {
        const runTags = run.tags.split(",");
        if (tagMode === "OR") { // Use OR logic: the run must contain at least one selected tag
            return selectedTags.some(selectedTag => runTags.includes(selectedTag));
        }
        if (tagMode === "NOT") { // Use NOT logic: the run must not contain any selected tag
            return !selectedTags.some(selectedTag => runTags.includes(selectedTag));
        }
        // Default AND logic: the run must contain all selected tags
        return selectedTags.every(selectedTag => runTags.includes(selectedTag));
    });
}

// function to filter run data based on the run tags filter
function filter_runtags(runs) {
    const tagElements = document.getElementById("runTag").getElementsByTagName("input");
    const tagModeEl = document.getElementById("tagMode");
    const tagMode = tagModeEl ? tagModeEl.value : "AND";

    if (selectedTagSetting != '') {
        for (const input of tagElements) {
            input.checked = false;
            // checkbox ids are prefixed with "runTagCheckBox", the value holds the raw tag name
            if (input.value === selectedTagSetting) {
                input.checked = true;
            }
        }
        if (tagModeEl) tagModeEl.value = "AND";
        selectedTagSetting = ''
    }

    const selectedTags = Array.from(tagElements)
        .filter(tagElement => tagElement.checked)
        .map(tagElement => tagElement.id.replace(/^runTagCheckBox/, ""));
    return apply_runtag_filter(runs, selectedTags, tagMode);
}

function apply_custom_filter_dimension(runs, dimName, checkedValues, mode) {
    if (!checkedValues.size) { return []; }
    if (checkedValues.has("All")) { return runs; }
    return runs.filter(run => {
        const effectiveValue = get_custom_filter_value(run, dimName);
        if (mode === "NOT") { // Use NOT logic: the run must not have any of the selected values
            return !checkedValues.has(effectiveValue);
        }
        // Default OR/AND logic: the run must have one of the selected values
        return checkedValues.has(effectiveValue);
    });
}

// filter run data based on active custom filters (one dropdown per dimension)
function filter_custom_filters(filteredRuns) {
    const dimensions = collect_custom_filter_dimensions();
    const hiddenCustomFilters = get_hidden_custom_filters();
    for (const dimName of Object.keys(dimensions)) {
        // hidden on this page also means not applied on this page
        if (hiddenCustomFilters.includes(dimName)) continue;
        const listEl = document.getElementById(`customFilter_${dimName}_List`);
        if (!listEl) continue;
        const checkedValues = new Set(
            Array.from(listEl.querySelectorAll("input:checked")).map(el => el.value)
        );
        const modeEl = document.getElementById(`customFilter_${dimName}_Mode`);
        const mode = modeEl ? modeEl.value : "OR";
        filteredRuns = apply_custom_filter_dimension(filteredRuns, dimName, checkedValues, mode);
    }
    return filteredRuns;
}

// custom_filters strings never change after the data is decoded, so the parsed result is
// cached: the value of one dimension is read once per run per filter pass, and the option
// availability computation walks every run once per dimension on top of that.
const parsedCustomFiltersCache = new Map();

function parse_custom_filters(cfStr) {
    if (!cfStr) return {};
    const cached = parsedCustomFiltersCache.get(cfStr);
    if (cached) return cached;
    const result = {};
    cfStr.split(":").forEach(part => {
        const eq = part.indexOf("=");
        if (eq > 0) {
            result[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
        }
    });
    parsedCustomFiltersCache.set(cfStr, result);
    return result;
}

// the value of one custom filter dimension for a run, "None" when the run has no such key
function get_custom_filter_value(run, dimName) {
    const value = parse_custom_filters(run.custom_filters)[dimName];
    return value === undefined ? "None" : value;
}

function collect_custom_filter_dimensions() {
    const dimensions = {};
    for (const run of runs) {
        if (!run.custom_filters) continue;
        const parsed = parse_custom_filters(run.custom_filters);
        for (const [key, value] of Object.entries(parsed)) {
            if (!dimensions[key]) dimensions[key] = new Set();
            dimensions[key].add(value);
        }
    }
    return dimensions;
}

function apply_project_version_filter(runs, selectedProjectVersions) {
    if (!selectedProjectVersions.size) return [];
    if (selectedProjectVersions.has("All")) return runs;

    return runs.filter(run => selectedProjectVersions.has(get_project_version_value(run)));
}

// the project version of a run, "None" when the run has no version label
function get_project_version_value(run) {
    return run.project_version === null || run.project_version === undefined ? "None" : run.project_version;
}

// filter run data based on the project version filter
function filter_project_versions(runs) {
    const selectedProjectVersions = new Set(
        Array.from(
            document.querySelectorAll('#projectVersionList input[type="checkbox"]:checked')
        ).map(el => el.value)
    );
    return apply_project_version_filter(runs, selectedProjectVersions);
}

// the selected date range as {from, to} Date objects, or null when the range is incomplete
function build_date_range(fromDate, fromTime, toDate, toTime) {
    if (!fromDate || !fromTime || !toDate || !toTime) {
        return null;
    }
    const from = new Date(`${fromDate} ${fromTime}:00`);
    const to = new Date(`${toDate} ${toTime}:00`);
    if (from > to) {
        return null;
    }
    return { from, to };
}

// The date a run started as the date filter sees it: when timezones are not converted, the
// offset is stripped so the run_start is a plain wall-clock time matching the date picker
// values (which are also wall-clock). Not the parse_run_start() of common.js, which keeps the
// offset - every module ends up in one script, so the names may not clash either.
function get_run_start_date(run) {
    let rs = run.run_start.replace(" ", "T");
    if (!settings.show.convertTimezone) {
        rs = strip_tz_suffix(rs);
    }
    return new Date(rs);
}
function apply_date_filter(runs, fromDateTime, toDateTime) {
    return runs.filter(run => {
        const runStart = get_run_start_date(run);
        return runStart >= fromDateTime && runStart <= toDateTime;
    });
}

// function to filter the run data based on the selected date range
function filter_dates(runs) {
    const fromDate = document.getElementById("fromDate").value;
    const fromTime = document.getElementById("fromTime").value;
    const toDate = document.getElementById("toDate").value;
    const toTime = document.getElementById("toTime").value;
    if (!fromDate || !fromTime || !toDate || !toTime) {
        return runs;
    }
    const dateRange = build_date_range(fromDate, fromTime, toDate, toTime);
    if (!dateRange) { // build_date_range only rejects a complete range when from is later than to
        alert("Filter error: The selected from date + time is later than your selected to date + time. Date filter has not been applied!");
        return runs;
    }
    return apply_date_filter(runs, dateRange.from, dateRange.to);
}

// function to filter the amount of runs based on the filter
// the amount is applied per project (every project_* run tag and the run name, see
// get_run_projects) and not on the combined run list: a run is kept when it is one of
// the last X runs of at least one of its projects, so a project with a lower run
// frequency never disappears behind the runs of a busier project (issue #347)
function filter_amount(filteredRuns) {
    var selectedAmount = document.getElementById("amount").value;
    // Handle weird selectedAmountValues:
    if (selectedAmount == "") {
        document.getElementById("amount").value = 10;
        selectedAmount = document.getElementById("amount").value;
    }
    if (selectedAmount > runs.length) {
        document.getElementById("amount").value = runs.length;
        selectedAmount = document.getElementById("amount").value;
    }
    if (selectedAmount < 0) {
        document.getElementById("amount").value = 0;
        selectedAmount = document.getElementById("amount").value;
    }
    if (selectedAmount.includes(",")) {
        document.getElementById("amount").value = selectedAmount.split(",")[0];
        selectedAmount = document.getElementById("amount").value;
    }
    if (selectedAmount.includes(".")) {
        document.getElementById("amount").value = selectedAmount.split(".")[0];
        selectedAmount = document.getElementById("amount").value;
    }
    filteredAmount = filteredRuns.length
    if (selectedAmount == 0) { return [] }
    // collect the indexes of the last X runs of every project, the indexes keep the
    // original (chronological) order of filteredRuns and de-duplicate runs that belong
    // to more than one project (a run always has a name project next to its tags)
    const runIndexesByProject = new Map();
    filteredRuns.forEach((run, index) => {
        for (const project of get_run_projects(run)) {
            if (!runIndexesByProject.has(project)) runIndexesByProject.set(project, []);
            runIndexesByProject.get(project).push(index);
        }
    });
    const keptIndexes = new Set();
    for (const indexes of runIndexesByProject.values()) {
        for (const index of indexes.slice(- selectedAmount)) keptIndexes.add(index);
    }
    return filteredRuns.filter((_, index) => keptIndexes.has(index));
}

function apply_metadata_filter(filteredRuns, selectedMetadata) {
    if (selectedMetadata == '' || selectedMetadata == 'All' || selectedMetadata == undefined) return filteredRuns;
    return filteredRuns.filter(run => (run.metadata || "").includes(selectedMetadata));
}

// function to filter the runs based on the selected metadata key:value pair
function filter_metadata(filteredRuns) {
    return apply_metadata_filter(filteredRuns, document.getElementById("metadata").value);
}

// function to filter suites/tests/keywords based on the already filtered runs
function filter_data(data) {
    const validRunStarts = filteredRuns.map(v => v.run_start);
    let filteredData = data.filter(v => validRunStarts.includes(v.run_start));
    if (filteredData.length > 0 && "owner" in filteredData[0]) {
        const libraries = settings.libraries || {};
        filteredData = filteredData.filter(item => {
            // if item has no owner, keep it
            if (!item.owner) return true;
            // if owner not in settings.libraries, assume enabled
            if (!(item.owner in libraries)) return true;
            // otherwise, include only if library is enabled
            return libraries[item.owner];
        });
    }
    return filteredData;
}

export {
    apply_custom_filter_dimension,
    apply_custom_filter_visibility,
    apply_date_filter,
    apply_metadata_filter,
    apply_project_version_filter,
    apply_run_name_filter,
    apply_runtag_filter,
    build_date_range,
    collect_custom_filter_dimensions,
    convert_timezone,
    dashboardPages,
    get_active_page,
    get_custom_filter_value,
    get_hidden_custom_filters,
    get_project_version_value,
    get_run_start_date,
    parse_custom_filters,
    remove_milliseconds,
    remove_timezones,
    setup_filtered_data_and_filters,
};
