import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@js/variables/settings.js', () => ({
    settings: { switch: { suitePathsCompareSection: false }, show: { aliases: 'run_start', rounding: 6 } },
    get_run_label: (run) => run.run_start,
}));
vi.mock('@js/variables/globals.js', () => ({ inFullscreen: false, inFullscreenGraph: '', filteredRuns: [] }));
vi.mock('@js/variables/chartconfig.js', () => ({ barConfig: {}, lineConfig: {} }));
vi.mock('@js/variables/graphs.js', () => ({ compareRunIds: ['compareRun1', 'compareRun2'] }));

const selectValues = {};
beforeEach(() => {
    globalThis.document = { getElementById: (id) => (id in selectValues ? { value: selectValues[id] } : null) };
});

const { get_compare_suite_duration_data, get_duration_graph_data } = await import('@js/graph_data/duration.js');

const suite = (run_start, name, elapsed_s, full_name = `Root.${name}`) => ({ run_start, name, full_name, elapsed_s, run_alias: '', run_name: '' });

describe('get_compare_suite_duration_data', () => {
    it('aligns every run on the labels, with a gap for a suite a run does not have', () => {
        selectValues.compareRun1 = 'r1';
        selectValues.compareRun2 = 'r2';
        const result = get_compare_suite_duration_data([
            suite('r1', 'Login', 10), suite('r1', 'Cart', 20),
            // r2 lists its suites in another order and has no Login suite
            suite('r2', 'Search', 5), suite('r2', 'Cart', 25),
        ]);
        expect(result.labels).toEqual(['Login', 'Cart', 'Search']);
        expect(result.datasets[0].data).toEqual([10, 20, null]);
        expect(result.datasets[1].data).toEqual([null, 25, 5]);
    });

    it('adds up suites that share a name in one run', () => {
        selectValues.compareRun1 = 'r1';
        selectValues.compareRun2 = 'None';
        const result = get_compare_suite_duration_data([
            suite('r1', 'Smoke', 3, 'A.Smoke'), suite('r1', 'Smoke', 4, 'B.Smoke'),
        ]);
        expect(result.labels).toEqual(['Smoke']);
        expect(result.datasets).toHaveLength(1);
        expect(result.datasets[0].data).toEqual([7]);
    });
});

describe('get_duration_graph_data', () => {
    it('shows the newest 30 runs in the bar view', () => {
        selectValues.suiteSelectSuites = 'All Suites Separate';
        selectValues.keywordSelect = '';
        const runs = Array.from({ length: 35 }, (_, index) => ({
            run_start: `2026-01-${String(index + 1).padStart(2, '0')} 10:00:00`, name: 'Webshop', elapsed_s: index,
        }));
        const graphData = get_duration_graph_data('run', 'bar', 'elapsed_s', runs);
        expect(graphData.labels).toHaveLength(30);
        expect(graphData.labels[0]).toBe('2026-01-06 10:00:00');
        expect(graphData.labels.at(-1)).toBe('2026-01-35 10:00:00');
    });
});
