import { describe, it, expect, vi } from 'vitest';

vi.mock('@js/variables/globals.js', () => ({ inFullscreen: false }));

import {
    run_custom_graph_query,
    get_custom_graph_rows,
    parse_custom_graph_metadata,
    parse_custom_graph_custom_filters,
} from '@js/customgraphs/engine.js';
import { parse_test_tags } from '@js/common.js';
import { validate_custom_graph_spec } from '@js/customgraphs/spec.js';
import { make_dataset } from './dataset.js';

function query(rawSpec, data = make_dataset(), options = {}) {
    const { spec, errors } = validate_custom_graph_spec({ title: 't', viz: { type: 'bar' }, ...rawSpec });
    expect(errors).toEqual([]);
    return run_custom_graph_query(spec, data, options);
}

function series_values(result, key = '') {
    return result.series.find(item => item.key === key).values;
}

describe('parsers', () => {
    it('parses test tags and run tags', () => {
        expect(parse_test_tags('[smoke, login]')).toEqual(['smoke', 'login']);
        expect(parse_test_tags('dev,project_1')).toEqual(['dev', 'project_1']);
        expect(parse_test_tags('[]')).toEqual([]);
        expect(parse_test_tags(null)).toEqual([]);
        expect(parse_test_tags(['a'])).toEqual(['a']);
    });

    it('parses the python list repr of metadata, including values with colons', () => {
        expect(parse_custom_graph_metadata("['Browser: chromium', 'Url: http://x:8080']"))
            .toEqual({ Browser: 'chromium', Url: 'http://x:8080' });
        expect(parse_custom_graph_metadata(`["Owner: O'Neil"]`)).toEqual({ Owner: "O'Neil" });
        expect(parse_custom_graph_metadata('')).toEqual({});
    });

    it('parses custom filters', () => {
        expect(parse_custom_graph_custom_filters('Pipeline=nightly:Release=2026.31'))
            .toEqual({ Pipeline: 'nightly', Release: '2026.31' });
    });
});

describe('rows', () => {
    it('joins run fields onto child rows and derives test fields', () => {
        const rows = get_custom_graph_rows('tests', make_dataset());
        const row = rows.find(item => item.name === 'Add To Cart' && item.run === '2026-08-02 10:00:00');
        expect(row.suite).toBe('Web.Cart');
        expect(row.status).toBe('skipped');
        expect(row.attempts).toBe(2);
        expect(row.run_tags).toEqual(['dev', 'project_web']);
        expect(row.metadata.Browser).toBe('firefox');
        expect(row.custom_filters.Release).toBe('2026.31');
        expect(row.project_version).toBe('1.0');
    });

    it('caches rows per source array and rebuilds for new arrays', () => {
        const data = make_dataset();
        const first = get_custom_graph_rows('tests', data);
        expect(get_custom_graph_rows('tests', data)).toBe(first);
        expect(get_custom_graph_rows('tests', { ...data, tests: [...data.tests] })).not.toBe(first);
    });

    it('resolves the test field to the name or, with suite paths, the full name', () => {
        const data = make_dataset();
        expect(get_custom_graph_rows('tests', data)[0].test).toBe('Valid Login');
        const withPaths = get_custom_graph_rows('tests', data, { suitePaths: true });
        expect(withPaths[0].test).toBe('Web.Login.Valid Login');
        expect(get_custom_graph_rows('tests', data, { suitePaths: true })).toBe(withPaths);
    });
});

