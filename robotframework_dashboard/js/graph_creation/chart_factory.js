import { open_log_from_label } from "../log.js";

// Generic chart create function - replaces boilerplate create_X_graph() pattern
function create_chart(chartId, buildConfigFn, addLogClickHandler = true) {
    if (window[chartId]) window[chartId].destroy();
    window[chartId] = new Chart(chartId, buildConfigFn());
    if (addLogClickHandler) {
        window[chartId].canvas.addEventListener("click", (event) => {
            open_log_from_label(window[chartId], event);
        });
    }
}

// Generic chart update function - replaces boilerplate update_X_graph() pattern
function update_chart(chartId, buildConfigFn, addLogClickHandler = true) {
    if (!window[chartId]) { create_chart(chartId, buildConfigFn, addLogClickHandler); return; }
    const config = buildConfigFn();
    window[chartId].data = config.data;
    window[chartId].options = config.options;
    window[chartId].update();
}

export { create_chart, update_chart };
