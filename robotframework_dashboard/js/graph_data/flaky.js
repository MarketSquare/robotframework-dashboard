import { settings, get_run_label } from "../variables/settings.js";
import { passedConfig, failedConfig, skippedConfig, rerunBorderColor, rerunBorderWidth } from "../variables/chartconfig.js";
import { convert_timeline_data, parse_test_attempts, resolve_test_status, count_attempt_flips } from "./helpers.js";
import { strip_tz_suffix } from "../common.js";

// function to prepare the data in the correct format for (recent) most flaky test graph
// with the rerun view of the test section (settings.switch.testRerunView) set to anything but "final",
// a status change inside the attempt history of a re-executed test (FAIL -> PASS on rerun) counts as a flip too
function get_most_flaky_data(dataType, graphType, filteredData, ignore, recent, limit) {
    const rerunView = settings.switch.testRerunView || "reruns";
    const useAttempts = rerunView !== "final";
    const status_of = (value) => {
        const attempts = useAttempts ? parse_test_attempts(value) : [];
        const status = resolve_test_status(value, attempts, rerunView);
        return [status === "PASS" ? "passed" : status === "FAIL" ? "failed" : "skipped", attempts];
    };
    var data = {};
    for (const value of filteredData) {
        if (ignore && value.skipped == 1) {
            continue;
        }
        const key = settings.switch.suitePathsTestSection ? value.full_name : value.name;
        const [current_status, attempts] = status_of(value);
        // a run in which any attempt failed counts as a failed run (recent sorting), also when the rerun passed
        const counts_as_failed = current_status === "failed" || (current_status === "skipped" && !ignore)
            || attempts.some(attempt => attempt.status === "FAIL");
        if (data[key]) {
            data[key]["run_starts"].push(value.run_start);
            if (counts_as_failed) {
                data[key]["failed_run_starts"].push(value.run_start);
            }
            if (current_status !== data[key]["previous_status"]) {
                data[key]["flips"] += 1;
                data[key]["previous_status"] = current_status;
            }
        } else {
            data[key] = {
                "run_starts": [value.run_start],
                "flips": 0,
                "failed_run_starts": counts_as_failed ? [value.run_start] : [],
                "previous_status": current_status,
            };
        }
        data[key]["flips"] += count_attempt_flips(attempts);
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
            return new Date(strip_tz_suffix(b[1].failed_run_starts[b[1].failed_run_starts.length - 1].replace(" ", "T"))).getTime() - new Date(strip_tz_suffix(a[1].failed_run_starts[a[1].failed_run_starts.length - 1].replace(" ", "T"))).getTime()
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
        var [labels, runStarts, count, run_labels] = [[], [], 0, []];
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
        const pointMeta = {};
        runStarts = runStarts.sort((a, b) => new Date(strip_tz_suffix(a)).getTime() - new Date(strip_tz_suffix(b)).getTime())
        for (const runStart of runStarts) {
            for (const label of labels) {
                var foundValues = [];
                for (value of filteredData) {
                    const compareKey = settings.switch.suitePathsTestSection ? value.full_name : value.name;
                    if (compareKey == label && value.run_start == runStart) {
                        // if (value.name == label && value.run_start == runStart) {
                        foundValues.push(value);
                        const runLabel = get_run_label(value);
                        if (!run_labels.includes(runLabel)) { run_labels.push(runLabel) }
                    }
                }
                if (foundValues.length > 0) {
                    var value = foundValues[0];
                    const [status, attempts] = status_of(value);
                    const statusName = status === "passed" ? "PASS" : status === "failed" ? "FAIL" : "SKIP";
                    pointMeta[`${label}::${runAxis}`] = {
                        status: statusName,
                        elapsed_s: value.elapsed_s || 0,
                        message: value.message || '',
                        attempts,
                    };
                    const config = status === "passed" ? passedConfig : status === "failed" ? failedConfig : skippedConfig;
                    const rerunConfig = attempts.length > 0 ? { borderColor: rerunBorderColor, borderWidth: rerunBorderWidth } : {};
                    datasets.push({
                        label: label,
                        data: [{ x: [runAxis, runAxis + 1], y: label }],
                        ...config,
                        ...rerunConfig,
                    });
                }
            }
            runAxis += 1;
        }
        if (settings.show.aliases === "alias" || settings.show.aliases === "run_name") { runStarts = run_labels }
        datasets = convert_timeline_data(datasets)
        var graphData = {
            labels: labels,
            datasets: datasets,
        };
        return [graphData, runStarts, pointMeta];
    }
}

export {
    get_most_flaky_data
};