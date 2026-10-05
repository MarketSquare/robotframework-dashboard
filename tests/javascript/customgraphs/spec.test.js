import { describe, it, expect, vi } from 'vitest';

vi.mock('@js/variables/globals.js', () => ({ inFullscreen: false }));

import { validate_custom_graph_spec, create_default_custom_graph_spec, sanitize_custom_graph_spec } from '@js/customgraphs/spec.js';
import { run_custom_graph_query } from '@js/customgraphs/engine.js';
import { CUSTOM_GRAPH_PRESETS } from '@js/customgraphs/presets.js';
import { make_dataset } from './dataset.js';

describe('validate_custom_graph_spec', () => {
    it('accepts the default spec unchanged', () => {
        const defaults = create_default_custom_graph_spec('test');
        const { spec, errors } = validate_custom_graph_spec(defaults);
        expect(errors).toEqual([]);
        expect(spec).toEqual(defaults);
    });

    it('drops unknown keys and fills defaults', () => {
        const { spec, errors } = validate_custom_graph_spec({
            source: 'runs', metric: { agg: 'count', evil: 1 }, viz: { type: 'bar' }, onClick: 'alert(1)',
        });
        expect(errors).toEqual([]);
        expect(spec.onClick).toBeUndefined();
        expect(spec.metric).toEqual({ agg: 'count' });
        expect(spec.useGlobalFilters).toBe(true);
        expect(spec.order).toBe('auto');
        expect(spec.limit).toBe(0);
    });

    it('rejects non-objects and unknown sources', () => {
        expect(validate_custom_graph_spec(null).errors).toHaveLength(1);
        expect(validate_custom_graph_spec([]).errors).toHaveLength(1);
        expect(validate_custom_graph_spec({ source: 'nope' }).errors[0]).toContain('not a known source');
    });

    it('reports invalid fields, operators and aggregations', () => {
        const { errors } = validate_custom_graph_spec({
            source: 'exceptions',
            where: [{ field: 'tags', op: 'has', value: 'x' }, { field: 'message', op: 'gt', value: '1' }],
            x: { field: 'status' },
            metric: { agg: 'pass_rate' },
            viz: { type: 'bar' },
        });
        expect(errors).toHaveLength(4);
    });

    it('requires a key for kv filter conditions', () => {
        const { errors } = validate_custom_graph_spec({
            source: 'runs', where: [{ field: 'metadata', op: 'is', value: 'chromium' }], metric: { agg: 'count' }, viz: { type: 'bar' },
        });
        expect(errors[0]).toContain('key to filter on');
    });

    it('requires a field for numeric aggregations and a key for kv groupings', () => {
        expect(validate_custom_graph_spec({ source: 'tests', metric: { agg: 'avg' }, viz: { type: 'bar' } }).errors[0])
            .toContain('choose a field');
        expect(validate_custom_graph_spec({ source: 'runs', x: { field: 'metadata' }, metric: { agg: 'count' }, viz: { type: 'bar' } }).errors[0])
            .toContain('key');
    });

    it('rejects an invalid regex, equal x and series, and a split donut', () => {
        const { errors } = validate_custom_graph_spec({
            source: 'tests',
            where: [{ field: 'name', op: 'matches', value: '(' }],
            x: { field: 'name' }, series: { field: 'name' },
            metric: { agg: 'count' }, viz: { type: 'donut' },
        });
        expect(errors).toHaveLength(3);
    });

    it('requires both an x axis and a split for a heatmap', () => {
        const base = { source: 'tests', metric: { agg: 'count' }, viz: { type: 'heatmap' } };
        expect(validate_custom_graph_spec({ ...base, x: { field: 'run' } }).errors[0]).toContain('heatmap');
        expect(validate_custom_graph_spec({ ...base, x: { field: 'run' }, series: { field: 'name' } }).errors).toEqual([]);
    });

    it('rejects regular expressions that are too long or repeat a repeating group', () => {
        const base = { source: 'tests', metric: { agg: 'count' }, viz: { type: 'bar' } };
        const errors = (value) => validate_custom_graph_spec({ ...base, where: [{ field: 'message', op: 'matches', value }] }).errors;
        expect(errors('^Timeout.*after (\\d+)s')).toEqual([]);
        expect(errors('(a+)+$')[0]).toContain('freeze');
        expect(errors('(\\w*)*')[0]).toContain('freeze');
        expect(errors('x'.repeat(101))[0]).toContain('at most');
    });

    it('only allows count based metrics when runs, suites or keywords are grouped by status', () => {
        const base = { source: 'runs', x: { field: 'run' }, series: { field: 'status' }, viz: { type: 'bar' } };
        for (const agg of ['count', 'pass_count', 'fail_count', 'skip_count']) {
            expect(validate_custom_graph_spec({ ...base, metric: { agg } }).errors).toEqual([]);
        }
        expect(validate_custom_graph_spec({ ...base, metric: { agg: 'pass_rate' } }).errors[0]).toContain('grouped by status');
        expect(validate_custom_graph_spec({ ...base, x: { field: 'status' }, series: null, metric: { agg: 'avg', field: 'elapsed_s' } }).errors[0])
            .toContain('grouped by status');
        // a test has a single status, so every metric still means something
        expect(validate_custom_graph_spec({ ...base, source: 'tests', metric: { agg: 'avg', field: 'elapsed_s' } }).errors).toEqual([]);
    });

    it('only keeps percentages with a split by and values that add up', () => {
        const base = { source: 'tests', x: { field: 'run' }, viz: { type: 'stacked_bar', percent: true } };
        expect(validate_custom_graph_spec({ ...base, series: { field: 'status' }, metric: { agg: 'count' } }).spec.viz.percent).toBe(true);
        expect(validate_custom_graph_spec({ ...base, series: null, metric: { agg: 'count' } }).spec.viz.percent).toBe(false);
        expect(validate_custom_graph_spec({ ...base, series: { field: 'name' }, metric: { agg: 'pass_rate' } }).spec.viz.percent).toBe(false);
    });

    it('does not reinterpret a spec of a newer version', () => {
        const { errors } = validate_custom_graph_spec({ v: 2, source: 'runs', metric: { agg: 'count' }, viz: { type: 'bar' } });
        expect(errors[0]).toContain('newer version');
        expect(validate_custom_graph_spec({ v: 1, source: 'runs', metric: { agg: 'count' }, viz: { type: 'bar' } }).errors).toEqual([]);
    });

    it('clamps title, limit and id', () => {
        const { spec } = validate_custom_graph_spec({
            id: '<img src=x>', title: 'x'.repeat(100), limit: 99999, source: 'runs', metric: { agg: 'count' }, viz: { type: 'bar' },
        });
        expect(spec.id).toBe('');
        expect(spec.title).toHaveLength(60);
        expect(spec.limit).toBe(500);
    });
});

