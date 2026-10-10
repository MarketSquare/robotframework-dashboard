import { settings, get_run_label } from "../variables/settings.js";
import { runs, tests, use_logs } from "../variables/data.js";
import { filteredRuns, gridEditMode, escape_html_for_merge } from "../variables/globals.js";
import { add_alert, update_graphs_with_loading } from "../common.js";
import { confirm_action } from "../eventlisteners/confirm_modal.js";
import {
    NOTE_MAX_LENGTH,
    NOTE_CATEGORY_COLORS,
    NOTES_STORAGE_WARNING_RATIO,
    notesStore,
    notesLoadError,
    notesEnabled,
    set_notes_enabled,
    get_raw_run_start,
    get_test_note,
    set_test_note,
    make_note,
    add_note_category,
    measure_storage_usage,
    load_notes,
    update_notes,
} from "./store.js";
import { get_chart_note_target } from "./chart_notes.js";
import {
    update_test_statistics_graph,
    update_test_most_flaky_graph,
    update_test_recent_most_flaky_graph,
    update_test_most_failed_graph,
    update_test_recent_most_failed_graph,
} from "../graph_creation/test.js";
import { update_compare_tests_graph } from "../graph_creation/compare.js";
import { update_test_table } from "../graph_creation/tables.js";
import { update_test_notes_graph } from "../graph_creation/notes.js";

let noteEditorTarget = null;
let noteMenuCanvas = null;
let notesStorageWarningDismissed = false;

function get_target_note(target) {
    return get_test_note(notesStore, target.run_start, target.full_name);
}

function set_target_note(store, target, note) {
    set_test_note(store, target.run_start, target.full_name, note);
}

// the label the graphs show for a stored run_start (converted timezone, alias or run name)
function get_note_run_label(runStart) {
    const run = filteredRuns.find(item => get_raw_run_start(item) === runStart) ?? runs.find(item => item.run_start === runStart);
    return run ? get_run_label(run) : runStart;
}

function get_note_test_message(runStart, fullName) {
    return tests.find(test => test.run_start === runStart && test.full_name === fullName)?.message ?? "";
}

// set while the notes modal is open: the page redraws once it is closed, like the filter and settings modals
let noteViewsStale = false;

function redraw_note_views() {
    noteViewsStale = false;
    const redraw = () => {
        if (settings.menu.dashboard) {
            update_test_statistics_graph();
            update_test_most_flaky_graph();
            update_test_recent_most_flaky_graph();
            update_test_most_failed_graph();
            update_test_recent_most_failed_graph();
            update_test_notes_graph();
        } else if (settings.menu.compare) {
            update_compare_tests_graph();
        } else if (settings.menu.tables) {
            update_test_table();
        }
    };
    if (settings.menu.dashboard) {
        update_graphs_with_loading(
            ["testStatisticsGraph", "testMostFlakyGraph", "testRecentMostFlakyGraph", "testMostFailedGraph", "testRecentMostFailedGraph", "testNotesTable"],
            redraw,
        );
    } else if (settings.menu.compare) {
        update_graphs_with_loading(["compareTestsGraph"], redraw);
    } else if (settings.menu.tables) {
        update_graphs_with_loading(["testTable"], redraw);
    }
}

// redraws what shows notes on the current page (deferred while the notes modal is open) and tells the notes modal to render again
function refresh_note_views() {
    if (document.getElementById("notesModal").classList.contains("show")) {
        noteViewsStale = true;
    } else {
        redraw_note_views();
    }
    update_notes_storage_warning();
    document.dispatchEvent(new CustomEvent("notes-changed"));
}

// returns true when the change was saved; a failed save is undone in the store and reported
function apply_notes_change(change) {
    const { error, result } = update_notes(change);
    if (error) {
        add_alert(escape_html_for_merge(error), "danger", 10000);
        return { saved: false, result };
    }
    refresh_note_views();
    return { saved: true, result };
}

