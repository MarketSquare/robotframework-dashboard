import { find_suite_run_starts, load_result_details, load_result_payloads } from "../data_loading.js";

// the input data, filled by load_data() which main() awaits before anything reads it
let runs = [];
let suites = [];
let tests = [];
let keywords = [];
let exceptions = [];
let data_load_scope = null;

const embedded_dashboard_data = {
    runs: "placeholder_runs",
    suites: "placeholder_suites",
    tests: "placeholder_tests",
    keywords: "placeholder_keywords",
    exceptions: "placeholder_exceptions",
};

async function load_data(options) {
    const result = await load_result_payloads(embedded_dashboard_data, options);
    ({ runs, suites, tests, keywords, exceptions } = result.data);
    // Run summaries are small. Keep the complete index so the existing filters can
    // select older results and other projects even when only some details are open.
    runs = result.allRuns;
    data_load_scope = result.scope;
    if (data_load_scope) filteredAmount = data_load_scope.runLimit;
    return data_load_scope;
}

let selectedResultsGeneration = 0;

async function load_selected_results(selectedRuns, on_progress) {
    const generation = ++selectedResultsGeneration;
    if (!data_load_scope) return;
    const starts = new Set(selectedRuns.map(run => run.raw_run_start ?? run.run_start));
    if ([...starts].every(start => data_load_scope.starts.has(start))) return;
    const data = await load_result_details(embedded_dashboard_data, starts, on_progress);
    if (generation !== selectedResultsGeneration) return;
    ({ suites, tests, keywords, exceptions } = data);
    data_load_scope = { ...data_load_scope, starts, loadedRuns: starts.size };
}

const suiteHistoryMatches = new Map();

async function find_history_suite_runs(path, on_progress) {
    if (!suiteHistoryMatches.has(path)) {
        suiteHistoryMatches.set(path, find_suite_run_starts(embedded_dashboard_data.suites, path, on_progress));
    }
    try {
        return await suiteHistoryMatches.get(path);
    } catch (error) {
        suiteHistoryMatches.delete(path);
        throw error;
    }
}

var unified_dashboard_title = '"placeholder_dashboard_title"'
var message_config = '"placeholder_message_config"'
var force_json_config = "placeholder_force_json_config"
var json_config = "placeholder_json_config"
var filteredAmount = "placeholder_amount"
var filteredAmountDefault = 0
const use_logs = "placeholder_use_logs"
const server = "placeholder_server"
const no_auto_update = "placeholder_no_autoupdate"
if (!message_config.includes("placeholder_message_config")) { message_config = JSON.parse(message_config) }

export {
    load_data,
    load_selected_results,
    find_history_suite_runs,
    data_load_scope,
    runs,
    suites,
    tests,
    keywords,
    exceptions,
    message_config,
    force_json_config,
    json_config,
    filteredAmount,
    filteredAmountDefault,
    use_logs,
    server,
    unified_dashboard_title,
    no_auto_update
};
