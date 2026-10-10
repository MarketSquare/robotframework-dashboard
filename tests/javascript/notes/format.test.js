import { describe, it, expect, vi } from 'vitest';

// globals.js reads the document when it loads, so only its escape helper is provided
vi.mock('@js/variables/globals.js', () => ({
    escape_html_for_merge: (str) => String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;'),
}));

const { linkify_note_text, note_cell_html, note_search_text } = await import('@js/notes/format.js');

describe('notes format', () => {
    describe('linkify_note_text', () => {
        it('escapes html in the note', () => {
            expect(linkify_note_text('<img src=x onerror="alert(1)">')).toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
        });

        it('turns http and https links into anchors, without trailing punctuation', () => {
            expect(linkify_note_text('see https://example.com/issues/12.')).toBe(
                'see <a href="https://example.com/issues/12" target="_blank" rel="noopener noreferrer">https://example.com/issues/12</a>.'
            );
        });

        it('keeps query strings and stops at escaped brackets and quotes', () => {
            expect(linkify_note_text('<https://example.com/?a=1&b=2>')).toBe(
                '&lt;<a href="https://example.com/?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">https://example.com/?a=1&amp;b=2</a>&gt;'
            );
            expect(linkify_note_text('"https://example.com"')).toContain('href="https://example.com"');
        });

        it('leaves other schemes as text', () => {
            expect(linkify_note_text('javascript:alert(1) ftp://host')).toBe('javascript:alert(1) ftp://host');
        });
    });

    describe('note cells', () => {
        it('escapes the identifiers of the edit button', () => {
            const html = note_cell_html('2025-01-15 09:05:03+02:00', 'Suite."Quoted" <Test>', null);
            expect(html).toContain('data-note-full-name="Suite.&quot;Quoted&quot; &lt;Test&gt;"');
            expect(html).toContain('title="Add note"');
        });

        it('searches on the note text', () => {
            expect(note_search_text({ text: 'bug 12', category: '', updated: '' })).toBe('bug 12');
            expect(note_search_text(null)).toBe('');
        });
    });
});