function fill_note_editor_categories(selectedId) {
    const select = document.getElementById("noteEditorCategory");
    const options = [`<option value="">No category</option>`];
    for (const category of notesStore.categories) {
        options.push(`<option value="${escape_html_for_merge(category.id)}">${escape_html_for_merge(category.name)}</option>`);
    }
    select.innerHTML = options.join("");
    select.value = notesStore.categories.some(category => category.id === selectedId) ? selectedId : "";
}

function update_note_editor_count() {
    const text = document.getElementById("noteEditorText");
    document.getElementById("noteEditorCount").innerText = `${text.value.length} / ${NOTE_MAX_LENGTH}`;
}

function open_note_editor(target) {
    noteEditorTarget = {
        ...target,
        runLabel: target.runLabel ?? get_note_run_label(target.run_start),
        message: target.message ?? get_note_test_message(target.run_start, target.full_name),
    };
    const note = get_target_note(noteEditorTarget);
    const rows = [`<dt>Run</dt><dd>${escape_html_for_merge(noteEditorTarget.runLabel)}</dd>`];
    rows.push(`<dt>Test</dt><dd>${escape_html_for_merge(noteEditorTarget.full_name)}</dd>`);
    if (noteEditorTarget.message) {
        const message = noteEditorTarget.message;
        const short = message.length > 300 ? `${message.substring(0, 300)}...` : message;
        rows.push(`<dt>Message</dt><dd class="note-editor-message">${escape_html_for_merge(short)}</dd>`);
    }
    document.getElementById("noteEditorTarget").innerHTML = rows.join("");
    document.getElementById("noteEditorModalLabel").innerText = `${note ? "Edit" : "Add"} Note`;
    fill_note_editor_categories(note?.category ?? "");
    document.getElementById("noteEditorText").value = note?.text ?? "";
    document.getElementById("noteEditorDelete").hidden = !note;
    document.getElementById("noteEditorNewCategory").hidden = true;
    update_note_editor_count();
    // opened from the notes modal: that one stays open below, dimmed like under the confirm dialog
    document.getElementById("notesModal").classList.toggle("dimmed", document.getElementById("notesModal").classList.contains("show"));
    bootstrap.Modal.getOrCreateInstance(document.getElementById("noteEditorModal")).show();
}

function close_note_editor() {
    bootstrap.Modal.getOrCreateInstance(document.getElementById("noteEditorModal")).hide();
}

function save_note_from_editor(closeModal = true) {
    if (!noteEditorTarget) return true;
    const target = noteEditorTarget;
    const note = make_note(document.getElementById("noteEditorText").value, document.getElementById("noteEditorCategory").value);
    const { saved } = apply_notes_change(store => set_target_note(store, target, note));
    if (saved) {
        noteEditorTarget = null;
        if (closeModal) close_note_editor();
    }
    return saved;
}

function delete_note_from_editor() {
    if (!noteEditorTarget) return;
    const target = noteEditorTarget;
    const { saved } = apply_notes_change(store => set_target_note(store, target, null));
    if (saved) {
        noteEditorTarget = null;
        close_note_editor();
    }
}

function add_category_from_editor() {
    const nameInput = document.getElementById("noteEditorNewCategoryName");
    const color = document.getElementById("noteEditorNewCategoryColor").value;
    const { saved, result } = apply_notes_change(store => add_note_category(store, nameInput.value, color));
    if (!saved) return;
    if (!result) {
        add_alert("A category needs a name that is not used yet.", "warning");
        return;
    }
    fill_note_editor_categories(result.id);
    nameInput.value = "";
    document.getElementById("noteEditorNewCategory").hidden = true;
}

