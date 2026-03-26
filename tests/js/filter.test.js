import { describe, it, expect, vi } from 'vitest';
import { strip_tz_suffix } from '@js/common.js';

// Test the pure data transformation logic from filter.js.
// Most filter functions in filter.js touch the DOM (document.getElementById),
// so here we test the reusable logic patterns (sorting, data transformations)
// that the filter functions rely on.

// Reimplementation of sort_wall_clock from filter.js for direct testing
function sort_wall_clock(data) {
    return [...data].sort((a, b) => {
        const ak = strip_tz_suffix(a.run_start);
        const bk = strip_tz_suffix(b.run_start);
        return ak < bk ? -1 : ak > bk ? 1 : 0;
    });
}

describe('filter.js pure logic', () => {
    describe('sort_wall_clock logic', () => {

        it('sorts runs by wall-clock time', () => {
            const data = [
                { run_start: '2025-01-15 10:00:00+02:00' },
                { run_start: '2025-01-15 08:00:00+02:00' },
                { run_start: '2025-01-15 09:00:00+02:00' },
            ];
            const sorted = sort_wall_clock(data);
            expect(sorted[0].run_start).toBe('2025-01-15 08:00:00+02:00');
            expect(sorted[1].run_start).toBe('2025-01-15 09:00:00+02:00');
            expect(sorted[2].run_start).toBe('2025-01-15 10:00:00+02:00');
        });

        it('sorts runs with mixed timezone offsets by wall-clock', () => {
            const data = [
                { run_start: '2025-01-15 12:00:00+05:00' },
                { run_start: '2025-01-15 08:00:00+01:00' },
                { run_start: '2025-01-15 10:00:00+02:00' },
            ];
            const sorted = sort_wall_clock(data);
            // Wall-clock sorting: 08:00, 10:00, 12:00
            expect(sorted[0].run_start).toBe('2025-01-15 08:00:00+01:00');
            expect(sorted[1].run_start).toBe('2025-01-15 10:00:00+02:00');
            expect(sorted[2].run_start).toBe('2025-01-15 12:00:00+05:00');
        });

        it('handles data without timezone suffixes', () => {
            const data = [
                { run_start: '2025-01-15 10:00:00' },
                { run_start: '2025-01-15 08:00:00' },
            ];
            const sorted = sort_wall_clock(data);
            expect(sorted[0].run_start).toBe('2025-01-15 08:00:00');
            expect(sorted[1].run_start).toBe('2025-01-15 10:00:00');
        });

        it('returns empty array for empty input', () => {
            expect(sort_wall_clock([])).toEqual([]);
        });

        it('does not mutate original array', () => {
            const data = [
                { run_start: '2025-01-15 10:00:00' },
                { run_start: '2025-01-15 08:00:00' },
            ];
            const original = [...data];
            sort_wall_clock(data);
            expect(data).toEqual(original);
        });
    });

    describe('remove_milliseconds logic', () => {
        function remove_milliseconds(data, showMilliseconds) {
            if (showMilliseconds) return data;
            return data.map(obj => {
                const rs = obj.run_start;
                const datetime = rs.slice(0, 19);
                const suffix = rs.slice(-6);
                const hasTz = /^[+-]\d{2}:\d{2}$/.test(suffix);
                return { ...obj, run_start: hasTz ? datetime + suffix : datetime };
            });
        }

        it('removes milliseconds when disabled', () => {
            const data = [{ run_start: '2025-01-15 09:05:03.123+02:00', name: 'run1' }];
            const result = remove_milliseconds(data, false);
            expect(result[0].run_start).toBe('2025-01-15 09:05:03+02:00');
        });

        it('preserves milliseconds when enabled', () => {
            const data = [{ run_start: '2025-01-15 09:05:03.123+02:00', name: 'run1' }];
            const result = remove_milliseconds(data, true);
            expect(result[0].run_start).toBe('2025-01-15 09:05:03.123+02:00');
        });

        it('handles timestamps without timezone', () => {
            const data = [{ run_start: '2025-01-15 09:05:03.123', name: 'run1' }];
            const result = remove_milliseconds(data, false);
            expect(result[0].run_start).toBe('2025-01-15 09:05:03');
        });

        it('does not mutate original data', () => {
            const data = [{ run_start: '2025-01-15 09:05:03.123+02:00', name: 'run1' }];
            remove_milliseconds(data, false);
            expect(data[0].run_start).toBe('2025-01-15 09:05:03.123+02:00');
        });
    });

    describe('remove_timezones logic', () => {
        function remove_timezones(data, showTimezones) {
            if (showTimezones) return data;
            return data.map(obj => {
                const rs = obj.run_start;
                const suffix = rs.slice(-6);
                const hasTz = /^[+-]\d{2}:\d{2}$/.test(suffix);
                if (!hasTz) return obj;
                return { ...obj, run_start: rs.slice(0, -6) };
            });
        }

        it('removes timezone suffix when disabled', () => {
            const data = [{ run_start: '2025-01-15 09:05:03+02:00' }];
            const result = remove_timezones(data, false);
            expect(result[0].run_start).toBe('2025-01-15 09:05:03');
        });

        it('preserves timezone suffix when enabled', () => {
            const data = [{ run_start: '2025-01-15 09:05:03+02:00' }];
            const result = remove_timezones(data, true);
            expect(result[0].run_start).toBe('2025-01-15 09:05:03+02:00');
        });

        it('handles timestamps without timezone', () => {
            const data = [{ run_start: '2025-01-15 09:05:03' }];
            const result = remove_timezones(data, false);
            expect(result[0].run_start).toBe('2025-01-15 09:05:03');
        });

        it('handles negative timezone offset', () => {
            const data = [{ run_start: '2025-01-15 09:05:03-05:00' }];
            const result = remove_timezones(data, false);
            expect(result[0].run_start).toBe('2025-01-15 09:05:03');
        });
    });

    describe('filter_data logic', () => {
        it('filters data based on matching run_start values', () => {
            const filteredRuns = [
                { run_start: '2025-01-15 09:00:00' },
                { run_start: '2025-01-15 10:00:00' },
            ];
            const data = [
                { run_start: '2025-01-15 09:00:00', name: 'suite1' },
                { run_start: '2025-01-15 10:00:00', name: 'suite2' },
                { run_start: '2025-01-15 11:00:00', name: 'suite3' },
            ];
            const validRunStarts = filteredRuns.map(v => v.run_start);
            const result = data.filter(v => validRunStarts.includes(v.run_start));
            expect(result).toHaveLength(2);
            expect(result[0].name).toBe('suite1');
            expect(result[1].name).toBe('suite2');
        });

        it('returns empty array when no runs match', () => {
            const filteredRuns = [{ run_start: '2025-01-15 12:00:00' }];
            const data = [
                { run_start: '2025-01-15 09:00:00', name: 'suite1' },
            ];
            const validRunStarts = filteredRuns.map(v => v.run_start);
            const result = data.filter(v => validRunStarts.includes(v.run_start));
            expect(result).toHaveLength(0);
        });
    });

    describe('convert_timezone logic', () => {
        // Reimplementation of filter.js convert_timezone for direct testing
        function convert_timezone(data, convertTimezone) {
            if (!convertTimezone) return data;
            return data.map(obj => {
                const rs = obj.run_start;
                const suffix = rs.slice(-6);
                const hasTz = /^[+-]\d{2}:\d{2}$/.test(suffix);
                if (!hasTz) return obj;

                const isoStr = rs.replace(' ', 'T');
                const date = new Date(isoStr);
                if (isNaN(date.getTime())) return obj;

                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                const hours = String(date.getHours()).padStart(2, '0');
                const minutes = String(date.getMinutes()).padStart(2, '0');
                const seconds = String(date.getSeconds()).padStart(2, '0');

                const tzOffset = -date.getTimezoneOffset();
                const tzSign = tzOffset >= 0 ? '+' : '-';
                const tzHours = String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, '0');
                const tzMins = String(Math.abs(tzOffset) % 60).padStart(2, '0');
                const localTz = `${tzSign}${tzHours}:${tzMins}`;

                const mainPart = rs.slice(0, -6);
                const subSecond = mainPart.length > 19 ? mainPart.slice(19) : '';
                const localStr = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}${subSecond}${localTz}`;

                return { ...obj, run_start: localStr };
            });
        }

        it('returns data unchanged when convertTimezone is false', () => {
            const data = [{ run_start: '2025-01-15 10:00:00+02:00', name: 'test1' }];
            const result = convert_timezone(data, false);
            expect(result).toEqual(data);
        });

        it('returns data unchanged for timestamps without timezone offset', () => {
            const data = [{ run_start: '2025-01-15 10:00:00', name: 'test1' }];
            const result = convert_timezone(data, true);
            expect(result[0].run_start).toBe('2025-01-15 10:00:00');
        });

        it('converts timestamp to local timezone', () => {
            const data = [{ run_start: '2025-01-15 10:00:00+00:00', name: 'test1' }];
            const result = convert_timezone(data, true);
            // The converted timestamp should end with the local timezone offset
            const localOffset = -new Date('2025-01-15T10:00:00+00:00').getTimezoneOffset();
            const sign = localOffset >= 0 ? '+' : '-';
            const h = String(Math.floor(Math.abs(localOffset) / 60)).padStart(2, '0');
            const m = String(Math.abs(localOffset) % 60).padStart(2, '0');
            const expectedSuffix = `${sign}${h}:${m}`;
            expect(result[0].run_start).toMatch(new RegExp(`\\${expectedSuffix}$`));
        });

        it('preserves sub-second precision', () => {
            const data = [{ run_start: '2025-01-15 10:00:00.123456+00:00', name: 'test1' }];
            const result = convert_timezone(data, true);
            expect(result[0].run_start).toContain('.123456');
        });

        it('does not mutate original data', () => {
            const data = [{ run_start: '2025-01-15 10:00:00+02:00', name: 'test1' }];
            const original = data[0].run_start;
            convert_timezone(data, true);
            expect(data[0].run_start).toBe(original);
        });

        it('handles invalid date gracefully', () => {
            const data = [{ run_start: 'not-a-date+00:00', name: 'test1' }];
            const result = convert_timezone(data, true);
            expect(result[0].run_start).toBe('not-a-date+00:00');
        });

        it('handles negative timezone offsets', () => {
            const data = [{ run_start: '2025-01-15 10:00:00-05:00', name: 'test1' }];
            const result = convert_timezone(data, true);
            // Should produce a valid date string with local offset
            expect(result[0].run_start).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
        });

        it('preserves other object properties', () => {
            const data = [{ run_start: '2025-01-15 10:00:00+02:00', name: 'test1', status: 'PASS' }];
            const result = convert_timezone(data, true);
            expect(result[0].name).toBe('test1');
            expect(result[0].status).toBe('PASS');
        });
    });
});
