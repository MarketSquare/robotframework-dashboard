import { settings } from "../variables/settings.js";
import { barConfig } from "../variables/chartconfig.js";
import { inFullscreen}  from "../variables/globals.js";

// helper function to more easily use the logic of filtering suite graph data based on the selected filters
// returns true if the value should be excluded, false if it should be included
function exclude_from_suite_data(dataType, value) {
    if (dataType !== "suite") return false;
    const suiteSelectSuites = document.getElementById("suiteSelectSuites").value;
    const suiteSelectSuitesOptions = [...document.getElementById("suiteSelectSuites").options].map(o => o.value);
    const suiteFolder = document.getElementById("suiteFolder").innerText;
    const isFolderAll = suiteFolder === "All";
    const isSuiteAll = suiteSelectSuites === "All Suites Separate" || suiteSelectSuites === "All Suites Combined";
    const usingSuitePaths = settings.switch.suitePathsSuiteSection;

    const folderMatches = (val) => val.full_name === suiteFolder || val.full_name.startsWith(`${suiteFolder}.`);
    const suiteNameMatches = (val) => suiteSelectSuitesOptions.includes(val.name);
    const fullNameMatches = (val) => suiteSelectSuitesOptions.includes(val.full_name);

    if (isFolderAll && isSuiteAll) {
        // All folders, all suites: include all
        return false;
    }
    if (isFolderAll && !isSuiteAll) {
        // All folders, specific suite
        return usingSuitePaths
            ? value.full_name !== suiteSelectSuites
            : value.name !== suiteSelectSuites;
    }
    if (!isFolderAll && isSuiteAll) {
        // Specific folder, all suites
        if (!folderMatches(value)) return true;

        return usingSuitePaths
            ? !fullNameMatches(value)
            : !suiteNameMatches(value);
    }
    // Specific folder, specific suite
    if (!folderMatches(value)) return true;
    return usingSuitePaths
        ? value.full_name !== suiteSelectSuites
        : value.name !== suiteSelectSuites;
}

// function to update the height of the test statistics graph and enable scrolling
function update_height(verticalId, labels, graphType, internal = false) {
    const vertical = document.getElementById(verticalId);
    if (!internal) {
        if (vertical.closest(".grid-stack-item")) { // if item is not hidden add resize observer
            const observer = new ResizeObserver(entries => {
                for (let entry of entries) {
                    update_height(verticalId, labels, graphType, true);
                    window[verticalId.replace("Vertical", "Graph")].resize();
                }
            });
            observer.observe(vertical.closest(".grid-stack-item"));
        }
    }
    const fullscreen = vertical.closest(".grid-stack-item-content")
    if (!fullscreen) return; // return if item is hidden
    var baseHeight = parseFloat(getComputedStyle(fullscreen).height);
    if (inFullscreen) {
        baseHeight = baseHeight - 103;
    } else { // fix for not in fullscreen take off the svg row and padding
        baseHeight = baseHeight - 75;
    }
    vertical.style.height = `${baseHeight}px`;
    if (labels > 10 && graphType != "bar") {
        const newHeight = baseHeight + (labels - 10) * 35;
        if (inFullscreen && newHeight < baseHeight) {
            vertical.style.height = `${baseHeight}px`;
        } else {
            vertical.style.height = `${newHeight}px`;
        }
    } else {
        vertical.style.height = `${baseHeight}px`;
    }
}

// function to convert timeline data to improve performance
function convert_timeline_data(oldDatasets) {
    const grouped = {};
    for (const dataset of oldDatasets) {
        const segment = dataset.data[0]; // assumes 1 item per dataset
        const status = `${dataset.label}:*:&:.:${dataset.backgroundColor}:*:&:.:${dataset.borderColor}:*:&:.:${dataset.borderWidth ?? ""}`;
        if (!grouped[status]) {
            grouped[status] = [];
        }
        grouped[status].push({
            x: segment.x,
            y: segment.y,
        });
    }
    const data = Object.entries(grouped)
        .filter(([_, data]) => data.length > 0)
        .map(([status, data]) => {
            const [label, backgroundColor, borderColor, borderWidth] = status.split(":*:&:.:");
            return {
                label,
                data,
                backgroundColor,
                borderColor,
                ...(borderWidth !== "" ? { borderWidth: Number(borderWidth) } : {}),
                ...barConfig,
                parsing: true
            };
        });
    return data
}

// function to read the rerun attempt history that `rebot --merge` leaves on a test
// returns [{status, message}, ...] from the first attempt to the last, or [] when the test ran once
function parse_test_attempts(test) {
    if (!test.attempts) return [];
    try {
        const attempts = JSON.parse(test.attempts);
        return Array.isArray(attempts) ? attempts : [];
    } catch {
        return [];
    }
}

// function to pick the status a test is shown with, depending on the rerun view of the test statistics graph
// view "first" shows the first attempt, everything else the final (merged) result
function resolve_test_status(test, attempts, rerunView) {
    if (rerunView === "first" && attempts.length > 0) {
        return attempts[0].status;
    }
    return test.passed == 1 ? "PASS" : test.failed == 1 ? "FAIL" : "SKIP";
}

// function to count the status changes inside the attempt history of one test (FAIL -> PASS = 1 flip)
function count_attempt_flips(attempts) {
    let flips = 0;
    for (let index = 1; index < attempts.length; index++) {
        if (attempts[index].status !== attempts[index - 1].status) flips++;
    }
    return flips;
}

// function to summarise the rerun history of a list of tests
// reran: tests with an attempt history, recovered: failed at least once but passed in the end,
// failedAllAttempts: failed in every attempt
function get_rerun_summary(tests) {
    const summary = { reran: 0, recovered: 0, failedAllAttempts: 0 };
    for (const test of tests) {
        const attempts = parse_test_attempts(test);
        if (attempts.length === 0) continue;
        summary.reran++;
        const failedBefore = attempts.slice(0, -1).some(attempt => attempt.status === "FAIL");
        if (test.passed == 1 && failedBefore) summary.recovered++;
        if (attempts.every(attempt => attempt.status === "FAIL")) summary.failedAllAttempts++;
    }
    return summary;
}

// function to format the attempt history for a tooltip
function format_attempt_lines(attempts, maxMessageLength = 80) {
    if (!attempts || attempts.length === 0) return [];
    const lines = [`Attempts: ${attempts.map(attempt => attempt.status).join(" → ")}`];
    attempts.forEach((attempt, index) => {
        let line = `  ${index + 1}. ${attempt.status}`;
        if (attempt.message) {
            const message = attempt.message.length > maxMessageLength ? attempt.message.substring(0, maxMessageLength) + "..." : attempt.message;
            line += ` - ${message}`;
        }
        lines.push(line);
    });
    return lines;
}

export {
    exclude_from_suite_data,
    update_height,
    convert_timeline_data,
    parse_test_attempts,
    resolve_test_status,
    format_attempt_lines,
    count_attempt_flips,
    get_rerun_summary
};