function setup_note_editor() {
    const modal = document.getElementById("noteEditorModal");
    const text = document.getElementById("noteEditorText");
    text.maxLength = NOTE_MAX_LENGTH;
    text.addEventListener("input", update_note_editor_count);
    text.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            save_note_from_editor();
        }
    });
    document.getElementById("noteEditorSave").addEventListener("click", save_note_from_editor);
    document.getElementById("noteEditorDelete").addEventListener("click", delete_note_from_editor);
    modal.addEventListener("hide.bs.modal", (event) => {
        if (noteEditorTarget && !save_note_from_editor(false)) event.preventDefault();
    });
    document.getElementById("noteEditorShowNewCategory").addEventListener("click", () => {
        const newCategory = document.getElementById("noteEditorNewCategory");
        newCategory.hidden = !newCategory.hidden;
        if (!newCategory.hidden) {
            document.getElementById("noteEditorNewCategoryColor").value = NOTE_CATEGORY_COLORS[notesStore.categories.length % NOTE_CATEGORY_COLORS.length];
            document.getElementById("noteEditorNewCategoryName").focus();
        }
    });
    document.getElementById("noteEditorAddCategory").addEventListener("click", add_category_from_editor);
    document.getElementById("noteEditorNewCategoryName").addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            add_category_from_editor();
        }
    });
    document.getElementById("notesModal").addEventListener("hidden.bs.modal", () => {
        if (noteViewsStale) redraw_note_views();
    });
    modal.addEventListener("shown.bs.modal", () => text.focus());
    modal.addEventListener("hidden.bs.modal", () => {
        noteEditorTarget = null;
        document.getElementById("notesModal").classList.remove("dimmed");
    });
    // the pencil buttons in the tables and the notes widget are rendered on every redraw
    document.addEventListener("click", (event) => {
        const button = event.target.closest?.(".note-edit-button");
        if (!button) return;
        open_note_editor({
            run_start: button.dataset.noteRunStart,
            full_name: button.dataset.noteFullName,
        });
    });
}

function hide_note_context_menu() {
    document.getElementById("noteContextMenu")?.remove();
    if (noteMenuCanvas) noteMenuCanvas.style.pointerEvents = "";
    noteMenuCanvas = null;
}

function delete_note_with_confirmation(target) {
    apply_notes_change(store => set_target_note(store, target, null));
}

function show_note_context_menu(event, target, chart, elements) {
    hide_note_context_menu();
    // Hide the tooltip without redrawing the chart: chart.update() is slow on large graphs and replays the last
    // mouse move, which reopens the tooltip over the menu. Only clear the active elements and drop the opacity.
    if (chart.tooltip) {
        chart.tooltip.setActiveElements([], { x: 0, y: 0 });
        chart.tooltip.opacity = 0;
    }
    noteMenuCanvas = chart.canvas;
    noteMenuCanvas.style.pointerEvents = "none";
    const note = get_target_note(target);
    const title = `${target.full_name} (${target.runLabel})`;
    const options = [["edit", note ? "Edit note" : "Add note"]];
    if (note) options.push(["delete", "Delete note"]);
    if (use_logs && typeof chart.options.onClick === "function") options.push(["log", "Open log"]);
    // a plain option list, like the list of a select
    const menu = document.createElement("div");
    menu.id = "noteContextMenu";
    menu.className = "note-context-menu";
    menu.setAttribute("role", "listbox");
    menu.title = title;
    menu.innerHTML = options
        .map(([action, label]) => `<button type="button" class="note-context-option" role="option" data-note-action="${action}">${label}</button>`)
        .join("");
    document.body.appendChild(menu);
    const left = Math.min(event.clientX, window.innerWidth - menu.offsetWidth - 8);
    const top = Math.min(event.clientY, window.innerHeight - menu.offsetHeight - 8);
    menu.style.left = `${Math.max(left, 8)}px`;
    menu.style.top = `${Math.max(top, 8)}px`;
    menu.addEventListener("keydown", (keyEvent) => {
        const buttons = [...menu.querySelectorAll(".note-context-option")];
        const index = buttons.indexOf(document.activeElement);
        if (keyEvent.key === "ArrowDown" || keyEvent.key === "ArrowUp") {
            keyEvent.preventDefault();
            const step = keyEvent.key === "ArrowDown" ? 1 : -1;
            buttons[(index + step + buttons.length) % buttons.length].focus();
        } else if (keyEvent.key === "Tab") {
            hide_note_context_menu();
        }
    });
    menu.addEventListener("click", (clickEvent) => {
        const action = clickEvent.target.closest("[data-note-action]")?.dataset.noteAction;
        if (!action) return;
        hide_note_context_menu();
        if (action === "edit") open_note_editor(target);
        else if (action === "delete") delete_note_with_confirmation(target);
        else if (action === "log") chart.options.onClick({ type: "click", chart, native: event }, elements, chart);
    });
    menu.querySelector(".note-context-option").focus();
}

