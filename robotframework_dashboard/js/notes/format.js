import { escape_html_for_merge } from "../variables/globals.js";
import { pencilSVG } from "../variables/svg.js";
import { notesStore, get_note_category } from "./store.js";

// note text comes from the user or an import, so it is escaped first; only http(s) links become anchors.
// A link ends before an escaped <, > or " so "<https://host>" does not take the bracket along.
function linkify_note_text(text) {
    return escape_html_for_merge(text).replace(/https?:\/\/(?:(?!&(?:lt|gt|quot);)[^\s<])+/g, (match) => {
        const url = match.replace(/[.,;:!?)\]]+$/, "");
        const rest = match.slice(url.length);
        return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>${rest}`;
    });
}

function note_category_badge_html(category) {
    if (!category) return "";
    return `<span class="note-category-badge" style="--note-color: ${category.color}">${escape_html_for_merge(category.name)}</span>`;
}

// plain text DataTables sorts and searches on
function note_search_text(note) {
    if (!note) return "";
    const category = get_note_category(notesStore, note.category);
    return [category?.name, note.text].filter(Boolean).join(" - ");
}

function note_edit_button_html(runStart, fullName, hasNote) {
    const label = hasNote ? "Edit note" : "Add note";
    return `<button type="button" class="btn btn-sm note-edit-button" title="${label}" aria-label="${label}"
                data-note-run-start="${escape_html_for_merge(runStart)}"
                data-note-full-name="${escape_html_for_merge(fullName)}">${pencilSVG("currentColor")}</button>`;
}

function note_cell_html(runStart, fullName, note) {
    const button = note_edit_button_html(runStart, fullName, !!note);
    if (!note) return `<div class="note-cell">${button}</div>`;
    const category = get_note_category(notesStore, note.category);
    return `<div class="note-cell">${button}${note_category_badge_html(category)}<span class="note-text" title="${escape_html_for_merge(note.text)}">${linkify_note_text(note.text)}</span></div>`;
}

export {
    linkify_note_text,
    note_category_badge_html,
    note_search_text,
    note_edit_button_html,
    note_cell_html,
};
