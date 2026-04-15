import { describe, it, expect, vi } from 'vitest';

vi.mock('@js/variables/globals.js', () => import('./mocks/globals.js'));

import {
    get_next_folder_level,
    format_duration,
    compare_to_average,
    space_to_camelcase,
    underscore_to_camelcase,
    camelcase_to_underscore,
    format_date_to_string,
    transform_file_path,
    combine_paths,
    debounce,
    strip_tz_suffix,
} from '@js/common.js';


describe('get_next_folder_level', () => {
    it('returns next level when currentPath is a prefix of fullPath', () => {
        expect(get_next_folder_level('a', 'a.b.c')).toBe('a.b');
    });

    it('returns deeper next level', () => {
        expect(get_next_folder_level('a.b', 'a.b.c.d')).toBe('a.b.c');
    });

    it('returns currentPath when already at full depth', () => {
        expect(get_next_folder_level('a.b.c', 'a.b.c')).toBe('a.b.c');
    });

    it('returns currentPath when not a prefix of fullPath', () => {
        expect(get_next_folder_level('x.y', 'a.b.c')).toBe('x.y');
    });

    it('handles single-level paths', () => {
        expect(get_next_folder_level('root', 'root')).toBe('root');
    });
});


describe('format_duration', () => {
    it('formats sub-second values', () => {
        expect(format_duration(0.5)).toBe('0.5s');
    });

    it('formats zero seconds', () => {
        expect(format_duration(0)).toBe('0s');
    });

    it('formats exact seconds with no trailing zeros', () => {
        expect(format_duration(5)).toBe('5s');
    });

    it('formats sub-minute with decimals', () => {
        expect(format_duration(45.12)).toBe('45.12s');
    });

    it('strips trailing zeros for sub-minute', () => {
        expect(format_duration(10.10)).toBe('10.1s');
    });

    it('formats minutes and seconds', () => {
        expect(format_duration(90)).toBe('1m 30s');
    });

    it('formats exact minutes', () => {
        expect(format_duration(120)).toBe('2m');
    });

    it('formats hours', () => {
        expect(format_duration(3661)).toBe('1h 1m 1s');
    });

    it('formats days', () => {
        expect(format_duration(86400)).toBe('1d');
    });

    it('does not show seconds when days > 0', () => {
        expect(format_duration(86400 + 3600 + 60 + 30)).toBe('1d 1h 1m');
    });

    it('formats days and hours without seconds', () => {
        expect(format_duration(90000)).toBe('1d 1h');
    });
});


describe('compare_to_average', () => {
    it('returns text-passed when duration is below threshold', () => {
        expect(compare_to_average(50, 100, 20)).toBe('text-passed');
    });

    it('returns text-failed when duration is above threshold', () => {
        expect(compare_to_average(150, 100, 20)).toBe('text-failed');
    });

    it('returns empty string when within range', () => {
        expect(compare_to_average(100, 100, 20)).toBe('');
    });

    it('returns empty string at exact lower boundary', () => {
        expect(compare_to_average(80, 100, 20)).toBe('');
    });

    it('returns empty string at exact upper boundary', () => {
        expect(compare_to_average(120, 100, 20)).toBe('');
    });

    it('handles string percent parameter', () => {
        expect(compare_to_average(50, 100, '20')).toBe('text-passed');
    });
});


describe('space_to_camelcase', () => {
    it('converts space-separated words to camelCase', () => {
        expect(space_to_camelcase('hello world')).toBe('helloWorld');
    });

    it('handles single word', () => {
        expect(space_to_camelcase('hello')).toBe('hello');
    });

    it('handles multiple words', () => {
        expect(space_to_camelcase('run statistics graph')).toBe('runStatisticsGraph');
    });
});


describe('underscore_to_camelcase', () => {
    it('converts underscored string to camelCase', () => {
        expect(underscore_to_camelcase('hello_world')).toBe('helloWorld');
    });

    it('handles multiple underscores', () => {
        expect(underscore_to_camelcase('run_statistics_graph')).toBe('runStatisticsGraph');
    });

    it('handles no underscores', () => {
        expect(underscore_to_camelcase('hello')).toBe('hello');
    });
});


describe('camelcase_to_underscore', () => {
    it('converts camelCase to underscore_case', () => {
        expect(camelcase_to_underscore('helloWorld')).toBe('hello_world');
    });

    it('handles multiple capitals', () => {
        expect(camelcase_to_underscore('runStatisticsGraph')).toBe('run_statistics_graph');
    });

    it('handles consecutive capitals', () => {
        expect(camelcase_to_underscore('myHTTPClient')).toBe('my_httpclient');
    });

    it('handles no capitals', () => {
        expect(camelcase_to_underscore('hello')).toBe('hello');
    });
});


