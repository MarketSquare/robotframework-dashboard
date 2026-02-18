import { filteredRuns, filteredSuites, filteredTests, filteredKeywords } from "../variables/globals.js";

// build table data for run table
function _get_run_table_data() {
    const data = [];
    for (const run of filteredRuns) {
        data.push([
            run.run_start,
            run.full_name,
            run.name,
            run.total,
            run.passed,
            run.failed,
            run.skipped,
            run.elapsed_s,
            run.start_time,
            run.project_version,
            run.tags,
            run.run_alias,
            run.metadata,
        ]);
    }
    return data;
}

// function to create run table in the run section
function create_run_table() {
    console.log("creating_run_table");
    if (runTable) { runTable.destroy(); }
    runTable = new DataTable("#runTable", {
        layout: {
            topStart: "info",
            bottomStart: null,
        },
        columns: [
            { title: "run" },
            { title: "full_name" },
            { title: "name" },
            { title: "total" },
            { title: "passed" },
            { title: "failed" },
            { title: "skipped" },
            { title: "elapsed_s" },
            { title: "start_time" },
            { title: "version" },
            { title: "tags" },
            { title: "alias" },
            { title: "metadata" },
        ],
        data: _get_run_table_data(),
    });
}

// build table data for suite table
function _get_suite_table_data() {
    const data = [];
    for (const suite of filteredSuites) {
        data.push([
            suite.run_start,
            suite.full_name,
            suite.name,
            suite.total,
            suite.passed,
            suite.failed,
            suite.skipped,
            suite.elapsed_s,
            suite.start_time,
            suite.run_alias,
            suite.id,
        ]);
    }
    return data;
}

// function to create suite table in the suite section
function create_suite_table() {
    console.log("creating_suite_table");
    if (suiteTable) { suiteTable.destroy(); }
    suiteTable = new DataTable("#suiteTable", {
        layout: {
            topStart: "info",
            bottomStart: null,
        },
        columns: [
            { title: "run" },
            { title: "full_name" },
            { title: "name" },
            { title: "total" },
            { title: "passed" },
            { title: "failed" },
            { title: "skipped" },
            { title: "elapsed_s" },
            { title: "start_time" },
            { title: "alias" },
            { title: "id" },
        ],
        data: _get_suite_table_data(),
    });
}

// build table data for test table
function _get_test_table_data() {
    const data = [];
    for (const test of filteredTests) {
        data.push([
            test.run_start,
            test.full_name,
            test.name,
            test.passed,
            test.failed,
            test.skipped,
            test.elapsed_s,
            test.start_time,
            test.message,
            test.tags,
            test.run_alias,
            test.id
        ]);
    }
    return data;
}

// function to create test table in the test section
function create_test_table() {
    console.log("creating_test_table");
    if (testTable) { testTable.destroy(); }
    testTable = new DataTable("#testTable", {
        layout: {
            topStart: "info",
            bottomStart: null,
        },
        columns: [
            { title: "run" },
            { title: "full_name" },
            { title: "name" },
            { title: "passed" },
            { title: "failed" },
            { title: "skipped" },
            { title: "elapsed_s" },
            { title: "start_time" },
            { title: "message" },
            { title: "tags" },
            { title: "alias" },
            { title: "id" },
        ],
        data: _get_test_table_data(),
    });
}

// build table data for keyword table
function _get_keyword_table_data() {
    const data = [];
    for (const keyword of filteredKeywords) {
        data.push([
            keyword.run_start,
            keyword.name,
            keyword.passed,
            keyword.failed,
            keyword.skipped,
            keyword.times_run,
            keyword.total_time_s,
            keyword.average_time_s,
            keyword.min_time_s,
            keyword.max_time_s,
            keyword.run_alias,
            keyword.owner,
        ]);
    }
    return data;
}

// function to create keyword table in the tables tab
function create_keyword_table() {
    console.log("creating_keyword_table");
    if (keywordTable) { keywordTable.destroy(); }
    keywordTable = new DataTable("#keywordTable", {
        layout: {
            topStart: "info",
            bottomStart: null,
        },
        columns: [
            { title: "run" },
            { title: "name" },
            { title: "passed" },
            { title: "failed" },
            { title: "skipped" },
            { title: "times_run" },
            { title: "total_execution_time" },
            { title: "average_execution_time" },
            { title: "min_execution_time" },
            { title: "max_execution_time" },
            { title: "alias" },
            { title: "owner" },
        ],
        data: _get_keyword_table_data(),
    });
}

// update function for run table - clears and redraws with new data
function update_run_table() {
    console.log("updating_run_table");
    if (!runTable) { create_run_table(); return; }
    runTable.clear();
    runTable.rows.add(_get_run_table_data());
    runTable.draw();
}

// update function for suite table - clears and redraws with new data
function update_suite_table() {
    console.log("updating_suite_table");
    if (!suiteTable) { create_suite_table(); return; }
    suiteTable.clear();
    suiteTable.rows.add(_get_suite_table_data());
    suiteTable.draw();
}

// update function for test table - clears and redraws with new data
function update_test_table() {
    console.log("updating_test_table");
    if (!testTable) { create_test_table(); return; }
    testTable.clear();
    testTable.rows.add(_get_test_table_data());
    testTable.draw();
}

// update function for keyword table - clears and redraws with new data
function update_keyword_table() {
    console.log("updating_keyword_table");
    if (!keywordTable) { create_keyword_table(); return; }
    keywordTable.clear();
    keywordTable.rows.add(_get_keyword_table_data());
    keywordTable.draw();
}

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