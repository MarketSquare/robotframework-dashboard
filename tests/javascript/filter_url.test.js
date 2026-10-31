import { describe, it, expect, vi } from 'vitest';

vi.mock('@js/variables/settings.js', () => ({ settings: {} }));
vi.mock('@js/variables/data.js', () => ({ runs: [], suites: [] }));
vi.mock('@js/filter/profiles.js', () => ({
    apply_filter_profile: () => {},
    capture_current_filters: () => ({}),
    get_default_filters: () => null,
    update_profile_select_display: () => {},
}));
vi.mock('@js/filter/controls.js', () => ({ update_filters_button_indicator: () => {} }));

import { build_filter_params, parse_filter_params, url_filters_to_profile } from '@js/filter/url.js';

const defaults = () => ({
    runs: 'All',
    runTags: [{ id: 'All', checked: true }, { id: 'dev', checked: false }, { id: 'prod', checked: false }],
    tagMode: 'AND',
    projectVersions: [{ value: 'All', checked: true }, { value: '1.0', checked: false }],
    fromDate: '2026-08-17', fromTime: '02:15',
    toDate: '2026-09-10', toTime: '06:00',
    metadata: 'All',
    amount: '18',
    suitePath: 'All',
    customFilters: { Release: [{ value: 'All', checked: true }, { value: 'R1', checked: false }] },
    customFilterModes: { Release: 'OR' },
});

describe('build_filter_params', () => {
    it('writes nothing for the default filters', () => {
        expect(build_filter_params(defaults(), defaults())).toEqual([]);
    });

    it('writes only the filters that differ from the defaults', () => {
        const current = defaults();
        current.runs = 'WebshopUI';
        current.amount = '3';
        current.runTags = [{ id: 'All', checked: false }, { id: 'dev', checked: true }, { id: 'prod', checked: true }];
        current.customFilters.Release = [{ value: 'All', checked: false }, { value: 'R1', checked: true }];
        current.customFilterModes.Release = 'NOT';
        expect(build_filter_params(current, defaults())).toEqual([
            ['run', 'WebshopUI'],
            ['amount', '3'],
            ['tag', 'dev'],
            ['tag', 'prod'],
            ['filter.Release', 'R1'],
            ['filterMode.Release', 'NOT'],
        ]);
    });
});

describe('parse_filter_params', () => {
    it('reads single values, repeated list values and custom filters', () => {
        const params = new URLSearchParams('run=WebshopUI&tag=dev&tag=prod&tagMode=OR&amount=3&filter.Release=R1&filterMode.Release=NOT&page=dashboard');
        expect(parse_filter_params(params)).toEqual({
            runs: 'WebshopUI',
            tagMode: 'OR',
            amount: '3',
            runTags: ['dev', 'prod'],
            customFilters: { Release: ['R1'] },
            customFilterModes: { Release: 'NOT' },
        });
    });

    it('drops values that can never be valid', () => {
        const params = new URLSearchParams('amount=-1&fromDate=yesterday&toTime=6pm&tagMode=XOR&filterMode.Release=ANY');
        expect(parse_filter_params(params)).toEqual({});
    });
});

describe('url_filters_to_profile', () => {
    it('checks exactly the listed options and unchecks All', () => {
        const profile = url_filters_to_profile({ runTags: ['dev'] }, defaults());
        expect(profile.runTags).toEqual([
            { id: 'All', checked: false }, { id: 'dev', checked: true }, { id: 'prod', checked: false },
        ]);
    });

    it('ignores a list without any option of this dashboard instead of hiding every run', () => {
        const profile = url_filters_to_profile({ runTags: ['unknown'], customFilters: { Missing: ['x'] } }, defaults());
        expect(profile).toEqual({});
    });

    it('skips single values the dashboard does not offer', () => {
        const is_valid_option = (key, value) => !(key === 'runs' && value === 'Unknown');
        expect(url_filters_to_profile({ runs: 'Unknown', amount: '3' }, defaults(), is_valid_option)).toEqual({ amount: '3' });
    });

    it('round trips the filters it writes', () => {
        const current = defaults();
        current.runs = 'WebshopUI';
        current.projectVersions = [{ value: 'All', checked: false }, { value: '1.0', checked: true }];
        current.customFilterModes.Release = 'NOT';
        const params = new URLSearchParams(build_filter_params(current, defaults()));
        const profile = url_filters_to_profile(parse_filter_params(params), defaults());
        expect({ ...defaults(), ...profile, customFilterModes: { ...profile.customFilterModes } }).toEqual(current);
    });
});
