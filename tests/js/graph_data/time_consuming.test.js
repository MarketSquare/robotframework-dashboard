import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('@js/variables/settings.js', () => ({
    settings: {
        switch: {
            useLibraryNames: false,
            suitePathsSuiteSection: false,
            suitePathsTestSection: false,
        },
        show: {
            aliases: false,
            rounding: 6,
        },
    },
}));
vi.mock('@js/variables/globals.js', () => ({
    inFullscreen: false,
    inFullscreenGraph: '',
}));
vi.mock('@js/variables/chartconfig.js', () => ({
    blueConfig: {
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
        borderColor: 'rgba(54, 162, 235)',
    },
}));
vi.mock('@js/graph_data/helpers.js', () => ({
    convert_timeline_data: (datasets) => {
        const grouped = {};
        for (const ds of datasets) {
            const key = `${ds.label}::${ds.backgroundColor}::${ds.borderColor}`;
            if (!grouped[key]) {
                grouped[key] = { label: ds.label, data: [], backgroundColor: ds.backgroundColor, borderColor: ds.borderColor, parsing: true };
            }
            grouped[key].data.push(...ds.data);
        }
        return Object.values(grouped);
    },
}));

import { get_most_time_consuming_or_most_used_data } from '@js/graph_data/time_consuming.js';
import { settings } from '@js/variables/settings.js';


function makeTestData(entries) {
    return entries.map(e => ({
        name: e.name,
        full_name: e.full_name || `Suite.${e.name}`,
        run_start: e.run_start,
        run_alias: e.run_alias || e.run_start,
        elapsed_s: e.elapsed_s ?? 1.0,
        total_time_s: e.total_time_s ?? 1.0,
        times_run: e.times_run ?? 1,
        passed: e.passed ?? 1,
        failed: e.failed ?? 0,
        skipped: e.skipped ?? 0,
        owner: e.owner || undefined,
    }));
}

