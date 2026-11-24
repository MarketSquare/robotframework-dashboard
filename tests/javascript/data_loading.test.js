import { describe, it, expect, vi, afterEach } from 'vitest';
import { deflateSync } from 'node:zlib';
import { decode_result_payload, find_suite_run_starts, load_result_details, load_result_payloads, requested_load_limit, select_recent_runs, select_run_amount } from '@js/data_loading.js';

const runs = [
    { run_start: '2026-10-01 10:00:00.000000+00:00', name: 'US', tags: 'regression' },
    { run_start: '2026-10-02 10:00:00.000000+00:00', name: 'EU', tags: 'regression' },
    { run_start: '2026-10-03 10:00:00.000000+00:00', name: 'US', tags: 'regression,nightly' },
    { run_start: '2026-10-04 10:00:00.000000+00:00', name: 'US', tags: 'smoke' },
];
const encode = value => deflateSync(JSON.stringify(value)).toString('base64');
function payloads() {
    return Object.fromEntries(['runs', 'suites', 'tests', 'keywords', 'exceptions'].map(name => [name, encode(
        name === 'runs' ? runs : runs.map(run => ({ run_start: run.run_start, name: `${name} result`, message: '🧪 {"nested":true}' })),
    )]));
}

afterEach(() => vi.restoreAllMocks());

describe('recent result selection', () => {
    it('selects the newest matching runs, preserving input order and leaving the source intact', () => {
        const selected = select_recent_runs(runs, 2, '?run=US&tag=regression');
        expect(selected.runs).toEqual([runs[0], runs[2]]);
        expect(selected.matchingRuns).toBe(2);
        expect(selected.totalRuns).toBe(4);
        expect(runs).toHaveLength(4);
    });

    it('supports OR/NOT tag modes and ignores unavailable URL options like the regular URL filters', () => {
        expect(select_recent_runs(runs, 20, '?tag=nightly&tag=smoke&tagMode=OR').runs).toEqual(runs.slice(2));
        expect(select_recent_runs(runs, 20, '?tag=smoke&tagMode=NOT').runs).toEqual(runs.slice(0, 3));
        expect(select_recent_runs(runs, 20, '?run=unknown&tag=unknown').runs).toEqual(runs);
        expect(select_recent_runs(runs, 20, '?run=EU&tag=smoke').runs).toEqual([]);
    });

    it('orders by the actual timestamp across UTC offsets', () => {
        const values = [
            { run_start: '2026-10-02 15:00:00.123456+09:00', name: 'US' },
            { run_start: '2026-10-02 08:00:00.123456+00:00', name: 'US' },
        ];
        expect(select_recent_runs(values, 1).runs).toEqual([values[1]]);
    });

    it('uses the existing per-project amount semantics, including project tags', () => {
        expect(select_recent_runs(runs, 1).runs).toEqual([runs[1], runs[3]]);
        const values = runs.map((run, i) => ({ ...run, tags: i === 0 ? 'project_rare' : '' }));
        expect(select_run_amount(values, 1)).toEqual([values[0], values[1], values[3]]);
        expect(select_run_amount(values, 0)).toEqual([]);
    });

    it('accepts only supported explicit loading limits', () => {
        expect(requested_load_limit('?loadRuns=5')).toBe(5);
        for (const value of ['all', '0', '-5', '500000', 'x', '']) {
            expect(requested_load_limit(`?loadRuns=${value}`)).toBeNull();
        }
    });
});