describe('sanitize_custom_graph_spec', () => {
    it('repairs a draft after the source changes', () => {
        const draft = {
            ...create_default_custom_graph_spec(),
            source: 'exceptions',
            where: [{ field: 'tags', op: 'has', value: 'x' }, { field: 'message', op: 'contains', value: 'Timeout' }],
            x: { field: 'name' }, series: { field: 'status' },
            metric: { agg: 'avg', field: 'elapsed_s' },
        };
        const spec = sanitize_custom_graph_spec(draft);
        expect(spec.where).toEqual([{ field: 'message', op: 'contains', value: 'Timeout' }]);
        expect(spec.x).toEqual({ field: 'run' });
        expect(spec.series).toBeNull();
        expect(spec.metric).toEqual({ agg: 'avg', field: 'amount' });
        expect(validate_custom_graph_spec(spec).errors).toEqual([]);
    });

    it('resets an operator that does not fit a new field type', () => {
        const spec = sanitize_custom_graph_spec({
            ...create_default_custom_graph_spec(),
            where: [{ field: 'elapsed_s', op: 'contains', value: 'abc' }],
        });
        expect(spec.where).toEqual([{ field: 'elapsed_s', op: 'eq', value: '' }]);
    });

    it('clears the split for donuts and when it equals the x axis', () => {
        const base = create_default_custom_graph_spec();
        expect(sanitize_custom_graph_spec({ ...base, viz: { type: 'donut' } }).series).toBeNull();
        expect(sanitize_custom_graph_spec({ ...base, series: { field: 'run' } }).series).toBeNull();
    });

    it('turns percentages off for chart types without the option', () => {
        const base = { ...create_default_custom_graph_spec(), viz: { type: 'stacked_bar', percent: true } };
        expect(sanitize_custom_graph_spec(base).viz.percent).toBe(true);
        expect(sanitize_custom_graph_spec({ ...base, viz: { type: 'line', percent: true } }).viz.percent).toBe(false);
        expect(validate_custom_graph_spec({ ...base, viz: { type: 'donut', percent: true } }).spec.viz.percent).toBe(false);
    });

    it('falls back to a count when a status split makes the metric meaningless', () => {
        const spec = sanitize_custom_graph_spec({
            ...create_default_custom_graph_spec(), source: 'runs', metric: { agg: 'avg', field: 'elapsed_s' },
        });
        expect(spec.metric).toEqual({ agg: 'count' });
        expect(validate_custom_graph_spec(spec).errors).toEqual([]);
    });

    it('turns percentages off without a split by or for values that do not add up', () => {
        const base = { ...create_default_custom_graph_spec(), viz: { type: 'stacked_bar', percent: true } };
        expect(sanitize_custom_graph_spec({ ...base, series: null }).viz.percent).toBe(false);
        expect(sanitize_custom_graph_spec({ ...base, metric: { agg: 'pass_rate' } }).viz.percent).toBe(false);
    });

    it('drops options that do not belong to the aggregation', () => {
        const spec = sanitize_custom_graph_spec({ ...create_default_custom_graph_spec(), metric: { agg: 'count', field: 'elapsed_s', ignoreSkips: true } });
        expect(spec.metric).toEqual({ agg: 'count' });
    });
});

describe('presets', () => {
    it.each(CUSTOM_GRAPH_PRESETS.map(preset => [preset.key, preset]))('%s is valid and runs', (_, preset) => {
        const { spec, errors } = validate_custom_graph_spec(preset.spec);
        expect(errors).toEqual([]);
        const result = run_custom_graph_query(spec, make_dataset());
        expect(result.series.length).toBeGreaterThan(0);
        expect(result.x.length).toBeGreaterThan(0);
    });

    it('most failed matches a hand count', () => {
        const preset = CUSTOM_GRAPH_PRESETS.find(item => item.key === 'mostFailed');
        const result = run_custom_graph_query(validate_custom_graph_spec(preset.spec).spec, make_dataset());
        expect(result.x.slice(0, 2).sort()).toEqual(['Invalid Login', 'Valid Login']);
        expect(result.series[0].values.slice(0, 2)).toEqual([1, 1]);
    });
});
