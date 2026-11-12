import { describe, it, expect, vi, beforeEach } from 'vitest';

const openMessageTests = vi.fn();
const openTestMessages = vi.fn();
vi.mock('@js/eventlisteners/message_tests_modal.js', () => ({ open_message_tests_modal: (...args) => openMessageTests(...args) }));
vi.mock('@js/variables/settings.js', () => ({ settings: { switch: {}, show: {} }, get_run_label: (item) => item.run_start }));
vi.mock('@js/variables/globals.js', () => ({ inFullscreen: false, inFullscreenGraph: '', filteredRuns: [] }));
vi.mock('@js/variables/chartconfig.js', () => ({ barConfig: {} }));
vi.mock('@js/eventlisteners/test_messages_modal.js', () => ({ open_test_messages_modal: (...args) => openTestMessages(...args) }));

import { apply_label_click, apply_message_tests_click, apply_test_messages_click } from '@js/graph_creation/label_click.js';

// a vertical axis from y 0 to 300 left of the chart area with one label per 100 pixels
function y_scale() {
    return { left: 0, right: 100, top: 0, bottom: 300, labelRotation: 0, getValueForPixel: pixel => (pixel - 50) / 100 };
}

function make_chart(config, scales) {
    return { data: config.data, scales, canvas: { style: {} }, getActiveElements: () => [] };
}

function fire(config, chart, type, x, y, inChartArea = false) {
    config.plugins[0].afterEvent(chart, { event: { type, x, y }, inChartArea });
}

beforeEach(() => {
    openMessageTests.mockClear();
    openTestMessages.mockClear();
});

describe('apply_label_click', () => {
    it('opens the label clicked on the y axis of a timeline', () => {
        const open = vi.fn();
        const config = { data: { labels: ['A', 'B', 'C'] }, options: { indexAxis: 'y' } };
        apply_label_click(config, open);
        const chart = make_chart(config, { y: y_scale() });
        fire(config, chart, 'click', 50, 160);
        expect(open).toHaveBeenCalledWith('B');
        // a timeline point keeps its own click (the log of its run)
        expect(config.options.onClick).toBeUndefined();
    });

    it('ignores clicks inside the chart area and outside the axis', () => {
        const open = vi.fn();
        const config = { data: { labels: ['A'] }, options: { indexAxis: 'y' } };
        apply_label_click(config, open);
        const chart = make_chart(config, { y: y_scale() });
        fire(config, chart, 'click', 50, 50, true);
        fire(config, chart, 'click', 150, 50);
        expect(open).not.toHaveBeenCalled();
    });

    it('reads its own labels when the chart has none (the scatter view)', () => {
        const open = vi.fn();
        const config = { data: { datasets: [] }, options: {} };
        apply_label_click(config, open, { axis: 'y', labels: ['Login', 'Logout'] });
        const chart = make_chart(config, { y: y_scale() });
        fire(config, chart, 'click', 50, 140);
        expect(open).toHaveBeenCalledWith('Logout');
        expect(config.options.onClick).toBeUndefined();
    });

    it('shows a pointer over a label', () => {
        const config = { data: { labels: ['A'] }, options: { indexAxis: 'y' } };
        apply_label_click(config, vi.fn());
        const chart = make_chart(config, { y: y_scale() });
        fire(config, chart, 'mousemove', 50, 50);
        expect(chart.canvas.style.cursor).toBe('pointer');
        fire(config, chart, 'mousemove', 150, 50);
        expect(chart.canvas.style.cursor).toBe('default');
    });

    it('opens the label of a clicked bar in a bar view', () => {
        const open = vi.fn();
        const config = { data: { labels: ['A', 'B'] }, options: {} };
        apply_label_click(config, open);
        expect(config.data.labelClick.axis).toBe('x');
        config.options.onClick({}, [{ index: 1 }], { data: config.data });
        config.options.onClick({}, [], { data: config.data });
        expect(open).toHaveBeenCalledTimes(1);
        expect(open).toHaveBeenCalledWith('B');
    });
});

describe('apply_message_tests_click', () => {
    it('opens the tests behind a known message', () => {
        const config = { data: { labels: ['Timeout'] }, options: {} };
        const tests = [{ name: 'Login' }];
        apply_message_tests_click(config, { Timeout: tests });
        config.options.onClick({}, [{ index: 0 }], { data: config.data });
        expect(openMessageTests).toHaveBeenCalledWith('Timeout', tests);
        config.data.labelClick.open('Unknown');
        expect(openMessageTests).toHaveBeenCalledTimes(1);
    });
});

describe('apply_test_messages_click', () => {
    it('opens the full messages of the clicked test', () => {
        const config = { data: { labels: ['Login'] }, options: { indexAxis: 'y' } };
        const tests = [
            { name: 'Login', run_start: '2025-01-15 10:00:00', failed: 1, message: 'm'.repeat(300), attempts: '' },
            { name: 'Other', run_start: '2025-01-15 10:00:00', failed: 1, message: 'other', attempts: '' },
        ];
        apply_test_messages_click(config, tests, test => test.name);
        config.data.labelClick.open('Login');
        expect(openTestMessages).toHaveBeenCalledTimes(1);
        const [label, runs] = openTestMessages.mock.calls[0];
        expect(label).toBe('Login');
        expect(runs.map(run => run.message)).toEqual(['m'.repeat(300)]);
        // a timeline names the click in the tooltip of a point with a shortened message instead
        expect(config.options.plugins?.tooltip?.callbacks?.footer).toBeUndefined();
    });

    it('opens the messages from a bar and says so in its tooltip', () => {
        const label = () => 'Fails: 3';
        const config = { data: { labels: ['Login'] }, options: { plugins: { tooltip: { callbacks: { label } } } } };
        apply_test_messages_click(config, [], test => test.name);
        expect(config.options.plugins.tooltip.callbacks.label).toBe(label);
        expect(config.options.plugins.tooltip.callbacks.footer()).toBe('Click to see the full messages');
        config.options.onClick({}, [{ index: 0 }], { data: config.data });
        expect(openTestMessages).toHaveBeenCalledWith('Login', []);
    });
});