describe('compressed result loading', () => {
    it('loads ordinary complete reports and the optional empty payloads', async () => {
        const loaded = await load_result_payloads(payloads());
        expect(loaded.scope).toBeNull();
        expect(loaded.data.runs).toEqual(runs);
        for (const dataset of ['suites', 'tests', 'keywords', 'exceptions']) {
            expect(loaded.data[dataset]).toHaveLength(4);
        }
        expect(await decode_result_payload('placeholder_exceptions')).toEqual([]);
    });

    it('opens a smaller history directly and keeps every dependent array in the same scope', async () => {
        const native = vi.spyOn(Response.prototype, 'json');
        const stages = [];
        const loaded = await load_result_payloads(payloads(), {
            maxRuns: 1, search: '?run=US&tag=regression', on_progress: value => stages.push(value.dataset),
        });
        expect(native).toHaveBeenCalledTimes(1); // only the small run index uses a whole-array JSON string
        expect(loaded.data.runs).toEqual([runs[2]]);
        expect(loaded.allRuns).toEqual(runs); // existing filters retain the full run index
        for (const rows of Object.values(loaded.data)) {
            expect(rows.map(row => row.run_start)).toEqual([runs[2].run_start]);
        }
        expect(loaded.scope).toMatchObject({ loadedRuns: 1, matchingRuns: 2, totalRuns: 4, recovered: false });
        expect(stages).toContain('keywords');
    });

    it('opens details for older selected runs without another whole-array JSON read', async () => {
        const native = vi.spyOn(Response.prototype, 'json');
        const details = await load_result_details(payloads(), new Set([runs[0].run_start, runs[1].run_start]));
        for (const rows of Object.values(details)) {
            expect(rows.map(row => row.run_start)).toEqual([runs[0].run_start, runs[1].run_start]);
        }
        expect(native).not.toHaveBeenCalled();
    });

    it('finds suite matches throughout the history with an exact path boundary', async () => {
        const suites = [
            { run_start: 'older', full_name: 'Root.Smoke.Case' },
            { run_start: 'latest', full_name: 'Root.Smoke' },
            { run_start: 'other', full_name: 'Root.SmokeTest' },
        ];
        const native = vi.spyOn(Response.prototype, 'json');
        expect(await find_suite_run_starts(encode(suites), 'Root.Smoke')).toEqual(new Set(['older', 'latest']));
        expect(native).not.toHaveBeenCalled();
    });

    it('recovers from a failed native JSON read by streaming the selected recent results', async () => {
        const original = Response.prototype.json;
        let calls = 0;
        vi.spyOn(Response.prototype, 'json').mockImplementation(function () {
            if (++calls === 3) return Promise.reject(new SyntaxError('Unexpected end of JSON input'));
            return original.call(this);
        });
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const loaded = await load_result_payloads(payloads(), { search: '?run=US&tag=regression' });
        expect(loaded.scope).toMatchObject({ loadedRuns: 2, recovered: true, runLimit: 20 });
        expect(loaded.data.tests.map(row => row.run_start)).toEqual([runs[0].run_start, runs[2].run_start]);
        expect(calls).toBe(3); // recovery never attempts another whole-array JSON read
    });

    it('opens the latest 20 runs when the failed full report contains more matching runs', async () => {
        const history = Array.from({ length: 30 }, (_, index) => ({
            name: 'Sample', tags: 'regression', run_start: `2026-10-${String(index + 1).padStart(2, '0')} 10:00:00`,
        }));
        const values = Object.fromEntries(['runs', 'suites', 'tests', 'keywords', 'exceptions'].map(name => [name, encode(history)]));
        const original = Response.prototype.json;
        let calls = 0;
        vi.spyOn(Response.prototype, 'json').mockImplementation(function () {
            if (++calls === 3) return Promise.reject(new RangeError('Invalid string length'));
            return original.call(this);
        });
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const loaded = await load_result_payloads(values);
        expect(loaded.scope).toMatchObject({ loadedRuns: 20, matchingRuns: 30, recovered: true });
        for (const rows of Object.values(loaded.data)) expect(rows).toEqual(history.slice(10));
    });

    it('fails explicitly when the payload is corrupt even in recovery', async () => {
        const values = payloads();
        values.tests = deflateSync('[{"run_start":"missing"}').toString('base64');
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        await expect(load_result_payloads(values)).rejects.toThrow('Could not read tests');
    });
});
