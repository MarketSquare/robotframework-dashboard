import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@js/variables/settings.js', () => ({
    settings: {
        menu: { dashboard: true, compare: false },
        switch: { suitePathsTestSection: false, testRerunView: 'reruns' },
        show: { aliases: 'run_start', rounding: 6 },
    },
    get_run_label: (item) => (item.run_name && globalThis.__aliases === 'run_name' ? item.run_name : item.run_start),
}));
vi.mock('@js/variables/chartconfig.js', async () => ({
    ...(await import('../mocks/chartconfig.js')),
    rerunBorderColor: '#36a2eb',
    rerunBorderWidth: 3,
}));
vi.mock('@js/variables/graphs.js', () => ({ compareRunIds: ['compareRun1', 'compareRun2'] }));
vi.mock('@js/variables/globals.js', () => import('../mocks/globals.js'));
vi.mock('@js/notes/store.js', () => ({ get_raw_run_start: (row) => row.run_start, get_test_note_marker: () => null }));

// the select and switch values the test section reads from the page
const controls = {};
beforeEach(() => {
    Object.assign(controls, {
        suiteSelectTests: { value: 'All' }, testSelect: { value: 'All' }, testTagsSelect: { value: 'All' },
        testOnlyChanges: { checked: false }, testNoChanges: { value: 'All' },
        compareOnlyChanges: { checked: false }, compareNoChanges: { value: 'All' },
        compareRun1: { value: 'None' }, compareRun2: { value: 'None' },
    });
    globalThis.document = { getElementById: (id) => controls[id] };
});

const { get_test_statistics_data, get_compare_statistics_graph_data } = await import('@js/graph_data/statistics.js');

const RERAN = '[{"status": "FAIL", "message": "boom"}, {"status": "PASS", "message": ""}]';
const test = (run_start, name, status, overrides = {}) => ({
    run_start, name, full_name: `Web.Cart.${name}`, tags: '[smoke, cart]', message: '', elapsed_s: 1, attempts: '',
    passed: status === 'pass' ? 1 : 0, failed: status === 'fail' ? 1 : 0, skipped: status === 'skip' ? 1 : 0, ...overrides,
});

describe('get_test_statistics_data', () => {
    const data = [
        test('r1', 'Always Passes', 'pass'), test('r2', 'Always Passes', 'pass', { attempts: RERAN }), test('r3', 'Always Passes', 'pass'),
        test('r1', 'Flips', 'pass'), test('r2', 'Flips', 'fail'),
    ];

    it('does not count a rerun marker as a status change for "Only changes"', () => {
        controls.testOnlyChanges.checked = true;
        const [graphData] = get_test_statistics_data(data);
        expect(graphData.labels).toEqual(['Flips']);
    });

    it('keeps a test with a rerun marker for "No changes: Passed"', () => {
        controls.testNoChanges.value = 'Passed';
        const [graphData] = get_test_statistics_data(data);
        expect(graphData.labels).toEqual(['Always Passes']);
    });

    it('filters on a whole tag', () => {
        controls.testTagsSelect.value = 'cart';
        expect(get_test_statistics_data(data)[0].labels).toEqual(['Always Passes', 'Flips']);
        controls.testTagsSelect.value = 'car';
        expect(get_test_statistics_data(data)[0].labels).toEqual([]);
    });
});

describe('runs that share a run name', () => {
    const named = [
        test('r1', 'Login', 'pass', { run_name: 'Nightly' }), test('r2', 'Login', 'fail', { run_name: 'Nightly' }),
    ];

    it('get their own column in the test statistics timeline', () => {
        globalThis.__aliases = 'run_name';
        const [graphData, runStarts] = get_test_statistics_data(named);
        expect(runStarts).toEqual(['r1', 'r2']);
        expect(graphData.datasets.flatMap(dataset => dataset.data.map(point => point.x[0])).sort()).toEqual([0, 1]);
        delete globalThis.__aliases;
    });

    it('are compared by their run_start, not by the shared label', () => {
        globalThis.__aliases = 'run_name';
        controls.compareRun1.value = 'r2';
        const result = get_compare_statistics_graph_data([
            { run_start: 'r1', run_name: 'Nightly', passed: 9, failed: 0, skipped: 0 },
            { run_start: 'r2', run_name: 'Nightly', passed: 7, failed: 2, skipped: 0 },
        ]);
        expect(result.datasets).toHaveLength(1);
        expect(result.datasets[0].data).toEqual([7, 2, 0]);
        expect(result.datasets[0].runStart).toBe('r2');
        delete globalThis.__aliases;
    });
});
