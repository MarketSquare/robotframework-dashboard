import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const noticeData = vi.hoisted(() => ({ data_load_scope: null, filteredAmount: 55 }));
const noticeGlobals = vi.hoisted(() => ({ filteredRuns: [] }));
vi.mock('@js/variables/data.js', () => noticeData);
vi.mock('@js/variables/globals.js', () => noticeGlobals);

import { show_loaded_history } from '@js/loading.js';

let elements;
beforeEach(() => {
    elements = Object.fromEntries(['dataLoadNotice', 'dataLoadScope', 'dataLoadRange'].map(id => [id, { hidden: true, textContent: '' }]));
    vi.stubGlobal('document', { getElementById: id => elements[id] });
    noticeData.data_load_scope = { loadedRuns: 20, totalRuns: 100, recovered: true };
    noticeData.filteredAmount = 55;
    noticeGlobals.filteredRuns = Array.from({ length: 20 }, (_, index) => ({ run_start: `2026-10-${String(index + 1).padStart(2, '0')} 10:00:00` }));
});
afterEach(() => vi.unstubAllGlobals());

describe('result notice', () => {
    it('states the visible and matching counts, dates, and next action', () => {
        show_loaded_history();
        expect(elements.dataLoadNotice.hidden).toBe(false);
        expect(elements.dataLoadScope.textContent).toBe('We couldn’t open the full report, so we’re showing the latest 20 of 55 matching runs.');
        expect(elements.dataLoadRange.textContent).toBe('2026-10-01 to 2026-10-20. Use Filters to choose a different date range, select a project, or try showing more runs.');
    });

    it('does not claim a failure for an explicit smaller load', () => {
        noticeData.data_load_scope.recovered = false;
        show_loaded_history();
        expect(elements.dataLoadScope.textContent).toBe('Showing 20 of 55 matching runs.');
    });

    it('hides the notice when all matching runs are shown, even with other projects unopened', () => {
        noticeData.filteredAmount = 20;
        show_loaded_history();
        expect(elements.dataLoadNotice.hidden).toBe(true);
    });

    it('hides the notice when the complete report is already open', () => {
        noticeData.data_load_scope.loadedRuns = 100;
        show_loaded_history();
        expect(elements.dataLoadNotice.hidden).toBe(true);
    });

    it('offers an action for empty filters without suggesting that data is still loading', () => {
        noticeGlobals.filteredRuns = [];
        noticeData.filteredAmount = 0;
        show_loaded_history();
        expect(elements.dataLoadNotice.hidden).toBe(false);
        expect(elements.dataLoadScope.textContent).toBe('No runs match these filters.');
        expect(elements.dataLoadRange.textContent).toBe('Use Filters to change or reset your selections.');
    });
});
