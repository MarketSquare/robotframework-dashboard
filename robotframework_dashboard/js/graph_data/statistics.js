import {
    failedBackgroundColor,
    failedBackgroundBorderColor,
    skippedBackgroundColor,
    skippedBackgroundBorderColor,
    passedBackgroundColor,
    passedBackgroundBorderColor,
    barConfig,
    lineConfig,
    passedConfig,
    failedConfig,
    skippedConfig
} from "../variables/chartconfig.js";
import { settings } from "../variables/settings.js";
import { convert_timeline_data, exclude_from_suite_data } from "./helpers.js";
import { compareRunIds } from "../variables/graphs.js";

// function to prepare the data in the correct format for statistics graphs
function get_statistics_graph_data(dataType, graphType, filteredData) {
    const suiteSelectSuitesCombined = document.getElementById("suiteSelectSuites").value === "All Suites Combined";
    const keywordSelect = document.getElementById("keywordSelect").value;
    const useLibraryNames = settings?.switch?.useLibraryNames === true;
    const rawPassed = [], rawFailed = [], rawSkipped = [], labels = [], aliases = [];
    let names = [];
    const process_value = (value) => {
        rawPassed.push(value.passed);
        rawFailed.push(value.failed);
        rawSkipped.push(value.skipped);
        labels.push(value.run_start);
        aliases.push(value.run_alias);
        names.push(value.name);
    };
    for (const value of filteredData) {
        if (exclude_from_suite_data(dataType, value)) continue;
        if (dataType === "keyword") {
            const keywordKey = useLibraryNames && value.owner
                ? `${value.owner}.${value.name}`
                : value.name;
            if (keywordKey !== keywordSelect) continue;
        }
        process_value(value);
    }
    const finalLabels = graphType !== "line" ? (settings.show.aliases ? aliases : labels) : labels;
    const styling = graphType !== "line" ? barConfig : lineConfig;
    let statisticsData = {
        labels: finalLabels,
        datasets: [
            {
                label: "Failed",
                data: rawFailed.slice(),
                backgroundColor: failedBackgroundColor,
                borderColor: failedBackgroundBorderColor,
                ...styling,
                stack: graphType === "percentages" || graphType === "amount" ? "Stack 0" : undefined,
            },
            {
                label: "Skipped",
                data: rawSkipped.slice(),
                backgroundColor: skippedBackgroundColor,
                borderColor: skippedBackgroundBorderColor,
                ...styling,
                stack: graphType === "percentages" || graphType === "amount" ? "Stack 0" : undefined,
            },
            {
                label: "Passed",
                data: rawPassed.slice(),
                backgroundColor: passedBackgroundColor,
                borderColor: passedBackgroundBorderColor,
                ...styling,
                stack: graphType === "percentages" || graphType === "amount" ? "Stack 0" : undefined,
            }
        ]
    };
    if (dataType === "suite" && suiteSelectSuitesCombined) {
        const bundled = {};
        const groupedLabels = [];
        const groupedData = Array(statisticsData.datasets.length).fill().map(() => []);

        statisticsData.labels.forEach((label, i) => {
            if (!(label in bundled)) {
                bundled[label] = groupedLabels.length;
                groupedLabels.push(label);
                statisticsData.datasets.forEach((_, d) => groupedData[d].push(0));
            }
            const idx = bundled[label];
            statisticsData.datasets.forEach((dataset, d) => {
                groupedData[d][idx] += dataset.data[i];
            });
        });
        statisticsData.datasets.forEach((dataset, i) => {
            dataset.data = groupedData[i];
        });
        statisticsData.labels = groupedLabels;
        names = Array(statisticsData.labels.length).fill("All Suites Combined");
    }
    if (graphType === "percentages") {
        const totalPoints = statisticsData.datasets[0].data.length;
        for (let i = 0; i < totalPoints; i++) {
            const passed = statisticsData.datasets[2].data[i];
            const failed = statisticsData.datasets[0].data[i];
            const skipped = statisticsData.datasets[1].data[i];
            const total = passed + failed + skipped;
            statisticsData.datasets[2].data[i] = total ? Math.round((passed / total) * 100) : 0;
            statisticsData.datasets[0].data[i] = total ? Math.round((failed / total) * 100) : 0;
            statisticsData.datasets[1].data[i] = total ? Math.round((skipped / total) * 100) : 0;
        }
    }
    return [statisticsData, names];
}

