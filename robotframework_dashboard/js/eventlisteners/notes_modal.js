import { runs, tests } from "../variables/data.js";
import { escape_html_for_merge } from "../variables/globals.js";
import { add_alert } from "../common.js";
import { pencilSVG } from "../variables/svg.js";
import { confirm_action } from "./confirm_modal.js";
import {
    NOTE_CATEGORY_NAME_MAX_LENGTH,
    NOTE_CATEGORY_COLORS,
    notesStore,
    notesLoadError,
    sanitize_notes_store,
    list_notes,
    remove_note_entries,
    find_unmatched_notes,
    get_note_category,
    add_note_category,
    update_note_category,
    remove_note_category,
    count_notes_with_category,
    merge_notes_stores,
    reset_notes_storage,
} from "../notes/store.js";
import { linkify_note_text, note_category_badge_html } from "../notes/format.js";
import {
    open_note_editor,
    apply_notes_change,
    get_note_run_label,
    format_storage_size,
    get_notes_storage_usage,
    update_notes_storage_warning,
} from "../notes/ui.js";

// the notes in the order they are listed, the buttons and checkboxes refer to them by index
let listedNoteEntries = [];
let unmatchedNoteEntries = [];

function note_entry_key(entry) {
    return `${entry.run_start}\u0000${entry.full_name}`;
}

function format_note_count(count) {
    return `${count} note${count === 1 ? "" : "s"}`;
}

