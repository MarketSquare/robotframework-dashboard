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
let hiddenSection;
let observed;
beforeEach(() => {
    canvas = make_canvas();
    hiddenSection = false;
    canvas.id = 'runStatisticsGraph';
    canvas.closest = () => (hiddenSection ? {} : null);
    observed = [];
    openLogFromLabel.mockClear();
    globalThis.window = {};
    globalThis.document = { getElementById: () => canvas };
    globalThis.ResizeObserver = class {
        constructor(callback) { this.callback = callback; }
        observe(target) { observed.push({ target, observer: this }); }
        unobserve() {}
    };
    globalThis.Chart = class {
        constructor(id, config) { this.canvas = canvas; this.config = config; }
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

describe('create_chart bar rounding', () => {
    it('resolves a borderRadius function once per build', () => {
        const borderRadius = vi.fn(() => 6);
        create_chart('runStatisticsGraph', () => ({ data: { datasets: [{ data: [1, 2], borderRadius }, { data: [3] }] } }));
        expect(window.runStatisticsGraph.config.data.datasets[0].borderRadius).toBe(6);
        expect(window.runStatisticsGraph.config.data.datasets[1].borderRadius).toBeUndefined();
        expect(borderRadius).toHaveBeenCalledTimes(1);
    });
});

describe('create_chart in a hidden section', () => {
    it('builds the chart only once the section is shown', () => {
        const build = vi.fn(() => ({}));
        hiddenSection = true;
        create_chart('runStatisticsGraph', build);
        expect(build).not.toHaveBeenCalled();
        expect(window.runStatisticsGraph).toBeUndefined();
        // the section is expanded: the canvas gets a size
        hiddenSection = false;
        const { target, observer } = observed[0];
        observer.callback([{ target, contentRect: { width: 400, height: 300 } }]);
        expect(build).toHaveBeenCalledTimes(1);
        expect(window.runStatisticsGraph).toBeDefined();
    });
});
