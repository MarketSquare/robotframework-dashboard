import { describe, it, expect, vi } from 'vitest';

// Mock dependencies
vi.mock('@js/variables/settings.js', () => ({
    settings: {
        show: {
            animation: false,
            duration: 1500,
            legends: true,
            axisTitles: true,
            rounding: 6,
        },
    },
}));
vi.mock('@js/variables/globals.js', () => ({
    heatMapHourAll: true,
}));
vi.mock('@js/log.js', () => ({
    open_log_file: vi.fn(),
}));
vi.mock('@js/common.js', () => ({
    format_duration: (val) => `${val}s`,
}));

import { get_graph_config } from '@js/graph_data/graph_config.js';
import { settings } from '@js/variables/settings.js';


describe('get_graph_config', () => {
    const sampleBarData = {
        labels: ['Run 1', 'Run 2'],
        datasets: [{ data: [5, 10] }],
    };

    const sampleTimelineData = {
        labels: ['Test A'],
        datasets: [{ data: [{ x: [0, 1], y: 'Test A' }] }],
    };

    describe('bar type', () => {
        it('returns type "bar" with correct structure', () => {
            const config = get_graph_config('bar', sampleBarData, 'My Title', 'X Axis', 'Y Axis');
            expect(config.type).toBe('bar');
            expect(config.data).toBe(sampleBarData);
            expect(config.options).toBeDefined();
        });

        it('includes stacked y axis', () => {
            const config = get_graph_config('bar', sampleBarData, '', 'X', 'Y');
            expect(config.options.scales.y.stacked).toBe(true);
        });

        it('sets interaction mode to x', () => {
            const config = get_graph_config('bar', sampleBarData, '', 'X', 'Y');
            expect(config.options.interaction.mode).toBe('x');
        });

        it('includes datalabels plugin config', () => {
            const config = get_graph_config('bar', sampleBarData, '', 'X', 'Y');
            expect(config.options.plugins.datalabels).toBeDefined();
            expect(config.options.plugins.datalabels.color).toBe('#000');
        });
    });

    describe('line type', () => {
        it('returns type "line" and wraps data in datasets when dataSets=true', () => {
            const lineData = [{ label: 'Set 1', data: [1, 2, 3] }];
            const config = get_graph_config('line', lineData, 'Title', 'X', 'Y');
            expect(config.type).toBe('line');
            expect(config.data.datasets).toBe(lineData);
        });

        it('does not wrap data when dataSets=false', () => {
            const lineData = { datasets: [{ data: [1, 2] }] };
            const config = get_graph_config('line', lineData, 'Title', 'X', 'Y', false);
            expect(config.data).toBe(lineData);
        });

        it('uses time scale on x axis', () => {
            const config = get_graph_config('line', [], 'Title', 'X', 'Y');
            expect(config.options.scales.x.type).toBe('time');
        });

        it('limits x axis ticks to 10', () => {
            const config = get_graph_config('line', [], 'Title', 'X', 'Y');
            expect(config.options.scales.x.ticks.maxTicksLimit).toBe(10);
        });
    });

    describe('timeline type', () => {
        it('returns type "bar" with indexAxis "y"', () => {
            const config = get_graph_config('timeline', sampleTimelineData, '', 'X', 'Y');
            expect(config.type).toBe('bar');
            expect(config.options.indexAxis).toBe('y');
        });

        it('hides legend', () => {
            const config = get_graph_config('timeline', sampleTimelineData, '', 'X', 'Y');
            expect(config.options.plugins.legend.display).toBe(false);
        });

        it('includes stacked y axis', () => {
            const config = get_graph_config('timeline', sampleTimelineData, '', 'X', 'Y');
            expect(config.options.scales.y.stacked).toBe(true);
        });
    });

    describe('boxplot type', () => {
        it('returns type "boxplot" with correct structure', () => {
            const config = get_graph_config('boxplot', sampleBarData, 'Title', 'X', 'Y');
            expect(config.type).toBe('boxplot');
            expect(config.options.plugins.tooltip.enabled).toBe(true);
            expect(config.options.plugins.legend.display).toBe(false);
        });
    });

    describe('radar type', () => {
        it('returns type "radar" with r scale', () => {
            const config = get_graph_config('radar', sampleBarData, '', 'X', 'Y');
            expect(config.type).toBe('radar');
            expect(config.options.scales.r).toBeDefined();
            expect(config.options.scales.r.angleLines.display).toBe(true);
        });

        it('includes legend', () => {
            const config = get_graph_config('radar', sampleBarData, '', 'X', 'Y');
            expect(config.options.plugins.legend.display).toBe(true);
        });
    });

    describe('common options', () => {
        it('is responsive and does not maintain aspect ratio', () => {
            const config = get_graph_config('bar', sampleBarData, '', 'X', 'Y');
            expect(config.options.responsive).toBe(true);
            expect(config.options.maintainAspectRatio).toBe(false);
        });

        it('includes normalized flag', () => {
            const config = get_graph_config('bar', sampleBarData, '', 'X', 'Y');
            expect(config.options.normalized).toBe(true);
        });

        it('shows title when graphTitle is non-empty', () => {
            const config = get_graph_config('bar', sampleBarData, 'My Title', 'X', 'Y');
            expect(config.options.plugins.title.display).toBe(true);
            expect(config.options.plugins.title.text).toBe('My Title');
        });

        it('hides title when graphTitle is empty', () => {
            const config = get_graph_config('bar', sampleBarData, '', 'X', 'Y');
            expect(config.options.plugins.title.display).toBe(false);
        });

        it('disables animation when settings.show.animation is false', () => {
            const config = get_graph_config('bar', sampleBarData, '', 'X', 'Y');
            expect(config.options.animation).toBe(false);
        });

        it('enables animation when settings.show.animation is true', () => {
            settings.show.animation = true;
            const config = get_graph_config('bar', sampleBarData, '', 'X', 'Y');
            expect(config.options.animation).toBeDefined();
            expect(config.options.animation).not.toBe(false);
            settings.show.animation = false; // restore
        });

        it('sets x/y axis titles', () => {
            const config = get_graph_config('bar', sampleBarData, '', 'My X', 'My Y');
            expect(config.options.scales.x.title.text).toBe('My X');
            expect(config.options.scales.y.title.text).toBe('My Y');
        });
    });

    describe('duration axis formatting', () => {
        it('uses format_duration on x axis when xTitle is "Duration"', () => {
            const config = get_graph_config('bar', sampleBarData, '', 'Duration', 'Y');
            const formatted = config.options.scales.x.ticks.callback(5);
            expect(formatted).toBe('5s');
        });

        it('uses format_duration on y axis when yTitle is "Duration"', () => {
            const config = get_graph_config('bar', sampleBarData, '', 'X', 'Duration');
            const formatted = config.options.scales.y.ticks.callback(10);
            expect(formatted).toBe('10s');
        });

        it('adds tooltip label callback for duration axes', () => {
            const config = get_graph_config('bar', sampleBarData, '', 'Duration', 'Y');
            expect(config.options.plugins.tooltip.callbacks.label).toBeDefined();
        });
    });

    describe('legend and axis title settings', () => {
        it('hides legend when settings.show.legends is false', () => {
            settings.show.legends = false;
            const config = get_graph_config('bar', sampleBarData, '', 'X', 'Y');
            expect(config.options.plugins.legend.display).toBe(false);
            settings.show.legends = true; // restore
        });

        it('hides axis titles when settings.show.axisTitles is false', () => {
            settings.show.axisTitles = false;
            const config = get_graph_config('bar', sampleBarData, '', 'X', 'Y');
            expect(config.options.scales.x.title.display).toBe(false);
            expect(config.options.scales.y.title.display).toBe(false);
            settings.show.axisTitles = true; // restore
        });
    });

    describe('unknown graph type', () => {
        it('returns undefined for unsupported type', () => {
            const config = get_graph_config('unknown', sampleBarData, '', 'X', 'Y');
            expect(config).toBeUndefined();
        });
    });
});
