import { settings, get_run_label } from "../variables/settings.js";
import { get_next_folder_level } from "../common.js";
import { onlyFailedFolders } from "../variables/globals.js";
import {
    passedBackgroundColor,
    passedBackgroundBorderColor,
    failedBackgroundColor,
    failedBackgroundBorderColor,
    skippedBackgroundColor,
    skippedBackgroundBorderColor
} from "../variables/chartconfig.js";

// function to prepare the data in the correct format for last run donut graphs
function get_donut_graph_data(dataType, filteredData) {
    const latest = filteredData[Object.keys(filteredData)[Object.keys(filteredData).length - 1]]
    var labels = [];
    var datasets = [];
    var backgroundColors = [];
    var backgroundBorderColors = [];
    if (latest) {
        if (latest.passed > 0) {
            labels.push("Passed")
            datasets.push(latest.passed)
            backgroundColors.push(passedBackgroundColor)
            backgroundBorderColors.push(passedBackgroundBorderColor)
        }
        if (latest.failed > 0) {
            labels.push("Failed")
            datasets.push(latest.failed)
            backgroundColors.push(failedBackgroundColor)
            backgroundBorderColors.push(failedBackgroundBorderColor)
        }
        if (latest.skipped > 0) {
            labels.push("Skipped")
            datasets.push(latest.skipped)
            backgroundColors.push(skippedBackgroundColor)
            backgroundBorderColors.push(skippedBackgroundBorderColor)
        }
    }
    const graphData = {
        labels: labels,
        datasets: [{
            data: datasets,
            backgroundColor: backgroundColors,
            borderColor: backgroundBorderColors,
            hoverOffset: 4
        }]
    };
    const callBackData = latest ? get_run_label(latest) : ""
    return [graphData, callBackData]
}

// function to prepare the data in the correct format for duration graphs
function get_donut_total_graph_data(dataType, filteredData) {
    let passed = 0, failed = 0, skipped = 0;
    for (const value of filteredData) {
        if (value.passed > 0) {
            passed = passed + value.passed;
        }
        if (value.failed > 0) {
            failed = failed + value.failed;
        }
        if (value.skipped > 0) {
            skipped = skipped + value.skipped;
        }
    }
    var data = []
    var labels = []
    var backgroundColors = []
    var backgroundBorderColors = []
    if (passed > 0) {
        data.push(passed)
        labels.push("Passed")
        backgroundColors.push(passedBackgroundColor)
        backgroundBorderColors.push(passedBackgroundBorderColor)
    }
    if (failed > 0) {
        data.push(failed)
        labels.push("Failed")
        backgroundColors.push(failedBackgroundColor)
        backgroundBorderColors.push(failedBackgroundBorderColor)
    }
    if (skipped > 0) {
        data.push(skipped)
        labels.push("Skipped")
        backgroundColors.push(skippedBackgroundColor)
        backgroundBorderColors.push(skippedBackgroundBorderColor)
    }
    const graphData = {
        labels: labels,
        datasets: [{
            data: data,
            backgroundColor: backgroundColors,
            borderColor: backgroundBorderColors,
            hoverOffset: 4
        }]
    };
    const callBackData = labels
    return [graphData, callBackData]
}