describe('grouping and aggregation', () => {
    it('counts test statuses per run in chronological order', () => {
        const result = query({ source: 'tests', x: { field: 'run' }, series: { field: 'status' }, metric: { agg: 'count' } });
        expect(result.xKind).toBe('run');
        expect(result.x).toEqual(['2026-08-01 10:00:00', '2026-08-02 10:00:00', '2026-08-10 10:00:00+02:00']);
        expect(series_values(result, 'passed')).toEqual([3, 1, 2]);
        expect(series_values(result, 'failed')).toEqual([0, 1, 1]);
        expect(series_values(result, 'skipped')).toEqual([0, 1, 0]);
    });

    it('gives the same per-run numbers from run counts as from test rows (status expansion)', () => {
        const fromRuns = query({ source: 'runs', x: { field: 'run' }, series: { field: 'status' }, metric: { agg: 'count' } });
        const fromTests = query({ source: 'tests', x: { field: 'run' }, series: { field: 'status' }, metric: { agg: 'count' } });
        expect(fromRuns.series).toEqual(fromTests.series);
    });

    it('uses the run label callback for run axes', () => {
        const result = query({ source: 'runs', x: { field: 'run' }, metric: { agg: 'count' } }, make_dataset(), { runLabel: run => run.run_alias });
        expect(result.xLabels).toEqual(['nightly-1', 'nightly-2', 'release-1']);
    });

    it('explodes tags so a test counts once per tag', () => {
        const result = query({ source: 'tests', x: { field: 'tags' }, metric: { agg: 'count' }, order: 'label' });
        expect(result.xLabels).toEqual(['(no tags)', 'login', 'smoke']);
        expect(series_values(result)).toEqual([3, 6, 3]);
    });

    it('calculates numeric aggregations', () => {
        const base = { source: 'tests', where: [{ field: 'name', op: 'is', value: 'Add To Cart' }], x: null };
        expect(series_values(query({ ...base, metric: { agg: 'sum', field: 'elapsed_s' } }))).toEqual([21]);
        expect(series_values(query({ ...base, metric: { agg: 'avg', field: 'elapsed_s' } }))).toEqual([7]);
        expect(series_values(query({ ...base, metric: { agg: 'min', field: 'elapsed_s' } }))).toEqual([5]);
        expect(series_values(query({ ...base, metric: { agg: 'max', field: 'elapsed_s' } }))).toEqual([9]);
        expect(series_values(query({ ...base, metric: { agg: 'median', field: 'elapsed_s' } }))).toEqual([7]);
        expect(series_values(query({ ...base, metric: { agg: 'p90', field: 'elapsed_s' } }))).toEqual([9]);
    });

    it('calculates the pass rate with and without skips', () => {
        const base = { source: 'tests', x: { field: 'run' } };
        expect(series_values(query({ ...base, metric: { agg: 'pass_rate' } }))).toEqual([100, 33.33, 66.67]);
        expect(series_values(query({ ...base, metric: { agg: 'pass_rate', ignoreSkips: true } }))).toEqual([100, 50, 66.67]);
    });

    it('counts distinct values', () => {
        const result = query({ source: 'tests', x: { field: 'run' }, metric: { agg: 'distinct', field: 'suite' } });
        expect(series_values(result)).toEqual([2, 2, 2]);
    });

    it('counts status flips per test and ignores skips', () => {
        const result = query({ source: 'tests', x: { field: 'name' }, metric: { agg: 'flips' }, order: 'label' });
        expect(result.x).toEqual(['Add To Cart', 'Invalid Login', 'Valid Login']);
        // Valid Login: pass, fail, pass = 2 flips; Invalid Login: pass, pass, fail = 1; Add To Cart: pass, skip, pass = 0
        expect(series_values(result)).toEqual([0, 1, 2]);
    });

    it('groups on metadata and custom filter keys', () => {
        const byBrowser = query({ source: 'runs', x: { field: 'metadata', key: 'Browser' }, metric: { agg: 'count' }, order: 'label' });
        expect(byBrowser.xLabels).toEqual(['(none)', 'chromium', 'firefox']);
        const byPipeline = query({ source: 'runs', x: { field: 'custom_filters', key: 'Pipeline' }, metric: { agg: 'count' }, order: 'label' });
        expect(byPipeline.x).toEqual(['nightly', 'release']);
        expect(series_values(byPipeline)).toEqual([2, 1]);
    });

    it('buckets run dates by day, week and month', () => {
        const base = { source: 'runs', metric: { agg: 'count' } };
        expect(query({ ...base, x: { field: 'run_date', bucket: 'day' } }).x).toEqual(['2026-08-01', '2026-08-02', '2026-08-10']);
        // 2026-08-01 is a Saturday: its week starts on Monday 2026-07-27
        expect(query({ ...base, x: { field: 'run_date', bucket: 'week' } }).x).toEqual(['2026-07-27', '2026-08-10']);
        expect(series_values(query({ ...base, x: { field: 'run_date', bucket: 'month' } }))).toEqual([3]);
    });

    it('fills missing cells with 0 for counts and null for averages', () => {
        const counts = query({ source: 'tests', x: { field: 'run' }, series: { field: 'name' }, metric: { agg: 'count' }, where: [{ field: 'status', op: 'is', value: 'failed' }] });
        expect(series_values(counts, 'Valid Login')).toEqual([1, 0]);
        const averages = query({ source: 'tests', x: { field: 'run' }, series: { field: 'name' }, metric: { agg: 'avg', field: 'elapsed_s' }, where: [{ field: 'status', op: 'is', value: 'failed' }] });
        expect(series_values(averages, 'Valid Login')).toEqual([3, null]);
    });

    it('keeps real values that look like the placeholder groups apart from them', () => {
        const data = make_dataset();
        data.tests = data.tests.map(test => test.name === 'Invalid Login' ? { ...test, tags: '[(no tags)]' } : test);
        const result = query({ source: 'tests', x: { field: 'tags' }, metric: { agg: 'count' }, order: 'label' }, data);
        expect(result.xLabels).toEqual(['(no tags)', '(no tags)', 'login', 'smoke']);
        expect(new Set(result.x).size).toBe(4);
    });

    it('splits the counts of runs by status into the matching status only', () => {
        const base = { source: 'runs', x: { field: 'run' }, series: { field: 'status' } };
        const failed = query({ ...base, metric: { agg: 'fail_count' } });
        expect(series_values(failed, 'passed')).toEqual([0, 0, 0]);
        expect(series_values(failed, 'failed')).toEqual([0, 1, 1]);
        const passed = query({ ...base, metric: { agg: 'pass_count' } });
        expect(series_values(passed, 'passed')).toEqual([3, 1, 2]);
        expect(series_values(passed, 'skipped')).toEqual([0, 0, 0]);
        // with status on the x axis the same rule applies
        const byStatus = query({ source: 'runs', x: { field: 'status' }, metric: { agg: 'fail_count' } });
        expect(byStatus.xLabels).toEqual(['Failed']);
        expect(series_values(byStatus)).toEqual([2]);
    });

    it('normalizes columns to percentages', () => {
        const result = query({ source: 'tests', x: { field: 'run' }, series: { field: 'status' }, metric: { agg: 'count' }, viz: { type: 'stacked_bar', percent: true } });
        expect(series_values(result, 'passed')).toEqual([100, 33.33, 66.67]);
        expect(result.meta.valueType).toBe('percent');
    });
});

