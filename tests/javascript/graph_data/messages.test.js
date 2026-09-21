import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@js/variables/settings.js', () => {
    const settings = {
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
vi.mock('@js/variables/globals.js', () => ({
    inFullscreen: false,
    inFullscreenGraph: '',
}));
vi.mock('@js/variables/chartconfig.js', () => ({
    failedConfig: {
        backgroundColor: 'rgba(206, 62, 1, 0.7)',
        borderColor: '#ce3e01',
    },
    rerunBorderColor: '#36a2eb',
    rerunBorderWidth: 3,
}));
vi.mock('@js/variables/data.js', () => ({
    message_config: 'placeholder_message_config',
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
vi.mock('@js/common.js', () => ({
    strip_tz_suffix: (s) => s.replace(/[+-]\d{2}:\d{2}$/, ''),
}));

import { get_messages_data } from '@js/graph_data/messages.js';
import { settings } from '@js/variables/settings.js';


function makeTestData(entries) {
    return entries.map(e => ({
        name: e.name || 'Some Test',
        run_start: e.run_start,
        run_alias: e.run_alias || e.run_start,
        passed: e.passed ?? 0,
        failed: e.failed ?? 0,
        skipped: e.skipped ?? 0,
        elapsed_s: e.elapsed_s ?? 1.0,
        message: e.message || '',
        attempts: e.attempts || '',
    }));
}


describe('get_messages_data', () => {
    beforeEach(() => {
        settings.show.aliases = false;
        settings.switch = { testRerunView: 'reruns' };
    });

    describe('rerun attempt history', () => {
        const hardFail = '[{"status": "FAIL", "message": "first"}, {"status": "FAIL", "message": "last"}]';

        it('only counts the final message, the attempts are not extra entries', () => {
            const data = makeTestData([
                { run_start: '2025-01-15 10:00:00', failed: 1, message: 'last', attempts: hardFail },
            ]);
            const [graphData] = get_messages_data('test', 'bar', data);
            expect(graphData.labels).toEqual(['last']);
            expect(graphData.datasets[0].data).toEqual([1]);
        });

        it('marks re-executed tests in the timeline and exposes the attempts in pointMeta', () => {
            const data = makeTestData([
                { run_start: '2025-01-15 10:00:00', failed: 1, message: 'last', attempts: hardFail },
                { run_start: '2025-01-16 10:00:00', failed: 1, message: 'last' },
            ]);
            const [graphData, , pointMeta] = get_messages_data('test', 'timeline', data);
            const marked = graphData.datasets.filter(d => d.borderWidth === 3);
            expect(marked).toHaveLength(1);
            expect(pointMeta['last::0'].attempts).toHaveLength(2);
            expect(pointMeta['last::1'].attempts).toEqual([]);
        });

        it('ignores the attempt history with the rerun view set to final', () => {
            settings.switch.testRerunView = 'final';
            const data = makeTestData([
                { run_start: '2025-01-15 10:00:00', failed: 1, message: 'last', attempts: hardFail },
            ]);
            const [graphData] = get_messages_data('test', 'timeline', data);
            expect(graphData.datasets.filter(d => d.borderWidth === 3)).toHaveLength(0);
        });
    });

    describe('bar graph type', () => {
        it('groups failures by message and returns bar chart data', () => {
            const data = makeTestData([
                { run_start: '2025-01-15 10:00:00', failed: 1, message: 'Assertion failed' },
                { run_start: '2025-01-16 10:00:00', failed: 1, message: 'Assertion failed' },
                { run_start: '2025-01-15 10:00:00', failed: 1, message: 'Timeout' },
            ]);
            const [graphData, callbackData] = get_messages_data('test', 'bar', data);

            expect(graphData.labels).toContain('Assertion failed');
            expect(graphData.labels).toContain('Timeout');
            // Assertion failed appeared 2 times, Timeout 1 time
            const idx = graphData.labels.indexOf('Assertion failed');
            expect(graphData.datasets[0].data[idx]).toBe(2);
        });

        it('ignores items with no message', () => {
            const data = makeTestData([
                { run_start: '2025-01-15 10:00:00', failed: 1, message: '' },
                { run_start: '2025-01-15 10:00:00', failed: 1, message: 'Error' },
            ]);
            const [graphData] = get_messages_data('test', 'bar', data);
            expect(graphData.labels).toEqual(['Error']);
        });

        it('ignores passed items (only includes failed/skipped)', () => {
            const data = makeTestData([
                { run_start: '2025-01-15 10:00:00', passed: 1, message: 'All good' },
                { run_start: '2025-01-15 10:00:00', failed: 1, message: 'Error' },
            ]);
            const [graphData] = get_messages_data('test', 'bar', data);
            expect(graphData.labels).toEqual(['Error']);
        });

        it('includes skipped items with messages', () => {
            const data = makeTestData([
                { run_start: '2025-01-15 10:00:00', skipped: 1, message: 'Precondition not met' },
            ]);
            const [graphData] = get_messages_data('test', 'bar', data);
            expect(graphData.labels).toEqual(['Precondition not met']);
        });

        it('sorts messages by frequency descending', () => {
            const data = makeTestData([
                { run_start: '2025-01-15 10:00:00', failed: 1, message: 'Rare Error' },
                { run_start: '2025-01-15 10:00:00', failed: 1, message: 'Common Error' },
                { run_start: '2025-01-16 10:00:00', failed: 1, message: 'Common Error' },
                { run_start: '2025-01-17 10:00:00', failed: 1, message: 'Common Error' },
            ]);
            const [graphData] = get_messages_data('test', 'bar', data);
            expect(graphData.labels[0]).toBe('Common Error');
            expect(graphData.datasets[0].data[0]).toBe(3);
        });

        it('limits to 10 messages by default', () => {
            const data = makeTestData(
                Array.from({ length: 15 }, (_, i) => ({
                    run_start: '2025-01-15 10:00:00',
                    failed: 1,
                    message: `Error ${i}`,
                }))
            );
            const [graphData] = get_messages_data('test', 'bar', data);
            expect(graphData.labels.length).toBe(10);
        });

        it('returns empty data for no failures', () => {
            const data = makeTestData([
                { run_start: '2025-01-15 10:00:00', passed: 1, message: '' },
            ]);
            const [graphData] = get_messages_data('test', 'bar', data);
            expect(graphData.labels).toEqual([]);
            expect(graphData.datasets[0].data).toEqual([]);
        });
    });

    describe('timeline graph type', () => {
        it('returns graphData, runStartsArray, and pointMeta', () => {
            const data = makeTestData([
                { name: 'Test A', run_start: '2025-01-15 10:00:00', failed: 1, message: 'Error 1' },
                { name: 'Test A', run_start: '2025-01-16 10:00:00', failed: 1, message: 'Error 1' },
            ]);
            const [graphData, runStartsArray, pointMeta] = get_messages_data('test', 'timeline', data);

            expect(graphData.labels).toContain('Error 1');
            expect(graphData.datasets.length).toBeGreaterThan(0);
            expect(runStartsArray.length).toBeGreaterThan(0);
            expect(pointMeta).toBeDefined();
        });

        it('records status in pointMeta for each data point', () => {
            const data = makeTestData([
                { name: 'Test A', run_start: '2025-01-15 10:00:00', failed: 1, elapsed_s: 2.5, message: 'Error' },
            ]);
            const [, , pointMeta] = get_messages_data('test', 'timeline', data);
            const key = 'Error::0';
            expect(pointMeta[key]).toBeDefined();
            expect(pointMeta[key].status).toBe('FAIL');
            expect(pointMeta[key].elapsed_s).toBe(2.5);
        });

        it('sorts run starts chronologically', () => {
            const data = makeTestData([
                { run_start: '2025-01-17 10:00:00', failed: 1, message: 'Error' },
                { run_start: '2025-01-15 10:00:00', failed: 1, message: 'Error' },
            ]);
            const [, runStartsArray] = get_messages_data('test', 'timeline', data);
            const firstTime = new Date(runStartsArray[0]).getTime();
            const lastTime = new Date(runStartsArray[runStartsArray.length - 1]).getTime();
            expect(firstTime).toBeLessThanOrEqual(lastTime);
        });
    });
});
