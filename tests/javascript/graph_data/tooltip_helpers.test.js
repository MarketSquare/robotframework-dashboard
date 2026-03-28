import { describe, it, expect } from 'vitest';
import { build_tooltip_meta, lookup_tooltip_meta, format_status } from '@js/graph_data/tooltip_helpers.js';


describe('build_tooltip_meta', () => {
    const sampleData = [
        { run_start: '2025-01-15 10:00:00', run_alias: 'Run A', elapsed_s: '5.5', passed: 1, failed: 0, skipped: 0, message: '' },
        { run_start: '2025-01-16 10:00:00', run_alias: 'Run B', elapsed_s: '3.2', passed: 0, failed: 1, skipped: 0, message: 'Assertion failed' },
    ];

    it('populates byLabel with run_start and run_alias keys', () => {
        const meta = build_tooltip_meta(sampleData);
        expect(meta.byLabel['2025-01-15 10:00:00']).toBeDefined();
        expect(meta.byLabel['Run A']).toBeDefined();
        expect(meta.byLabel['2025-01-16 10:00:00']).toBeDefined();
        expect(meta.byLabel['Run B']).toBeDefined();
    });

    it('populates byTime with timestamp keys', () => {
        const meta = build_tooltip_meta(sampleData);
        const t1 = new Date('2025-01-15T10:00:00').getTime();
        const t2 = new Date('2025-01-16T10:00:00').getTime();
        expect(meta.byTime[t1]).toBeDefined();
        expect(meta.byTime[t2]).toBeDefined();
    });

    it('parses elapsed from the specified durationField', () => {
        const data = [{ run_start: '2025-01-15 10:00:00', run_alias: 'A', total_time_s: '12.5', passed: 0, failed: 0, skipped: 0, message: '' }];
        const meta = build_tooltip_meta(data, 'total_time_s');
        expect(meta.byLabel['A'].elapsed_s).toBe(12.5);
    });

    it('defaults to elapsed_s field', () => {
        const meta = build_tooltip_meta(sampleData);
        expect(meta.byLabel['Run A'].elapsed_s).toBe(5.5);
    });

    it('stores pass/fail/skip counts and message', () => {
        const meta = build_tooltip_meta(sampleData);
        expect(meta.byLabel['Run B']).toEqual({
            elapsed_s: 3.2,
            passed: 0,
            failed: 1,
            skipped: 0,
            message: 'Assertion failed',
        });
    });

    it('handles empty data', () => {
        const meta = build_tooltip_meta([]);
        expect(meta.byLabel).toEqual({});
        expect(meta.byTime).toEqual({});
    });

    it('handles missing optional fields gracefully', () => {
        const data = [{ run_start: '2025-01-15 10:00:00', run_alias: 'A' }];
        const meta = build_tooltip_meta(data);
        expect(meta.byLabel['A']).toEqual({
            elapsed_s: 0,
            passed: 0,
            failed: 0,
            skipped: 0,
            message: '',
        });
    });

    describe('aggregate mode', () => {
        it('sums values for the same run_start when aggregate=true', () => {
            const data = [
                { run_start: '2025-01-15 10:00:00', run_alias: 'Run A', elapsed_s: '5', passed: 3, failed: 1, skipped: 0, message: '' },
                { run_start: '2025-01-15 10:00:00', run_alias: 'Run A', elapsed_s: '3', passed: 2, failed: 0, skipped: 1, message: '' },
            ];
            const meta = build_tooltip_meta(data, 'elapsed_s', true);
            expect(meta.byLabel['Run A'].elapsed_s).toBe(8);
            expect(meta.byLabel['Run A'].passed).toBe(5);
            expect(meta.byLabel['Run A'].failed).toBe(1);
            expect(meta.byLabel['Run A'].skipped).toBe(1);
        });

        it('sums byTime for same timestamp when aggregate=true', () => {
            const data = [
                { run_start: '2025-01-15 10:00:00', run_alias: 'A', elapsed_s: '2', passed: 1, failed: 0, skipped: 0, message: '' },
                { run_start: '2025-01-15 10:00:00', run_alias: 'A', elapsed_s: '3', passed: 0, failed: 1, skipped: 0, message: '' },
            ];
            const meta = build_tooltip_meta(data, 'elapsed_s', true);
            const t = new Date('2025-01-15T10:00:00').getTime();
            expect(meta.byTime[t].elapsed_s).toBe(5);
        });

        it('does not aggregate different run_starts', () => {
            const data = [
                { run_start: '2025-01-15 10:00:00', run_alias: 'A', elapsed_s: '5', passed: 1, failed: 0, skipped: 0, message: '' },
                { run_start: '2025-01-16 10:00:00', run_alias: 'B', elapsed_s: '3', passed: 0, failed: 1, skipped: 0, message: '' },
            ];
            const meta = build_tooltip_meta(data, 'elapsed_s', true);
            expect(meta.byLabel['A'].elapsed_s).toBe(5);
            expect(meta.byLabel['B'].elapsed_s).toBe(3);
        });

        it('keeps first entry when aggregate=false and same key appears again', () => {
            const data = [
                { run_start: '2025-01-15 10:00:00', run_alias: 'A', elapsed_s: '5', passed: 1, failed: 0, skipped: 0, message: '' },
                { run_start: '2025-01-15 10:00:00', run_alias: 'A', elapsed_s: '3', passed: 0, failed: 1, skipped: 0, message: '' },
            ];
            const meta = build_tooltip_meta(data, 'elapsed_s', false);
            // First entry wins, no aggregation
            expect(meta.byLabel['A'].elapsed_s).toBe(5);
            expect(meta.byLabel['A'].passed).toBe(1);
        });
    });
});