describe('filters', () => {
    const count = (where, source = 'tests') => query({ source, where, x: null, metric: { agg: 'count' } }).series[0].values[0];

    it('applies string operators', () => {
        expect(count([{ field: 'name', op: 'is', value: 'Valid Login' }])).toBe(3);
        expect(count([{ field: 'name', op: 'is_not', value: 'Valid Login' }])).toBe(6);
        expect(count([{ field: 'name', op: 'contains', value: 'login' }])).toBe(6);
        expect(count([{ field: 'name', op: 'not_contains', value: 'login' }])).toBe(3);
        expect(count([{ field: 'name', op: 'matches', value: '^(valid|add)' }])).toBe(6);
    });

    it('applies number, status and tag operators', () => {
        expect(count([{ field: 'elapsed_s', op: 'gte', value: '5' }])).toBe(3);
        expect(count([{ field: 'elapsed_s', op: 'lt', value: '2' }])).toBe(3);
        expect(count([{ field: 'status', op: 'is', value: 'failed' }])).toBe(2);
        expect(count([{ field: 'tags', op: 'has', value: 'smoke' }])).toBe(3);
        expect(count([{ field: 'tags', op: 'has_not', value: 'login' }])).toBe(3);
        expect(count([{ field: 'run_tags', op: 'has', value: 'prod' }])).toBe(3);
    });

    it('applies kv and project version filters', () => {
        expect(count([{ field: 'metadata', key: 'Browser', op: 'is', value: 'firefox' }])).toBe(3);
        expect(count([{ field: 'custom_filters', key: 'Pipeline', op: 'is_not', value: 'nightly' }])).toBe(3);
        expect(count([{ field: 'project_version', op: 'is', value: '1.0' }], 'runs')).toBe(2);
    });

    it('applies date filters', () => {
        expect(count([{ field: 'run_date', op: 'after', value: '2026-08-02' }], 'runs')).toBe(2);
        expect(count([{ field: 'run_date', op: 'before', value: '2026-08-02' }], 'runs')).toBe(1);
        const now = new Date('2026-08-11T12:00:00');
        const result = query({ source: 'runs', where: [{ field: 'run_date', op: 'last_days', value: '5' }], x: null, metric: { agg: 'count' } }, make_dataset(), { now });
        expect(result.series[0].values).toEqual([1]);
    });

    it('ignores incomplete conditions', () => {
        expect(count([{ field: 'tags', op: 'has', value: '' }])).toBe(9);
        const { spec } = validate_custom_graph_spec({ source: 'tests', where: [{ field: 'metadata', op: 'is', value: 'firefox' }], x: null, metric: { agg: 'count' }, viz: { type: 'bar' } });
        expect(run_custom_graph_query(spec, make_dataset()).series[0].values).toEqual([9]);
    });

    it('ignores regular expressions that could freeze the dashboard', () => {
        // validation reports it; a spec that skipped validation still does not run it
        const spec = { ...validate_custom_graph_spec({ source: 'tests', x: null, metric: { agg: 'count' }, viz: { type: 'bar' } }).spec,
            where: [{ field: 'message', op: 'matches', value: '(a+)+$' }] };
        expect(run_custom_graph_query(spec, make_dataset()).series[0].values).toEqual([9]);
    });

    it('applies the extra row filter of the section filters', () => {
        const result = query({ source: 'tests', x: null, metric: { agg: 'count' } }, make_dataset(), { rowFilter: row => row.suite === 'Web.Cart' });
        expect(result.series[0].values).toEqual([3]);
    });

    it('ANDs conditions', () => {
        expect(count([{ field: 'tags', op: 'has', value: 'login' }, { field: 'status', op: 'is', value: 'passed' }])).toBe(4);
    });
});

