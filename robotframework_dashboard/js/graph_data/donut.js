import { settings, get_run_label } from "../variables/settings.js";
import { get_next_folder_level } from "../common.js";
import { onlyFailedFolders, previousFolder } from "../variables/globals.js";
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
    const latest = filteredData[filteredData.length - 1]
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

// shades of the fail colour for the failed folder donuts, cycled so neighbours always differ
const FAIL_FOLDER_SHADES = ["#ce3e01", "#b13601", "#992f01", "#7f2600"];

function assign_fail_colors(count) {
    return Array.from({ length: count }, (_, index) => FAIL_FOLDER_SHADES[index % FAIL_FOLDER_SHADES.length]);
}

// sums the suite counts per child folder of folder (per top level suite without a folder). The labels
// keep their first-seen order, which Object.keys would not for a numeric suite name.
function aggregate_by_folder(data, folder, include = () => true) {
    const labels = [];
    const totals = {};
    for (const value of data) {
        if (!include(value)) continue;
        let label;
        if (!folder) {
            label = value.full_name.split(".")[0];
        } else {
            if (!value.full_name.startsWith(folder + ".") && value.full_name != folder) continue;
            label = get_next_folder_level(folder, value.full_name);
        }
        if (!totals[label]) {
            labels.push(label);
            totals[label] = { total: 0, passed: 0, skipped: 0, failed: 0 };
        }
        const entry = totals[label];
        entry.total += value.total;
        entry.passed += value.passed;
        entry.skipped += value.skipped;
        entry.failed += value.failed;
    }
    return { labels, totals };
}

// function to prepare the data in the correct format for the last failed folders donut
function get_donut_folder_fail_graph_data(dataType, filteredData) {
    const lastRunStart = filteredData[filteredData.length - 1]?.run_start;
    const suiteFolder = document.getElementById("suiteFolder").innerText;
    const { labels, totals: callbackData } = aggregate_by_folder(filteredData, suiteFolder == "All" ? "" : suiteFolder,
        value => value.run_start == lastRunStart && value.failed != 0);
    const graphData = {
        labels: labels,
        datasets: [{
            data: labels.map(label => callbackData[label].failed),
            backgroundColor: assign_fail_colors(labels.length),
            hoverOffset: 4
        }]
    };
    return [graphData, callbackData];
}

// function to prepare the data in the correct format for folder donuts
function get_donut_folder_graph_data(dataType, filteredData, folder) {
    const { labels: folderLabels, totals: callbackData } = aggregate_by_folder(filteredData, folder);
    previousFolder = folder ? folder : "";
    const labels = folderLabels.filter(label => !onlyFailedFolders || callbackData[label].failed > 0);
    const data = labels.map(label => onlyFailedFolders ? callbackData[label].failed : callbackData[label].total);
    const dataset = onlyFailedFolders
        ? { data: data, backgroundColor: assign_fail_colors(labels.length), hoverOffset: 4 }
        : { data: data, hoverOffset: 4 };
    return [{ labels: labels, datasets: [dataset] }, callbackData];
}

export {
    get_donut_graph_data,
    get_donut_total_graph_data,
    get_donut_folder_graph_data,
    get_donut_folder_fail_graph_data,
    aggregate_by_folder,
    assign_fail_colors,
};