import { notesStore, notesEnabled, get_test_note, format_note_tooltip_lines } from "./store.js";

// chart id -> function(chart, elements) returning the note target of a right-clicked point, or null;
// the graph builders set it on every build so it always reads the data of the current chart
const chartNoteTargets = new Map();

function set_chart_note_target(chartId, resolver) {
    if (resolver) chartNoteTargets.set(chartId, resolver);
    else chartNoteTargets.delete(chartId);
}

function get_chart_note_target(chartId) {
    return chartNoteTargets.get(chartId) ?? null;
}

function test_note_target(meta, runLabel) {
    if (!meta) return null;
    return { run_start: meta.run_start, full_name: meta.full_name, runLabel, message: meta.message || "" };
}

// for timeline graphs whose tooltip meta is keyed "<label>::<run index>"
function timeline_test_note_target(pointMeta, runLabels) {
    return (chart, elements) => {
        const dataset = chart.data.datasets[elements[0].datasetIndex];
        const raw = dataset?.data[elements[0].index];
        if (!raw) return null;
        const label = raw.y ?? dataset.label;
        return test_note_target(pointMeta[`${label}::${raw.x[0]}`], runLabels[raw.x[0]]);
    };
}

function test_note_lines(meta) {
    if (!meta || !notesEnabled) return [];
    return format_note_tooltip_lines(notesStore, get_test_note(notesStore, meta.run_start, meta.full_name));
}

export {
    set_chart_note_target,
    get_chart_note_target,
    test_note_target,
    timeline_test_note_target,
    test_note_lines,
};
