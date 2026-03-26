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
    failedConfig: {
        backgroundColor: 'rgba(206, 62, 1, 0.7)',
        borderColor: '#ce3e01',
    },
}));
vi.mock('@js/graph_data/helpers.js', () => ({
    convert_timeline_data: (datasets) => {
        // Simplified grouping for testing
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
vi.mock('@js/common.js', () => ({
    strip_tz_suffix: (s) => s.replace(/[+-]\d{2}:\d{2}$/, ''),
}));

import { get_most_failed_data } from '@js/graph_data/failed.js';
import { settings } from '@js/variables/settings.js';


function makeTestData(entries) {
    return entries.map(e => ({
        name: e.name,
        full_name: e.full_name || `Suite.${e.name}`,
        run_start: e.run_start,
        run_alias: e.run_alias || e.run_start,
        failed: e.failed ?? 1,
        passed: e.passed ?? 0,
        skipped: e.skipped ?? 0,
        elapsed_s: e.elapsed_s ?? 1.0,
        message: e.message || '',
        owner: e.owner || undefined,
    }));
}

describe('get_most_failed_data', () => {
    beforeEach(() => {
        settings.switch.useLibraryNames = false;
        settings.switch.suitePathsSuiteSection = false;
        settings.switch.suitePathsTestSection = false;
        settings.show.aliases = false;
    });

    describe('bar graph type', () => {
        it('returns graph data and callback data for failed items', () => {
            const data = makeTestData([
                { name: 'Test A', run_start: '2025-01-15 10:00:00', failed: 1 },
                { name: 'Test A', run_start: '2025-01-16 10:00:00', failed: 1 },
                { name: 'Test B', run_start: '2025-01-15 10:00:00', failed: 1 },
            ]);
            const [graphData, callbackData] = get_most_failed_data('test', 'bar', data, false);

            expect(graphData.labels).toEqual(['Test A', 'Test B']);
            expect(graphData.datasets[0].data).toEqual([2, 1]);
        });

        it('excludes items with failed=0', () => {
            const data = makeTestData([
                { name: 'Test A', run_start: '2025-01-15 10:00:00', failed: 1 },
                { name: 'Test B', run_start: '2025-01-15 10:00:00', failed: 0, passed: 1 },
            ]);
            const [graphData] = get_most_failed_data('test', 'bar', data, false);

            expect(graphData.labels).toEqual(['Test A']);
            expect(graphData.datasets[0].data).toEqual([1]);
        });

        it('limits to 10 items by default', () => {
            const data = makeTestData(
                Array.from({ length: 15 }, (_, i) => ({
                    name: `Test ${i}`,
                    run_start: '2025-01-15 10:00:00',
                    failed: 1,
                }))
            );
            const [graphData] = get_most_failed_data('test', 'bar', data, false);
            expect(graphData.labels.length).toBe(10);
        });

        it('sorts by failure count descending', () => {
            const data = makeTestData([
                { name: 'Test A', run_start: '2025-01-15 10:00:00', failed: 1 },
                { name: 'Test B', run_start: '2025-01-15 10:00:00', failed: 1 },
                { name: 'Test B', run_start: '2025-01-16 10:00:00', failed: 1 },
                { name: 'Test B', run_start: '2025-01-17 10:00:00', failed: 1 },
            ]);
            const [graphData] = get_most_failed_data('test', 'bar', data, false);
            expect(graphData.labels[0]).toBe('Test B');
            expect(graphData.datasets[0].data[0]).toBe(3);
        });

        it('sorts by most recent failure when recent=true', () => {
            const data = makeTestData([
                { name: 'Test Old', run_start: '2025-01-10 10:00:00', failed: 1 },
                { name: 'Test Old', run_start: '2025-01-11 10:00:00', failed: 1 },
                { name: 'Test Old', run_start: '2025-01-12 10:00:00', failed: 1 },
                { name: 'Test Recent', run_start: '2025-01-20 10:00:00', failed: 1 },
            ]);
            const [graphData] = get_most_failed_data('test', 'bar', data, true);
            // Recent puts the test with the latest failure first
            expect(graphData.labels[0]).toBe('Test Recent');
        });

        it('uses full_name when suitePathsSuiteSection is true for suite dataType', () => {
            settings.switch.suitePathsSuiteSection = true;
            const data = makeTestData([
                { name: 'MySuite', full_name: 'Root.MySuite', run_start: '2025-01-15 10:00:00', failed: 1 },
            ]);
            const [graphData] = get_most_failed_data('suite', 'bar', data, false);
            expect(graphData.labels[0]).toBe('Root.MySuite');
        });

        it('uses owner.name when useLibraryNames is true for keyword dataType', () => {
            settings.switch.useLibraryNames = true;
            const data = makeTestData([
                { name: 'MyKeyword', owner: 'BuiltIn', run_start: '2025-01-15 10:00:00', failed: 1 },
            ]);
            const [graphData] = get_most_failed_data('keyword', 'bar', data, false);
            expect(graphData.labels[0]).toBe('BuiltIn.MyKeyword');
        });

        it('uses aliases in callback data when show.aliases is true', () => {
            settings.show.aliases = true;
            const data = makeTestData([
                { name: 'Test A', run_start: '2025-01-15 10:00:00', run_alias: 'Alias1', failed: 1 },
            ]);
            const [, callbackData] = get_most_failed_data('test', 'bar', data, false);
            expect(callbackData['Test A']).toEqual(['Alias1']);
        });

        it('returns empty data when no failures', () => {
            const data = makeTestData([
                { name: 'Test A', run_start: '2025-01-15 10:00:00', failed: 0, passed: 1 },
            ]);
            const [graphData] = get_most_failed_data('test', 'bar', data, false);
            expect(graphData.labels).toEqual([]);
            expect(graphData.datasets[0].data).toEqual([]);
        });
    });

    describe('timeline graph type', () => {
        it('returns graphData, runStartsArray, and pointMeta', () => {
            const data = makeTestData([
                { name: 'Test A', run_start: '2025-01-15 10:00:00', failed: 1, message: 'err1' },
                { name: 'Test A', run_start: '2025-01-16 10:00:00', failed: 1, message: 'err2' },
            ]);
            const [graphData, runStartsArray, pointMeta] = get_most_failed_data('test', 'timeline', data, false);

            expect(graphData.labels).toEqual(['Test A']);
            expect(graphData.datasets.length).toBeGreaterThan(0);
            expect(runStartsArray.length).toBe(2);
            expect(pointMeta).toBeDefined();
        });

        it('records pointMeta with FAIL status for each point', () => {
            const data = makeTestData([
                { name: 'Test A', run_start: '2025-01-15 10:00:00', failed: 1, elapsed_s: 2.5, message: 'boom' },
            ]);
            const [, , pointMeta] = get_most_failed_data('test', 'timeline', data, false);
            const key = 'Test A::0';
            expect(pointMeta[key]).toBeDefined();
            expect(pointMeta[key].status).toBe('FAIL');
            expect(pointMeta[key].elapsed_s).toBe(2.5);
            expect(pointMeta[key].message).toBe('boom');
        });

        it('sorts run starts chronologically', () => {
            const data = makeTestData([
                { name: 'Test A', run_start: '2025-01-16 10:00:00', failed: 1 },
                { name: 'Test A', run_start: '2025-01-15 10:00:00', failed: 1 },
            ]);
            const [, runStartsArray] = get_most_failed_data('test', 'timeline', data, false);
            expect(runStartsArray[0]).toBe('2025-01-15 10:00:00');
            expect(runStartsArray[1]).toBe('2025-01-16 10:00:00');
        });

        it('uses aliases for runStartsArray when show.aliases is true', () => {
            settings.show.aliases = true;
            const data = makeTestData([
                { name: 'Test A', run_start: '2025-01-15 10:00:00', run_alias: 'Alias1', failed: 1 },
            ]);
            const [, runStartsArray] = get_most_failed_data('test', 'timeline', data, false);
            expect(runStartsArray).toContain('Alias1');
        });
    });
});
