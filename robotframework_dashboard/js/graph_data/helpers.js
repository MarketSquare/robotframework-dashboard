import { settings, get_run_label } from "../variables/settings.js";
import { barConfig } from "../variables/chartconfig.js";
import { inFullscreen, filteredRuns } from "../variables/globals.js";
import { parse_test_tags } from "../common.js";

// helper function to more easily use the logic of filtering suite graph data based on the selected filters
// returns a function that returns true if a value should be excluded, false if it should be included
// the selected filters are read once here instead of once per value
function get_suite_data_exclusion(dataType) {
    if (dataType !== "suite") return () => false;
    const suiteSelectSuites = document.getElementById("suiteSelectSuites").value;
    const suiteSelectSuitesOptions = new Set([...document.getElementById("suiteSelectSuites").options].map(o => o.value));
    const suiteFolder = document.getElementById("suiteFolder").innerText;
    const isFolderAll = suiteFolder === "All";
    const isSuiteAll = suiteSelectSuites === "All Suites Separate" || suiteSelectSuites === "All Suites Combined";
    const usingSuitePaths = settings.switch.suitePathsSuiteSection;

    const folderMatches = (val) => val.full_name === suiteFolder || val.full_name.startsWith(`${suiteFolder}.`);
    const suiteNameMatches = (val) => suiteSelectSuitesOptions.has(val.name);
    const fullNameMatches = (val) => suiteSelectSuitesOptions.has(val.full_name);
    const selectedSuiteMismatch = (val) => usingSuitePaths
        ? val.full_name !== suiteSelectSuites
        : val.name !== suiteSelectSuites;

    if (isFolderAll && isSuiteAll) {
        // All folders, all suites: include all
        return () => false;
    }
    if (isFolderAll && !isSuiteAll) {
        // All folders, specific suite
        return selectedSuiteMismatch;
    }
    if (!isFolderAll && isSuiteAll) {
        // Specific folder, all suites
        return (value) => {
            if (!folderMatches(value)) return true;
            return usingSuitePaths
                ? !fullNameMatches(value)
                : !suiteNameMatches(value);
        };
    }
    // Specific folder, specific suite
    return (value) => !folderMatches(value) || selectedSuiteMismatch(value);
}

// function to group timeline rows by label and run_start in one pass
// returns Map(label -> Map(run_start -> [rows])), rows whose labels are not in labels are skipped
// the name a keyword has in the keyword section select: "Library.Keyword" when library names are shown
function get_keyword_select_key(keyword) {
    return settings?.switch?.useLibraryNames === true && keyword.owner
        ? `${keyword.owner}.${keyword.name}`
        : keyword.name;
}

// returns a predicate telling whether a test ({ name, full_name, tags }) matches the suite, test
// and tag selects of the test section; the selects are read once here instead of once per test
// whether a test belongs to the suite selected in the test section: the parent suite's name, or its
// full name with Use Suite Paths. A whole-name match, so suite "Cart" leaves out "Web.Cart Rules"
function is_test_in_suite(value, suite, usePaths) {
    if (suite === "All") return true;
    const expectedFull = `${suite}.${value.name}`;
    return usePaths
        ? value.full_name === expectedFull
        : value.full_name === expectedFull || value.full_name.endsWith(`.${expectedFull}`);
}

function get_test_section_predicate() {
    const suite = document.getElementById("suiteSelectTests")?.value || "All";
    const test = document.getElementById("testSelect")?.value || "All";
    const tag = document.getElementById("testTagsSelect")?.value || "All";
    const usePaths = settings.switch.suitePathsTestSection;
    return (value) => {
        if (!is_test_in_suite(value, suite, usePaths)) return false;
        if (test !== "All" && value.name !== test) return false;
        return tag === "All" || parse_test_tags(value.tags).includes(tag);
    };
}

function group_timeline_values(data, labels, get_labels) {
    const groups = new Map(labels.map(label => [label, new Map()]));
    for (const value of data) {
        for (const label of get_labels(value)) {
            const byRunStart = groups.get(label);
            if (!byRunStart) continue;
            if (!byRunStart.has(value.run_start)) byRunStart.set(value.run_start, []);
            byRunStart.get(value.run_start).push(value);
        }
    }
    return groups;
}

// one resize observer per graph: every config build calls update_height, and an observer per call
// would keep resizing the chart for every earlier build
const heightObservers = new Map();

// graphs key their runs on run_start, which is unique, and show this label: with run name labels many
// runs share a label, so a label can't tell them apart. Cached per filtered runs array
let runLabelsByRunStart = { runs: null, labels: new Map() };
function get_run_label_by_run_start(runStart) {
    if (runLabelsByRunStart.runs !== filteredRuns || runLabelsByRunStart.aliases !== settings.show.aliases) {
        runLabelsByRunStart = {
            runs: filteredRuns,
            aliases: settings.show.aliases,
            labels: new Map(filteredRuns.map(run => [run.run_start, get_run_label(run)])),
        };
    }
    return runLabelsByRunStart.labels.get(runStart) ?? runStart;
}

// function to update the height of the test statistics graph and enable scrolling
function update_height(verticalId, labels, graphType, internal = false) {
    const vertical = document.getElementById(verticalId);
    if (!internal) {
        const item = vertical.closest(".grid-stack-item");
        const current = heightObservers.get(verticalId);
        if (current && current.item !== item) {
            current.observer.disconnect();
            heightObservers.delete(verticalId);
        }
        if (item) { // if item is not hidden observe its size, with the label count of the latest build
            if (!heightObservers.has(verticalId)) {
                const entry = { item, labels, graphType };
                entry.observer = new ResizeObserver(() => {
                    update_height(verticalId, entry.labels, entry.graphType, true);
                    window[verticalId.replace("Vertical", "Graph")]?.resize();
                });
                entry.observer.observe(item);
                heightObservers.set(verticalId, entry);
            } else {
                Object.assign(heightObservers.get(verticalId), { labels, graphType });
            }
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
// one dataset per bar style (status colour, rerun or note border), not per item: Chart.js looks up
// the stack of every bar across all datasets, which makes a timeline with thousands of datasets slow.
// Every point keeps its own row in y.
function convert_timeline_data(oldDatasets) {
    const grouped = new Map();
    for (const dataset of oldDatasets) {
        const key = `${dataset.backgroundColor}|${dataset.borderColor}|${dataset.borderWidth ?? ""}`;
        if (!grouped.has(key)) {
            grouped.set(key, {
                data: [],
                backgroundColor: dataset.backgroundColor,
                borderColor: dataset.borderColor,
                ...(dataset.borderWidth !== undefined ? { borderWidth: Number(dataset.borderWidth) } : {}),
                ...barConfig,
                parsing: true
            });
        }
        for (const segment of dataset.data) {
            grouped.get(key).data.push({ x: segment.x, y: segment.y });
        }
    }
    return [...grouped.values()];
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
function truncate_message(message, max = 120) {
    const text = String(message ?? "");
    return text.length > max ? `${text.substring(0, max)}...` : text;
}

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
    get_suite_data_exclusion,
    get_keyword_select_key,
    get_test_section_predicate,
    is_test_in_suite,
    group_timeline_values,
    update_height,
    get_run_label_by_run_start,
    convert_timeline_data,
    parse_test_attempts,
    resolve_test_status,
    format_attempt_lines,
    truncate_message,
    count_attempt_flips,
    get_rerun_summary
};