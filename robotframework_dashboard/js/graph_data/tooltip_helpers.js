// Build a metadata lookup for enhanced tooltips from filtered data arrays.
// Returns { byLabel: {label -> meta}, byTime: {timestamp -> meta} }.
// When aggregate=true, entries with the same run_start are summed (use for suites/keywords combined).
function build_tooltip_meta(filteredData, durationField = 'elapsed_s', aggregate = false) {
    const byLabel = {};
    const byTime = {};
    for (const item of filteredData) {
        const elapsed = parseFloat(item[durationField]) || 0;
        const p = item.passed || 0;
        const f = item.failed || 0;
        const s = item.skipped || 0;
        const msg = item.message || '';
        const keys = [item.run_start, item.run_alias];
        const timeKey = new Date(item.run_start).getTime();
        const meta = { elapsed_s: elapsed, passed: p, failed: f, skipped: s, message: msg };
        for (const key of keys) {
            if (aggregate && byLabel[key]) {
                byLabel[key].elapsed_s += elapsed;
                byLabel[key].passed += p;
                byLabel[key].failed += f;
                byLabel[key].skipped += s;
            } else if (!byLabel[key]) {
                byLabel[key] = { ...meta };
            }
        }
        if (aggregate && byTime[timeKey]) {
            byTime[timeKey].elapsed_s += elapsed;
            byTime[timeKey].passed += p;
            byTime[timeKey].failed += f;
            byTime[timeKey].skipped += s;
        } else if (!byTime[timeKey]) {
            byTime[timeKey] = { ...meta };
        }
    }
    return { byLabel, byTime };
}

// Look up metadata from Chart.js tooltip items (works for bar, line, scatter charts)
function lookup_tooltip_meta(meta, tooltipItems) {
    if (!tooltipItems || !tooltipItems.length) return null;
    const item = tooltipItems[0];
    // Try chart data labels array (bar/timeline charts)
    const labels = item.chart?.data?.labels;
    if (labels && labels[item.dataIndex] != null) {
        const found = meta.byLabel[labels[item.dataIndex]];
        if (found) return found;
    }
    // Try raw x value (line/scatter charts with time axis)
    if (item.raw && typeof item.raw === 'object' && item.raw.x != null) {
        const t = item.raw.x instanceof Date ? item.raw.x.getTime() : new Date(item.raw.x).getTime();
        const found = meta.byTime[t];
        if (found) return found;
    }
    // Fallback: tooltip label text
    return meta.byLabel[item.label] || null;
}

// Format status as a single string for tooltip display
// Returns "PASS"/"FAIL"/"SKIP" for individual items, or "Passed: X, Failed: Y, Skipped: Z" for aggregates
function format_status(meta) {
    if (meta.passed === 1 && meta.failed === 0 && meta.skipped === 0) return 'PASS';
    if (meta.failed === 1 && meta.passed === 0 && meta.skipped === 0) return 'FAIL';
    if (meta.skipped === 1 && meta.passed === 0 && meta.failed === 0) return 'SKIP';
    return `Passed: ${meta.passed}, Failed: ${meta.failed}, Skipped: ${meta.skipped}`;
}

export { build_tooltip_meta, lookup_tooltip_meta, format_status };
