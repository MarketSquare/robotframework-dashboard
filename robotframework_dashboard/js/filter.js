import { settings } from './variables/settings.js';
import { compareRunIds } from './variables/graphs.js';
import { runs, suites, tests, keywords, unified_dashboard_title } from './variables/data.js';
import { show_loading_overlay, hide_loading_overlay, strip_tz_suffix } from './common.js';
import { set_local_storage_item } from './localstorage.js';
import {
    filteredAmount,
    filteredRuns,
    filteredSuites,
    filteredTests,
    filteredKeywords,
    selectedRunSetting,
    selectedTagSetting
} from './variables/globals.js';

// Sort an array of run objects by wall-clock run_start (timezone offset stripped),
// ensuring correct chronological order when timestamps span mixed timezone offsets.
function sort_wall_clock(data) {
    return [...data].sort((a, b) => {
        const ak = strip_tz_suffix(a.run_start);
        const bk = strip_tz_suffix(b.run_start);
        return ak < bk ? -1 : ak > bk ? 1 : 0;
    });
}

// function updates the data in the graphs whenever filters are updated
function setup_filtered_data_and_filters() {
    filteredRuns = remove_milliseconds(runs)
    filteredSuites = remove_milliseconds(suites)
    filteredTests = remove_milliseconds(tests)
    filteredKeywords = remove_milliseconds(keywords)
    // convert timezones if enabled (must run before remove_timezones so the offset is still present)
    filteredRuns = convert_timezone(filteredRuns);
    filteredSuites = convert_timezone(filteredSuites);
    filteredTests = convert_timezone(filteredTests);
    filteredKeywords = convert_timezone(filteredKeywords);
    // remove timezone display if disabled
    filteredRuns = remove_timezones(filteredRuns);
    filteredSuites = remove_timezones(filteredSuites);
    filteredTests = remove_timezones(filteredTests);
    filteredKeywords = remove_timezones(filteredKeywords);
    // filter run data
    filteredRuns = filter_runs(filteredRuns);
    filteredRuns = filter_runtags(filteredRuns);
    filteredRuns = filter_dates(filteredRuns);
    filteredRuns = filter_amount(filteredRuns);
    filteredRuns = filter_metadata(filteredRuns);
    filteredRuns = filter_project_versions(filteredRuns);
    // filter suites and tests based on filtered runs
    filteredSuites = filter_data(filteredSuites);
    filteredTests = filter_data(filteredTests);
    filteredKeywords = filter_data(filteredKeywords);
    // re-sort all filtered data by wall-clock run_start so mixed-timezone datasets
    // appear in the correct chronological order on graphs (timestamps may have been
    // converted or had their offsets stripped above, so re-sort here is the source of truth)
    filteredRuns = sort_wall_clock(filteredRuns);
    filteredSuites = sort_wall_clock(filteredSuites);
    filteredTests = sort_wall_clock(filteredTests);
    filteredKeywords = sort_wall_clock(filteredKeywords);
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

// function to filter run data based on the runs (aka run name) filter
function filter_runs(runs) {
    if (selectedRunSetting != '') {
        document.getElementById("runs").value = selectedRunSetting
        selectedRunSetting = ''
    }
    const selectedRun = document.getElementById("runs").value;
    if (selectedRun === "All") {
        var selectedRuns = runs
    } else {
        var selectedRuns = Object.values(runs).filter(run => run.name === selectedRun)
    }
    return selectedRuns;
}

// function to filter run data based on the run tags filter
function filter_runtags(runs) {
    const tagElements = document.getElementById("runTag").getElementsByTagName("input");
    const useOrTags = document.getElementById("useOrTags").checked;

    if (selectedTagSetting != '') {
        for (const input of tagElements) {
            input.checked = false;
            if (input.id === selectedTagSetting) {
                input.checked = true;
            }
        }
        useOrTags.checked = false;
        selectedTagSetting = ''
    }

    const selectedTags = Array.from(tagElements)
        .filter(tagElement => tagElement.checked)
        .map(tagElement => tagElement.id.replace(/^runTagCheckBox/, ""));
    if (selectedTags.includes("All")) { // If "All" is selected, return all runs
        return runs;
    }
    if (selectedTags.length === 0) { // If no tags are selected, return an empty list
        return [];
    }
    return runs.filter(run => {
        const runTags = run.tags.split(",");
        if (!useOrTags) { // Use AND logic: the run must contain all selected tags
            return selectedTags.every(selectedTag => runTags.includes(selectedTag));
        }
        // Use OR logic: the run must contain at least one selected tag
        return selectedTags.some(selectedTag => runTags.includes(selectedTag));
    });
}

// filter run data based on the project version filter
function filter_project_versions(runs) {
    const selectedProjectVersions = new Set(
        Array.from(
            document.querySelectorAll('#projectVersionList input[type="checkbox"]:checked')
        ).map(el => el.value)
    );
    if (!selectedProjectVersions.size) return [];
    if (selectedProjectVersions.has("All")) return runs;

    return runs.filter(run => {
        if (run.project_version === null) { // allow filter for runs with no project version
            return selectedProjectVersions.has("None");
        }
        return selectedProjectVersions.has(run.project_version);
    });
}

// function to filter the run data based on the selected date range
function filter_dates(runs) {
    const fromDate = document.getElementById("fromDate").value;
    const fromTime = document.getElementById("fromTime").value;
    const toDate = document.getElementById("toDate").value;
    const toTime = document.getElementById("toTime").value;
    if (!fromDate || !fromTime || !toDate || !toTime) { // Return all runs if any date/time values are missing
        return runs;
    }
    const fromDateTime = new Date(`${fromDate} ${fromTime}:00`);
    const toDateTime = new Date(`${toDate} ${toTime}:00`);
    if (fromDateTime > toDateTime) { // Check for valid date range
        alert("Filter error: The selected from date + time is later than your selected to date + time. Date filter has not been applied!");
        return runs;  // Return all runs if invalid range
    }
    return runs.filter(run => {
        // When not converting timezones, strip any timezone offset so the run_start is treated
        // as a plain wall-clock time matching the date picker values (which are also wall-clock).
        let rs = run.run_start.replace(" ", "T");
        if (!settings.show.convertTimezone) {
            rs = strip_tz_suffix(rs);
        }
        const runStart = new Date(rs);
        return runStart >= fromDateTime && runStart <= toDateTime;
    });
}

// function to filter the amount of runs based on the filter
function filter_amount(filteredRuns) {
    var selectedAmount = document.getElementById("amount").value;
    // Handle weird selectedAmountValues:
    if (selectedAmount == "") {
        $("#amount").val(10).trigger("change.amount");
        selectedAmount = document.getElementById("amount").value;
    }
    if (selectedAmount > runs.length) {
        $("#amount").val(runs.length).trigger("change.amount");
        selectedAmount = document.getElementById("amount").value;
    }
    if (selectedAmount < 0) {
        $("#amount").val(0).trigger("change.amount");
        selectedAmount = document.getElementById("amount").value;
    }
    if (selectedAmount.includes(",")) {
        $("#amount").val(selectedAmount.split(",")[0]).trigger("change.amount");
        selectedAmount = document.getElementById("amount").value;
    }
    if (selectedAmount.includes(".")) {
        $("#amount").val(selectedAmount.split(".")[0]).trigger("change.amount");
        selectedAmount = document.getElementById("amount").value;
    }
    filteredAmount = filteredRuns.length
    if (selectedAmount == 0) { return [] }
    filteredRuns = filteredRuns.slice(- selectedAmount)
    return filteredRuns
}

// function to filter the runs based on the selected metadata key:value pair
function filter_metadata(filteredRuns) {
    const selectedMetadata = document.getElementById("metadata").value;
    if (selectedMetadata == '' || selectedMetadata == 'All') return filteredRuns;
    var filteredData = []
    for (const run of filteredRuns) {
        if (run.metadata.includes(selectedMetadata)) {
            filteredData.push(run)
        }
    }
    return filteredData
}

// function to filter suites/tests/keywords based on the already filtered runs
function filter_data(data) {
    // Step 1: Only include entries that match filteredRuns
    const validRunStarts = filteredRuns.map(v => v.run_start);
    let filteredData = data.filter(v => validRunStarts.includes(v.run_start));
    // Step 2: Check if the first element has an "owner" key
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

// function to update the available runs in the selects
function setup_runs_in_compare_selects() {
    const selects = compareRunIds.map(id => document.getElementById(id));
    const items = filteredRuns.map(run => settings.show.aliases ? run.run_alias : run.run_start);
    selects.forEach(select => select.innerHTML = "")
    selects.forEach(select => {
        select.options.add(new Option("None", "None"));
        items.forEach(item => select.options.add(new Option(item, item)));
    });
    selects[0].selectedIndex = selects[0].options.length - 1;
    selects[1].selectedIndex = selects[1].options.length - 2;
}

// function to update the available suites to select in the suite filters
function setup_suites_in_suite_select() {
    const suiteSelectSuites = document.getElementById("suiteSelectSuites");
    const toggleSuitesSelectionInSuiteStats = document.getElementById("toggleSuitesSelectionInSuiteStats");
    const suiteFolder = document.getElementById("suiteFolder").innerText;
    suiteSelectSuites.innerHTML = "";
    toggleSuitesSelectionInSuiteStats.innerHTML = "";
    var suiteNames = new Set()
    for (const suite of filteredSuites) {
        if (suiteFolder != "All" && !(suite.full_name.startsWith(suiteFolder + ".") || suite.full_name == suiteFolder)) {
            continue
        }
        if (settings.switch.suitePathsSuiteSection) {
            suiteNames.add(suite.full_name);
        } else {
            suiteNames.add(suite.name);
        }
    }
    suiteNames = [...suiteNames].sort()
    suiteSelectSuites.options.add(new Option("All Suites Separate", "All Suites Separate"));
    suiteSelectSuites.options.add(new Option("All Suites Combined", "All Suites Combined"));
    toggleSuitesSelectionInSuiteStats.options.add(new Option("All Suites Separate", "All Suites Separate"));
    toggleSuitesSelectionInSuiteStats.options.add(new Option("All Suites Combined", "All Suites Combined"));
    suiteNames.forEach(suiteName => {
        suiteSelectSuites.options.add(new Option(suiteName, suiteName));
        toggleSuitesSelectionInSuiteStats.options.add(new Option(suiteName, suiteName));
    });
    const suiteStatsSelection = settings.show.suitesSelectionInSuiteStats;
    if (suiteStatsSelection === 'All Suites Separate') {
        suiteSelectSuites.selectedIndex = 0;
        toggleSuitesSelectionInSuiteStats.selectedIndex = 0;
    } else if (suiteStatsSelection === 'All Suites Combined') {
        suiteSelectSuites.selectedIndex = 1;
        toggleSuitesSelectionInSuiteStats.selectedIndex = 1;
    } else {
        let suiteIndex = suiteNames.indexOf(suiteStatsSelection);
        // If not found or not set, default to first suite and update localStorage
        if (suiteIndex < 0 && suiteNames.length > 0) {
            suiteIndex = 0;
            settings.show.suitesSelectionInSuiteStats = suiteNames[0];
            set_local_storage_item('show.suitesSelectionInSuiteStats', suiteNames[0]);
        }
        const resolvedIndex = suiteIndex >= 0 ? suiteIndex + 2 : 2;
        suiteSelectSuites.selectedIndex = resolvedIndex;
        toggleSuitesSelectionInSuiteStats.selectedIndex = resolvedIndex;
    }
}

// function to update the available suites to select in the test filters
function setup_suites_in_test_select() {
    const suiteSelectTests = document.getElementById("suiteSelectTests");
    const suitesSelectionInTestStats = document.getElementById("toggleSuitesSelectionInTestStats");
    suiteSelectTests.innerHTML = "";
    suitesSelectionInTestStats.innerHTML = "";
    const suiteNames = settings.switch.suitePathsTestSection
        ? [...new Set(filteredSuites.map(suite => suite.full_name))].sort()
        : [...new Set(filteredSuites.map(suite => suite.name))].sort();
    suiteSelectTests.options.add(new Option("All", "All"));
    suitesSelectionInTestStats.options.add(new Option("All", "All"));
    suiteNames.forEach(suiteName => {
        suiteSelectTests.options.add(new Option(suiteName, suiteName));
        suitesSelectionInTestStats.options.add(new Option(suiteName, suiteName));
    });
    const testStatsSelection = settings.show.suitesSelectionInTestStats;
    if (testStatsSelection === 'All') {
        suiteSelectTests.selectedIndex = 0;
        suitesSelectionInTestStats.selectedIndex = 0;
    } else {
        let suiteIndex = suiteNames.indexOf(testStatsSelection);
        // If not found or not set, default to first suite and update localStorage
        if (suiteIndex < 0 && suiteNames.length > 0) {
            suiteIndex = 0;
            settings.show.suitesSelectionInTestStats = suiteNames[0];
            set_local_storage_item('show.suitesSelectionInTestStats', suiteNames[0]);
        }
        suiteSelectTests.selectedIndex = suiteIndex >= 0 ? suiteIndex + 1 : 0;
        suitesSelectionInTestStats.selectedIndex = suiteIndex >= 0 ? suiteIndex + 1 : 0;
    }
}

// function to update the available tests to select in the filters
// applies to the test filter on the test statistics level
function setup_tests_in_select() {
    const suiteSelectTests = document.getElementById("suiteSelectTests").value;
    const testTagsSelect = document.getElementById("testTagsSelect").value;
    const testSelect = document.getElementById("testSelect");
    testSelect.innerHTML = "";
    const testNames = filteredTests.reduce((names, test) => {
        const isInSuite = settings.switch.suitePathsTestSection
            ? test.full_name.includes(`${suiteSelectTests}.${test.name}`) || suiteSelectTests === "All"
            : test.full_name.includes(`.${suiteSelectTests}.${test.name}`) || suiteSelectTests === "All"
        const hasTag = testTagsSelect === "All" || test.tags.includes(testTagsSelect);

        if (isInSuite && hasTag && !names.includes(test.name)) {
            names.push(test.name);
        }

        return names;
    }, []);
    testSelect.options.add(new Option("All", "All"));
    testNames.sort().forEach(testName => testSelect.options.add(new Option(testName, testName)));
}

// function to update the available testtags to select in the filters
// applies to the testtag filter on the test statistics level
function setup_testtags_in_select() {
    const suiteSelectTests = document.getElementById("suiteSelectTests").value;
    const testTagsSelect = document.getElementById("testTagsSelect");
    testTagsSelect.innerHTML = "";
    const testTags = [...new Set(filteredTests.reduce((tags, test) => {
        if (settings.switch.suitePathsTestSection) {
            if (test.full_name.includes(`${suiteSelectTests}.${test.name}`) || suiteSelectTests === "All") {
                test.tags.replace(/\[|\]/g, "").split(",").forEach(tag => tags.push(tag.trim()));
            }
        } else {
            if (test.full_name.includes(`.${suiteSelectTests}.${test.name}`) || suiteSelectTests === "All") {
                test.tags.replace(/\[|\]/g, "").split(",").forEach(tag => tags.push(tag.trim()));
            }
        }
        return tags;
    }, []))].filter(Boolean);
    testTagsSelect.options.add(new Option("All", "All"));
    testTags.forEach(tag => testTagsSelect.options.add(new Option(tag, tag)));
}

// function to update the available keywords to select in the filters
// applies to the keyword filter on the keyword statistics level
function setup_keywords_in_select() {
    const keywordSelect = document.getElementById("keywordSelect");
    keywordSelect.innerHTML = "";
    const useLibraryNames = settings?.switch?.useLibraryNames === true;

    // Build display names depending on the setting
    const keywordNames = [
        ...new Set(
            filteredKeywords.map(keyword =>
                useLibraryNames && keyword.owner
                    ? `${keyword.owner}.${keyword.name}`
                    : keyword.name
            )
        )
    ].sort();

    // Add options to select
    keywordNames.forEach(keywordName => {
        keywordSelect.options.add(new Option(keywordName, keywordName));
    });
    // Optionally select the last one
    if (keywordNames.length > 0) {
        keywordSelect.selectedIndex = keywordNames.length - 1;
    }
}

// function to setup run amount filter maximum
function setup_run_amount_filter() {
    document.getElementById("amount").setAttribute("max", runs.length)
}

// function that initializes the from date/time and to date/time selection boxes in the filters
function setup_lowest_highest_dates() {
    if (runs.length == 0) {
        document.getElementById("fromDate").value = "1900-01-01";
        document.getElementById("fromTime").value = "00:00";
        document.getElementById("toDate").value = "9999-12-31";
        document.getElementById("toTime").value = "23:59";
        return;
    }

    if (settings.show.convertTimezone) {
        // Convert to viewer's local timezone: parse the stored offset-aware timestamps as UTC
        // instants, then display the local wall-clock equivalent in the pickers.
        var dates = runs.map(run => new Date(run.run_start.replace(" ", "T")));
        var lowest = new Date(Math.min.apply(null, dates));
        var highest = new Date(Math.max.apply(null, dates));
        var tzoffset = new Date().getTimezoneOffset() * 60000;
        lowest = new Date(new Date(lowest - tzoffset).getTime() - 1 * 60000); // account for seconds
        highest = new Date(new Date(highest - tzoffset).getTime() + 1 * 60000); // account for seconds
        lowest.setTime(lowest.getTime() - 1 * 60 * 60 * 1000); // minus 1 hour for DST
        highest.setTime(highest.getTime() + 1 * 60 * 60 * 1000); // plus 1 hour for DST
        document.getElementById("fromDate").value = lowest.toISOString().split("T")[0];
        document.getElementById("fromTime").value = lowest.toISOString().split("T")[1].substring(0, 5);
        document.getElementById("toDate").value = highest.toISOString().split("T")[0];
        document.getElementById("toTime").value = highest.toISOString().split("T")[1].substring(0, 5);
    } else {
        // No conversion: strip the timezone suffix and treat the stored wall-clock datetime
        // as-is, so picker defaults match exactly what the user sees in the dashboard.
        const wallClocks = runs.map(run => {
            const rs = run.run_start;
            const suffix = rs.slice(-6);
            const hasTz = /^[+-]\d{2}:\d{2}$/.test(suffix);
            // Take only YYYY-MM-DD HH:MM:SS (first 19 chars)
            return hasTz ? rs.slice(0, 19) : rs.slice(0, 19);
        });
        wallClocks.sort();
        const lowestStr = wallClocks[0];
        const highestStr = wallClocks[wallClocks.length - 1];
        // Adjust by 1 minute and 1 hour (for seconds and DST) using plain date arithmetic
        const adjust = (dateStr, deltaMs) => {
            const d = new Date(dateStr.replace(" ", "T"));
            d.setTime(d.getTime() + deltaMs);
            const pad = n => String(n).padStart(2, "0");
            const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
            const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
            return { date, time };
        };
        const low = adjust(lowestStr, -(1 * 60 + 60 * 60) * 1000); // -1min -1hr
        const high = adjust(highestStr, (1 * 60 + 60 * 60) * 1000);  // +1min +1hr
        document.getElementById("fromDate").value = low.date;
        document.getElementById("fromTime").value = low.time;
        document.getElementById("toDate").value = high.date;
        document.getElementById("toTime").value = high.time;
    }
}

// function to setup metadata filter if there is metadata in the data
function setup_metadata_filter() {
    var metadataItems = new Set();
    for (const run of runs) {
        if (!run.metadata) continue;
        const jsonStr = run.metadata.replace(/'/g, '"');
        const parsed = JSON.parse(jsonStr);
        parsed.forEach(item => metadataItems.add(item));
    }
    metadataItems = Array.from(metadataItems).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    const metadataFilter = document.getElementById("metadataFilter");
    if (metadataItems.length > 0) {
        metadataFilter.hidden = false;
        const optionsHtml = metadataItems
            .map(label => `<option value="${label}">${label}</option>`)
            .join("");
        const metadataSelect = document.getElementById("metadata");
        metadataSelect.innerHTML = `<option value="All">All</option>` + optionsHtml;
    } else {
        metadataFilter.hidden = true;
    }
}

// function to update the available runs to select in the filters
function setup_runs_in_select_filter_buttons() {
    const runOptions = new Set();
    runs.forEach(run => runOptions.add(run.name));
    const optionsHtml = Array.from(runOptions)
        .map(runName => `<option value="${runName}">${runName}</option>`)
        .join("");
    const runsSelect = document.getElementById("runs");
    runsSelect.innerHTML = `<option value="All">All</option>` + optionsHtml;
}

// function to update the available runtags to select in the filters
function setup_runtags_in_select_filter_buttons() {
    const tags = new Set();
    runs.forEach(run => {
        run.tags.split(",").forEach(tag => {
            if (tag) { // Avoid adding empty tags
                tags.add(tag);
            }
        });
    });
    const andOrTags = `
        <li class="list-group-item d-flex small">
            <div class="btn-group form-switch">
                <input class="form-check-input" type="checkbox" role="switch" id="useOrTags" />
            </div>
            <div class="btn-group">
                <label class="form-check-label" for="useOrTags">Use OR (default AND)</label>
            </div>
        </li>
    `;
    const listItemTemplate = (value) => `
        <li class="list-group-item list-group-item-action d-flex small">
            <input class="form-check-input me-1" type="checkbox" value="${value}" id="runTagCheckBox${value}">
            <label class="form-check-label ms-2" for="runTagCheckBox${value}">${value}</label>
        </li>
    `;
    const listItems = [listItemTemplate("All")].concat(
        Array.from(tags).sort().map(tag => listItemTemplate(tag))
    ).join("");
    const tagsSelect = document.getElementById("runTag");
    tagsSelect.innerHTML = andOrTags + listItems;
    if (tags.size > 0) {
        document.getElementById("runTagFilter").hidden = false
    } else {
        document.getElementById("runTagFilter").hidden = true
    }
    const allRunTagsCheckBox = document.getElementById("runTagCheckBoxAll");
    allRunTagsCheckBox.checked = true;
    const filterActiveIndicatorId = "filterRunTagSelectedIndicator";
    setup_filter_active_indicator(allRunTagsCheckBox, filterActiveIndicatorId);
    setup_filter_checkbox_subfilter("runTagCheckBoxes");
    setup_filter_checkbox_handler_listeners(tagsSelect, allRunTagsCheckBox, filterActiveIndicatorId);
}

// create projectVersions checkboxes in filters
function setup_project_versions_in_select_filter_buttons() {
    const projectVersionList = document.getElementById("projectVersionList");
    projectVersionList.innerHTML = '';
    const projectVersionOptionsSet = new Set(
        runs
            .map(run => run.project_version)
            .filter(ver => ver != null)
    );
    const projectVersionOptions = [...projectVersionOptionsSet].sort().reverse();
    projectVersionOptions.unshift("None");
    projectVersionOptions.unshift("All");
    const prefix = "projectVersionInputItem";
    const listItemTemplate = (prefix, value) => `
        <li class="list-group-item list-group-item-action d-flex small">
            <input class="form-check-input me-1" type="checkbox" value="${value}" id="${prefix}${value}">
            <label class="form-check-label ms-2" for="${prefix}${value}">${value}</label>
        </li>
    `;
    const projectVersionListHtml = projectVersionOptions
        .map(projectVersion => listItemTemplate(prefix, projectVersion))
        .join('');
    projectVersionList.innerHTML = projectVersionListHtml;
    const allVersionsCheckBox = document.getElementById(`${prefix}All`);
    allVersionsCheckBox.checked = true;
    const filterVersionSelectedIndicatorId = "filterVersionSelectedIndicator";
    setup_filter_active_indicator(allVersionsCheckBox, filterVersionSelectedIndicatorId);
    setup_filter_checkbox_subfilter("projectVersionCheckBoxes");
    setup_filter_checkbox_handler_listeners(projectVersionList, allVersionsCheckBox, filterVersionSelectedIndicatorId);
}

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

function handle_overview_latest_version_selection(overviewVersionSelectorList, latestRunByProject) {
    show_loading_overlay();
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const selectedOptions = Array.from(
                overviewVersionSelectorList.querySelectorAll("input:checked")
            ).map(inputElement => inputElement.value);
            if (selectedOptions.includes("All")) {
                create_overview_latest_graphs(latestRunByProject);
            } else {
                const filteredLatestRunByProject = Object.fromEntries(
                    Object.entries(latestRunByProject)
                        .filter(([projectName, run]) => selectedOptions.includes(run.project_version ?? "None"))
                );
                create_overview_latest_graphs(filteredLatestRunByProject);
            }
            update_overview_latest_heading();
            hide_loading_overlay();
        });
    });
}

