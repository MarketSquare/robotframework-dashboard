import { describe, it, expect, vi } from 'vitest';

vi.mock('@js/variables/settings.js', () => ({ settings: {} }));
vi.mock('@js/variables/data.js', () => ({ runs: [] }));
vi.mock('@js/localstorage.js', () => ({ set_local_storage_item: () => {} }));
vi.mock('@js/filter/pipeline.js', () => ({ collect_custom_filter_dimensions: () => ({}) }));
vi.mock('@js/filter/suite_path.js', () => ({ setup_suite_path_navigator: () => {} }));
vi.mock('@js/filter/availability.js', () => ({ schedule_filter_option_availability_refresh: () => {} }));
vi.mock('@js/filter/controls.js', () => ({ update_filter_active_indicator: () => {} }));

import { profiles_match } from '@js/filter/profiles.js';

const base = () => ({
    runs: 'All',
    runTags: [{ id: 'All', checked: false }, { id: 'nightly', checked: true }, { id: 'smoke', checked: false }],
    customFilters: { Release: [{ value: '1.0', checked: true }, { value: '2.0', checked: false }] },
    customFilterModes: { Release: 'OR' },
});

describe('profiles_match', () => {
    it('matches the same filters', () => {
        expect(profiles_match(base(), base())).toBe(true);
    });

    it('sees a change in the custom filters and their modes', () => {
        const values = base();
        values.customFilters.Release[1].checked = true;
        expect(profiles_match(base(), values)).toBe(false);
        const modes = base();
        modes.customFilterModes.Release = 'NOT';
        expect(profiles_match(base(), modes)).toBe(false);
    });

    it('ignores the order of the options and new unchecked options', () => {
        const current = base();
        current.runTags = [{ id: 'weekly', checked: false }, ...current.runTags.reverse()];
        expect(profiles_match(base(), current)).toBe(true);
        current.runTags[0].checked = true;
        expect(profiles_match(base(), current)).toBe(false);
    });

    it('only compares the keys the profile saved', () => {
        expect(profiles_match({ runs: 'All' }, base())).toBe(true);
        expect(profiles_match({ runs: 'Webshop' }, base())).toBe(false);
    });
});
