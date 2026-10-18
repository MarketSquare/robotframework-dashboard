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
const addAlertMock = vi.fn();
vi.mock('@js/common.js', async (importOriginal) => ({ ...(await importOriginal()), add_alert: addAlertMock }));

// log.js calls window.open and add_alert; stub them.
beforeEach(() => {
    dataMock.runs.length = 0;
    dataMock.suites.length = 0;
    dataMock.tests.length = 0;
    globalsMock.filteredRuns.length = 0;
    globalsMock.filteredSuites.length = 0;
    globalsMock.filteredTests.length = 0;
    globalsMock.filteredKeywords.length = 0;
    globalThis.window = { open: vi.fn(() => ({})), location: { href: 'http://localhost/' } };
    addAlertMock.mockClear();
});

const { open_log_file, open_log_from_path, open_log_from_label } = await import('@js/log.js');

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

describe('open_log_file', () => {
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

        expect(addAlertMock).not.toHaveBeenCalled();
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

        expect(addAlertMock).not.toHaveBeenCalled();
        expect(globalThis.window.open).toHaveBeenCalledTimes(1);
    });

    it('falls back to raw runs when the clicked run was filtered out', () => {
        const utcStart = '2025-01-15 10:00:00';
        const path = '/results/output.xml';
        dataMock.runs.push({ run_start: utcStart, path, run_alias: null });
        // filteredRuns is empty — run filtered away

        const event = makeBarClickEvent(utcStart);
        open_log_file(event, [{ index: 0 }]);

        expect(addAlertMock).not.toHaveBeenCalled();
        expect(globalThis.window.open).toHaveBeenCalledTimes(1);
    });

    it('alerts only when no matching run exists anywhere', () => {
        const event = makeBarClickEvent('2099-12-31 00:00:00');
        open_log_file(event, [{ index: 0 }]);
        expect(addAlertMock).toHaveBeenCalledTimes(1);
        expect(globalThis.window.open).not.toHaveBeenCalled();
    });
});

describe('open_log_from_path in server mode', () => {
    it('encodes the path and keeps the suite or test anchor', () => {
        dataMock.server = true;
        open_log_from_path('/results/run 1/log&build+2%.html#s1-s2-t3');
        expect(window.open).toHaveBeenCalledWith('/log?path=%2Fresults%2Frun%201%2Flog%26build%2B2%25.html#s1-s2-t3', '_blank');
        open_log_from_path('C:\\results\\log.html');
        expect(window.open).toHaveBeenLastCalledWith('/log?path=C%3A%5Cresults%5Clog.html', '_blank');
        dataMock.server = false;
    });
});

describe('open_log_from_label', () => {
    // a category axis where Chart.js skipped every other label: 4 ticks for 8 runs, 100px apart
    function make_chart(labels) {
        const ticks = [0, 2, 4, 6].map(value => ({ value, label: labels[value] }));
        return {
            canvas: { getBoundingClientRect: () => ({ left: 0, top: 0 }) },
            config: { _config: { options: {} } },
            data: { labels },
            scales: { x: { ticks, top: 300, bottom: 340, left: 50, right: 450, width: 400, getPixelForTick: (index) => 50 + index * 100 } },
        };
    }

    it('opens the run of the clicked label when the axis skips labels', () => {
        const labels = Array.from({ length: 8 }, (_, index) => `2025-01-0${index + 1} 10:00:00`);
        globalsMock.filteredRuns.push(...labels.map(run_start => ({ run_start, path: `/results/output-${run_start.slice(8, 10)}.xml` })));
        open_log_from_label(make_chart(labels), { clientX: 255, clientY: 320 });
        expect(window.open).toHaveBeenCalledTimes(1);
        expect(window.open.mock.calls[0][0]).toContain('log-05.html');
    });

    it('ignores a click above the axis', () => {
        const labels = Array.from({ length: 8 }, (_, index) => `2025-01-0${index + 1} 10:00:00`);
        globalsMock.filteredRuns.push(...labels.map(run_start => ({ run_start, path: '/results/output.xml' })));
        open_log_from_label(make_chart(labels), { clientX: 255, clientY: 100 });
        expect(window.open).not.toHaveBeenCalled();
    });
});

describe('open_log_file with repeated labels', () => {
    it('opens the run of the clicked column from the graph data', () => {
        globalsMock.filteredRuns.push(
            { run_start: '2025-01-15 10:00:00', path: '/results/output-first.xml' },
            { run_start: '2025-01-16 10:00:00', path: '/results/output-second.xml' },
        );
        const event = makeBarClickEvent('Nightly');
        event.chart.data = { labels: ['Nightly', 'Nightly'], runStarts: ['2025-01-15 10:00:00', '2025-01-16 10:00:00'] };
        open_log_file(event, [{ index: 1 }]);
        expect(window.open.mock.calls[0][0]).toContain('log-second.html');
    });

    it('tells apart two runs started in the same second by their milliseconds', () => {
        globalsMock.filteredRuns.push(
            { run_start: '2025-01-15 10:00:00.100', path: '/results/output-a.xml' },
            { run_start: '2025-01-15 10:00:00.900', path: '/results/output-b.xml' },
        );
        const event = makeBarClickEvent('2025-01-15 10:00:00.900');
        open_log_file(event, [{ index: 0 }]);
        expect(window.open.mock.calls[0][0]).toContain('log-b.html');
    });
});
