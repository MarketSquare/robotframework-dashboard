import { settings } from './variables/settings.js';
import { compareRunIds } from './variables/graphs.js';
import { runs, suites, tests, keywords, unified_dashboard_title } from './variables/data.js';
import { show_loading_overlay, hide_loading_overlay } from './common.js';
import {
    filteredAmount,
    filteredRuns,
    filteredSuites,
    filteredTests,
    filteredKeywords,
    selectedRunSetting,
    selectedTagSetting
} from './variables/globals.js';

// function updates the data in the graphs whenever filters are updated
function setup_filtered_data_and_filters() {
    filteredRuns = remove_milliseconds(runs)
    filteredSuites = remove_milliseconds(suites)
    filteredTests = remove_milliseconds(tests)
    filteredKeywords = remove_milliseconds(keywords)
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

    return data.map(obj => ({
        ...obj,
        run_start: obj.run_start.slice(0, 19)
    }));
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
        .map(tagElement => tagElement.id);
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
        const runStart = new Date(run.run_start);
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
    const suiteFolder = document.getElementById("suiteFolder").innerText;
    suiteSelectSuites.innerHTML = "";
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
    suiteNames.forEach(suiteName => {
        suiteSelectSuites.options.add(new Option(suiteName, suiteName));
    });
    suiteSelectSuites.selectedIndex = 1;
}

// function to update the available suites to select in the test filters
function setup_suites_in_test_select() {
    const suiteSelectTests = document.getElementById("suiteSelectTests");
    suiteSelectTests.innerHTML = "";
    const suiteNames = settings.switch.suitePathsTestSection
        ? [...new Set(filteredSuites.map(suite => suite.full_name))].sort()
        : [...new Set(filteredSuites.map(suite => suite.name))].sort();
    suiteSelectTests.options.add(new Option("All", "All"));
    suiteNames.forEach(suiteName => {
        suiteSelectTests.options.add(new Option(suiteName, suiteName));
    });
    suiteSelectTests.selectedIndex = 1;
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
    testNames.forEach(testName => testSelect.options.add(new Option(testName, testName)));
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
    var dates = [];
    for (run of runs) {
        dates.push(new Date(run.run_start));
    }
    if (dates.length == 0) {
        document.getElementById("fromDate").value = "1900-01-01";
        document.getElementById("fromTime").value = "00:00";
        document.getElementById("toDate").value = "9999-12-31";
        document.getElementById("toTime").value = "23:59";
        return
    }
    var lowest = new Date(Math.min.apply(null, dates));
    var highest = new Date(Math.max.apply(null, dates));
    var tzoffset = new Date().getTimezoneOffset() * 60000;
    lowest = new Date(new Date(lowest - tzoffset).getTime() + -1 * 60000); // this is to account for seconds in the initial filter value
    highest = new Date(new Date(highest - tzoffset).getTime() + 1 * 60000); // this is to account for seconds in the initial filter value
    lowest.setTime(lowest.getTime() - 1 * 60 * 60 * 1000) // minus 1 hour to account for possible daylight saving time switches of 1 hour!
    highest.setTime(highest.getTime() + 1 * 60 * 60 * 1000) // plus 1 hour to account for possible daylight saving time switches of 1 hour!
    document.getElementById("fromDate").value = lowest.toISOString().split("T")[0];
    document.getElementById("fromTime").value = lowest.toISOString().split("T")[1].substring(0, 5);
    document.getElementById("toDate").value = highest.toISOString().split("T")[0];
    document.getElementById("toTime").value = highest.toISOString().split("T")[1].substring(0, 5);
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
            <input class="form-check-input me-1" type="checkbox" value="${value}" id="${value}">
            <label class="form-check-label ms-2" for="${value}">${value}</label>
        </li>
    `;
    const listItems = [listItemTemplate("All")].concat(
        Array.from(tags).map(tag => listItemTemplate(tag))
    ).join("");
    const tagsSelect = document.getElementById("runTag");
    tagsSelect.innerHTML = andOrTags + listItems;
    if (tags.size > 0) {
        document.getElementById("runTagFilter").hidden = false
    } else {
        document.getElementById("runTagFilter").hidden = true
    }
    const allRunTagsCheckBox = document.getElementById("All");
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
    generate_version_filter_list_item_html
};