function _get_test_filters() {
    return {
        suiteSelectTests: document.getElementById("suiteSelectTests").value,
        testSelect: document.getElementById("testSelect").value,
        testTagsSelect: document.getElementById("testTagsSelect").value,
        testOnlyChanges: document.getElementById("testOnlyChanges").checked,
        testNoChanges: document.getElementById("testNoChanges").value,
        compareOnlyChanges: document.getElementById("compareOnlyChanges").checked,
        compareNoChanges: document.getElementById("compareNoChanges").value,
        selectedRuns: [...new Set(
            compareRunIds
                .map(id => document.getElementById(id).value)
                .filter(val => val !== "None")
        )],
    };
}

function _get_test_label(test) {
    if (settings.menu.dashboard) {
        return settings.switch.suitePathsTestSection ? test.full_name : test.name;
    } else if (settings.menu.compare) {
        return settings.switch.suitePathsCompareSection ? test.full_name : test.name;
    }
    return test.name;
}

function _should_skip_test(test, filters) {
    if (settings.menu.dashboard) {
        const testBaseName = test.name;
        if (filters.suiteSelectTests !== "All") {
            const expectedFull = `${filters.suiteSelectTests}.${testBaseName}`;
            const isMatch = settings.switch.suitePathsTestSection
                ? test.full_name === expectedFull
                : test.full_name.includes(`.${filters.suiteSelectTests}.${testBaseName}`) || test.full_name === expectedFull;
            if (!isMatch) return true;
        }
        if (filters.testSelect !== "All" && testBaseName !== filters.testSelect) return true;
        if (filters.testTagsSelect !== "All") {
            const tagList = test.tags.replace(/\[|\]/g, "").split(",");
            if (!tagList.includes(filters.testTagsSelect)) return true;
        }
    } else if (settings.menu.compare) {
        if (!(filters.selectedRuns.includes(test.run_start) || filters.selectedRuns.includes(test.run_alias))) return true;
    }
    return false;
}

function get_test_statistics_data(filteredTests) {
    const filters = _get_test_filters();
    const [runStarts, datasets] = [[], []];
    const testMetaMap = {};
    var labels = [];
    for (const test of filteredTests) {
        if (_should_skip_test(test, filters)) continue;
        const testLabel = _get_test_label(test);
        if (!labels.includes(testLabel)) {
            labels.push(testLabel);
        }
        const runId = settings.show.aliases ? test.run_alias : test.run_start;

        if (!runStarts.includes(runId)) {
            runStarts.push(runId);
        }
        const runAxis = runStarts.indexOf(runId);
        const statusName = test.passed == 1 ? "PASS" : test.failed == 1 ? "FAIL" : "SKIP";
        const config =
            test.passed == 1 ? passedConfig :
                test.failed == 1 ? failedConfig :
                    test.skipped == 1 ? skippedConfig : null;
        if (config) {
            datasets.push({
                label: testLabel,
                data: [{ x: [runAxis, runAxis + 1], y: testLabel }],
                ...config,
            });
        }
        testMetaMap[`${testLabel}::${runAxis}`] = {
            message: test.message || '',
            elapsed_s: test.elapsed_s || 0,
            status: statusName,
        };
    }
    let finalDatasets = convert_timeline_data(datasets);
    if ((filters.testOnlyChanges && filters.testNoChanges !== "All") || (filters.compareOnlyChanges && filters.compareNoChanges !== "All")) {
        // If both filters are set, return empty data, as nothing can match this
        return [{ labels: [], datasets: [] }, [], {}];
    }
    if (filters.testOnlyChanges || filters.compareOnlyChanges || filters.testNoChanges !== "All" || filters.compareNoChanges !== "All") {
        const countMap = {};
        for (const ds of finalDatasets) {
            countMap[ds.label] = (countMap[ds.label] || 0) + 1;
        }
        let labelsToKeep = new Set();
        if (filters.testOnlyChanges || filters.compareOnlyChanges) {
            // Only keep the tests that have more than 1 status change
            labelsToKeep = new Set(Object.keys(countMap).filter(label => countMap[label] > 1));
        } else if (filters.testNoChanges !== "All" || filters.compareNoChanges !== "All") {
            const countMap = {};
            for (const ds of finalDatasets) {
                countMap[ds.label] = (countMap[ds.label] || 0) + 1;
            }
            labelsToKeep = new Set(Object.keys(countMap).filter(label => {
                // Only keep tests that appear once (no status changes)
                if (countMap[label] !== 1) return false;
                // Find the dataset for this label to check its status
                const dataset = finalDatasets.find(ds => ds.label === label);
                if (!dataset) return false;
                // Check if the dataset's status matches testNoChanges
                const isPassedTest = dataset.backgroundColor === passedBackgroundColor;
                const isFailedTest = dataset.backgroundColor === failedBackgroundColor;
                const isSkippedTest = dataset.backgroundColor === skippedBackgroundColor;
                return (
                    (filters.testNoChanges === "Passed" && isPassedTest) ||
                    (filters.testNoChanges === "Failed" && isFailedTest) ||
                    (filters.testNoChanges === "Skipped" && isSkippedTest) ||
                    (filters.compareNoChanges === "Passed" && isPassedTest) ||
                    (filters.compareNoChanges === "Failed" && isFailedTest) ||
                    (filters.compareNoChanges === "Skipped" && isSkippedTest)
                );
            }));
        }
        finalDatasets = finalDatasets.filter(ds => labelsToKeep.has(ds.label));
        labels = labels.filter(label => labelsToKeep.has(label));
    }
    const graphData = {
        labels,
        datasets: finalDatasets,
    };
    return [graphData, runStarts, testMetaMap];
}

