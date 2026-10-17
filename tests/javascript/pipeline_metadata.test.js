import { describe, it, expect, vi } from 'vitest';

vi.mock('@js/variables/settings.js', () => ({ settings: { show: {}, switch: {}, menu: {} } }));
vi.mock('@js/variables/data.js', () => ({ exceptions: [], filteredAmount: 0, keywords: [], runs: [], suites: [], tests: [], unified_dashboard_title: '' }));
vi.mock('@js/variables/globals.js', () => import('./mocks/globals.js'));
vi.mock('@js/filter/section_selects.js', () => ({}));
vi.mock('@js/filter/suite_path.js', () => ({ filter_runs_by_suite_path: (runs) => runs, filter_suite_path_data: (data) => data }));

import { apply_metadata_filter, build_date_range, collect_custom_filter_dimensions } from '@js/filter/pipeline.js';

const run = (metadata) => ({ metadata });

describe('apply_metadata_filter', () => {
    const runs = [
        run("['Env: prod', 'Team: Storefront']"),
        run("['Env: production', 'Team: Storefront']"),
        run(''),
    ];

    it('matches a whole metadata item, not a part of one', () => {
        expect(apply_metadata_filter(runs, 'Env: prod')).toEqual([runs[0]]);
        expect(apply_metadata_filter(runs, 'Team: Storefront')).toHaveLength(2);
        expect(apply_metadata_filter(runs, 'Env: pro')).toEqual([]);
    });

    it('keeps every run for All', () => {
        expect(apply_metadata_filter(runs, 'All')).toBe(runs);
    });
});

describe('build_date_range', () => {
    it('builds local dates from the picker values, including the whole "to" minute', () => {
        const range = build_date_range('2026-01-15', '10:00', '2026-01-15', '10:59');
        expect(range.from).toEqual(new Date(2026, 0, 15, 10, 0, 0));
        expect(range.to).toEqual(new Date(2026, 0, 15, 10, 59, 59, 999));
        expect(build_date_range('2026-01-16', '10:00', '2026-01-15', '10:00')).toBeNull();
    });
});

describe('collect_custom_filter_dimensions', () => {
    it('collects the dimensions of the runs once', () => {
        expect(collect_custom_filter_dimensions()).toBe(collect_custom_filter_dimensions());
    });
});
