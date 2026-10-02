import { describe, it, expect, vi } from 'vitest';

// message_config is module state, so the message config tests live in their own file
vi.mock('@js/variables/settings.js', () => ({
    settings: { show: { aliases: 'run_start' }, switch: { testRerunView: 'reruns' } },
    get_run_label: (item) => item.run_start,
}));
vi.mock('@js/variables/globals.js', () => ({
    inFullscreen: false,
    inFullscreenGraph: '',
}));
vi.mock('@js/variables/chartconfig.js', () => ({
    failedConfig: { backgroundColor: 'rgba(206, 62, 1, 0.7)', borderColor: '#ce3e01' },
    rerunBorderColor: '#36a2eb',
    rerunBorderWidth: 3,
}));
vi.mock('@js/variables/data.js', () => ({
    message_config: ['Element ${locator} not found', 'Timeout after * seconds'],
}));
vi.mock('@js/graph_data/helpers.js', async () => ({
    ...(await vi.importActual('@js/graph_data/helpers.js')),
    convert_timeline_data: (datasets) => datasets,
}));
vi.mock('@js/common.js', () => ({
    strip_tz_suffix: (s) => s.replace(/[+-]\d{2}:\d{2}$/, ''),
}));

import { get_messages_data } from '@js/graph_data/messages.js';

function make_test(run_start, message) {
    return { name: 'Test', run_start, run_alias: run_start, passed: 0, failed: 1, skipped: 0, elapsed_s: 1, message, attempts: '' };
}

describe('get_messages_data with a message config', () => {
    const data = [
        make_test('2025-01-15 10:00:00', 'Element id:login not found'),
        make_test('2025-01-15 10:00:00', 'Timeout after 5 seconds'),
        make_test('2025-01-16 10:00:00', 'Element id:cart not found'),
        make_test('2025-01-16 10:00:00', 'Element id:cart not found'),
        make_test('2025-01-17 10:00:00', 'Something else'),
    ];

    it('merges the messages that match a rule in the bar graph', () => {
        const [graphData] = get_messages_data('test', 'bar', data);
        expect(graphData.labels).toEqual(['Element ${locator} not found', 'Something else', 'Timeout after * seconds']);
        expect(graphData.datasets[0].data).toEqual([2, 1, 1]);
    });

    it('puts every matching message in the cell of its rule and run in the timeline', () => {
        const [graphData, runStarts, pointMeta] = get_messages_data('test', 'timeline', data);
        expect(runStarts).toEqual(['2025-01-15 10:00:00', '2025-01-16 10:00:00', '2025-01-17 10:00:00']);
        const cells = graphData.datasets.map(dataset => `${dataset.label}@${dataset.data[0].x[0]}`);
        expect(cells).toEqual([
            'Element ${locator} not found@0',
            'Timeout after * seconds@0',
            'Element ${locator} not found@1',
            'Something else@2',
        ]);
        expect(pointMeta['Element ${locator} not found::1'].message).toBe('Element id:cart not found');
    });
});