// this function updates the version select list in the latest runs bar
function update_overview_version_select_list() {
    const overviewLatestVersionSelectorList = document.getElementById("overviewLatestVersionSelectorList");
    if (overviewLatestVersionSelectorList) {
        overviewLatestVersionSelectorList.innerHTML = '';
        if (settings.switch.runName || settings.switch.runTags) {
            const filteredLatestRunByProject = {};
            settings.switch.runName && Object.assign(filteredLatestRunByProject, latestRunByProjectName);
            settings.switch.runTags && Object.assign(filteredLatestRunByProject, latestRunByProjectTag);
            const runAmountByVersion = {};
            for (const run of Object.values(filteredLatestRunByProject)) {
                const projectVersion = run.project_version ?? "None";
                runAmountByVersion[projectVersion] ??= 0;
                runAmountByVersion[projectVersion]++;
            }
            const allVersionAmountInFilter = Object.keys(runAmountByVersion).length;
            const versionFilterListItemAllHtml = generate_version_filter_list_item_html("All", "overviewLatest", "checked", allVersionAmountInFilter, "version");
            const specificVersionFilterListItemHtml = Object.keys(runAmountByVersion)
                .sort()
                .reverse()
                .map(version => {
                    return generate_version_filter_list_item_html(
                        version,
                        "overviewLatest",
                        "", //not checked
                        runAmountByVersion[version],
                        "run"
                    )
                }).join('');
            overviewLatestVersionSelectorList.innerHTML = versionFilterListItemAllHtml + specificVersionFilterListItemHtml;
            const allCheckBox = document.getElementById("overviewLatestVersionFilterListItemAllInput");
            setup_filter_checkbox_handler_listeners(
                overviewLatestVersionSelectorList,
                allCheckBox,
                "overviewLatestVersionSelectedIndicator",
                () => { handle_overview_latest_version_selection(overviewLatestVersionSelectorList, filteredLatestRunByProject) }
            );
        }
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

function setup_filter_checkbox_subfilter(parentElementId) {
    const container = document.getElementById(parentElementId);
    const searchBar = container.querySelector("input.form-control");
    const checkBoxRows = container.querySelectorAll("li.list-group-item-action");
    searchBar.addEventListener("input", () => {
        const filterText = searchBar.value.toLowerCase();
        checkBoxRows.forEach(row => {
            const checkbox = row.querySelector("input.form-check-input");
            const rowValue = checkbox.value.toLowerCase();
            const shouldHide = !rowValue.includes(filterText);
            row.classList.toggle("d-none", shouldHide);
        });
    });
}

function generate_version_filter_list_item_html(version, projectName, checked, amount, amountType) {
    function versionFilterListItemInput(version, id, checked) {
        return `<input class="form-check-input version-checkbox" type="checkbox" value="${version}" id="${id}" ${checked}>`
    };
    function versionFilterListItemLabel(forId, version, amount, amountType, pluralPostfix) {
        return `<label class="form-check-label" for="${forId}">${version} (${amount} ${amountType}${pluralPostfix})</label>`
    };
    const listItemId = `${projectName}VersionFilterListItem`;
    const listItemInputId = `${listItemId}${version}Input`;
    const pluralPostfix = amount === 1 ? '' : 's';
    return `
        <li>
            <div class="form-check">
                ${versionFilterListItemInput(version, listItemInputId, checked)}
                ${versionFilterListItemLabel(listItemInputId, version, amount, amountType, pluralPostfix)}
            </div>
        </li>
    `
}

function clear_all_filters() {
    clear_project_filter();
    clear_version_filter();
    document.getElementById("amount").value = filteredAmountDefault;
    document.getElementById("metadata").value = "All";
    setup_lowest_highest_dates();
}

function clear_version_filter() {
    document.getElementById("projectVersionCheckBoxesFilter").value = "";
    const versionElements = document.getElementById("projectVersionList").getElementsByTagName("input");
    for (const input of versionElements) {
        input.checked = false;
        input.parentElement.classList.remove("d-none"); //show filtered rows
        if (input.value == "All") input.checked = true;
    }
    update_filter_active_indicator("projectVersionInputItemAll", "filterVersionSelectedIndicator");
}

function set_filter_show_current_version(version) {
    const projectVersionList = document.getElementById("projectVersionList");
    document.getElementById("projectVersionInputItemAll").checked = false;
    projectVersionList.querySelector(`input[value="${version}"]`).checked = true;
    update_filter_active_indicator("projectVersionInputItemAll", "filterVersionSelectedIndicator");
}

// ============ Filter Profiles ============

// Track the currently active profile name (null if none applied)
let activeProfileName = null;

// Snapshot of the filter state at dashboard load time (used to determine checkbox defaults when creating a profile)
let defaultFilters = null;

// Capture the current filter state as the baseline default (called once after filters are initialized)
function capture_default_filters() {
    defaultFilters = capture_current_filters();
}

// Returns true when the current value of a single filter key differs from the default snapshot
function filter_key_differs_from_default(key) {
    if (!defaultFilters) return false;
    const current = capture_current_filters();
    if (key === 'runTags') {
        const defaultTagMap = {};
        (defaultFilters.runTags || []).forEach(t => { defaultTagMap[t.id] = t.checked; });
        for (const tag of (current.runTags || [])) {
            if (defaultTagMap[tag.id] !== tag.checked) return true;
        }
        return false;
    }
    if (key === 'projectVersions') {
        const defaultVersionMap = {};
        (defaultFilters.projectVersions || []).forEach(v => { defaultVersionMap[v.value] = v.checked; });
        for (const ver of (current.projectVersions || [])) {
            if (defaultVersionMap[ver.value] !== ver.checked) return true;
        }
        return false;
    }
    return String(current[key] ?? '') !== String(defaultFilters[key] ?? '');
}

// Returns an object mapping each profile checkbox id to whether it should be checked
// (i.e. the corresponding filter(s) currently differ from the default state)
function compute_profile_check_states() {
    const checkKeyMap = {
        profileCheckRuns: ['runs'],
        profileCheckRunTags: ['runTags', 'useOrTags'],
        profileCheckVersions: ['projectVersions'],
        profileCheckFromDate: ['fromDate'],
        profileCheckFromTime: ['fromTime'],
        profileCheckToDate: ['toDate'],
        profileCheckToTime: ['toTime'],
        profileCheckMetadata: ['metadata'],
        profileCheckAmount: ['amount'],
    };
    const result = {};
    for (const [checkId, keys] of Object.entries(checkKeyMap)) {
        result[checkId] = keys.some(key => filter_key_differs_from_default(key));
    }
    return result;
}

// Read the current state of all filter controls into a plain object
function capture_current_filters() {
    const profile = {};
    // Runs select
    profile.runs = document.getElementById("runs").value;
    // Run tags checkboxes
    const tagInputs = document.getElementById("runTag").querySelectorAll("input.form-check-input");
    profile.runTags = Array.from(tagInputs).map(el => ({ id: el.id.replace(/^runTagCheckBox/, ""), checked: el.checked }));
    profile.useOrTags = document.getElementById("useOrTags")?.checked ?? false;
    // Project version checkboxes
    const versionInputs = document.getElementById("projectVersionList").querySelectorAll("input.form-check-input");
    profile.projectVersions = Array.from(versionInputs).map(el => ({ value: el.value, checked: el.checked }));
    // Date/time
    profile.fromDate = document.getElementById("fromDate").value;
    profile.fromTime = document.getElementById("fromTime").value;
    profile.toDate = document.getElementById("toDate").value;
    profile.toTime = document.getElementById("toTime").value;
    // Metadata
    profile.metadata = document.getElementById("metadata").value;
    // Amount
    profile.amount = document.getElementById("amount").value;
    return profile;
}

// Build a profile object from current filters, filtered by which checkboxes are checked
function build_profile_from_checks() {
    const full = capture_current_filters();
    const profile = {};
    const checkMap = {
        profileCheckRuns: 'runs',
        profileCheckRunTags: 'runTags',
        profileCheckVersions: 'projectVersions',
        profileCheckFromDate: 'fromDate',
        profileCheckFromTime: 'fromTime',
        profileCheckToDate: 'toDate',
        profileCheckToTime: 'toTime',
        profileCheckMetadata: 'metadata',
        profileCheckAmount: 'amount',
    };
    for (const [checkId, keys] of Object.entries(checkMap)) {
        const el = document.getElementById(checkId);
        if (el && el.checked) {
            if (Array.isArray(keys)) {
                keys.forEach(k => profile[k] = full[k]);
            } else {
                profile[keys] = full[keys];
            }
        }
    }
    return profile;
}

// Compare two profile objects for equality (only keys present in the saved profile)
function profiles_match(saved, current) {
    for (const key of Object.keys(saved)) {
        const s = saved[key];
        const c = current[key];
        if (Array.isArray(s)) {
            if (!Array.isArray(c) || s.length !== c.length) return false;
            for (let i = 0; i < s.length; i++) {
                if (JSON.stringify(s[i]) !== JSON.stringify(c[i])) return false;
            }
        } else {
            if (String(s) !== String(c)) return false;
        }
    }
    return true;
}

// Find the name of a saved profile that exactly matches the current filters
function find_matching_profile() {
    const profiles = load_filter_profiles();
    const current = capture_current_filters();
    for (const [name, saved] of Object.entries(profiles)) {
        if (profiles_match(saved, current)) return name;
    }
    return null;
}

// Update the profile select display to reflect current state
function update_profile_select_display() {
    const selectEl = document.getElementById("selectFilterProfile");
    const selectInner = selectEl.querySelector("select");
    const dot = document.getElementById("profileModifiedDot");
    const updateBtn = document.getElementById("updateFilterProfile");

    const matchingName = find_matching_profile();

    if (matchingName) {
        // Current filters exactly match a saved profile
        activeProfileName = matchingName;
        selectInner.options[0].textContent = matchingName;
        dot.style.display = "none";
        updateBtn.style.display = "none";
    } else if (activeProfileName) {
        // A profile was applied but filters have since changed
        selectInner.options[0].textContent = activeProfileName;
        dot.style.display = "";
        updateBtn.style.display = "";
    } else {
        // No profile active
        selectInner.options[0].textContent = "Apply Filter Profile";
        dot.style.display = "none";
        updateBtn.style.display = "none";
    }
}

// Clear the active profile tracking
function clear_active_profile() {
    activeProfileName = null;
}

// Update the active profile with current filter values
function update_active_profile() {
    if (!activeProfileName) return;
    const profileData = capture_current_filters();
    // Only save the keys that were in the original profile
    const profiles = load_filter_profiles();
    const original = profiles[activeProfileName];
    if (!original) return;
    const updated = {};
    for (const key of Object.keys(original)) {
        updated[key] = profileData[key];
    }
    save_filter_profile_to_storage(activeProfileName, updated);
    update_profile_select_display();
}

// Apply a saved profile's filter values to the filter controls
function apply_filter_profile(profile, name) {
    if (name) activeProfileName = name;
    if (profile.runs !== undefined) {
        document.getElementById("runs").value = profile.runs;
    }

    if (profile.runTags !== undefined) {
        const tagInputs = document.getElementById("runTag").querySelectorAll("input.form-check-input");
        const tagMap = {};
        profile.runTags.forEach(t => tagMap[t.id] = t.checked);
        tagInputs.forEach(el => {
            tag=el.id.replace(/^runTagCheckBox/, "")
            if (tagMap[tag] !== undefined) el.checked = tagMap[tag];
        });
        update_filter_active_indicator("runTagCheckBoxAll", "filterRunTagSelectedIndicator");
    }
    if (profile.projectVersions !== undefined) {
        const versionInputs = document.getElementById("projectVersionList").querySelectorAll("input.form-check-input");
        const versionMap = {};
        profile.projectVersions.forEach(v => versionMap[v.value] = v.checked);
        versionInputs.forEach(el => {
            if (versionMap[el.value] !== undefined) el.checked = versionMap[el.value];
        });
        update_filter_active_indicator("projectVersionInputItemAll", "filterVersionSelectedIndicator");
    }
    if (profile.fromDate !== undefined) {
        document.getElementById("fromDate").value = profile.fromDate;
    }
    if (profile.fromTime !== undefined) {
        document.getElementById("fromTime").value = profile.fromTime;
    }
    if (profile.toDate !== undefined) {
        document.getElementById("toDate").value = profile.toDate;
    }
    if (profile.toTime !== undefined) {
        document.getElementById("toTime").value = profile.toTime;
    }
    if (profile.metadata !== undefined) {
        document.getElementById("metadata").value = profile.metadata;
    }
    if (profile.amount !== undefined) {
        document.getElementById("amount").value = profile.amount;
    }
}

// Load filter profiles from settings (cumulative — never deletes existing ones)
function load_filter_profiles() {
    return settings.filterProfiles || {};
}

// Save a filter profile to settings/localStorage (cumulative merge)
function save_filter_profile_to_storage(name, profileData) {
    const profiles = load_filter_profiles();
    profiles[name] = profileData;
    set_local_storage_item("filterProfiles", profiles);
}

// Delete a filter profile from settings/localStorage
function delete_filter_profile(name) {
    const profiles = load_filter_profiles();
    delete profiles[name];
    set_local_storage_item("filterProfiles", profiles);
}

// Populate the profile dropdown list from settings
function populate_filter_profile_select() {
    const list = document.getElementById("filterProfileList");
    const profiles = load_filter_profiles();
    list.innerHTML = '';
    const names = Object.keys(profiles).sort();
    if (names.length === 0) {
        list.innerHTML = '<li class="list-group-item small text-muted">No profiles saved</li>';
        return;
    }
    for (const name of names) {
        const li = document.createElement("li");
        li.className = "list-group-item list-group-item-action d-flex align-items-center small";
        li.innerHTML = `<span class="filter-profile-apply flex-grow-1" data-profile="${name}" id="profile${name}" style="cursor: pointer;">${name}</span>`
            + `<span class="filter-profile-delete ms-2" data-profile="${name}" id="profileCheck${name}" title="Delete profile" style="cursor: pointer;">&times;</span>`;
        list.appendChild(li);
    }
}

// Show the profile editor checkboxes and name input
function enter_profile_edit_mode() {
    document.getElementById("addFilterProfile").style.display = "none";
    document.getElementById("cancelFilterProfile").style.display = "";
    document.getElementById("filterProfileEditorInline").style.display = "";
    document.getElementById("filterProfileEditorInline").classList.add("d-flex");
    document.getElementById("filterProfileName").value = "";
    // Show all profile checkboxes
    document.querySelectorAll(".filter-profile-check").forEach(el => {
        el.style.display = "";
    });
    // Set each checkbox based on whether the corresponding filter currently differs from the default state
    const states = compute_profile_check_states();
    for (const [id, checked] of Object.entries(states)) {
        const el = document.getElementById(id);
        if (el) el.checked = checked;
    }
}

// Hide the profile editor checkboxes and name input
function exit_profile_edit_mode() {
    document.getElementById("cancelFilterProfile").style.display = "none";
    document.getElementById("addFilterProfile").style.display = "";
    document.getElementById("filterProfileEditorInline").style.display = "none";
    document.getElementById("filterProfileEditorInline").classList.remove("d-flex");
    document.querySelectorAll(".filter-profile-check").forEach(el => {
        el.style.display = "none";
    });
}

export {
    setup_filtered_data_and_filters,
    setup_run_amount_filter,
    setup_lowest_highest_dates,
    setup_metadata_filter,
    setup_runs_in_select_filter_buttons,
    setup_runtags_in_select_filter_buttons,
    setup_suites_in_suite_select,
    setup_suites_in_test_select,
    setup_tests_in_select,
    setup_testtags_in_select,
    setup_keywords_in_select,
    setup_project_versions_in_select_filter_buttons,
    setup_filter_checkbox_handler_listeners,
    update_overview_version_select_list,
    clear_all_filters,
    set_filter_show_current_version,
    generate_version_filter_list_item_html,
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
};