describe('lookup_tooltip_meta', () => {
    const meta = {
        byLabel: {
            'Test A': { elapsed_s: 5, passed: 1, failed: 0, skipped: 0, message: '' },
            '2025-01-15 10:00:00': { elapsed_s: 3, passed: 0, failed: 1, skipped: 0, message: 'err' },
        },
        byTime: {
            [new Date('2025-01-15T10:00:00').getTime()]: { elapsed_s: 3, passed: 0, failed: 1, skipped: 0, message: 'err' },
        },
    };

    it('returns null for empty tooltipItems', () => {
        expect(lookup_tooltip_meta(meta, [])).toBeNull();
        expect(lookup_tooltip_meta(meta, null)).toBeNull();
        expect(lookup_tooltip_meta(meta, undefined)).toBeNull();
    });

    it('looks up by chart data labels (bar charts)', () => {
        const tooltipItems = [{
            dataIndex: 0,
            chart: { data: { labels: ['Test A', 'Test B'] } },
        }];
        const result = lookup_tooltip_meta(meta, tooltipItems);
        expect(result).toEqual(meta.byLabel['Test A']);
    });

    it('looks up by raw x value (time axis)', () => {
        const t = new Date('2025-01-15T10:00:00');
        const tooltipItems = [{
            dataIndex: 0,
            chart: { data: { labels: [] } },
            raw: { x: t },
        }];
        const result = lookup_tooltip_meta(meta, tooltipItems);
        expect(result).toEqual(meta.byTime[t.getTime()]);
    });

    it('falls back to tooltip label text', () => {
        const tooltipItems = [{
            dataIndex: 99,
            chart: { data: { labels: [] } },
            label: 'Test A',
        }];
        const result = lookup_tooltip_meta(meta, tooltipItems);
        expect(result).toEqual(meta.byLabel['Test A']);
    });

    it('returns null when no match found', () => {
        const tooltipItems = [{
            dataIndex: 0,
            chart: { data: { labels: [] } },
            label: 'Unknown',
        }];
        expect(lookup_tooltip_meta(meta, tooltipItems)).toBeNull();
    });
});


describe('format_status', () => {
    it('returns PASS for single pass', () => {
        expect(format_status({ passed: 1, failed: 0, skipped: 0 })).toBe('PASS');
    });

    it('returns FAIL for single fail', () => {
        expect(format_status({ passed: 0, failed: 1, skipped: 0 })).toBe('FAIL');
    });

    it('returns SKIP for single skip', () => {
        expect(format_status({ passed: 0, failed: 0, skipped: 1 })).toBe('SKIP');
    });

    it('returns aggregate string for mixed counts', () => {
        expect(format_status({ passed: 5, failed: 2, skipped: 1 })).toBe('Passed: 5, Failed: 2, Skipped: 1');
    });

    it('returns aggregate string when all zeros', () => {
        expect(format_status({ passed: 0, failed: 0, skipped: 0 })).toBe('Passed: 0, Failed: 0, Skipped: 0');
    });

    it('returns aggregate string for multiple passes', () => {
        expect(format_status({ passed: 3, failed: 0, skipped: 0 })).toBe('Passed: 3, Failed: 0, Skipped: 0');
    });
});
