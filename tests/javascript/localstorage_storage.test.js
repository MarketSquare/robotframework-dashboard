import { describe, it, expect, vi, beforeEach } from 'vitest';

const addAlert = vi.fn();
vi.mock('@js/variables/globals.js', () => import('./mocks/globals.js'));
vi.mock('@js/variables/data.js', () => ({ force_json_config: false, json_config: 'placeholder_json_config', runs: [] }));
vi.mock('@js/common.js', async () => ({
    ...(await vi.importActual('@js/common.js')),
    add_alert: (...args) => addAlert(...args),
}));

// the settings defaults read the window size at import
globalThis.window ??= { innerWidth: 1920, innerHeight: 1080, matchMedia: () => ({ matches: false }) };

const { sanitize_graph_types, set_local_storage_item } = await import('@js/localstorage.js');
const { settings } = await import('@js/variables/settings.js');

beforeEach(() => addAlert.mockClear());

describe('sanitize_graph_types', () => {
    it('replaces a graph type that is not a view option of the graph with its default', () => {
        const graphTypes = { runStatisticsGraphType: 'pie', testStatisticsGraphType: 'line', suiteDurationGraphType: undefined };
        sanitize_graph_types(graphTypes);
        expect(graphTypes.runStatisticsGraphType).toBe('percentages');
        expect(graphTypes.testStatisticsGraphType).toBe('line');
        expect(graphTypes.suiteDurationGraphType).toBe('line');
    });
});

describe('set_local_storage_item', () => {
    it('keeps the setting in memory and reports it when the storage is full', () => {
        const quota = new Error('full');
        quota.name = 'QuotaExceededError';
        globalThis.localStorage = { setItem: () => { throw quota; }, getItem: () => null };
        expect(() => set_local_storage_item('branding.title', 'Nightly')).not.toThrow();
        expect(settings.branding.title).toBe('Nightly');
        expect(addAlert).toHaveBeenCalledWith('Settings are not saved, the browser storage is full.', 'danger');
        delete globalThis.localStorage;
    });
});
