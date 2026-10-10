import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as store from '@js/notes/store.js';

const {
    NOTE_MAX_LENGTH,
    NOTE_DEFAULT_COLOR,
    NOTE_BORDER_WIDTH,
    empty_notes_store,
    get_raw_run_start,
    sanitize_notes_store,
    get_test_note,
    set_test_note,
    set_notes_enabled,
    make_note,
    list_notes,
    remove_note_entries,
    find_unmatched_notes,
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
} = store;

const RUN = '2025-01-15 09:05:03.123+02:00';
const OTHER_RUN = '2025-01-16 10:00:00+02:00';
const TEST = 'Suite.Sub.Login Works';

function note(text, category = '', updated = '2025-01-01T00:00:00.000Z') {
    return { text, category, updated };
}

// minimal Storage implementation; quota is the number of characters it accepts
function fake_storage(quota = Infinity) {
    const items = new Map();
    return {
        get length() { return items.size; },
        key: (index) => [...items.keys()][index] ?? null,
        getItem: (key) => items.has(key) ? items.get(key) : null,
        setItem: (key, value) => {
            const used = [...items].reduce((sum, [k, v]) => sum + (k === key ? 0 : k.length + v.length), 0);
            if (used + key.length + value.length > quota) {
                const error = new Error('quota');
                error.name = 'QuotaExceededError';
                throw error;
            }
            items.set(key, String(value));
        },
        removeItem: (key) => items.delete(key),
    };
}

