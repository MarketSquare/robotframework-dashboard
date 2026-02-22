import { settings } from "../variables/settings.js";

import { passedConfig, failedConfig, skippedConfig } from "../variables/chartconfig.js";
import { convert_timeline_data } from "./helpers.js";

// function to prepare the data in the correct format for (recent) most flaky test graph
function get_most_flaky_data(dataType, graphType, filteredData, ignore, recent, limit) {
    var data = {};
    for (const value of filteredData) {
        if (ignore && value.skipped == 1) {
            continue;
        }
        const key = settings.switch.suitePathsTestSection ? value.full_name : value.name;
        if (data[key]) {
            data[key]["run_starts"].push(value.run_start);
            let current_status;
            if (value.passed == 1) {
                current_status = "passed";
            } else if (value.failed == 1) {
                current_status = "failed";
                data[key]["failed_run_starts"].push(value.run_start);
            } else if (!ignore) {
                if (value.skipped == 1) {
                    current_status = "skipped";
                    data[key]["failed_run_starts"].push(value.run_start);
                }
            }
            if (current_status !== data[key]["previous_status"]) {
                data[key]["flips"] += 1;
                data[key]["previous_status"] = current_status;
            }
        } else {
            let previous_status;
            data[key] = {
                "run_starts": [value.run_start],
                "flips": 0,
                "failed_run_starts": []
            };
            if (value.passed == 1) {
                previous_status = "passed";
            } else if (value.failed == 1) {
                previous_status = "failed";
                data[key]["failed_run_starts"].push(value.run_start);
            } else if (!ignore) {
                if (value.skipped == 1) {
                    previous_status = "skipped";
                    data[key]["failed_run_starts"].push(value.run_start);
                }
            }
            data[key]["previous_status"] = previous_status;
        }
    }
    var sortedData = [];
    for (var test in data) {
        if (data[test].flips > 0) {
            sortedData.push([test, data[test]]);
        }
    }
    sortedData.sort(function (a, b) {
        return b[1].flips - a[1].flips;
    });
    if (recent) { // do extra filtering to get most recent flaky tests at the top
        sortedData.sort(function (a, b) {
            return new Date(b[1].failed_run_starts[b[1].failed_run_starts.length - 1]).getTime() - new Date(a[1].failed_run_starts[a[1].failed_run_starts.length - 1]).getTime()
        })
    }

    if (graphType == "bar") {
        var [datasets, labels, count] = [[], [], 0];
        for (const key in sortedData) {
            if (count == limit) {
                break;
            }
            labels.push(sortedData[key][0]);
            datasets.push(sortedData[key][1].flips);
            count += 1;
        }
        const graphData = {
            labels,
            datasets: [{
                data: datasets,
                ...failedConfig,
            }],
        };
        return [graphData, data];
    } else if (graphType == "timeline") {
        var [labels, runStarts, count, run_aliases] = [[], [], 0, []];
        for (const key in sortedData) {
            if (count == limit) {
                break;
            }
            labels.push(sortedData[key][0]);
            for (const runStart of sortedData[key][1].run_starts) {
                if (!runStarts.includes(runStart)) {
                    runStarts.push(runStart);
                }
            }
            count += 1;
        }
        var datasets = [];
        var runAxis = 0;
        runStarts = runStarts.sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
        for (const runStart of runStarts) {
            for (const label of labels) {
                var foundValues = [];
                for (value of filteredData) {
                    const compareKey = settings.switch.suitePathsTestSection ? value.full_name : value.name;
                    if (compareKey == label && value.run_start == runStart) {
                        // if (value.name == label && value.run_start == runStart) {
                        foundValues.push(value);
                        if (!run_aliases.includes(value.run_alias)) { run_aliases.push(value.run_alias) }
                    }
                }
                if (foundValues.length > 0) {
                    var value = foundValues[0];
                    if (value.passed == 1) {
                        datasets.push({
                            label: label,
                            data: [{ x: [runAxis, runAxis + 1], y: label }],
                            ...passedConfig,
                        });
                    }
                    else if (value.failed == 1) {
                        datasets.push({
                            label: label,
                            data: [{ x: [runAxis, runAxis + 1], y: label }],
                            ...failedConfig,
                        });
                    }
                    else if (value.skipped == 1) {
                        datasets.push({
                            label: label,
                            data: [{ x: [runAxis, runAxis + 1], y: label }],
                            ...skippedConfig,
                        });
                    }
                }
            }
            runAxis += 1;
        }
        if (settings.show.aliases) { runStarts = run_aliases }
        datasets = convert_timeline_data(datasets)
        var graphData = {
            labels: labels,
            datasets: datasets,
        };
        return [graphData, runStarts];
    }
}

export {
    get_most_flaky_data
};