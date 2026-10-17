import { open_log_from_label } from "../log.js";

function create_chart(chartId, buildConfigFn, addLogClickHandler = true) {
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
    const config = buildConfigFn();
    window[chartId].data = config.data;
    window[chartId].options = config.options;
    window[chartId].update();
}

export { create_chart, update_chart };
