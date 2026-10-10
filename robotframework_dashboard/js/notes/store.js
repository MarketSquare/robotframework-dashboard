// notes on test results live in their own localStorage key instead of in the settings:
// merge_deep strips keys that are missing from the defaults and "Reset settings" removes the settings key.
// This module has no imports so the graph_data modules (and their unit tests) can read notes.
const NOTES_STORAGE_KEY = "notes";
const NOTES_VERSION = 1;
const NOTE_MAX_LENGTH = 2000;
const NOTE_CATEGORY_NAME_MAX_LENGTH = 40;
const NOTE_DEFAULT_COLOR = "#a855f7";
// none of them close to the passed, failed and skipped bar colors or the blue rerun border
const NOTE_CATEGORY_COLORS = ["#ec4899", "#06b6d4", "#f97316", "#6366f1", "#14b8a6", "#d946ef", "#f43f5e", "#94a3b8"];
// wider than the rerun border (3) so both markers stay distinguishable
const NOTE_BORDER_WIDTH = 4;
// browsers allow roughly 5 MB per origin and count the characters of keys and values
const NOTES_STORAGE_LIMIT = 5000000;
const NOTES_STORAGE_WARNING_RATIO = 0.8;
const NOTE_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

let notesStore = empty_notes_store();
let notesLoadError = "";
// settings.show.notes, set by notes/ui.js; this module stays free of imports
let notesEnabled = false;

// run_start and test name maps have no prototype, so names such as "constructor" are plain keys
function empty_notes_store() {
    return { version: NOTES_VERSION, categories: [], tests: Object.create(null) };
}

function set_notes_enabled(enabled) {
    notesEnabled = enabled;
}

// the filtered data carries a converted run_start (timezone, milliseconds), notes always use the stored one
function get_raw_run_start(row) {
    return row.raw_run_start ?? row.run_start;
}

function note_entries_of(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? Object.entries(value) : [];
}

function sanitize_note_category(raw) {
    if (!raw || typeof raw !== "object") return null;
    const id = typeof raw.id === "string" ? raw.id.trim().slice(0, 64) : "";
    const name = typeof raw.name === "string" ? raw.name.trim().slice(0, NOTE_CATEGORY_NAME_MAX_LENGTH) : "";
    if (!id || !name) return null;
    const color = typeof raw.color === "string" && NOTE_COLOR_PATTERN.test(raw.color) ? raw.color.toLowerCase() : NOTE_DEFAULT_COLOR;
    return { id, name, color };
}

function sanitize_note(raw, categoryIds) {
    if (!raw || typeof raw !== "object") return null;
    const text = typeof raw.text === "string" ? raw.text.slice(0, NOTE_MAX_LENGTH) : "";
    const category = typeof raw.category === "string" && categoryIds.has(raw.category) ? raw.category : "";
    if (text.trim() === "" && category === "") return null;
    const updated = typeof raw.updated === "string" ? raw.updated : "";
    return { text, category, updated };
}

// validates notes read from storage or an import, dropping every entry that does not fit the format
function sanitize_notes_store(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        throw new Error("the notes are not a JSON object");
    }
    if (typeof raw.version === "number" && raw.version > NOTES_VERSION) {
        throw new Error(`the notes were saved by a newer dashboard version (format ${raw.version})`);
    }
    const store = empty_notes_store();
    const categoryIds = new Set();
    for (const category of Array.isArray(raw.categories) ? raw.categories : []) {
        const clean = sanitize_note_category(category);
        if (clean && !categoryIds.has(clean.id)) {
            categoryIds.add(clean.id);
            store.categories.push(clean);
        }
    }
    for (const [runStart, testNotes] of note_entries_of(raw.tests)) {
        for (const [fullName, note] of note_entries_of(testNotes)) {
            const clean = sanitize_note(note, categoryIds);
            if (clean) set_test_note(store, runStart, fullName, clean);
        }
    }
    return store;
}

function get_test_note(store, runStart, fullName) {
    if (!Object.hasOwn(store.tests, runStart)) return null;
    const testNotes = store.tests[runStart];
    return Object.hasOwn(testNotes, fullName) ? testNotes[fullName] : null;
}

