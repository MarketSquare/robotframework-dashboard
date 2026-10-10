import { filteredTests, escape_html_for_merge } from "../variables/globals.js";
import { settings, get_run_label } from "../variables/settings.js";
import { get_test_section_predicate } from "../graph_data/helpers.js";
import { notesStore, get_raw_run_start, get_test_note, get_note_category } from "../notes/store.js";
import { note_search_text, note_cell_html } from "../notes/format.js";

// kept here instead of on window: window.testNotesTable is the table element (named access)
let testNotesDataTable = null;
// the note column renders its edit button from the source row, see tables.js
let testNotesRows = [];

// the failed tests and the tests with a note of the filtered runs, newest run first;
// follows the section filters like the most failed graphs
function get_test_notes_rows() {
    const source = settings.switch.sectionFiltersApplyTest ? filteredTests.filter(get_test_section_predicate()) : filteredTests;
    return source.filter(test => test.failed == 1 || get_test_note(notesStore, get_raw_run_start(test), test.full_name)).reverse();
}

function get_test_status(test) {
    return test.failed == 1 ? "FAIL" : test.skipped == 1 ? "SKIP" : "PASS";
}

function get_test_notes_table_data() {
    testNotesRows = get_test_notes_rows();
    return testNotesRows.map(test => [
        get_run_label(test),
        settings.switch.suitePathsTestSection ? test.full_name : test.name,
        get_test_status(test),
        test.message || "",
        note_search_text(get_test_note(notesStore, get_raw_run_start(test), test.full_name)),
    ]);
}

const testNotesColumns = [
    { title: "run", type: "string" },
    {
        title: "test", type: "string",
        render: (data, type, row, meta) => {
            const test = testNotesRows[meta.row];
            if (type !== "display" || !test) return data;
            return `<span title="${escape_html_for_merge(test.full_name)}">${escape_html_for_merge(data)}</span>`;
        },
    },
    { title: "status", type: "string" },
    {
        title: "message", type: "string",
        render: (data, type) => {
            if (type !== "display") return data;
            const short = data.length > 200 ? `${data.substring(0, 200)}...` : data;
            return `<span class="test-notes-message" title="${escape_html_for_merge(data)}">${escape_html_for_merge(short)}</span>`;
        },
    },
    {
        title: "note", type: "string",
        render: (data, type, row, meta) => {
            const test = testNotesRows[meta.row];
            if (type !== "display" || !test) return data;
            const runStart = get_raw_run_start(test);
            return note_cell_html(runStart, test.full_name, get_test_note(notesStore, runStart, test.full_name));
        },
    },
];

// "12 failures - 9 without note - Product bug 2 - Environment 1", the categories count every note shown
function update_test_notes_summary() {
    const summary = document.getElementById("testNotesSummary");
    if (!summary) return;
    const counts = new Map();
    let failures = 0;
    let failuresWithoutNote = 0;
    let withoutCategory = 0;
    for (const test of testNotesRows) {
        const note = get_test_note(notesStore, get_raw_run_start(test), test.full_name);
        if (test.failed == 1) failures++;
        if (!note) failuresWithoutNote++;
        else if (!note.category) withoutCategory++;
        else counts.set(note.category, (counts.get(note.category) ?? 0) + 1);
    }
    const parts = [
        `<span>${failures} failures</span>`,
        `<span>${failuresWithoutNote} without note</span>`,
    ];
    for (const [id, count] of counts) {
        const category = get_note_category(notesStore, id);
        if (!category) continue;
        parts.push(`<span class="note-summary-item"><span class="note-color-dot" style="--note-color: ${category.color}"></span>${escape_html_for_merge(category.name)} ${count}</span>`);
    }
    if (withoutCategory > 0) parts.push(`<span>No category ${withoutCategory}</span>`);
    summary.innerHTML = parts.join(`<span class="note-summary-separator">&middot;</span>`);
}

function create_test_notes_graph() {
    if (testNotesDataTable) {
        testNotesDataTable.destroy();
        testNotesDataTable = null;
    }
    if (!document.getElementById("testNotesTable")) return;
    testNotesDataTable = new DataTable("#testNotesTable", {
        layout: { topStart: "info", topEnd: "search", bottomStart: null },
        columns: testNotesColumns,
        data: get_test_notes_table_data(),
        order: [],
        pageLength: 10,
        lengthChange: false,
        autoWidth: false,
        language: { emptyTable: "No failed or noted tests in the filtered runs" },
    });
    update_test_notes_summary();
}

// the layout editor replaces the widget html, so a table on a removed element is created again
function update_test_notes_graph() {
    if (!testNotesDataTable || !document.body.contains(testNotesDataTable.table().node())) {
        create_test_notes_graph();
        return;
    }
    testNotesDataTable.clear();
    testNotesDataTable.rows.add(get_test_notes_table_data());
    testNotesDataTable.draw(false);
    update_test_notes_summary();
}

export {
    create_test_notes_graph,
    update_test_notes_graph,
};
