import { describe, it, expect, vi } from 'vitest';

// the runs left by the run filters; with milliseconds hidden both show the same run_start
const globalsMock = vi.hoisted(() => ({
    filteredRuns: [{ run_start: '2026-01-15 10:00:00', raw_run_start: '2026-01-15 10:00:00.250000' }],
}));

vi.mock('@js/variables/settings.js', () => ({ settings: { show: {}, switch: {}, menu: {}, libraries: {} } }));
vi.mock('@js/variables/data.js', () => ({ exceptions: [], filteredAmount: 0, keywords: [], runs: [], suites: [], tests: [], unified_dashboard_title: '' }));
vi.mock('@js/variables/globals.js', () => globalsMock);
vi.mock('@js/filter/section_selects.js', () => ({}));
vi.mock('@js/filter/suite_path.js', () => ({ filter_runs_by_suite_path: (runs) => runs, filter_suite_path_data: (data) => data }));

import { filter_data } from '@js/filter/pipeline.js';

describe('filter_data', () => {
    it('keeps the rows of the filtered runs by their stored run_start, also when hiding milliseconds makes two runs look the same', () => {
        const suites = [
            { name: 'Kept', run_start: '2026-01-15 10:00:00', raw_run_start: '2026-01-15 10:00:00.250000' },
            { name: 'Other run, same second', run_start: '2026-01-15 10:00:00', raw_run_start: '2026-01-15 10:00:00.750000' },
        ];
        expect(filter_data(suites).map(suite => suite.name)).toEqual(['Kept']);
    });

    it('falls back to run_start for rows without a stored one', () => {
        globalsMock.filteredRuns = [{ run_start: '2026-01-16 10:00:00' }];
        expect(filter_data([{ name: 'A', run_start: '2026-01-16 10:00:00' }, { name: 'B', run_start: '2026-01-17 10:00:00' }]).map(s => s.name)).toEqual(['A']);
    });
});