describe('notes store', () => {
    describe('get_raw_run_start', () => {
        it('prefers the stored run_start over the converted one', () => {
            expect(get_raw_run_start({ run_start: '2025-01-15 09:05:03', raw_run_start: RUN })).toBe(RUN);
        });

        it('falls back to run_start on rows that were not transformed', () => {
            expect(get_raw_run_start({ run_start: RUN })).toBe(RUN);
        });
    });

    describe('set and get', () => {
        it('stores and removes test notes', () => {
            const notes = empty_notes_store();
            set_test_note(notes, RUN, TEST, note('bug 12'));
            expect(get_test_note(notes, RUN, TEST).text).toBe('bug 12');
            expect(get_test_note(notes, OTHER_RUN, TEST)).toBeNull();

            set_test_note(notes, RUN, TEST, null);
            expect(get_test_note(notes, RUN, TEST)).toBeNull();
            expect(Object.keys(notes.tests)).toEqual([]);
        });

        it('treats names of object properties as plain test names', () => {
            const notes = empty_notes_store();
            expect(get_test_note(notes, RUN, 'constructor')).toBeNull();
            set_test_note(notes, RUN, '__proto__', note('odd name'));
            expect(get_test_note(notes, RUN, '__proto__').text).toBe('odd name');
            expect(get_test_note(notes, RUN, 'toString')).toBeNull();
        });
    });

    describe('make_note', () => {
        it('trims the text and stamps the time', () => {
            const made = make_note('  bug 12  ', 'c1', new Date('2025-02-01T10:00:00Z'));
            expect(made).toEqual({ text: 'bug 12', category: 'c1', updated: '2025-02-01T10:00:00.000Z' });
        });

        it('returns null when there is neither text nor category', () => {
            expect(make_note('   ', '')).toBeNull();
        });

        it('keeps a note that only has a category', () => {
            expect(make_note('', 'c1').category).toBe('c1');
        });

        it('cuts the text at the maximum length', () => {
            expect(make_note('x'.repeat(NOTE_MAX_LENGTH + 10), '').text).toHaveLength(NOTE_MAX_LENGTH);
        });
    });

    describe('sanitize_notes_store', () => {
        it('keeps valid notes and drops everything else', () => {
            const clean = sanitize_notes_store({
                version: 1,
                categories: [
                    { id: 'c1', name: ' Product bug ', color: '#AABBCC' },
                    { id: 'c1', name: 'duplicate id', color: '#000000' },
                    { id: 'c2', name: '', color: '#000000' },
                    { id: 'c3', name: 'Bad color', color: 'red' },
                ],
                runs: { [RUN]: note('run notes are no longer kept') },
                tests: { [RUN]: { [TEST]: note('bug', 'c1'), Other: note('env down', 'unknown'), Wrong: { text: 42 }, Empty: note('  ') }, [OTHER_RUN]: 'not an object' },
            });
            expect(clean.categories).toEqual([
                { id: 'c1', name: 'Product bug', color: '#aabbcc' },
                { id: 'c3', name: 'Bad color', color: NOTE_DEFAULT_COLOR },
            ]);
            expect(get_test_note(clean, RUN, 'Other')).toEqual(note('env down', ''));
            expect(get_test_note(clean, RUN, TEST)).toEqual(note('bug', 'c1'));
            expect(clean.runs).toBeUndefined();
            expect(list_notes(clean)).toHaveLength(2);
        });

        it('rejects data that is not a notes object', () => {
            expect(() => sanitize_notes_store([])).toThrow('not a JSON object');
            expect(() => sanitize_notes_store(null)).toThrow('not a JSON object');
        });

        it('rejects notes saved by a newer version', () => {
            expect(() => sanitize_notes_store({ version: 99 })).toThrow('newer dashboard version');
        });
    });

    describe('find_unmatched_notes', () => {
        it('lists notes whose run or test is not in the data', () => {
            const notes = empty_notes_store();
            set_test_note(notes, RUN, TEST, note('matched test'));
            set_test_note(notes, RUN, 'Suite.Renamed Test', note('renamed test'));
            set_test_note(notes, OTHER_RUN, TEST, note('test of a removed run'));
            const unmatched = find_unmatched_notes(notes, [{ run_start: RUN }], [{ run_start: RUN, full_name: TEST }]);
            expect(unmatched.map(entry => entry.note.text).sort()).toEqual(['renamed test', 'test of a removed run']);
        });

        it('removes the listed entries', () => {
            const notes = empty_notes_store();
            set_test_note(notes, OTHER_RUN, TEST, note('test of a removed run'));
            remove_note_entries(notes, find_unmatched_notes(notes, [], []));
            expect(list_notes(notes)).toEqual([]);
        });
    });

    describe('categories', () => {
        it('rejects an empty or already used name, ignoring case', () => {
            const notes = empty_notes_store();
            expect(add_note_category(notes, 'Product bug', '#ec4899', 'c1')).toEqual({ id: 'c1', name: 'Product bug', color: '#ec4899' });
            expect(add_note_category(notes, 'product BUG', '#06b6d4', 'c2')).toBeNull();
            expect(add_note_category(notes, '  ', '#06b6d4', 'c3')).toBeNull();
            add_note_category(notes, 'Environment', '#06b6d4', 'c4');
            expect(update_note_category(notes, 'c4', 'Product Bug', '#06b6d4')).toBeNull();
            expect(update_note_category(notes, 'c4', 'Infrastructure', '#14b8a6').name).toBe('Infrastructure');
        });

        it('clears a removed category and drops notes left without text', () => {
            const notes = empty_notes_store();
            add_note_category(notes, 'Flaky', '#ec4899', 'c1');
            set_test_note(notes, RUN, 'Suite.Other', note('keeps its text', 'c1'));
            set_test_note(notes, RUN, TEST, note('', 'c1'));
            expect(count_notes_with_category(notes, 'c1')).toBe(2);
            expect(remove_note_category(notes, 'c1')).toBe(2);
            expect(notes.categories).toEqual([]);
            expect(get_test_note(notes, RUN, 'Suite.Other')).toEqual(note('keeps its text', ''));
            expect(get_test_note(notes, RUN, TEST)).toBeNull();
        });

        it('colors a note by its category', () => {
            const notes = empty_notes_store();
            add_note_category(notes, 'Flaky', '#ec4899', 'c1');
            expect(get_note_color(notes, note('x', 'c1'))).toBe('#ec4899');
            expect(get_note_color(notes, note('x'))).toBe(NOTE_DEFAULT_COLOR);
        });
    });

    describe('merge_notes_stores', () => {
        it('adds new notes, replaces older ones and maps categories by name', () => {
            const local = empty_notes_store();
            add_note_category(local, 'Product bug', '#ec4899', 'local-bug');
            set_test_note(local, RUN, 'Suite.Older', note('local older', '', '2025-01-01T00:00:00.000Z'));
            set_test_note(local, RUN, TEST, note('local newer', '', '2025-03-01T00:00:00.000Z'));

            const imported = sanitize_notes_store({
                categories: [
                    { id: 'imported-bug', name: 'product bug', color: '#000000' },
                    { id: 'imported-env', name: 'Environment', color: '#06b6d4' },
                ],
                tests: {
                    [RUN]: {
                        'Suite.Older': note('imported newer', 'imported-bug', '2025-02-01T00:00:00.000Z'),
                        [TEST]: note('imported older', '', '2025-02-01T00:00:00.000Z'),
                    },
                    [OTHER_RUN]: { [TEST]: note('imported new', 'imported-env', '2025-02-01T00:00:00.000Z') },
                },
            });
            const result = merge_notes_stores(local, imported);

            expect(result).toEqual({ added: 1, updated: 1, unchanged: 1, categoriesAdded: 1 });
            expect(local.categories.map(category => category.name)).toEqual(['Product bug', 'Environment']);
            expect(get_test_note(local, RUN, 'Suite.Older')).toEqual(note('imported newer', 'local-bug', '2025-02-01T00:00:00.000Z'));
            expect(get_test_note(local, RUN, TEST).text).toBe('local newer');
            expect(get_test_note(local, OTHER_RUN, TEST).category).toBe('imported-env');
        });
    });

    describe('measure_storage_usage', () => {
        it('counts the characters of all keys and values', () => {
            const storage = fake_storage();
            storage.setItem('settings', 'x'.repeat(92));
            storage.setItem('notes', 'y'.repeat(95));
            const usage = measure_storage_usage(storage);
            expect(usage.total).toBe(200);
            expect(usage.notes).toBe(100);
            expect(usage.ratio).toBe(200 / usage.limit);
        });
    });

    describe('format_note_tooltip_lines', () => {
        it('shows the category and the note on one line', () => {
            const notes = empty_notes_store();
            add_note_category(notes, 'Flaky', '#ec4899', 'c1');
            expect(format_note_tooltip_lines(notes, note('first line\nsecond   line', 'c1'))).toEqual([
                'Category: Flaky',
                'Note: first line second line',
            ]);
        });

        it('shortens long notes and shows nothing without a note', () => {
            const lines = format_note_tooltip_lines(empty_notes_store(), note('x'.repeat(200)));
            expect(lines[0]).toBe(`Note: ${'x'.repeat(120)}...`);
            expect(format_note_tooltip_lines(empty_notes_store(), null)).toEqual([]);
        });
    });

    describe('storage', () => {
        let storage;
        beforeEach(() => {
            storage = fake_storage();
            globalThis.localStorage = storage;
            load_notes();
        });
        afterEach(() => {
            delete globalThis.localStorage;
        });

        it('saves and loads the notes', () => {
            const { error } = update_notes(notes => set_test_note(notes, RUN, TEST, note('bug 12')));
            expect(error).toBe('');
            load_notes();
            expect(get_test_note(store.notesStore, RUN, TEST).text).toBe('bug 12');
            expect(get_test_note_marker(RUN, TEST)).toBeNull();
            set_notes_enabled(true);
            expect(get_test_note_marker(RUN, TEST)).toEqual({ borderColor: NOTE_DEFAULT_COLOR, borderWidth: NOTE_BORDER_WIDTH });
            expect(get_test_note_marker(RUN, 'Suite.Other')).toBeNull();
            set_notes_enabled(false);
        });

        it('undoes a change that does not fit in the storage', () => {
            update_notes(notes => set_test_note(notes, RUN, TEST, note('small')));
            globalThis.localStorage = fake_storage(storage.getItem('notes').length + 10);
            const { error } = update_notes(notes => set_test_note(notes, OTHER_RUN, TEST, note('x'.repeat(500))));
            expect(error).toContain('storage is full');
            expect(get_test_note(store.notesStore, OTHER_RUN, TEST)).toBeNull();
            expect(get_test_note(store.notesStore, RUN, TEST).text).toBe('small');
        });

        it('does not overwrite notes it could not read until they are reset', () => {
            storage.setItem('notes', '{broken');
            load_notes();
            expect(store.notesLoadError).not.toBe('');
            const { error } = update_notes(notes => set_test_note(notes, RUN, TEST, note('new')));
            expect(error).toContain('could not be read');
            expect(storage.getItem('notes')).toBe('{broken');

            expect(reset_notes_storage()).toBe('');
            expect(storage.getItem('notes')).toBeNull();
            expect(update_notes(notes => set_test_note(notes, RUN, TEST, note('new'))).error).toBe('');
        });

        it('reports a save error without the storage', () => {
            delete globalThis.localStorage;
            expect(save_notes()).toContain('Notes are not saved');
        });
    });
});