// function to prepare the data for scatter view of test statistics (timestamp-based x-axis, one row per test)
function get_test_statistics_line_data(filteredTests) {
    const filters = _get_test_filters();
    const testDataMap = new Map();

    for (const test of filteredTests) {
        if (_should_skip_test(test, filters)) continue;
        const testLabel = _get_test_label(test);
        const statusName = test.passed == 1 ? "Passed" : test.failed == 1 ? "Failed" : "Skipped";

        if (!testDataMap.has(testLabel)) {
            testDataMap.set(testLabel, []);
        }
        testDataMap.get(testLabel).push({
            x: new Date(test.start_time),
            message: test.message || "",
            status: statusName,
            runStart: test.run_start,
            runAlias: test.run_alias,
            elapsed: test.elapsed_s,
            testLabel: testLabel,
        });
    }

    // Apply "Only Changes" and "Status" filters
    if ((filters.testOnlyChanges && filters.testNoChanges !== "All") ||
        (filters.compareOnlyChanges && filters.compareNoChanges !== "All")) {
        return { datasets: [], labels: [] };
    }
    if (filters.testOnlyChanges || filters.compareOnlyChanges) {
        for (const [label, points] of testDataMap) {
            const statuses = new Set(points.map(p => p.status));
            if (statuses.size <= 1) testDataMap.delete(label);
        }
    } else if (filters.testNoChanges !== "All" || filters.compareNoChanges !== "All") {
        const noChanges = filters.testNoChanges !== "All" ? filters.testNoChanges : filters.compareNoChanges;
        for (const [label, points] of testDataMap) {
            const statuses = new Set(points.map(p => p.status));
            if (statuses.size !== 1 || !statuses.has(noChanges)) testDataMap.delete(label);
        }
    }

    // Assign each test a Y-axis row index
    const testLabels = [...testDataMap.keys()];
    const testIndexMap = {};
    testLabels.forEach((label, i) => { testIndexMap[label] = i; });

    // Build a single scatter dataset with all points, colored by status
    const allPoints = [];
    const allColors = [];
    const allBorderColors = [];
    const allMeta = [];

    for (const [testLabel, points] of testDataMap) {
        points.sort((a, b) => a.x.getTime() - b.x.getTime());
        const yIndex = testIndexMap[testLabel];
        for (const p of points) {
            allPoints.push({ x: p.x, y: yIndex });
            allColors.push(
                p.status === "Passed" ? passedBackgroundColor :
                p.status === "Failed" ? failedBackgroundColor :
                skippedBackgroundColor
            );
            allBorderColors.push(
                p.status === "Passed" ? passedBackgroundBorderColor :
                p.status === "Failed" ? failedBackgroundBorderColor :
                skippedBackgroundBorderColor
            );
            allMeta.push(p);
        }
    }

    const datasets = [{
        label: "Test Results",
        data: allPoints,
        pointBackgroundColor: allColors,
        pointBorderColor: allBorderColors,
        pointRadius: 6,
        pointHoverRadius: 9,
        showLine: false,
        _pointMeta: allMeta,
    }];

    return { datasets, labels: testLabels };
}

// function to get the compare statistics data
function get_compare_statistics_graph_data(filteredData) {
    const selectedRuns = [...new Set(
        compareRunIds
            .map(id => document.getElementById(id).value)
            .filter(val => val !== "None")
    )];
    const datasets = selectedRuns.map(runId => {
        const match = filteredData.find(d =>
            d.run_start === runId || d.run_alias === runId
        );
        return match ? {
            label: settings.show.aliases ? match.run_alias : match.run_start,
            data: [match.passed, match.failed, match.skipped],
            ...barConfig
        } : null;
    }).filter(Boolean);
    return {
        labels: ['Passed', 'Failed', 'Skipped'],
        datasets
    };
}

export {
    get_statistics_graph_data,
    get_test_statistics_data,
    get_test_statistics_line_data,
    get_compare_statistics_graph_data
};