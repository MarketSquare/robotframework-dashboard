import { open_log_from_label } from "../log.js";

// a graph in a collapsed or hidden section (or hidden from the layout) is not computed or drawn: its
// canvas has no size, so it waits until it gets one, which is when the section is shown again
const deferredCharts = new Map();
let deferredChartObserver = null;

function is_in_hidden_container(canvas) {
    return !!canvas?.closest("[hidden]");
}

function defer_chart(chartId, canvas, buildConfigFn, addLogClickHandler) {
    deferredChartObserver ??= new ResizeObserver(entries => {
        for (const entry of entries) {
            if (entry.contentRect.width === 0 && entry.contentRect.height === 0) continue;
            const id = entry.target.id;
            const deferred = deferredCharts.get(id);
            if (deferred) create_chart(id, deferred.buildConfigFn, deferred.addLogClickHandler);
        }
    });
    deferredCharts.set(chartId, { buildConfigFn, addLogClickHandler });
    deferredChartObserver.observe(canvas);
}

function create_chart(chartId, buildConfigFn, addLogClickHandler = true) {
    const target = document.getElementById(chartId);
    if (is_in_hidden_container(target)) {
        defer_chart(chartId, target, buildConfigFn, addLogClickHandler);
        return;
    }
    if (deferredCharts.delete(chartId)) deferredChartObserver.unobserve(target);
    if (window[chartId]) window[chartId].destroy();
    window[chartId] = new Chart(chartId, buildConfigFn());
    // the canvas outlives its charts (a graph type change creates a new chart on it), so it gets
    // one listener that reads the current chart instead of one listener per chart
    const canvas = window[chartId].canvas;
    canvas.dataset.logClick = addLogClickHandler ? "true" : "";
    if (!canvas.dataset.logClickBound) {
        canvas.dataset.logClickBound = "true";
        canvas.addEventListener("click", (event) => {
            if (canvas.dataset.logClick && window[chartId]) open_log_from_label(window[chartId], event);
        });
    }
}

function update_chart(chartId, buildConfigFn, addLogClickHandler = true) {
    if (!window[chartId]) { create_chart(chartId, buildConfigFn, addLogClickHandler); return; }
    // a chart in a hidden section is drawn again from scratch once it is shown
    if (is_in_hidden_container(window[chartId].canvas)) {
        defer_chart(chartId, window[chartId].canvas, buildConfigFn, addLogClickHandler);
        return;
    }
    const config = buildConfigFn();
    window[chartId].data = config.data;
    window[chartId].options = config.options;
    window[chartId].update();
}

export { create_chart, update_chart };