// function to prepare the data in the correct format for the last failed folders donut
function get_donut_folder_fail_graph_data(dataType, filteredData) {
    var lastRunStart = filteredData[Object.keys(filteredData)[Object.keys(filteredData).length - 1]]
    if (lastRunStart) {
        lastRunStart = lastRunStart.run_start
    }
    const suiteFolder = document.getElementById("suiteFolder").innerText;
    var labels = new Set()
    const callbackData = {}
    const data = []
    for (const value of filteredData) {
        if (value.run_start != lastRunStart) { continue }
        if (value.failed == 0) { continue }
        if (suiteFolder == "All") {
            const label = value.full_name.split(".")[0]
            labels.add(label)
            if (!callbackData[label]) {
                callbackData[label] = {
                    total: value.total,
                    passed: value.passed,
                    skipped: value.skipped,
                    failed: value.failed
                };
            } else {
                callbackData[label].total += value.total;
                callbackData[label].passed += value.passed;
                callbackData[label].skipped += value.skipped;
                callbackData[label].failed += value.failed;
            }
        } else {
            if (!value.full_name.startsWith(suiteFolder + ".") && value.full_name != suiteFolder) { continue }
            const label = get_next_folder_level(suiteFolder, value.full_name)
            labels.add(label)
            if (!callbackData[label]) {
                callbackData[label] = {
                    total: value.total,
                    passed: value.passed,
                    skipped: value.skipped,
                    failed: value.failed
                };
            } else {
                callbackData[label].total += value.total;
                callbackData[label].passed += value.passed;
                callbackData[label].skipped += value.skipped;
                callbackData[label].failed += value.failed;
            }
        }
    }
    labels = [...labels]
    for (const label of labels) {
        data.push(callbackData[label].failed)
    }
    const redShades = [
        "#ce3e01", // base fail color
        "#b13601", // darker burnt orange
        "#992f01", // deep red-orange
        "#7f2600"  // very dark, almost brown-red
    ];
    function assignColors(intoCount) {
        const result = [];
        const colorCount = redShades.length;
        let index = 0;
        for (let i = 0; i < intoCount; i++) {
            result.push(redShades[index]);
            index = (index + 1) % colorCount;
            if (i > 0 && result[i] === result[i - 1]) { // Ensure no same color next to each other
                index = (index + 1) % colorCount;
                result[i] = redShades[index];
            }
        }
        return result;
    }
    const backgroundColor = assignColors(labels.length);
    const graphData = {
        labels: labels,
        datasets: [{
            data: data,
            backgroundColor: backgroundColor,
            hoverOffset: 4
        }]
    };
    return [graphData, callbackData];
}

// function to prepare the data in the correct format for folder donuts
function get_donut_folder_graph_data(dataType, filteredData, folder) {
    var labels = new Set()
    const callbackData = {}
    const data = []
    for (const value of filteredData) {
        if (!folder) {
            const label = value.full_name.split(".")[0]
            labels.add(label)
            if (!callbackData[label]) {
                callbackData[label] = {
                    total: value.total,
                    passed: value.passed,
                    skipped: value.skipped,
                    failed: value.failed
                };
            } else {
                callbackData[label].total += value.total;
                callbackData[label].passed += value.passed;
                callbackData[label].skipped += value.skipped;
                callbackData[label].failed += value.failed;
            }
        } else {
            if (!value.full_name.startsWith(folder + ".") && value.full_name != folder) { continue }
            const label = get_next_folder_level(folder, value.full_name)
            labels.add(label)
            if (!callbackData[label]) {
                callbackData[label] = {
                    total: value.total,
                    passed: value.passed,
                    skipped: value.skipped,
                    failed: value.failed
                };
            } else {
                callbackData[label].total += value.total;
                callbackData[label].passed += value.passed;
                callbackData[label].skipped += value.skipped;
                callbackData[label].failed += value.failed;
            }
        }
    }
    previousFolder = folder ? folder : "";
    labels = [...labels]
    const finalLabels = []
    for (const label of labels) {
        if (onlyFailedFolders) {
            if (callbackData[label].failed > 0) {
                finalLabels.push(label)
                data.push(callbackData[label].failed)
            }
        } else {
            finalLabels.push(label)
            data.push(callbackData[label].total)
        }
    }
    var graphData
    if (onlyFailedFolders) {
        const redShades = [
            "#ce3e01", // base fail color
            "#b13601", // darker burnt orange
            "#992f01", // deep red-orange
            "#7f2600"  // very dark, almost brown-red
        ];
        function assignColors(intoCount) {
            const result = [];
            const colorCount = redShades.length;
            let index = 0;
            for (let i = 0; i < intoCount; i++) {
                result.push(redShades[index]);
                index = (index + 1) % colorCount;
                if (i > 0 && result[i] === result[i - 1]) { // Ensure no same color next to each other
                    index = (index + 1) % colorCount;
                    result[i] = redShades[index];
                }
            }
            return result;
        }
        const backgroundColor = assignColors(finalLabels.length);
        graphData = {
            labels: finalLabels,
            datasets: [{
                data: data,
                backgroundColor: backgroundColor,
                hoverOffset: 4
            }]
        };
    } else {
        graphData = {
            labels: finalLabels,
            datasets: [{
                data: data,
                hoverOffset: 4
            }]
        };
    }
    return [graphData, callbackData]
}

export {
    get_donut_graph_data,
    get_donut_total_graph_data,
    get_donut_folder_graph_data,
    get_donut_folder_fail_graph_data
};