import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@js/variables/settings.js', () => {
    const settings = {
        show: { aliases: 'run_start' },
        switch: { suitePathsSuiteSection: false },
    };
    return {
        settings,
        get_run_label: (item) => {
            const mode = settings.show.aliases;
            if (mode === 'alias') return item.run_alias;
            if (mode === 'run_name') return item.run_name ?? item.name;
            return item.run_start;
        },
    };
});
vi.mock('@js/common.js', () => ({
    get_next_folder_level: (current, full) => {
        if (!full.startsWith(current + '.')) return current;
        const rest = full.slice(current.length + 1);
        const next = rest.split('.')[0];
        return `${current}.${next}`;
    },
}));
vi.mock('@js/variables/globals.js', () => ({
    onlyFailedFolders: false,
    previousFolder: '',
}));
vi.mock('@js/variables/chartconfig.js', () => ({
    passedBackgroundColor: 'rgba(151, 189, 97, 0.7)',
    passedBackgroundBorderColor: '#97bd61',
    failedBackgroundColor: 'rgba(206, 62, 1, 0.7)',
    failedBackgroundBorderColor: '#ce3e01',
    skippedBackgroundColor: 'rgba(254, 216, 79, 0.7)',
    skippedBackgroundBorderColor: '#fed84f',
}));

import { get_donut_graph_data, get_donut_total_graph_data, aggregate_by_folder, assign_fail_colors } from '@js/graph_data/donut.js';
import { settings } from '@js/variables/settings.js';


describe('get_donut_graph_data', () => {
    beforeEach(() => {
        settings.show.aliases = false;
    });

    it('returns donut data for the last entry in filtered data', () => {
        const filteredData = [
            { run_start: '2025-01-15 10:00:00', run_alias: 'R1', passed: 5, failed: 2, skipped: 1 },
            { run_start: '2025-01-16 10:00:00', run_alias: 'R2', passed: 8, failed: 0, skipped: 3 },
        ];
        const [graphData, callbackData] = get_donut_graph_data('test', filteredData);

        expect(graphData.labels).toContain('Passed');
        expect(graphData.labels).toContain('Skipped');
        // Last entry has failed=0, so no "Failed" label
        expect(graphData.labels).not.toContain('Failed');
        expect(graphData.datasets[0].data).toContain(8);
        expect(graphData.datasets[0].data).toContain(3);
    });

    it('includes only non-zero categories', () => {
        const filteredData = [
            { run_start: '2025-01-15 10:00:00', run_alias: 'R1', passed: 10, failed: 0, skipped: 0 },
        ];
        const [graphData] = get_donut_graph_data('test', filteredData);
        expect(graphData.labels).toEqual(['Passed']);
        expect(graphData.datasets[0].data).toEqual([10]);
    });

    it('includes all three categories when all non-zero', () => {
        const filteredData = [
            { run_start: '2025-01-15 10:00:00', run_alias: 'R1', passed: 5, failed: 3, skipped: 2 },
        ];
        const [graphData] = get_donut_graph_data('test', filteredData);
        expect(graphData.labels).toEqual(['Passed', 'Failed', 'Skipped']);
        expect(graphData.datasets[0].data).toEqual([5, 3, 2]);
    });

    it('returns run_start as callback data by default', () => {
        const filteredData = [
            { run_start: '2025-01-15 10:00:00', run_alias: 'R1', passed: 5, failed: 0, skipped: 0 },
        ];
        const [, callbackData] = get_donut_graph_data('test', filteredData);
        expect(callbackData).toBe('2025-01-15 10:00:00');
    });

    it('returns run_alias as callback data when aliases enabled', () => {
        settings.show.aliases = 'alias';
        const filteredData = [
            { run_start: '2025-01-15 10:00:00', run_alias: 'Alias1', passed: 5, failed: 0, skipped: 0 },
        ];
        const [, callbackData] = get_donut_graph_data('test', filteredData);
        expect(callbackData).toBe('Alias1');
    });

    it('returns run_name as callback data when run_name mode enabled', () => {
        settings.show.aliases = 'run_name';
        const filteredData = [
            { run_start: '2025-01-15 10:00:00', run_alias: 'Alias1', run_name: 'My Suite Run', passed: 5, failed: 0, skipped: 0 },
        ];
        const [, callbackData] = get_donut_graph_data('test', filteredData);
        expect(callbackData).toBe('My Suite Run');
    });

    it('returns empty callback data for empty input', () => {
        const [graphData, callbackData] = get_donut_graph_data('test', []);
        expect(graphData.labels).toEqual([]);
        expect(graphData.datasets[0].data).toEqual([]);
        expect(callbackData).toBe('');
    });

    it('assigns correct colors for each status', () => {
        const filteredData = [
            { run_start: '2025-01-15 10:00:00', run_alias: 'R1', passed: 5, failed: 3, skipped: 2 },
        ];
        const [graphData] = get_donut_graph_data('test', filteredData);
        const colors = graphData.datasets[0].backgroundColor;
        expect(colors[0]).toBe('rgba(151, 189, 97, 0.7)');  // Passed
        expect(colors[1]).toBe('rgba(206, 62, 1, 0.7)');     // Failed
        expect(colors[2]).toBe('rgba(254, 216, 79, 0.7)');   // Skipped
    });
});