// a null note removes the stored one
function set_test_note(store, runStart, fullName, note) {
    if (note) {
        if (!Object.hasOwn(store.tests, runStart)) store.tests[runStart] = Object.create(null);
        store.tests[runStart][fullName] = note;
    } else if (Object.hasOwn(store.tests, runStart)) {
        delete store.tests[runStart][fullName];
        if (Object.keys(store.tests[runStart]).length === 0) delete store.tests[runStart];
    }
}

// returns the note to store for the editor input, or null when nothing is left to keep
function make_note(text, category, now = new Date()) {
    const cleanText = String(text ?? "").trim().slice(0, NOTE_MAX_LENGTH);
    const cleanCategory = category || "";
    if (!cleanText && !cleanCategory) return null;
    return { text: cleanText, category: cleanCategory, updated: now.toISOString() };
}

function list_notes(store) {
    const entries = [];
    for (const [runStart, testNotes] of Object.entries(store.tests)) {
        for (const [fullName, note] of Object.entries(testNotes)) {
            entries.push({ run_start: runStart, full_name: fullName, note });
        }
    }
    return entries;
}

function remove_note_entries(store, entries) {
    for (const entry of entries) set_test_note(store, entry.run_start, entry.full_name, null);
}

// notes whose run or test is not in this dashboard's data: another dashboard on the same origin
// (all file:// pages share one storage in Chrome) or a removed run, so they are never deleted automatically
function find_unmatched_notes(store, runs, tests) {
    const runStarts = new Set(runs.map(run => run.run_start));
    const testsByRun = new Map();
    for (const runStart of Object.keys(store.tests)) {
        if (runStarts.has(runStart)) testsByRun.set(runStart, new Set());
    }
    if (testsByRun.size > 0) {
        for (const test of tests) testsByRun.get(test.run_start)?.add(test.full_name);
    }
    return list_notes(store).filter(entry => !runStarts.has(entry.run_start) || !testsByRun.get(entry.run_start).has(entry.full_name));
}

function get_note_category(store, id) {
    return id ? store.categories.find(category => category.id === id) ?? null : null;
}

function get_note_color(store, note) {
    return get_note_category(store, note.category)?.color ?? NOTE_DEFAULT_COLOR;
}

