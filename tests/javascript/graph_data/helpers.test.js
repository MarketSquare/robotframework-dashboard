import { describe, it, expect, vi } from 'vitest';

vi.mock('@js/variables/settings.js', () => ({
    settings: {
        switch: { suitePathsSuiteSection: false },
        show: { rounding: 6 },
    },
}));
vi.mock('@js/variables/chartconfig.js', () => ({
    barConfig: {
        borderSkipped: false,
        borderRadius: () => ({ topLeft: 6, topRight: 6, bottomLeft: 6, bottomRight: 6 }),
    },
}));
vi.mock('@js/variables/globals.js', () => ({
    inFullscreen: false,
    inFullscreenGraph: '',
}));

import { convert_timeline_data, parse_test_attempts, resolve_test_status, format_attempt_lines, count_attempt_flips, get_rerun_summary } from '@js/graph_data/helpers.js';


describe('convert_timeline_data', () => {
    it('groups datasets by status label+colors', () => {
        const datasets = [
            {
                label: 'PASS',
                data: [{ x: [0, 1], y: 'Test A' }],
                backgroundColor: 'green',
                borderColor: 'darkgreen',
            },
            {
                label: 'PASS',
                data: [{ x: [1, 2], y: 'Test B' }],
                backgroundColor: 'green',
                borderColor: 'darkgreen',
            },
            {
                label: 'FAIL',
                data: [{ x: [0, 1], y: 'Test C' }],
                backgroundColor: 'red',
                borderColor: 'darkred',
            },
        ];

        const result = convert_timeline_data(datasets);

        // Should group into 2 datasets: PASS and FAIL
        expect(result).toHaveLength(2);
        const passDataset = result.find(d => d.label === 'PASS');
        const failDataset = result.find(d => d.label === 'FAIL');
        expect(passDataset.data).toHaveLength(2);
        expect(failDataset.data).toHaveLength(1);
    });

    it('preserves data coordinates', () => {
        const datasets = [
            {
                label: 'PASS',
                data: [{ x: [2, 3], y: 'Test A' }],
                backgroundColor: 'green',
                borderColor: 'darkgreen',
            },
        ];

        const result = convert_timeline_data(datasets);
        expect(result[0].data[0]).toEqual({ x: [2, 3], y: 'Test A' });
    });

    it('returns empty array for empty input', () => {
        expect(convert_timeline_data([])).toEqual([]);
    });

    it('sets parsing: true on grouped datasets', () => {
        const datasets = [
            {
                label: 'PASS',
                data: [{ x: [0, 1], y: 'Test A' }],
                backgroundColor: 'green',
                borderColor: 'darkgreen',
            },
        ];
        const result = convert_timeline_data(datasets);
        expect(result[0].parsing).toBe(true);
    });

    it('preserves colors from original datasets', () => {
        const datasets = [
            {
                label: 'SKIP',
                data: [{ x: [0, 1], y: 'Test A' }],
                backgroundColor: 'yellow',
                borderColor: 'gold',
            },
        ];
        const result = convert_timeline_data(datasets);
        expect(result[0].backgroundColor).toBe('yellow');
        expect(result[0].borderColor).toBe('gold');
    });

    it('keeps rerun-marked bars (border width) apart from plain bars of the same status', () => {
        const datasets = [
            { label: 'Test A', data: [{ x: [0, 1], y: 'Test A' }], backgroundColor: 'green', borderColor: 'darkgreen' },
            { label: 'Test A', data: [{ x: [1, 2], y: 'Test A' }], backgroundColor: 'green', borderColor: 'blue', borderWidth: 3 },
            { label: 'Test A', data: [{ x: [2, 3], y: 'Test A' }], backgroundColor: 'green', borderColor: 'darkgreen' },
        ];
        const result = convert_timeline_data(datasets);
        expect(result).toHaveLength(2);
        expect(result[0].data).toHaveLength(2);
        expect(result[0].borderWidth).toBeUndefined();
        expect(result[1]).toMatchObject({ borderColor: 'blue', borderWidth: 3 });
    });
});

