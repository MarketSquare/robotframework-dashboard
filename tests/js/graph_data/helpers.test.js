import { describe, it, expect, vi } from 'vitest';

// Mock dependencies
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

import { convert_timeline_data } from '@js/graph_data/helpers.js';


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
});
