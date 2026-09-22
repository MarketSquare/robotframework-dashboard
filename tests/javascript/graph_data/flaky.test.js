import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@js/variables/settings.js', () => {
    const settings = {
        switch: {
            suitePathsTestSection: false,
        },
        show: {
            aliases: 'run_start',
            rounding: 6,
        },
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
vi.mock('@js/variables/chartconfig.js', () => ({
    passedConfig: { backgroundColor: 'rgba(151, 189, 97, 0.7)', borderColor: '#97bd61' },
    failedConfig: { backgroundColor: 'rgba(206, 62, 1, 0.7)', borderColor: '#ce3e01' },
    skippedConfig: { backgroundColor: 'rgba(254, 216, 79, 0.7)', borderColor: '#fed84f' },
    rerunBorderColor: '#36a2eb',
    rerunBorderWidth: 3,
}));
vi.mock('@js/graph_data/helpers.js', async () => ({
    ...(await vi.importActual('@js/graph_data/helpers.js')),
    convert_timeline_data: (datasets) => {
        const grouped = {};
        for (const ds of datasets) {
            const key = `${ds.label}::${ds.backgroundColor}::${ds.borderColor}`;
            if (!grouped[key]) {
                grouped[key] = { label: ds.label, data: [], backgroundColor: ds.backgroundColor, borderColor: ds.borderColor, borderWidth: ds.borderWidth, parsing: true };
            }
            grouped[key].data.push(...ds.data);
        }
        return Object.values(grouped);
    },
}));
vi.mock('@js/variables/globals.js', () => ({
    inFullscreen: false,
    inFullscreenGraph: '',
}));
vi.mock('@js/common.js', () => ({
    strip_tz_suffix: (s) => s.replace(/[+-]\d{2}:\d{2}$/, ''),
}));

import { get_most_flaky_data } from '@js/graph_data/flaky.js';
import { settings } from '@js/variables/settings.js';


function makeTestData(entries) {
    return entries.map(e => ({
        name: e.name,
        full_name: e.full_name || `Suite.${e.name}`,
        run_start: e.run_start,
        run_alias: e.run_alias || e.run_start,
        run_name: e.run_name || '',
        passed: e.passed ?? 0,
        failed: e.failed ?? 0,
        skipped: e.skipped ?? 0,
        elapsed_s: e.elapsed_s ?? 1.0,
        message: e.message || '',
        attempts: e.attempts || '',
    }));
}

const RECOVERED = '[{"status": "FAIL", "message": "boom"}, {"status": "PASS", "message": ""}]';
const HARD_FAIL = '[{"status": "FAIL", "message": "a"}, {"status": "FAIL", "message": "b"}]';

describe('get_most_flaky_data', () => {
    beforeEach(() => {
        settings.switch.suitePathsTestSection = false;
        settings.switch.testRerunView = 'reruns';
        settings.show.aliases = false;
    });

    describe('bar graph type', () => {
        it('counts status flips and returns bar chart data', () => {
            // Test A: PASS -> FAIL -> PASS = 2 flips
            const data = makeTestData([
                { name: 'Test A', run_start: '2025-01-15 10:00:00', passed: 1 },
                { name: 'Test A', run_start: '2025-01-16 10:00:00', failed: 1 },
                { name: 'Test A', run_start: '2025-01-17 10:00:00', passed: 1 },
            ]);
            const [graphData] = get_most_flaky_data('test', 'bar', data, false, false, 10);
            expect(graphData.labels).toEqual(['Test A']);
            expect(graphData.datasets[0].data).toEqual([2]);
        });

        it('excludes tests with zero flips', () => {
            // Test A: PASS -> PASS -> PASS = 0 flips (not flaky)
            const data = makeTestData([
                { name: 'Test A', run_start: '2025-01-15 10:00:00', passed: 1 },
                { name: 'Test A', run_start: '2025-01-16 10:00:00', passed: 1 },
                { name: 'Test A', run_start: '2025-01-17 10:00:00', passed: 1 },
            ]);
            const [graphData] = get_most_flaky_data('test', 'bar', data, false, false, 10);
            expect(graphData.labels).toEqual([]);
            expect(graphData.datasets[0].data).toEqual([]);
        });

        it('sorts by flips descending', () => {
            const data = makeTestData([
                // Test A: PASS -> FAIL = 1 flip
                { name: 'Test A', run_start: '2025-01-15 10:00:00', passed: 1 },
                { name: 'Test A', run_start: '2025-01-16 10:00:00', failed: 1 },
                // Test B: PASS -> FAIL -> PASS = 2 flips
                { name: 'Test B', run_start: '2025-01-15 10:00:00', passed: 1 },
                { name: 'Test B', run_start: '2025-01-16 10:00:00', failed: 1 },
                { name: 'Test B', run_start: '2025-01-17 10:00:00', passed: 1 },
            ]);
            const [graphData] = get_most_flaky_data('test', 'bar', data, false, false, 10);
            expect(graphData.labels[0]).toBe('Test B');
            expect(graphData.datasets[0].data[0]).toBe(2);
        });

        it('respects limit parameter', () => {
            const data = makeTestData([
                { name: 'Test A', run_start: '2025-01-15 10:00:00', passed: 1 },
                { name: 'Test A', run_start: '2025-01-16 10:00:00', failed: 1 },
                { name: 'Test B', run_start: '2025-01-15 10:00:00', passed: 1 },
                { name: 'Test B', run_start: '2025-01-16 10:00:00', failed: 1 },
                { name: 'Test C', run_start: '2025-01-15 10:00:00', passed: 1 },
                { name: 'Test C', run_start: '2025-01-16 10:00:00', failed: 1 },
            ]);
            const [graphData] = get_most_flaky_data('test', 'bar', data, false, false, 2);
            expect(graphData.labels.length).toBe(2);
        });

        it('ignores skipped tests when ignore=true', () => {
            const data = makeTestData([
                { name: 'Test A', run_start: '2025-01-15 10:00:00', passed: 1 },
                { name: 'Test A', run_start: '2025-01-16 10:00:00', skipped: 1 },
                { name: 'Test A', run_start: '2025-01-17 10:00:00', passed: 1 },
            ]);
            // With ignore=true, skipped entries are excluded entirely
            const [graphData] = get_most_flaky_data('test', 'bar', data, true, false, 10);
            expect(graphData.labels).toEqual([]);
        });

        it('counts skipped as a status flip when ignore=false', () => {
            const data = makeTestData([
                { name: 'Test A', run_start: '2025-01-15 10:00:00', passed: 1 },
                { name: 'Test A', run_start: '2025-01-16 10:00:00', skipped: 1 },
            ]);
            const [graphData] = get_most_flaky_data('test', 'bar', data, false, false, 10);
            expect(graphData.labels).toEqual(['Test A']);
            expect(graphData.datasets[0].data).toEqual([1]);
        });

        it('uses full_name when suitePathsTestSection is true', () => {
            settings.switch.suitePathsTestSection = true;
            const data = makeTestData([
                { name: 'Test A', full_name: 'Root.Suite.Test A', run_start: '2025-01-15 10:00:00', passed: 1 },
                { name: 'Test A', full_name: 'Root.Suite.Test A', run_start: '2025-01-16 10:00:00', failed: 1 },
            ]);
            const [graphData] = get_most_flaky_data('test', 'bar', data, false, false, 10);
            expect(graphData.labels[0]).toBe('Root.Suite.Test A');
        });

        it('returns callback data with full test information', () => {
            const data = makeTestData([
                { name: 'Test A', run_start: '2025-01-15 10:00:00', passed: 1 },
                { name: 'Test A', run_start: '2025-01-16 10:00:00', failed: 1 },
            ]);
            const [, callbackData] = get_most_flaky_data('test', 'bar', data, false, false, 10);
            expect(callbackData['Test A']).toBeDefined();
            expect(callbackData['Test A'].flips).toBe(1);
            expect(callbackData['Test A'].run_starts).toHaveLength(2);
        });
    });

    describe('timeline graph type', () => {
        it('returns graphData, runStarts, and pointMeta', () => {
            const data = makeTestData([
                { name: 'Test A', run_start: '2025-01-15 10:00:00', passed: 1 },
                { name: 'Test A', run_start: '2025-01-16 10:00:00', failed: 1 },
            ]);
            const [graphData, runStarts, pointMeta] = get_most_flaky_data('test', 'timeline', data, false, false, 10);

            expect(graphData.labels).toEqual(['Test A']);
            expect(graphData.datasets.length).toBeGreaterThan(0);
            expect(runStarts).toHaveLength(2);
            expect(pointMeta).toBeDefined();
        });

        it('records correct status in pointMeta', () => {
            const data = makeTestData([
                { name: 'Test A', run_start: '2025-01-15 10:00:00', passed: 1, elapsed_s: 2.0 },
                { name: 'Test A', run_start: '2025-01-16 10:00:00', failed: 1, elapsed_s: 3.0, message: 'error' },
            ]);
            const [, , pointMeta] = get_most_flaky_data('test', 'timeline', data, false, false, 10);
            expect(pointMeta['Test A::0'].status).toBe('PASS');
            expect(pointMeta['Test A::1'].status).toBe('FAIL');
            expect(pointMeta['Test A::1'].message).toBe('error');
        });

        it('sorts run starts chronologically', () => {
            const data = makeTestData([
                { name: 'Test A', run_start: '2025-01-17 10:00:00', passed: 1 },
                { name: 'Test A', run_start: '2025-01-15 10:00:00', failed: 1 },
            ]);
            const [, runStarts] = get_most_flaky_data('test', 'timeline', data, false, false, 10);
            expect(runStarts[0]).toBe('2025-01-15 10:00:00');
            expect(runStarts[1]).toBe('2025-01-17 10:00:00');
        });

        it('uses run_alias when show.aliases is true', () => {
            settings.show.aliases = 'alias';
            const data = makeTestData([
                { name: 'Test A', run_start: '2025-01-15 10:00:00', run_alias: 'Alias1', passed: 1 },
                { name: 'Test A', run_start: '2025-01-16 10:00:00', run_alias: 'Alias2', failed: 1 },
            ]);
            const [, runStarts] = get_most_flaky_data('test', 'timeline', data, false, false, 10);
            expect(runStarts).toContain('Alias1');
            expect(runStarts).toContain('Alias2');
        });

        it('uses run_name when show.aliases is run_name', () => {
            settings.show.aliases = 'run_name';
            const data = makeTestData([
                { name: 'Test A', run_start: '2025-01-15 10:00:00', run_alias: 'Alias1', run_name: 'Run One', passed: 1 },
                { name: 'Test A', run_start: '2025-01-16 10:00:00', run_alias: 'Alias2', run_name: 'Run Two', failed: 1 },
            ]);
            const [, runStarts] = get_most_flaky_data('test', 'timeline', data, false, false, 10);
            expect(runStarts).toContain('Run One');
            expect(runStarts).toContain('Run Two');
        });

        it('color codes by status (PASS, FAIL, SKIP)', () => {
            const data = makeTestData([
                { name: 'Test A', run_start: '2025-01-15 10:00:00', passed: 1 },
                { name: 'Test A', run_start: '2025-01-16 10:00:00', failed: 1 },
                { name: 'Test A', run_start: '2025-01-17 10:00:00', skipped: 1 },
            ]);
            const [graphData] = get_most_flaky_data('test', 'timeline', data, false, false, 10);
            const bgColors = graphData.datasets.map(d => d.backgroundColor);
            // Should have distinct colors for PASS, FAIL, SKIP
            expect(new Set(bgColors).size).toBeGreaterThanOrEqual(2);
        });
    });

    describe('rerun attempt history', () => {
        it('counts a recovery on rerun as a flip even when every run ends green', () => {
            const data = makeTestData([
                { name: 'Retry Hero', run_start: '2025-01-15 10:00:00', passed: 1, attempts: RECOVERED },
                { name: 'Retry Hero', run_start: '2025-01-16 10:00:00', passed: 1, attempts: RECOVERED },
                { name: 'Stable', run_start: '2025-01-15 10:00:00', passed: 1 },
                { name: 'Stable', run_start: '2025-01-16 10:00:00', passed: 1 },
            ]);
            const [graphData] = get_most_flaky_data('test', 'bar', data, false, false, 10);
            expect(graphData.labels).toEqual(['Retry Hero']);
            expect(graphData.datasets[0].data).toEqual([2]);
        });

        it('does not count attempts that failed every time as flips', () => {
            const data = makeTestData([
                { name: 'Broken', run_start: '2025-01-15 10:00:00', failed: 1, attempts: HARD_FAIL },
                { name: 'Broken', run_start: '2025-01-16 10:00:00', failed: 1, attempts: HARD_FAIL },
            ]);
            const [graphData] = get_most_flaky_data('test', 'bar', data, false, false, 10);
            expect(graphData.labels).toEqual([]);
        });

        it('ignores the attempt history with the rerun view set to final', () => {
            settings.switch.testRerunView = 'final';
            const data = makeTestData([
                { name: 'Retry Hero', run_start: '2025-01-15 10:00:00', passed: 1, attempts: RECOVERED },
                { name: 'Retry Hero', run_start: '2025-01-16 10:00:00', passed: 1, attempts: RECOVERED },
            ]);
            const [graphData] = get_most_flaky_data('test', 'bar', data, false, false, 10);
            expect(graphData.labels).toEqual([]);
        });

        it('marks re-executed tests in the timeline and exposes the attempts in pointMeta', () => {
            const data = makeTestData([
                { name: 'Retry Hero', run_start: '2025-01-15 10:00:00', passed: 1, attempts: RECOVERED },
                { name: 'Retry Hero', run_start: '2025-01-16 10:00:00', passed: 1 },
            ]);
            const [graphData, , pointMeta] = get_most_flaky_data('test', 'timeline', data, false, false, 10);
            const marked = graphData.datasets.filter(d => d.borderWidth === 3);
            expect(marked).toHaveLength(1);
            expect(marked[0].borderColor).toBe('#36a2eb');
            expect(pointMeta['Retry Hero::0'].attempts).toHaveLength(2);
            expect(pointMeta['Retry Hero::1'].attempts).toEqual([]);
        });

        it('shows the first attempt status in the timeline with the first attempt view', () => {
            settings.switch.testRerunView = 'first';
            const data = makeTestData([
                { name: 'Retry Hero', run_start: '2025-01-15 10:00:00', passed: 1, attempts: RECOVERED },
                { name: 'Retry Hero', run_start: '2025-01-16 10:00:00', passed: 1 },
            ]);
            const [, , pointMeta] = get_most_flaky_data('test', 'timeline', data, false, false, 10);
            expect(pointMeta['Retry Hero::0'].status).toBe('FAIL');
            expect(pointMeta['Retry Hero::1'].status).toBe('PASS');
        });
    });

    describe('recent sorting', () => {
        it('prioritizes tests with most recent failures', () => {
            const data = makeTestData([
                { name: 'Old Flaky', run_start: '2025-01-10 10:00:00', passed: 1 },
                { name: 'Old Flaky', run_start: '2025-01-11 10:00:00', failed: 1 },
                { name: 'Old Flaky', run_start: '2025-01-12 10:00:00', passed: 1 },
                { name: 'New Flaky', run_start: '2025-01-20 10:00:00', passed: 1 },
                { name: 'New Flaky', run_start: '2025-01-21 10:00:00', failed: 1 },
            ]);
            const [graphData] = get_most_flaky_data('test', 'bar', data, false, true, 10);
            expect(graphData.labels[0]).toBe('New Flaky');
        });
    });
});