// right-clicking a point of a graph that set a note target (notes/chart_notes.js) opens the notes menu,
// anywhere else the browser menu stays; the left click keeps opening the log
function setup_note_context_menu() {
    document.addEventListener("contextmenu", (event) => {
        hide_note_context_menu();
        const canvas = event.target;
        if (!notesEnabled || !(canvas instanceof HTMLCanvasElement) || gridEditMode) return;
        const resolve_target = get_chart_note_target(canvas.id);
        const chart = resolve_target ? Chart.getChart(canvas) : null;
        if (!chart) return;
        const elements = chart.getElementsAtEventForMode(event, "nearest", { intersect: true }, true);
        if (elements.length === 0) return;
        const target = resolve_target(chart, elements);
        if (!target) return;
        event.preventDefault();
        show_note_context_menu(event, target, chart, elements);
    });
    document.addEventListener("pointerdown", (event) => {
        if (!event.target.closest?.("#noteContextMenu")) hide_note_context_menu();
    });
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") hide_note_context_menu();
    });
    window.addEventListener("scroll", hide_note_context_menu, true);
    window.addEventListener("resize", hide_note_context_menu);
    window.addEventListener("blur", hide_note_context_menu);
}

function format_storage_size(characters) {
    if (characters < 100000) return `${Math.ceil(characters / 1000)} KB`;
    return `${(characters / 1000000).toFixed(1)} MB`;
}

function get_notes_storage_usage() {
    try {
        return measure_storage_usage(localStorage);
    } catch {
        return null;
    }
}

// shown on every page while the storage is nearly full, dismissing it lasts until the next reload
function update_notes_storage_warning() {
    const banner = document.getElementById("notesStorageWarning");
    const usage = get_notes_storage_usage();
    const show = notesEnabled && !!usage && usage.ratio >= NOTES_STORAGE_WARNING_RATIO && !notesStorageWarningDismissed;
    banner.hidden = !show;
    if (!show) return;
    document.getElementById("notesStorageWarningText").innerText =
        `The browser storage for this dashboard is ${Math.round(usage.ratio * 100)}% full ` +
        `(${format_storage_size(usage.total)} of about ${format_storage_size(usage.limit)}, notes use ${format_storage_size(usage.notes)}). ` +
        `When it is full, notes and settings can no longer be saved. Export and remove notes you no longer need.`;
}

function setup_notes_storage_warning() {
    document.getElementById("notesStorageWarningClose").addEventListener("click", () => {
        notesStorageWarningDismissed = true;
        update_notes_storage_warning();
    });
    document.getElementById("notesStorageWarningOpen").addEventListener("click", () => {
        bootstrap.Modal.getOrCreateInstance(document.getElementById("notesModal")).show();
    });
    update_notes_storage_warning();
}

// notes are opt-in (settings.show.notes): the menu icon, the right-click menu, the tooltips, the markers,
// the Test Notes widget and the note column only exist while they are enabled
function apply_notes_enabled() {
    set_notes_enabled(settings.show.notes === true);
    document.getElementById("notesNavItem").hidden = !notesEnabled;
    if (!notesEnabled) hide_note_context_menu();
    update_notes_storage_warning();
}

// loads the notes before the first graphs are drawn, they read the notes while building
function setup_notes() {
    load_notes();
    set_notes_enabled(settings.show.notes === true);
    document.getElementById("notesNavItem").hidden = !notesEnabled;
    setup_note_editor();
    setup_note_context_menu();
    setup_notes_storage_warning();
    if (notesLoadError && notesEnabled) {
        add_alert(`The stored notes could not be read: ${escape_html_for_merge(notesLoadError)}. Open the Notes modal to reset them.`, "danger", 15000);
    }
}

export {
    setup_notes,
    apply_notes_enabled,
    open_note_editor,
    apply_notes_change,
    get_note_run_label,
    format_storage_size,
    get_notes_storage_usage,
    update_notes_storage_warning,
};
