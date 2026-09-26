import { describe, it, expect, vi } from 'vitest';

vi.mock('@js/variables/globals.js', () => import('./mocks/globals.js'));
vi.mock('@js/variables/data.js', () => import('./mocks/data.js'));
vi.mock('@js/variables/graphs.js', () => import('./mocks/graphs.js'));

import { get_filter_dropdown_placement } from '@js/filter/controls.js';

describe('get_filter_dropdown_placement', () => {
    it('opens below when the content fits below', () => {
        expect(get_filter_dropdown_placement(400, 600, 300, 500)).toEqual({ dropUp: false, maxHeight: 400 });
    });

    it('opens above when the content does not fit below and there is more room above', () => {
        expect(get_filter_dropdown_placement(150, 600, 300, 500)).toEqual({ dropUp: true, maxHeight: 500 });
    });

    it('stays below when the content does not fit either way but below has more room', () => {
        expect(get_filter_dropdown_placement(250, 200, 300, 500)).toEqual({ dropUp: false, maxHeight: 250 });
    });

    it('caps the height at the room above when flipped', () => {
        expect(get_filter_dropdown_placement(100, 220, 400, 500)).toEqual({ dropUp: true, maxHeight: 220 });
    });

    it('only compares against the default max height for very long lists', () => {
        // 2000px of options, but the panel never grows beyond 500px, which fits below
        expect(get_filter_dropdown_placement(550, 800, 2000, 500)).toEqual({ dropUp: false, maxHeight: 500 });
    });

    it('never shrinks below the minimum height', () => {
        expect(get_filter_dropdown_placement(20, 10, 300, 500)).toEqual({ dropUp: false, maxHeight: 120 });
    });
});
