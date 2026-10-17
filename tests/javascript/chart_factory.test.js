import { describe, it, expect, vi, beforeEach } from 'vitest';

const openLogFromLabel = vi.fn();
vi.mock('@js/log.js', () => ({ open_log_from_label: (...args) => openLogFromLabel(...args) }));

// a canvas that records its click listeners, shared by every chart created on it
function make_canvas() {
    const listeners = [];
    return {
        dataset: {},
        listeners,
        addEventListener: (type, handler) => { if (type === 'click') listeners.push(handler); },
        click() { listeners.forEach(handler => handler({ type: 'click' })); },
    };
}

let canvas;
beforeEach(() => {
    canvas = make_canvas();
    openLogFromLabel.mockClear();
    globalThis.window = {};
    globalThis.Chart = class {
        constructor() { this.canvas = canvas; }
        destroy() {}
    };
});

const { create_chart } = await import('@js/graph_creation/chart_factory.js');

describe('create_chart', () => {
    it('binds one log click listener per canvas when the chart is created again', () => {
        create_chart('runStatisticsGraph', () => ({}));
        create_chart('runStatisticsGraph', () => ({}));
        create_chart('runStatisticsGraph', () => ({}));
        expect(canvas.listeners).toHaveLength(1);
        canvas.click();
        expect(openLogFromLabel).toHaveBeenCalledTimes(1);
        expect(openLogFromLabel.mock.calls[0][0]).toBe(window.runStatisticsGraph);
    });

    it('stops opening logs when the chart is created again without the log click', () => {
        create_chart('runStatisticsGraph', () => ({}));
        create_chart('runStatisticsGraph', () => ({}), false);
        canvas.click();
        expect(openLogFromLabel).not.toHaveBeenCalled();
    });
});