describe('format_date_to_string', () => {
    it('formats a date object to YYYY-MM-DD HH:MM:SS', () => {
        const date = new Date(2025, 0, 15, 9, 5, 3); // Jan 15, 2025 09:05:03
        expect(format_date_to_string(date)).toBe('2025-01-15 09:05:03');
    });

    it('pads single-digit values', () => {
        const date = new Date(2025, 2, 3, 1, 2, 3); // Mar 3, 2025 01:02:03
        expect(format_date_to_string(date)).toBe('2025-03-03 01:02:03');
    });

    it('handles midnight', () => {
        const date = new Date(2025, 11, 31, 0, 0, 0); // Dec 31, 2025 00:00:00
        expect(format_date_to_string(date)).toBe('2025-12-31 00:00:00');
    });
});


describe('transform_file_path', () => {
    it('transforms output.xml to log.html with forward slashes', () => {
        expect(transform_file_path('/path/to/output.xml')).toBe('/path/to/log.html');
    });

    it('transforms output.xml to log.html with backslashes', () => {
        expect(transform_file_path('C:\\path\\to\\output.xml')).toBe('C:\\path\\to\\log.html');
    });

    it('replaces all occurrences of output in filename', () => {
        expect(transform_file_path('/path/output_output.xml')).toBe('/path/log_log.html');
    });

    it('handles case-insensitive .XML extension', () => {
        expect(transform_file_path('/path/output.XML')).toBe('/path/log.html');
    });
});


describe('combine_paths', () => {
    it('combines base URL with relative path by matching folder', () => {
        const result = combine_paths('http://localhost:8000/results/', 'results/log.html');
        expect(result).toBe('http://localhost:8000/results/log.html');
    });

    it('resolves .. in relative path', () => {
        const result = combine_paths('http://localhost:8000/a/b/', '../c/log.html');
        expect(result).toBe('http://localhost:8000/c/log.html');
    });

    it('resolves . in relative path', () => {
        const result = combine_paths('http://localhost:8000/results/', './results/log.html');
        expect(result).toBe('http://localhost:8000/results/log.html');
    });

    it('handles backslashes in relative path', () => {
        const result = combine_paths('http://localhost:8000/results/', 'results\\subdir\\log.html');
        expect(result).toBe('http://localhost:8000/results/subdir/log.html');
    });

    it('handles no matching folder', () => {
        const result = combine_paths('http://localhost:8000/', 'output/log.html');
        expect(result).toBe('http://localhost:8000/output/log.html');
    });
});


describe('strip_tz_suffix', () => {
    it('strips +HH:MM timezone suffix', () => {
        expect(strip_tz_suffix('2025-01-15 09:05:03+02:00')).toBe('2025-01-15 09:05:03');
    });

    it('strips -HH:MM timezone suffix', () => {
        expect(strip_tz_suffix('2025-01-15 09:05:03-05:00')).toBe('2025-01-15 09:05:03');
    });

    it('returns string unchanged if no timezone suffix', () => {
        expect(strip_tz_suffix('2025-01-15 09:05:03')).toBe('2025-01-15 09:05:03');
    });

    it('handles millisecond timestamps with timezone', () => {
        expect(strip_tz_suffix('2025-01-15 09:05:03.123+02:00')).toBe('2025-01-15 09:05:03.123');
    });

    it('handles UTC offset +00:00', () => {
        expect(strip_tz_suffix('2025-01-15 09:05:03+00:00')).toBe('2025-01-15 09:05:03');
    });
});


describe('debounce', () => {
    it('delays function execution', async () => {
        vi.useFakeTimers();
        const fn = vi.fn();
        const debounced = debounce(fn, 100);

        debounced();
        expect(fn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(100);
        expect(fn).toHaveBeenCalledOnce();

        vi.useRealTimers();
    });

    it('resets timer on subsequent calls', () => {
        vi.useFakeTimers();
        const fn = vi.fn();
        const debounced = debounce(fn, 100);

        debounced();
        vi.advanceTimersByTime(50);
        debounced(); // reset
        vi.advanceTimersByTime(50);
        expect(fn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(50);
        expect(fn).toHaveBeenCalledOnce();

        vi.useRealTimers();
    });

    it('passes arguments to the debounced function', () => {
        vi.useFakeTimers();
        const fn = vi.fn();
        const debounced = debounce(fn, 100);

        debounced('a', 'b');
        vi.advanceTimersByTime(100);
        expect(fn).toHaveBeenCalledWith('a', 'b');

        vi.useRealTimers();
    });
});
