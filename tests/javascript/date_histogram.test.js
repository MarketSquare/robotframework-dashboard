import { describe, it, expect, vi } from 'vitest';

// Mock the modules that only exist once the data is embedded in the generated HTML. The
// bucketing takes its run data as an argument, so the empty mock data does not matter.
vi.mock('@js/variables/data.js', () => import('./mocks/data.js'));
vi.mock('@js/variables/globals.js', () => import('./mocks/globals.js'));
vi.mock('@js/variables/graphs.js', () => import('./mocks/graphs.js'));
vi.mock('@js/variables/chartconfig.js', () => import('./mocks/chartconfig.js'));

import { build_histogram_buckets, build_tooltip_content, get_run_status, pick_bucket_unit } from '@js/filter/date_histogram.js';

function make_run(run) {
    return { name: 'run', run_start: '2026-01-01 10:00:00', passed: 1, failed: 0, skipped: 0, ...run };
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// the bucket unit of a window, as its label
function unit_label_for(spanMs) {
    return pick_bucket_unit(spanMs).label;
}

describe('pick_bucket_unit', () => {
    it('picks the smallest unit that keeps the window at or below 60 bars', () => {
        expect(unit_label_for(30 * MINUTE)).toBe('1 minute');
        expect(unit_label_for(4 * HOUR)).toBe('5 minutes');
        expect(unit_label_for(12 * HOUR)).toBe('15 minutes');
        expect(unit_label_for(2 * DAY)).toBe('1 hour');
        expect(unit_label_for(10 * DAY)).toBe('6 hours');
        expect(unit_label_for(45 * DAY)).toBe('1 day');
        expect(unit_label_for(365 * DAY)).toBe('1 week');
    });

    it('falls back to the largest unit for a window no unit can cover', () => {
        expect(unit_label_for(20 * 365 * DAY)).toBe('1 month');
    });
});

describe('build_histogram_buckets', () => {
    const hourUnit = pick_bucket_unit(2 * DAY);
    const dayUnit = pick_bucket_unit(45 * DAY);

    it('starts the buckets on a unit boundary instead of on the window edge', () => {
        const histogram = build_histogram_buckets([], new Date('2026-01-01T10:30:00'), new Date('2026-01-03T10:30:00'), dayUnit);
        expect(histogram.buckets[0].start).toEqual(new Date('2026-01-01T00:00:00'));
        expect(histogram.buckets[1].start).toEqual(new Date('2026-01-02T00:00:00'));
        expect(histogram.buckets.at(-1).start).toEqual(new Date('2026-01-03T00:00:00'));
    });

    it('counts a run in the bucket it started in, split by run status', () => {
        const runs = [
            make_run({ run_start: '2026-01-01 10:05:00', passed: 3, failed: 0, skipped: 0 }),
            make_run({ run_start: '2026-01-01 10:55:00', passed: 2, failed: 1, skipped: 0 }),
            make_run({ run_start: '2026-01-01 11:05:00', passed: 0, failed: 0, skipped: 4 }),
        ];
        const histogram = build_histogram_buckets(runs, new Date('2026-01-01T10:00:00'), new Date('2026-01-01T12:00:00'), hourUnit);
        expect(histogram.total).toBe(3);
        expect(histogram.buckets[0]).toMatchObject({ passed: 1, failed: 1, skipped: 0 });
        expect(histogram.buckets[1]).toMatchObject({ passed: 0, failed: 0, skipped: 1 });
    });

    it('leaves out the runs outside the window', () => {
        const runs = [
            make_run({ run_start: '2026-01-01 09:00:00' }),
            make_run({ run_start: '2026-01-01 10:30:00' }),
            make_run({ run_start: '2026-01-01 13:00:00' }),
        ];
        const histogram = build_histogram_buckets(runs, new Date('2026-01-01T10:00:00'), new Date('2026-01-01T12:00:00'), hourUnit);
        expect(histogram.total).toBe(1);
        expect(histogram.buckets[0].passed).toBe(1);
    });

    it('keeps a bucket per unit so the bars are evenly spaced in time', () => {
        const histogram = build_histogram_buckets([], new Date('2026-01-01T00:00:00'), new Date('2026-01-01T05:00:00'), hourUnit);
        expect(histogram.buckets).toHaveLength(6);
        expect(histogram.buckets.every(bucket => bucket.passed === 0 && bucket.failed === 0 && bucket.skipped === 0)).toBe(true);
    });

    it('advances a day bucket by calendar date so a DST switch does not shift it', () => {
        // the night of 2026-03-29 is 23 hours long in Central European Time
        const histogram = build_histogram_buckets([], new Date('2026-03-28T12:00:00'), new Date('2026-03-31T12:00:00'), dayUnit);
        for (const bucket of histogram.buckets) {
            expect(bucket.start.getHours()).toBe(0);
        }
    });
});

describe('get_run_status', () => {
    it('calls any run with a failure failed', () => {
        expect(get_run_status(make_run({ passed: 10, failed: 1, skipped: 0 }))).toBe('failed');
    });

    it('calls a run that only skipped skipped', () => {
        expect(get_run_status(make_run({ passed: 0, failed: 0, skipped: 3 }))).toBe('skipped');
    });

    it('calls a run with passes and skips passed', () => {
        expect(get_run_status(make_run({ passed: 2, failed: 0, skipped: 3 }))).toBe('passed');
    });
});

describe('tooltip contents', () => {
    const hourUnit = pick_bucket_unit(2 * DAY);

    function histogram_of(runs) {
        return build_histogram_buckets(runs, new Date('2026-01-01T10:00:00'), new Date('2026-01-01T12:00:00'), hourUnit);
    }

    it('holds a block per run with the three status rows', () => {
        const histogram = histogram_of([
            make_run({ run_start: '2026-01-01 10:05:00', passed: 100, failed: 5, skipped: 3 }),
            make_run({ run_start: '2026-01-01 10:45:00', name: 'api', passed: 50, failed: 0, skipped: 0 }),
        ]);
        const content = build_tooltip_content(histogram, 0);
        expect(content.title).toBe('01.01.2026 10:00 - 10:59');
        expect(content.runs.map(run => run.label)).toEqual(['10:05 run', '10:45 api']);
        expect(content.runs[0].rows.map(row => `${row.label}: ${row.value}`))
            .toEqual(['Failed: 5', 'Skipped: 3', 'Passed: 100']);
        expect(content.runs[0].rows.every(row => row.color)).toBe(true);
    });

    it('sorts the runs of a bucket by start time', () => {
        const histogram = histogram_of([
            make_run({ run_start: '2026-01-01 10:45:00', name: 'late' }),
            make_run({ run_start: '2026-01-01 10:05:00', name: 'early' }),
        ]);
        expect(build_tooltip_content(histogram, 0).runs.map(run => run.label)).toEqual(['10:05 early', '10:45 late']);
    });

    it('cuts off a long bucket and counts what it left out', () => {
        const runs = Array.from({ length: 9 }, (item, index) =>
            make_run({ run_start: `2026-01-01 10:0${index}:00`, name: `run_${index}` }));
        const content = build_tooltip_content(histogram_of(runs), 0);
        expect(content.runs).toHaveLength(6);
        expect(content.hiddenRuns).toBe(3);
    });

    it('repeats the date of a run only when a bar covers more than a day', () => {
        const weekUnit = pick_bucket_unit(365 * DAY);
        const histogram = build_histogram_buckets(
            [make_run({ run_start: '2026-01-07 09:30:00' })],
            new Date('2026-01-05T00:00:00'), new Date('2026-01-11T00:00:00'), weekUnit);
        expect(build_tooltip_content(histogram, 0).runs[0].label).toBe('07.01 09:30 run');
    });

    it('keeps the time range of an empty bucket and leaves the blocks out', () => {
        const content = build_tooltip_content(histogram_of([]), 0);
        expect(content.title).toBe('01.01.2026 10:00 - 10:59');
        expect(content.runs).toEqual([]);
    });
});