describe('get_most_time_consuming_or_most_used_data', () => {
    beforeEach(() => {
        settings.switch.useLibraryNames = false;
        settings.switch.suitePathsSuiteSection = false;
        settings.switch.suitePathsTestSection = false;
        settings.show.aliases = false;
    });

    describe('bar graph type - most time consuming', () => {
        it('returns bar data sorted by occurrence count across runs', () => {
            const data = makeTestData([
                { name: 'Test A', run_start: '2025-01-15 10:00:00', elapsed_s: 5 },
                { name: 'Test A', run_start: '2025-01-16 10:00:00', elapsed_s: 3 },
                { name: 'Test B', run_start: '2025-01-15 10:00:00', elapsed_s: 10 },
            ]);
            const [graphData, callbackData] = get_most_time_consuming_or_most_used_data(
                'test', 'bar', data, false, false
            );

            expect(graphData.labels).toBeDefined();
            expect(graphData.datasets).toHaveLength(1);
            expect(graphData.datasets[0].data.length).toBeGreaterThan(0);
        });

        it('returns data for only last run when onlyLastRun=true', () => {
            const data = makeTestData([
                { name: 'Test A', run_start: '2025-01-15 10:00:00', elapsed_s: 5 },
                { name: 'Test B', run_start: '2025-01-15 10:00:00', elapsed_s: 10 },
                { name: 'Test A', run_start: '2025-01-16 10:00:00', elapsed_s: 3 },
                { name: 'Test B', run_start: '2025-01-16 10:00:00', elapsed_s: 8 },
            ]);
            const [graphData] = get_most_time_consuming_or_most_used_data(
                'test', 'bar', data, true, false
            );
            // Should only include last run data (2025-01-16)
            expect(graphData.labels.length).toBeLessThanOrEqual(10);
            // B has more elapsed time, should be first
            expect(graphData.labels[0]).toBe('Test B');
        });

        it('uses total_time_s for keyword dataType', () => {
            const data = makeTestData([
                { name: 'KW A', run_start: '2025-01-15 10:00:00', total_time_s: 20, elapsed_s: 1 },
                { name: 'KW B', run_start: '2025-01-15 10:00:00', total_time_s: 5, elapsed_s: 10 },
            ]);
            const [graphData] = get_most_time_consuming_or_most_used_data(
                'keyword', 'bar', data, true, false
            );
            // For keywords, total_time_s is used, KW A has higher total_time_s
            expect(graphData.labels[0]).toBe('KW A');
        });
    });

    describe('bar graph type - most used', () => {
        it('sorts by times_run when mostUsed=true and onlyLastRun=true', () => {
            const data = makeTestData([
                { name: 'KW A', run_start: '2025-01-15 10:00:00', times_run: 100 },
                { name: 'KW B', run_start: '2025-01-15 10:00:00', times_run: 50 },
            ]);
            const [graphData] = get_most_time_consuming_or_most_used_data(
                'keyword', 'bar', data, true, true
            );
            expect(graphData.labels[0]).toBe('KW A');
            expect(graphData.datasets[0].data[0]).toBe(100);
        });
    });

    describe('timeline graph type', () => {
        it('returns graphData with labels and datasets, plus callback data', () => {
            const data = makeTestData([
                { name: 'Test A', run_start: '2025-01-15 10:00:00', elapsed_s: 5 },
                { name: 'Test A', run_start: '2025-01-16 10:00:00', elapsed_s: 3 },
            ]);
            const [graphData, callbackData] = get_most_time_consuming_or_most_used_data(
                'test', 'timeline', data, false, false
            );

            expect(graphData.labels).toContain('Test A');
            expect(graphData.datasets.length).toBeGreaterThan(0);
            expect(callbackData.runs).toBeDefined();
            expect(callbackData.details).toBeDefined();
        });

        it('includes details with duration and pass/fail/skip counts', () => {
            const data = makeTestData([
                { name: 'Test A', run_start: '2025-01-15 10:00:00', elapsed_s: 5, passed: 1, failed: 0, skipped: 0 },
            ]);
            const [, callbackData] = get_most_time_consuming_or_most_used_data(
                'test', 'timeline', data, false, false
            );
            const details = callbackData.details;
            expect(details['Test A']).toBeDefined();
            const run = details['Test A']['2025-01-15 10:00:00'];
            expect(run.duration).toBe(5);
            expect(run.passed).toBe(1);
        });
    });

    describe('suite paths settings', () => {
        it('uses full_name for suite data type with suitePathsSuiteSection', () => {
            settings.switch.suitePathsSuiteSection = true;
            const data = makeTestData([
                { name: 'MySuite', full_name: 'Root.MySuite', run_start: '2025-01-15 10:00:00' },
            ]);
            const [graphData] = get_most_time_consuming_or_most_used_data(
                'suite', 'bar', data, true, false
            );
            expect(graphData.labels[0]).toBe('Root.MySuite');
        });

        it('uses owner.name for keywords with useLibraryNames', () => {
            settings.switch.useLibraryNames = true;
            const data = makeTestData([
                { name: 'MyKW', owner: 'BuiltIn', run_start: '2025-01-15 10:00:00' },
            ]);
            const [graphData] = get_most_time_consuming_or_most_used_data(
                'keyword', 'bar', data, true, false
            );
            expect(graphData.labels[0]).toBe('BuiltIn.MyKW');
        });
    });

    describe('callback data structure', () => {
        it('bar callback includes aliases, run_starts, and details', () => {
            const data = makeTestData([
                { name: 'Test A', run_start: '2025-01-15 10:00:00', run_alias: 'Alias1', elapsed_s: 5 },
            ]);
            const [, callbackData] = get_most_time_consuming_or_most_used_data(
                'test', 'bar', data, false, false
            );
            expect(callbackData.aliases).toBeDefined();
            expect(callbackData.run_starts).toBeDefined();
            expect(callbackData.details).toBeDefined();
        });

        it('timeline callback includes runs, aliases, and details', () => {
            const data = makeTestData([
                { name: 'Test A', run_start: '2025-01-15 10:00:00', run_alias: 'Alias1', elapsed_s: 5 },
            ]);
            const [, callbackData] = get_most_time_consuming_or_most_used_data(
                'test', 'timeline', data, false, false
            );
            expect(callbackData.runs).toBeDefined();
            expect(callbackData.aliases).toBeDefined();
            expect(callbackData.details).toBeDefined();
        });
    });
});
