import { describe, it, expect } from 'vitest';
import { read_json_array } from '@js/json_array.js';

function byte_stream(text, width = 7) {
    const bytes = new TextEncoder().encode(text);
    return new ReadableStream({
        start(controller) {
            for (let offset = 0; offset < bytes.length; offset += width) {
                controller.enqueue(bytes.slice(offset, offset + width));
            }
            controller.close();
        },
    });
}

describe('streamed result arrays', () => {
    const rows = [
        { run_start: 'old', message: 'quotes " braces }{ brackets [] slash \\ and newline\n', nested: { values: [1, { ok: true }, null] } },
        { run_start: 'new', message: 'Unicode: café, 東京, 🧪', attempts: [{ message: '\\"' }] },
        { run_start: 'new', message: 'literal escape: \\u0041' },
    ];

    it.each([1, 2, 7, 64, 4096])('frames escaped and nested records across %i-byte chunks', async width => {
        expect(await read_json_array(byte_stream(JSON.stringify(rows), width))).toEqual(rows);
    });

    it('retains only selected records and reports scanned versus retained counts', async () => {
        const progress = [];
        const actual = await read_json_array(byte_stream(JSON.stringify(rows)), row => row.run_start === 'new', value => progress.push(value));
        expect(actual).toEqual(rows.slice(1));
        expect(progress.at(-1)).toEqual({ scanned: 3, retained: 2 });
    });

    it('accepts an empty array, JSON whitespace, and a UTF-8 byte order mark', async () => {
        expect(await read_json_array(byte_stream('\uFEFF \t[\n]\r'))).toEqual([]);
    });

    it.each([
        '', '[', '[{}', '[{"message":"unfinished', '[{"nested":[1,2]}',
        '{"not":"an array"}', '[1]', '[null]', '[[{}]]', '[{},]', '[{}{}]',
        '[{"a":}]', '[{}]extra', '[{}]\u2003', '[{"a":[1,2}}]',
    ])('rejects malformed or incomplete input %j', async text => {
        await expect(read_json_array(byte_stream(text, 1))).rejects.toBeInstanceOf(SyntaxError);
    });

    it('validates discarded records too, instead of hiding corrupt data', async () => {
        await expect(read_json_array(byte_stream('[{"run_start":"old","bad":}]'), () => false)).rejects.toBeInstanceOf(SyntaxError);
    });

    it('propagates source failures and cancels after a parse failure', async () => {
        const failure = new Error('broken stream');
        await expect(read_json_array(new ReadableStream({ start(controller) { controller.error(failure); } }))).rejects.toBe(failure);
        let cancelled = false;
        const stream = new ReadableStream({
            start(controller) { controller.enqueue(new TextEncoder().encode('[invalid')); },
            cancel() { cancelled = true; },
        });
        await expect(read_json_array(stream)).rejects.toBeInstanceOf(SyntaxError);
        expect(cancelled).toBe(true);
    });
});