function generate_note_category_id() {
    return `category-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function note_category_name_taken(store, name, exceptId = "") {
    const lower = name.trim().toLowerCase();
    return store.categories.some(category => category.id !== exceptId && category.name.toLowerCase() === lower);
}

// returns the new category, or null when the name is empty or already used
function add_note_category(store, name, color, id = generate_note_category_id()) {
    const clean = sanitize_note_category({ id, name, color });
    if (!clean || note_category_name_taken(store, clean.name)) return null;
    store.categories.push(clean);
    return clean;
}

function update_note_category(store, id, name, color) {
    const category = get_note_category(store, id);
    const clean = sanitize_note_category({ id, name, color });
    if (!category || !clean || note_category_name_taken(store, clean.name, id)) return null;
    category.name = clean.name;
    category.color = clean.color;
    return category;
}

// the notes keep their text; a note that only had this category is removed, it would be empty
function remove_note_category(store, id) {
    store.categories = store.categories.filter(category => category.id !== id);
    let affected = 0;
    for (const entry of list_notes(store)) {
        if (entry.note.category !== id) continue;
        affected++;
        set_test_note(store, entry.run_start, entry.full_name, entry.note.text.trim() ? { ...entry.note, category: "" } : null);
    }
    return affected;
}

function count_notes_with_category(store, id) {
    return list_notes(store).filter(entry => entry.note.category === id).length;
}

// merges imported notes into store: new notes are added, a note that exists in both is replaced only
// when the imported one is newer; imported categories with the name of an existing one are mapped onto it
function merge_notes_stores(store, imported) {
    const result = { added: 0, updated: 0, unchanged: 0, categoriesAdded: 0 };
    const categoryMap = new Map();
    for (const category of imported.categories) {
        const sameId = get_note_category(store, category.id);
        const sameName = store.categories.find(existing => existing.name.toLowerCase() === category.name.toLowerCase());
        if (sameId) {
            categoryMap.set(category.id, sameId.id);
        } else if (sameName) {
            categoryMap.set(category.id, sameName.id);
        } else {
            store.categories.push({ ...category });
            categoryMap.set(category.id, category.id);
            result.categoriesAdded++;
        }
    }
    for (const entry of list_notes(imported)) {
        const note = { ...entry.note, category: categoryMap.get(entry.note.category) ?? "" };
        const existing = get_test_note(store, entry.run_start, entry.full_name);
        if (existing && existing.updated >= note.updated) {
            result.unchanged++;
            continue;
        }
        if (existing) result.updated++;
        else result.added++;
        set_test_note(store, entry.run_start, entry.full_name, note);
    }
    return result;
}

function measure_storage_usage(storage) {
    let total = 0;
    let notes = 0;
    for (let index = 0; index < storage.length; index++) {
        const key = storage.key(index);
        const size = key.length + (storage.getItem(key)?.length ?? 0);
        total += size;
        if (key === NOTES_STORAGE_KEY) notes = size;
    }
    return { total, notes, limit: NOTES_STORAGE_LIMIT, ratio: total / NOTES_STORAGE_LIMIT };
}

function format_note_tooltip_lines(store, note) {
    if (!note) return [];
    const lines = [];
    const category = get_note_category(store, note.category);
    if (category) lines.push(`Category: ${category.name}`);
    if (note.text) {
        const flat = note.text.replace(/\s+/g, " ");
        lines.push(`Note: ${flat.length > 120 ? flat.substring(0, 120) + "..." : flat}`);
    }
    return lines;
}

function get_test_note_marker(runStart, fullName) {
    if (!notesEnabled) return null;
    const note = get_test_note(notesStore, runStart, fullName);
    return note ? { borderColor: get_note_color(notesStore, note), borderWidth: NOTE_BORDER_WIDTH } : null;
}

// localStorage throws in some privacy modes, so every access is guarded
function load_notes() {
    notesLoadError = "";
    notesStore = empty_notes_store();
    let raw = null;
    try {
        raw = localStorage.getItem(NOTES_STORAGE_KEY);
    } catch (error) {
        notesLoadError = `the browser storage is not available (${error.message})`;
        return;
    }
    if (raw === null) return;
    try {
        notesStore = sanitize_notes_store(JSON.parse(raw));
    } catch (error) {
        notesLoadError = error.message;
    }
}

// returns an error message, or "" when the notes were saved
function save_notes() {
    if (notesLoadError) {
        return `Notes are not saved, the stored notes could not be read: ${notesLoadError}.`;
    }
    try {
        localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notesStore));
        return "";
    } catch (error) {
        if (error?.name === "QuotaExceededError") {
            return "Notes are not saved, the browser storage is full. Remove notes in the Notes manager first.";
        }
        return `Notes are not saved: ${error.message}`;
    }
}

// applies change to the notes and saves them; the change is undone when saving fails
function update_notes(change) {
    const before = JSON.stringify(notesStore);
    const result = change(notesStore);
    const error = save_notes();
    if (error) notesStore = sanitize_notes_store(JSON.parse(before));
    return { error, result };
}

// drops notes that could not be read, so the dashboard can save notes again
function reset_notes_storage() {
    try {
        localStorage.removeItem(NOTES_STORAGE_KEY);
    } catch (error) {
        return `The notes could not be reset: ${error.message}`;
    }
    notesStore = empty_notes_store();
    notesLoadError = "";
    return "";
}

export {
    NOTES_STORAGE_KEY,
    NOTES_VERSION,
    NOTE_MAX_LENGTH,
    NOTE_CATEGORY_NAME_MAX_LENGTH,
    NOTE_DEFAULT_COLOR,
    NOTE_CATEGORY_COLORS,
    NOTE_BORDER_WIDTH,
    NOTES_STORAGE_WARNING_RATIO,
    notesStore,
    notesLoadError,
    notesEnabled,
    set_notes_enabled,
    empty_notes_store,
    get_raw_run_start,
    sanitize_notes_store,
    get_test_note,
    set_test_note,
    make_note,
    list_notes,
    remove_note_entries,
    find_unmatched_notes,
    get_note_category,
    get_note_color,
    add_note_category,
    update_note_category,
    remove_note_category,
    count_notes_with_category,
    merge_notes_stores,
    measure_storage_usage,
    format_note_tooltip_lines,
    get_test_note_marker,
    load_notes,
    save_notes,
    update_notes,
    reset_notes_storage,
};