function format_note_updated(updated) {
    const date = new Date(updated);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

function note_entry_cells(entry, runLabel) {
    const category = get_note_category(notesStore, entry.note.category);
    return `<td>${escape_html_for_merge(runLabel)}</td>
            <td class="notes-table-name">${escape_html_for_merge(entry.full_name)}</td>
            <td>${note_category_badge_html(category)}</td>
            <td class="notes-table-text">${linkify_note_text(entry.note.text)}</td>
            <td class="text-nowrap">${escape_html_for_merge(format_note_updated(entry.note.updated))}</td>`;
}

function by_newest_note(first, second) {
    return second.note.updated.localeCompare(first.note.updated);
}

function render_notes_list(matched) {
    const container = document.getElementById("notesList");
    listedNoteEntries = [];
    const toggle = document.getElementById("notesListUpdateToggle");
    const bulkActions = document.getElementById("notesListBulkActions");
    const updateMode = toggle.getAttribute("aria-pressed") === "true";
    if (matched.length === 0) {
        container.innerHTML = `<p class="text-muted small mb-0">No notes in this dashboard yet. Right-click a test in a graph, or use the pencil in the Test Notes widget or the tables.</p>`;
        bulkActions.hidden = true;
        toggle.setAttribute("aria-pressed", "false");
        return;
    }
    listedNoteEntries = matched.sort(by_newest_note);
    const rows = listedNoteEntries.map((entry, index) => `<tr>
            ${updateMode ? `<td><input class="form-check-input" type="checkbox" data-notes-select-index="${index}" aria-label="Select note"></td>` : ""}
            ${note_entry_cells(entry, get_note_run_label(entry.run_start))}
            <td class="text-nowrap">
                <button type="button" class="btn btn-sm note-list-edit-button" data-notes-action="edit" data-notes-index="${index}" title="Edit note" aria-label="Edit note">${pencilSVG("currentColor")}</button>
            </td>
        </tr>`).join("");
    const head = updateMode ? `<th></th>` : "";
    container.innerHTML = `<div class="notes-table-wrapper"><table class="table table-sm notes-table" id="notesListTable">
            <thead><tr>${head}<th>Run</th><th>Test</th><th>Category</th><th>Note</th><th>Updated</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
        </table></div>`;
    bulkActions.hidden = !updateMode;
}

function render_unmatched_notes(unmatched) {
    unmatchedNoteEntries = unmatched.sort(by_newest_note);
    const container = document.getElementById("notesUnmatchedList");
    document.getElementById("deleteSelectedUnmatchedNotes").disabled = unmatched.length === 0;
    document.getElementById("deleteAllUnmatchedNotes").disabled = unmatched.length === 0;
    if (unmatched.length === 0) {
        container.innerHTML = `<p class="text-muted small mb-0">Every stored note belongs to a run or test in this dashboard.</p>`;
        return;
    }
    const rows = unmatchedNoteEntries.map((entry, index) => `<tr>
            <td><input class="form-check-input" type="checkbox" data-unmatched-index="${index}" aria-label="Select note"></td>
            ${note_entry_cells(entry, entry.run_start)}
        </tr>`).join("");
    container.innerHTML = `<div class="notes-table-wrapper"><table class="table table-sm notes-table" id="notesUnmatchedTable">
            <thead><tr><th></th><th>Run</th><th>Test</th><th>Category</th><th>Note</th><th>Updated</th></tr></thead>
            <tbody>${rows}</tbody>
        </table></div>`;
}

function render_note_categories() {
    const container = document.getElementById("noteCategoriesList");
    if (notesStore.categories.length === 0) {
        container.innerHTML = `<p class="text-muted small mb-0">No categories yet.</p>`;
        return;
    }
    container.innerHTML = notesStore.categories.map(category => `<div class="row g-2 align-items-center mb-2 note-category-row" data-category-id="${escape_html_for_merge(category.id)}">
            <div class="col">
                <input class="form-control form-control-sm" type="text" maxlength="${NOTE_CATEGORY_NAME_MAX_LENGTH}"
                    value="${escape_html_for_merge(category.name)}" data-category-field="name" aria-label="Category name">
            </div>
            <div class="col-auto">
                <input class="form-control form-control-sm form-control-color" type="color" value="${category.color}"
                    data-category-field="color" aria-label="Category color">
            </div>
            <div class="col-auto small text-muted">${format_note_count(count_notes_with_category(notesStore, category.id))}</div>
            <div class="col-auto">
                <button type="button" class="btn btn-sm btn-outline-light" data-category-action="delete">Delete</button>
            </div>
        </div>`).join("");
}

function render_notes_storage_usage() {
    const usage = get_notes_storage_usage();
    const text = document.getElementById("notesStorageUsageText");
    const bar = document.getElementById("notesStorageUsageBar");
    if (!usage) {
        text.innerText = "not available";
        bar.style.width = "0%";
        return;
    }
    const percent = Math.min(100, Math.round(usage.ratio * 100));
    text.innerText = `${format_storage_size(usage.total)} of about ${format_storage_size(usage.limit)} (${percent}%), notes ${format_storage_size(usage.notes)}`;
    bar.style.width = `${percent}%`;
    bar.classList.toggle("bg-warning", usage.ratio >= 0.8 && usage.ratio < 0.95);
    bar.classList.toggle("bg-danger", usage.ratio >= 0.95);
}

function render_notes_modal() {
    document.getElementById("notesLoadError").hidden = !notesLoadError;
    document.getElementById("notesLoadErrorMessage").innerText = notesLoadError ? `The stored notes could not be read: ${notesLoadError}.` : "";
    const unmatched = find_unmatched_notes(notesStore, runs, tests);
    const unmatchedKeys = new Set(unmatched.map(note_entry_key));
    const matched = list_notes(notesStore).filter(entry => !unmatchedKeys.has(note_entry_key(entry)));
    document.getElementById("notesListCount").innerText = matched.length;
    document.getElementById("notesUnmatchedCount").innerText = unmatched.length;
    render_notes_list(matched);
    render_unmatched_notes(unmatched);
    render_note_categories();
    render_notes_storage_usage();
}

async function delete_unmatched_notes(entries) {
    if (entries.length === 0) return;
    const confirmed = await confirm_action(`Delete ${format_note_count(entries.length).replace(" note", " unmatched note")}?<br><br>
        They may belong to another dashboard that is opened from the same location. Export them first to keep a copy.`);
    if (confirmed) apply_notes_change(store => remove_note_entries(store, entries));
}

function export_notes_json() {
    return JSON.stringify(notesStore, null, 2);
}

function download_notes() {
    const blob = new Blob([export_notes_json()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `robotdashboard-notes-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

async function copy_notes() {
    try {
        await navigator.clipboard.writeText(export_notes_json());
        add_alert("Copied the notes to the clipboard!", "success");
    } catch (error) {
        add_alert(`The notes could not be copied: ${escape_html_for_merge(error.message)}`, "danger");
    }
}

function import_notes() {
    const textArea = document.getElementById("importNotesText");
    let imported;
    try {
        imported = sanitize_notes_store(JSON.parse(textArea.value));
    } catch (error) {
        add_alert(`The notes could not be imported: ${escape_html_for_merge(error.message)}`, "danger", 10000);
        return;
    }
    const { saved, result } = apply_notes_change(store => merge_notes_stores(store, imported));
    if (!saved) return;
    textArea.value = "";
    document.getElementById("importNotesFile").value = "";
    add_alert(`Imported notes: ${result.added} added, ${result.updated} updated, ${result.unchanged} unchanged, ${result.categoriesAdded} new categories.`, "success", 8000);
}

function setup_notes_categories_tab() {
    const nameInput = document.getElementById("newNoteCategoryName");
    const colorInput = document.getElementById("newNoteCategoryColor");
    const add_category = () => {
        const { saved, result } = apply_notes_change(store => add_note_category(store, nameInput.value, colorInput.value));
        if (!saved) return;
        if (!result) {
            add_alert("A category needs a name that is not used yet.", "warning");
            return;
        }
        nameInput.value = "";
        colorInput.value = NOTE_CATEGORY_COLORS[notesStore.categories.length % NOTE_CATEGORY_COLORS.length];
    };
    document.getElementById("addNoteCategory").addEventListener("click", add_category);
    nameInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            add_category();
        }
    });
    const list = document.getElementById("noteCategoriesList");
    list.addEventListener("change", (event) => {
        const row = event.target.closest(".note-category-row");
        if (!row) return;
        const id = row.dataset.categoryId;
        const name = row.querySelector('[data-category-field="name"]').value;
        const color = row.querySelector('[data-category-field="color"]').value;
        const { saved, result } = apply_notes_change(store => update_note_category(store, id, name, color));
        if (saved && !result) {
            add_alert("A category needs a name that is not used yet.", "warning");
            render_note_categories();
        }
    });
    list.addEventListener("click", async (event) => {
        const row = event.target.closest('[data-category-action="delete"]')?.closest(".note-category-row");
        if (!row) return;
        const category = get_note_category(notesStore, row.dataset.categoryId);
        if (!category) return;
        const count = count_notes_with_category(notesStore, category.id);
        apply_notes_change(store => remove_note_category(store, category.id));
    });
}

function get_selected_note_entries() {
    return [...document.querySelectorAll("#notesListTable [data-notes-select-index]:checked")]
        .map(checkbox => listedNoteEntries[Number(checkbox.dataset.notesSelectIndex)])
        .filter(Boolean);
}

function delete_selected_notes() {
    const selected = get_selected_note_entries();
    if (selected.length === 0) return;
    apply_notes_change(store => remove_note_entries(store, selected));
}

function delete_all_notes() {
    if (listedNoteEntries.length === 0) return;
    apply_notes_change(store => remove_note_entries(store, [...listedNoteEntries]));
}

function setup_notes_modal() {
    const modal = document.getElementById("notesModal");
    modal.addEventListener("show.bs.modal", render_notes_modal);
    document.addEventListener("notes-changed", () => {
        if (modal.classList.contains("show")) render_notes_modal();
    });
    document.getElementById("notesListUpdateToggle").addEventListener("click", () => {
        const toggle = document.getElementById("notesListUpdateToggle");
        const bulkActions = document.getElementById("notesListBulkActions");
        const isPressed = toggle.getAttribute("aria-pressed") === "true";
        toggle.setAttribute("aria-pressed", String(!isPressed));
        bulkActions.hidden = toggle.getAttribute("aria-pressed") !== "true";
        render_notes_modal();
    });
    document.getElementById("deleteSelectedNotes").addEventListener("click", delete_selected_notes);
    document.getElementById("deleteAllNotes").addEventListener("click", delete_all_notes);
    document.getElementById("notesList").addEventListener("click", (event) => {
        const button = event.target.closest("[data-notes-action]");
        if (!button) return;
        const entry = listedNoteEntries[Number(button.dataset.notesIndex)];
        if (!entry) return;
        if (button.dataset.notesAction === "edit") {
            open_note_editor({ run_start: entry.run_start, full_name: entry.full_name });
        }
    });
    document.getElementById("deleteSelectedUnmatchedNotes").addEventListener("click", () => {
        const selected = [...document.querySelectorAll("#notesUnmatchedList [data-unmatched-index]:checked")]
            .map(checkbox => unmatchedNoteEntries[Number(checkbox.dataset.unmatchedIndex)])
            .filter(Boolean);
        delete_unmatched_notes(selected);
    });
    document.getElementById("deleteAllUnmatchedNotes").addEventListener("click", () => delete_unmatched_notes([...unmatchedNoteEntries]));
    document.getElementById("resetNotesStorage").addEventListener("click", async () => {
        const confirmed = await confirm_action("Remove the stored notes that could not be read? This cannot be undone.");
        if (!confirmed) return;
        const error = reset_notes_storage();
        if (error) add_alert(escape_html_for_merge(error), "danger");
        render_notes_modal();
        update_notes_storage_warning();
    });
    setup_notes_categories_tab();
    document.getElementById("downloadNotes").addEventListener("click", download_notes);
    document.getElementById("copyNotes").addEventListener("click", copy_notes);
    document.getElementById("importNotesFile").addEventListener("change", async (event) => {
        const file = event.target.files?.[0];
        if (file) document.getElementById("importNotesText").value = await file.text();
    });
    document.getElementById("importNotes").addEventListener("click", import_notes);
    document.getElementById("newNoteCategoryColor").value = NOTE_CATEGORY_COLORS[0];
}

export { setup_notes_modal };