describe('get_donut_total_graph_data', () => {
    it('sums all entries across filtered data', () => {
        const filteredData = [
            { passed: 5, failed: 2, skipped: 1 },
            { passed: 3, failed: 1, skipped: 0 },
            { passed: 2, failed: 0, skipped: 4 },
        ];
        const [graphData, callbackData] = get_donut_total_graph_data('test', filteredData);
        expect(graphData.labels).toEqual(['Passed', 'Failed', 'Skipped']);
        expect(graphData.datasets[0].data).toEqual([10, 3, 5]);
    });

    it('only includes non-zero totals', () => {
        const filteredData = [
            { passed: 5, failed: 0, skipped: 0 },
            { passed: 3, failed: 0, skipped: 0 },
        ];
        const [graphData] = get_donut_total_graph_data('test', filteredData);
        expect(graphData.labels).toEqual(['Passed']);
        expect(graphData.datasets[0].data).toEqual([8]);
    });

    it('returns labels array as callback data', () => {
        const filteredData = [
            { passed: 5, failed: 2, skipped: 1 },
        ];
        const [, callbackData] = get_donut_total_graph_data('test', filteredData);
        expect(callbackData).toEqual(['Passed', 'Failed', 'Skipped']);
    });

    it('returns empty data for no input', () => {
        const [graphData, callbackData] = get_donut_total_graph_data('test', []);
        expect(graphData.labels).toEqual([]);
        expect(graphData.datasets[0].data).toEqual([]);
        expect(callbackData).toEqual([]);
    });

    it('assigns correct colors', () => {
        const filteredData = [
            { passed: 1, failed: 1, skipped: 1 },
        ];
        const [graphData] = get_donut_total_graph_data('test', filteredData);
        expect(graphData.datasets[0].backgroundColor).toEqual([
            'rgba(151, 189, 97, 0.7)',
            'rgba(206, 62, 1, 0.7)',
            'rgba(254, 216, 79, 0.7)',
        ]);
    });

    it('has hoverOffset set on dataset', () => {
        const filteredData = [{ passed: 1, failed: 0, skipped: 0 }];
        const [graphData] = get_donut_total_graph_data('test', filteredData);
        expect(graphData.datasets[0].hoverOffset).toBe(4);
    });
});

describe('aggregate_by_folder', () => {
    const suites = [
        { full_name: 'Root.A.One', total: 2, passed: 1, failed: 1, skipped: 0 },
        { full_name: 'Root.A.Two', total: 3, passed: 3, failed: 0, skipped: 0 },
        { full_name: 'Root.B', total: 1, passed: 0, failed: 0, skipped: 1 },
        { full_name: 'Other', total: 4, passed: 4, failed: 0, skipped: 0 },
    ];

    it('sums the top level suites without a folder', () => {
        const { labels, totals } = aggregate_by_folder(suites, '');
        expect(labels).toEqual(['Root', 'Other']);
        expect(totals.Root).toEqual({ total: 6, passed: 4, failed: 1, skipped: 1 });
    });

    it('sums the child folders of a folder and skips other suites', () => {
        const { labels, totals } = aggregate_by_folder(suites, 'Root');
        expect(labels).toEqual(['Root.A', 'Root.B']);
        expect(totals['Root.A']).toEqual({ total: 5, passed: 4, failed: 1, skipped: 0 });
    });

    it('keeps the first-seen order for numeric suite names', () => {
        const { labels } = aggregate_by_folder([
            { full_name: 'b', total: 1, passed: 1, failed: 0, skipped: 0 },
            { full_name: '2', total: 1, passed: 1, failed: 0, skipped: 0 },
        ], '');
        expect(labels).toEqual(['b', '2']);
    });

    it('only counts the suites include accepts', () => {
        const { labels } = aggregate_by_folder(suites, 'Root', suite => suite.failed > 0);
        expect(labels).toEqual(['Root.A']);
    });
});

describe('assign_fail_colors', () => {
    it('cycles the fail shades so neighbours differ', () => {
        const colors = assign_fail_colors(6);
        expect(colors).toEqual(['#ce3e01', '#b13601', '#992f01', '#7f2600', '#ce3e01', '#b13601']);
        expect(assign_fail_colors(0)).toEqual([]);
    });
});
