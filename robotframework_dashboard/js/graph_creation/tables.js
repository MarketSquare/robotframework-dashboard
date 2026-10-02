import { filteredRuns, filteredSuites, filteredTests, filteredKeywords, filteredExceptions } from "../variables/globals.js";
import { parse_test_attempts } from "../graph_data/helpers.js";

function _get_run_table_data() {
    return filteredRuns.map(run => [
        run.run_start, run.full_name, run.name, run.total, run.passed, run.failed,
        run.skipped, run.elapsed_s, run.start_time, run.project_version, run.tags, run.run_alias, run.metadata,
        run.custom_filters ?? "",
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
        parse_test_attempts(test).map(attempt => attempt.status).join(" → "),
    ]);
}

function _get_keyword_table_data() {
    return filteredKeywords.map(keyword => [
        keyword.run_start, keyword.name, keyword.passed, keyword.failed, keyword.skipped,
        keyword.times_run, keyword.total_time_s, keyword.average_time_s, keyword.min_time_s,
        keyword.max_time_s, keyword.run_alias, keyword.owner,
    ]);
}

function _get_exception_table_data() {
    return filteredExceptions.map(exception => [
        exception.run_start, exception.message, exception.amount, exception.run_alias,
    ]);
}

// DataTables detects the type of a column by checking every cell on every update, which is slow
// for large tables, so the columns get the type it would detect. Only the version is left to the
// detection, because it can be numeric or free text depending on the project.
function run_start_column() { return { title: "run", type: "date" }; }
function number_column(title) { return { title, type: "num" }; }
function text_column(title, type = "string") { return { title, type }; }
const runColumns = [
    run_start_column(), text_column("full_name"), text_column("name"), number_column("total"),
    number_column("passed"), number_column("failed"), number_column("skipped"), number_column("elapsed_s"),
    text_column("start_time"), { title: "version" }, text_column("tags"), text_column("alias"), text_column("metadata"),
    text_column("custom_filters"),
];
const suiteColumns = [
    run_start_column(), text_column("full_name"), text_column("name"), number_column("total"),
    number_column("passed"), number_column("failed"), number_column("skipped"), number_column("elapsed_s"),
    text_column("start_time"), text_column("alias"), text_column("id"),
];
const testColumns = [
    run_start_column(), text_column("full_name"), text_column("name"),
    number_column("passed"), number_column("failed"), number_column("skipped"), number_column("elapsed_s"),
    text_column("start_time"), text_column("message", "html"), text_column("tags"), text_column("alias"), text_column("id"),
    text_column("attempts", "string-utf8"),
];
const keywordColumns = [
    run_start_column(), text_column("name"), number_column("passed"), number_column("failed"),
    number_column("skipped"), number_column("times_run"), number_column("total_execution_time"),
    number_column("average_execution_time"), number_column("min_execution_time"),
    number_column("max_execution_time"), text_column("alias"), text_column("owner"),
];
const exceptionColumns = [
    run_start_column(), text_column("message"), number_column("amount"), text_column("alias"),
];

function create_data_table(tableId, columns, getDataFn) {
    if (window[tableId]) window[tableId].destroy();
    window[tableId] = new DataTable(`#${tableId}`, {
        layout: { topStart: "info", bottomStart: null },
        columns,
        data: getDataFn(),
        scrollX: true,
        autoWidth: false,
    });
}
function create_run_table() { create_data_table("runTable", runColumns, _get_run_table_data); }
function create_suite_table() { create_data_table("suiteTable", suiteColumns, _get_suite_table_data); }
function create_test_table() { create_data_table("testTable", testColumns, _get_test_table_data); }
function create_keyword_table() { create_data_table("keywordTable", keywordColumns, _get_keyword_table_data); }
function create_exception_table() { create_data_table("exceptionTable", exceptionColumns, _get_exception_table_data); }

function update_data_table(tableId, columns, getDataFn) {
    if (!window[tableId]) { create_data_table(tableId, columns, getDataFn); return; }
    window[tableId].clear();
    window[tableId].rows.add(getDataFn());
    window[tableId].draw();
}
function update_run_table() { update_data_table("runTable", runColumns, _get_run_table_data); }
function update_suite_table() { update_data_table("suiteTable", suiteColumns, _get_suite_table_data); }
function update_test_table() { update_data_table("testTable", testColumns, _get_test_table_data); }
function update_keyword_table() { update_data_table("keywordTable", keywordColumns, _get_keyword_table_data); }
function update_exception_table() { update_data_table("exceptionTable", exceptionColumns, _get_exception_table_data); }

export {
    create_run_table,
    create_suite_table,
    create_test_table,
    create_keyword_table,
    create_exception_table,
    update_run_table,
    update_suite_table,
    update_test_table,
    update_keyword_table,
    update_exception_table
};