import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@js/variables/settings.js', () => {
    const settings = {
        show: {
            aliases: false,
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
vi.mock('@js/common.js', () => ({
    strip_tz_suffix: (s) => s.replace(/[+-]\d{2}:\d{2}$/, ''),
}));

import { get_exceptions_data } from '@js/graph_data/exceptions.js';
import { settings } from '@js/variables/settings.js';

function makeExceptionData(entries) {
    return entries.map(e => ({
        run_start: e.run_start,
        run_alias: e.run_alias || e.run_start,
        run_name: e.run_name || e.run_start,
        message: e.message,
        amount: e.amount ?? 1,
    }));
}

describe('get_exceptions_data', () => {
    beforeEach(() => {
        settings.show.aliases = false;
    });

    describe('bar graph type', () => {
        it('aggregates the amount for the same message across runs', () => {
            const data = makeExceptionData([
                { run_start: '2025-01-15 10:00:00', message: 'Timeout error', amount: 2 },
                { run_start: '2025-01-16 10:00:00', message: 'Timeout error', amount: 1 },
                { run_start: '2025-01-15 10:00:00', message: 'Connection error', amount: 1 },
            ]);
            const [graphData, callbackData] = get_exceptions_data('bar', data);

            expect(graphData.labels).toContain('Timeout error');
            expect(graphData.labels).toContain('Connection error');
            const idx = graphData.labels.indexOf('Timeout error');
            expect(graphData.datasets[0].data[idx]).toBe(3);
            expect(callbackData['Timeout error']).toEqual([
                '2025-01-15 10:00:00: 2',
                '2025-01-16 10:00:00: 1',
            ]);
        });

        it('sorts messages by total count descending', () => {
            const data = makeExceptionData([
                { run_start: '2025-01-15 10:00:00', message: 'Rare error', amount: 1 },
                { run_start: '2025-01-15 10:00:00', message: 'Common error', amount: 5 },
            ]);
            const [graphData] = get_exceptions_data('bar', data);
            expect(graphData.labels[0]).toBe('Common error');
            expect(graphData.datasets[0].data[0]).toBe(5);
        });

        it('limits to the top 10 messages by default', () => {
            const data = makeExceptionData(
                Array.from({ length: 15 }, (_, i) => ({
                    run_start: '2025-01-15 10:00:00',
                    message: `Error ${i}`,
                    amount: 1,
                }))
            );
            const [graphData] = get_exceptions_data('bar', data);
            expect(graphData.labels.length).toBe(10);
        });

        it('returns empty data when there are no exceptions', () => {
            const [graphData] = get_exceptions_data('bar', []);
            expect(graphData.labels).toEqual([]);
            expect(graphData.datasets[0].data).toEqual([]);
        });

        it('applies the failed color config to the dataset', () => {
            const data = makeExceptionData([
                { run_start: '2025-01-15 10:00:00', message: 'Error', amount: 1 },
            ]);
            const [graphData] = get_exceptions_data('bar', data);
            expect(graphData.datasets[0].backgroundColor).toBe('rgba(206, 62, 1, 0.7)');
        });
    });

    describe('timeline graph type', () => {
        it('returns graphData, runStartsArray, and pointMeta', () => {
            const data = makeExceptionData([
                { run_start: '2025-01-15 10:00:00', message: 'Timeout error', amount: 2 },
                { run_start: '2025-01-16 10:00:00', message: 'Timeout error', amount: 1 },
            ]);
            const [graphData, runStartsArray, pointMeta] = get_exceptions_data('timeline', data);

            expect(graphData.labels).toContain('Timeout error');
            expect(graphData.datasets.length).toBeGreaterThan(0);
            expect(runStartsArray.length).toBe(2);
            expect(pointMeta).toBeDefined();
        });

        it('records amount and message in pointMeta keyed by label and run axis index', () => {
            const data = makeExceptionData([
                { run_start: '2025-01-15 10:00:00', message: 'Timeout error', amount: 3 },
            ]);
            const [, , pointMeta] = get_exceptions_data('timeline', data);
            const key = 'Timeout error::0';
            expect(pointMeta[key]).toBeDefined();
            expect(pointMeta[key].amount).toBe(3);
            expect(pointMeta[key].message).toBe('Timeout error');
        });

        it('sorts run starts chronologically', () => {
            const data = makeExceptionData([
                { run_start: '2025-01-17 10:00:00', message: 'Error', amount: 1 },
                { run_start: '2025-01-15 10:00:00', message: 'Error', amount: 1 },
            ]);
            const [, runStartsArray] = get_exceptions_data('timeline', data);
            const firstTime = new Date(runStartsArray[0]).getTime();
            const lastTime = new Date(runStartsArray[runStartsArray.length - 1]).getTime();
            expect(firstTime).toBeLessThanOrEqual(lastTime);
        });

        it('limits to the top 10 messages by default', () => {
            const data = makeExceptionData(
                Array.from({ length: 15 }, (_, i) => ({
                    run_start: '2025-01-15 10:00:00',
                    message: `Error ${i}`,
                    amount: 1,
                }))
            );
            const [graphData] = get_exceptions_data('timeline', data);
            expect(graphData.labels.length).toBe(10);
        });

        it('uses run_alias for run labels when settings.show.aliases is "alias"', () => {
            settings.show.aliases = 'alias';
            const data = makeExceptionData([
                { run_start: '2025-01-15 10:00:00', run_alias: 'nightly-1', message: 'Error', amount: 1 },
            ]);
            const [, runStartsArray] = get_exceptions_data('timeline', data);
            expect(runStartsArray).toEqual(['nightly-1']);
        });
    });
});
