import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mutable mock state for runs/filteredRuns so individual tests can set them up.
const dataMock = {
    runs: [],
    suites: [],
    tests: [],
    server: false,
    use_logs: true,
};
const globalsMock = {
    filteredRuns: [],
    filteredSuites: [],
    filteredTests: [],
    filteredKeywords: [],
};

vi.mock('@js/variables/data.js', () => dataMock);
vi.mock('@js/variables/globals.js', () => globalsMock);
vi.mock('@js/variables/settings.js', () => ({
    settings: { show: { aliases: 'run_start' } },
    get_run_label: (item) => item.run_start,
}));

// log.js calls window.open and alert; stub them.
beforeEach(() => {
    dataMock.runs.length = 0;
    dataMock.suites.length = 0;
    dataMock.tests.length = 0;
    globalsMock.filteredRuns.length = 0;
    globalsMock.filteredSuites.length = 0;
    globalsMock.filteredTests.length = 0;
    globalsMock.filteredKeywords.length = 0;
    globalThis.window = { open: vi.fn(() => ({})), location: { href: 'http://localhost/' } };
    globalThis.alert = vi.fn();
});

const { open_log_file } = await import('@js/log.js');

// Build a fake chart click event for a non-line, non-doughnut graph that
// reads chart.data.labels[index]. Matches the path log.js takes for e.g.
// the bar statistics graph (the one in the issue's repro).
function makeBarClickEvent(label, graphId = 'runStatisticsGraph') {
    return {
        chart: {
            config: { _config: { type: 'bar' } },
            canvas: { id: graphId },
            data: { labels: [label] },
        },
    };
}

describe('open_log_file (issue #311)', () => {
    it('resolves log path against filteredRuns when timezone is converted to local time', () => {
        // The DB / unfiltered runs hold the original UTC run_start.
        const utcStart = '2025-01-15 10:00:00';
        // After the "convert to local timezone" toggle, filteredRuns carries
        // the local-time wall-clock string — this is what the chart label shows.
        const localStart = '2025-01-15 12:00:00';
        const path = '/results/output.xml';

        dataMock.runs.push({ run_start: utcStart, path, run_alias: null });
        globalsMock.filteredRuns.push({ run_start: localStart, path, run_alias: null });

        const event = makeBarClickEvent(localStart);
        const chartElement = [{ index: 0 }];

        open_log_file(event, chartElement);

        // Before the fix: lookup happened against `runs` (UTC), no match, alert fired.
        expect(globalThis.alert).not.toHaveBeenCalled();
        expect(globalThis.window.open).toHaveBeenCalledTimes(1);
        const openedUrl = globalThis.window.open.mock.calls[0][0];
        // output.xml is rewritten to log.html by transform_file_path
        expect(openedUrl).toContain('log.html');
    });

    it('still resolves correctly in UTC mode (filteredRuns == runs run_start)', () => {
        const utcStart = '2025-01-15 10:00:00';
        const path = '/results/output.xml';
        dataMock.runs.push({ run_start: utcStart, path, run_alias: null });
        globalsMock.filteredRuns.push({ run_start: utcStart, path, run_alias: null });

        const event = makeBarClickEvent(utcStart);
        open_log_file(event, [{ index: 0 }]);

        expect(globalThis.alert).not.toHaveBeenCalled();
        expect(globalThis.window.open).toHaveBeenCalledTimes(1);
    });

    it('falls back to raw runs when the clicked run was filtered out', () => {
        const utcStart = '2025-01-15 10:00:00';
        const path = '/results/output.xml';
        dataMock.runs.push({ run_start: utcStart, path, run_alias: null });
        // filteredRuns is empty — run filtered away

        const event = makeBarClickEvent(utcStart);
        open_log_file(event, [{ index: 0 }]);

        expect(globalThis.alert).not.toHaveBeenCalled();
        expect(globalThis.window.open).toHaveBeenCalledTimes(1);
    });

    it('alerts only when no matching run exists anywhere', () => {
        const event = makeBarClickEvent('2099-12-31 00:00:00');
        open_log_file(event, [{ index: 0 }]);
        expect(globalThis.alert).toHaveBeenCalledTimes(1);
        expect(globalThis.window.open).not.toHaveBeenCalled();
    });
});
