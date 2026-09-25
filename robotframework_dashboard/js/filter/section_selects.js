import { get_run_label, settings } from '../variables/settings.js';
import { compareRunIds } from '../variables/graphs.js';
import { set_local_storage_item } from '../localstorage.js';
import { filteredKeywords, filteredRuns, filteredSuites, filteredTests } from '../variables/globals.js';

// function to update the available runs in the selects
function setup_runs_in_compare_selects() {
    const selects = compareRunIds.map(id => document.getElementById(id));
    const items = filteredRuns.map(run => get_run_label(run));
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

    const keywordNames = [
        ...new Set(
            filteredKeywords.map(keyword =>
                useLibraryNames && keyword.owner
                    ? `${keyword.owner}.${keyword.name}`
                    : keyword.name
            )
        )
    ].sort();

    keywordNames.forEach(keywordName => {
        keywordSelect.options.add(new Option(keywordName, keywordName));
    });
    if (keywordNames.length > 0) {
        keywordSelect.selectedIndex = keywordNames.length - 1;
    }
}

export {
    setup_keywords_in_select,
    setup_runs_in_compare_selects,
    setup_suites_in_suite_select,
    setup_suites_in_test_select,
    setup_tests_in_select,
    setup_testtags_in_select,
};
