import { describe, it, expect, vi } from 'vitest';

vi.mock('@js/variables/data.js', () => ({ runs: [], suites: [] }));
vi.mock('@js/variables/globals.js', () => ({ filteredSuites: [], filteredTests: [] }));
vi.mock('@js/filter/availability.js', () => ({ schedule_filter_option_availability_refresh: () => {} }));

import { apply_suite_path_run_filter } from '@js/filter/suite_path.js';

const runs = [{ run_start: 'r1' }, { run_start: 'r2' }];

describe('apply_suite_path_run_filter', () => {
    it('keeps the runs with a suite on the path, for every path and suite list it is given', () => {
        const suites = [{ run_start: 'r1', full_name: 'Web.Cart' }, { run_start: 'r2', full_name: 'Web.Login' }];
        expect(apply_suite_path_run_filter(runs, 'Web.Cart', suites)).toEqual([runs[0]]);
        expect(apply_suite_path_run_filter(runs, 'Web.Cart', suites)).toEqual([runs[0]]);
        expect(apply_suite_path_run_filter(runs, 'Web.Login', suites)).toEqual([runs[1]]);
        expect(apply_suite_path_run_filter(runs, 'Web.Login', [{ run_start: 'r1', full_name: 'Web.Login.Form' }])).toEqual([runs[0]]);
        expect(apply_suite_path_run_filter(runs, 'All', suites)).toBe(runs);
    });
});