describe('parse_test_attempts', () => {
    it('returns an empty list for tests that ran once', () => {
        expect(parse_test_attempts({ attempts: '' })).toEqual([]);
        expect(parse_test_attempts({})).toEqual([]);
        expect(parse_test_attempts({ attempts: null })).toEqual([]);
    });

    it('parses the JSON attempt history', () => {
        const test = { attempts: '[{"status": "FAIL", "message": "boom"}, {"status": "PASS", "message": ""}]' };
        expect(parse_test_attempts(test)).toEqual([
            { status: 'FAIL', message: 'boom' },
            { status: 'PASS', message: '' },
        ]);
    });

    it('ignores malformed values', () => {
        expect(parse_test_attempts({ attempts: 'not json' })).toEqual([]);
        expect(parse_test_attempts({ attempts: '{"status": "FAIL"}' })).toEqual([]);
    });
});

describe('resolve_test_status', () => {
    const attempts = [{ status: 'FAIL', message: 'boom' }, { status: 'PASS', message: '' }];
    const recovered = { passed: 1, failed: 0, skipped: 0 };

    it('uses the final status unless the first attempt view is active', () => {
        expect(resolve_test_status(recovered, attempts, 'final')).toBe('PASS');
        expect(resolve_test_status(recovered, attempts, 'reruns')).toBe('PASS');
        expect(resolve_test_status(recovered, attempts, 'first')).toBe('FAIL');
    });

    it('falls back to the final status when there is no history', () => {
        expect(resolve_test_status({ passed: 0, failed: 1, skipped: 0 }, [], 'first')).toBe('FAIL');
        expect(resolve_test_status({ passed: 0, failed: 0, skipped: 1 }, [], 'first')).toBe('SKIP');
    });
});

describe('format_attempt_lines', () => {
    it('returns nothing for tests without history', () => {
        expect(format_attempt_lines([])).toEqual([]);
        expect(format_attempt_lines(undefined)).toEqual([]);
    });

    it('lists the chain and one line per attempt with truncated messages', () => {
        const attempts = [{ status: 'FAIL', message: 'x'.repeat(100) }, { status: 'PASS', message: '' }];
        expect(format_attempt_lines(attempts, 10)).toEqual([
            'Attempts: FAIL → PASS',
            '  1. FAIL - xxxxxxxxxx...',
            '  2. PASS',
        ]);
    });
});

describe('count_attempt_flips', () => {
    it('counts status changes between consecutive attempts', () => {
        expect(count_attempt_flips([])).toBe(0);
        expect(count_attempt_flips([{ status: 'FAIL' }, { status: 'PASS' }])).toBe(1);
        expect(count_attempt_flips([{ status: 'FAIL' }, { status: 'FAIL' }])).toBe(0);
        expect(count_attempt_flips([{ status: 'FAIL' }, { status: 'PASS' }, { status: 'FAIL' }])).toBe(2);
    });
});

describe('get_rerun_summary', () => {
    const recovered = { passed: 1, failed: 0, skipped: 0, attempts: '[{"status": "FAIL", "message": "x"}, {"status": "PASS", "message": ""}]' };
    const hardFail = { passed: 0, failed: 1, skipped: 0, attempts: '[{"status": "FAIL", "message": "x"}, {"status": "FAIL", "message": "y"}]' };
    const rerunOfPass = { passed: 1, failed: 0, skipped: 0, attempts: '[{"status": "PASS", "message": ""}, {"status": "PASS", "message": ""}]' };
    const once = { passed: 0, failed: 1, skipped: 0, attempts: '' };

    it('splits re-executed tests into recovered and failed-all-attempts', () => {
        expect(get_rerun_summary([recovered, hardFail, rerunOfPass, once])).toEqual({ reran: 3, recovered: 1, failedAllAttempts: 1 });
    });

    it('returns zeros without any attempt history', () => {
        expect(get_rerun_summary([once, {}])).toEqual({ reran: 0, recovered: 0, failedAllAttempts: 0 });
    });
});