describe('ordering and limits', () => {
    it('ranks categories by value and keeps the top N', () => {
        const result = query({ source: 'tests', x: { field: 'name' }, metric: { agg: 'avg', field: 'elapsed_s' }, order: 'value_desc', limit: 2 });
        expect(result.x).toEqual(['Add To Cart', 'Valid Login']);
    });

    it('ranks on the mean of the series for values that do not add up', () => {
        // Login has two tests of 3s, Cart one test of 5s: summed Login (6) would rank above Cart (5)
        const data = make_dataset();
        data.tests = data.tests.map(test => ({ ...test, elapsed_s: test.name === 'Add To Cart' ? '5' : '3' }));
        const result = query({ source: 'tests', x: { field: 'suite' }, series: { field: 'name' }, metric: { agg: 'avg', field: 'elapsed_s' }, order: 'value_desc' }, data);
        expect(result.x).toEqual(['Web.Cart', 'Web.Login']);
    });

    it('leaves zero values out of a ranking of counts', () => {
        const result = query({ source: 'tests', x: { field: 'name' }, metric: { agg: 'fail_count' }, order: 'value_desc', limit: 10 });
        expect(result.x.sort()).toEqual(['Invalid Login', 'Valid Login']);
    });

    it('keeps zero values on a chronological axis', () => {
        const result = query({ source: 'tests', x: { field: 'run' }, metric: { agg: 'fail_count' } });
        expect(series_values(result)).toEqual([0, 1, 1]);
    });

    it('keeps the most recent N values on a run axis', () => {
        const result = query({ source: 'runs', x: { field: 'run' }, metric: { agg: 'count' }, limit: 2 });
        expect(result.x).toEqual(['2026-08-02 10:00:00', '2026-08-10 10:00:00+02:00']);
    });

    it('caps the number of series at 10 and reports the rest', () => {
        const data = make_dataset();
        data.tests = Array.from({ length: 12 }, (_, i) => ({ ...data.tests[0], name: `T${i}` }));
        const result = query({ source: 'tests', x: { field: 'run' }, series: { field: 'name' }, metric: { agg: 'count' } }, data);
        expect(result.series).toHaveLength(10);
        expect(result.meta.hiddenSeries).toBe(2);
    });
});

describe('heatmap', () => {
    it('keeps up to 50 rows and drops rows of only zeros for counts', () => {
        const data = make_dataset();
        data.tests = Array.from({ length: 60 }, (_, i) => ({ ...data.tests[0], name: `T${i}`, failed: i < 55 ? 1 : 0, passed: i < 55 ? 0 : 1 }));
        const result = query({ source: 'tests', x: { field: 'run' }, series: { field: 'name' }, metric: { agg: 'fail_count' }, viz: { type: 'heatmap' } }, data);
        expect(result.series).toHaveLength(50);
        expect(result.meta.hiddenSeries).toBe(5);
        expect(result.series.every(item => item.values[0] === 1)).toBe(true);
    });

    it('keeps zero rows for metrics that are not counts', () => {
        const result = query({ source: 'tests', x: { field: 'run' }, series: { field: 'name' }, metric: { agg: 'pass_rate' }, viz: { type: 'heatmap' } });
        expect(result.series.map(item => item.key).sort()).toEqual(['Add To Cart', 'Invalid Login', 'Valid Login']);
    });
});

describe('performance', () => {
    it('handles 200k test rows in reasonable time', () => {
        const data = make_dataset();
        const base = data.tests;
        data.tests = Array.from({ length: 200000 }, (_, i) => ({ ...base[i % base.length], name: `Test ${i % 500}` }));
        const started = performance.now();
        query({ source: 'tests', x: { field: 'run' }, series: { field: 'status' }, metric: { agg: 'count' } }, data);
        query({ source: 'tests', x: { field: 'name' }, metric: { agg: 'flips' }, order: 'value_desc', limit: 10 }, data);
        expect(performance.now() - started).toBeLessThan(3000);
    });
});
