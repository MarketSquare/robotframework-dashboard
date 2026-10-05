import { describe, it, expect, vi } from 'vitest';

vi.mock('@js/variables/globals.js', () => ({ inFullscreen: false, escape_html_for_merge: (value) => String(value) }));
vi.mock('@js/variables/settings.js', () => ({ settings: { show: { axisTitles: true, dateLabels: true, legends: true } } }));
vi.mock('@js/variables/chartconfig.js', () => import('../mocks/chartconfig.js'));
vi.mock('@js/graph_data/graph_config.js', () => ({ get_graph_config: () => ({ options: { plugins: {}, scales: { x: {}, y: {} } } }) }));

import { build_custom_graph_chart_config } from '@js/customgraphs/viz.js';
import { run_custom_graph_query } from '@js/customgraphs/engine.js';
import { validate_custom_graph_spec } from '@js/customgraphs/spec.js';
import { make_dataset } from './dataset.js';

describe('heatmap', () => {
    it('gives runs with the same label their own column', () => {
        const { spec } = validate_custom_graph_spec({
            source: 'tests', x: { field: 'run' }, series: { field: 'name' }, metric: { agg: 'count' }, viz: { type: 'heatmap' },
        });
        // the first two runs are both called "Nightly"
        const result = run_custom_graph_query(spec, make_dataset(), { runLabel: run => run.name });
        expect(result.xLabels).toEqual(['Nightly', 'Nightly', 'Release']);
        const config = build_custom_graph_chart_config(spec, result);
        const columns = config.options.scales.x.labels;
        expect(new Set(columns).size).toBe(3);
        expect(new Set(config.data.datasets[0].data.map(cell => `${cell.x}|${cell.y}`)).size).toBe(9);
        const tick = config.options.scales.x.ticks.callback;
        expect(columns.map((_, index) => tick.call({ getLabelForValue: (value) => columns[value] }, index)))
            .toEqual(['Nightly', 'Nightly', 'Release']);
    });
});
