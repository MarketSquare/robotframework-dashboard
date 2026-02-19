import { filteredRuns, filteredSuites, filteredTests, filteredKeywords } from "../variables/globals.js";

// Generic table factory functions
function create_data_table(tableId, columns, getDataFn) {
    console.log(`creating_${tableId}`);
    if (window[tableId]) window[tableId].destroy();
    window[tableId] = new DataTable(`#${tableId}`, {
        layout: { topStart: "info", bottomStart: null },
        columns,
        data: getDataFn(),
    });
}

function update_data_table(tableId, columns, getDataFn) {
    console.log(`updating_${tableId}`);
    if (!window[tableId]) { create_data_table(tableId, columns, getDataFn); return; }
    window[tableId].clear();
    window[tableId].rows.add(getDataFn());
    window[tableId].draw();
}

// data builder functions
function _get_run_table_data() {
    return filteredRuns.map(run => [
        run.run_start, run.full_name, run.name, run.total, run.passed, run.failed,
        run.skipped, run.elapsed_s, run.start_time, run.project_version, run.tags, run.run_alias, run.metadata,
    ]);
}

function _get_suite_table_data() {
    return filteredSuites.map(suite => [
        suite.run_start, suite.full_name, suite.name, suite.total, suite.passed, suite.failed,
        suite.skipped, suite.elapsed_s, suite.start_time, suite.run_alias, suite.id,
    ]);
}

function _get_test_table_data() {
    return filteredTests.map(test => [
        test.run_start, test.full_name, test.name, test.passed, test.failed, test.skipped,
        test.elapsed_s, test.start_time, test.message, test.tags, test.run_alias, test.id,
    ]);
}

function _get_keyword_table_data() {
    return filteredKeywords.map(keyword => [
        keyword.run_start, keyword.name, keyword.passed, keyword.failed, keyword.skipped,
        keyword.times_run, keyword.total_time_s, keyword.average_time_s, keyword.min_time_s,
        keyword.max_time_s, keyword.run_alias, keyword.owner,
    ]);
}

// column definitions
const runColumns = [
    { title: "run" }, { title: "full_name" }, { title: "name" }, { title: "total" },
    { title: "passed" }, { title: "failed" }, { title: "skipped" }, { title: "elapsed_s" },
    { title: "start_time" }, { title: "version" }, { title: "tags" }, { title: "alias" }, { title: "metadata" },
];
const suiteColumns = [
    { title: "run" }, { title: "full_name" }, { title: "name" }, { title: "total" },
    { title: "passed" }, { title: "failed" }, { title: "skipped" }, { title: "elapsed_s" },
    { title: "start_time" }, { title: "alias" }, { title: "id" },
];
const testColumns = [
    { title: "run" }, { title: "full_name" }, { title: "name" },
    { title: "passed" }, { title: "failed" }, { title: "skipped" }, { title: "elapsed_s" },
    { title: "start_time" }, { title: "message" }, { title: "tags" }, { title: "alias" }, { title: "id" },
];
const keywordColumns = [
    { title: "run" }, { title: "name" }, { title: "passed" }, { title: "failed" },
    { title: "skipped" }, { title: "times_run" }, { title: "total_execution_time" },
    { title: "average_execution_time" }, { title: "min_execution_time" },
    { title: "max_execution_time" }, { title: "alias" }, { title: "owner" },
];

// create/update functions
function create_run_table() { create_data_table("runTable", runColumns, _get_run_table_data); }
function create_suite_table() { create_data_table("suiteTable", suiteColumns, _get_suite_table_data); }
function create_test_table() { create_data_table("testTable", testColumns, _get_test_table_data); }
function create_keyword_table() { create_data_table("keywordTable", keywordColumns, _get_keyword_table_data); }

function update_run_table() { update_data_table("runTable", runColumns, _get_run_table_data); }
function update_suite_table() { update_data_table("suiteTable", suiteColumns, _get_suite_table_data); }
function update_test_table() { update_data_table("testTable", testColumns, _get_test_table_data); }
function update_keyword_table() { update_data_table("keywordTable", keywordColumns, _get_keyword_table_data); }

export {
    create_run_table,
    create_suite_table,
    create_test_table,
    create_keyword_table,
    update_run_table,
    update_suite_table,
    update_test_table,
    update_keyword_table
};