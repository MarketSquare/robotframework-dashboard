import { settings, get_run_label } from "./variables/settings.js";
import { set_local_storage_item } from "./localstorage.js";
import { filteredTests, filteredSuites, filteredKeywords } from "./variables/globals.js";
import {
    barConfig,
    lineConfig,
    passedBackgroundColor,
    passedBackgroundBorderColor,
    failedBackgroundColor,
    failedBackgroundBorderColor,
    skippedBackgroundColor,
    skippedBackgroundBorderColor,
    blueBackgroundColor,
    blueBackgroundBorderColor,
} from "./variables/chartconfig.js";
import { get_graph_config } from "./graph_data/graph_config.js";
import { get_most_failed_data } from "./graph_data/failed.js";
import { get_most_flaky_data } from "./graph_data/flaky.js";
import { get_most_time_consuming_or_most_used_data } from "./graph_data/time_consuming.js";
import { strip_tz_suffix } from "./common.js";
import { CUSTOM_GRAPH_TEMPLATES } from "./variables/customgraphdefs.js";

// ─── ID generation ──────────────────────────────────────────────────────────

function generate_custom_graph_id() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
        return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    }
    return Math.random().toString(36).slice(2, 14);
}

// ─── Pre-filtering ──────────────────────────────────────────────────────────

function get_custom_filtered_data(graph) {
    const { dataType, scopeFilter, scopeType } = graph;
    let rawData;
    if (dataType === "test")         rawData = filteredTests;
    else if (dataType === "suite")   rawData = filteredSuites;
    else if (dataType === "keyword") rawData = filteredKeywords;
    else return [];

    if (!rawData || rawData.length === 0) return [];

    if (scopeType === "name") {
        if (!scopeFilter) return rawData;
        return rawData.filter(item => item.name === scopeFilter || item.full_name === scopeFilter);
    }

    if (scopeType === "tag") {
        if (!scopeFilter) return rawData;
        return rawData.filter(item => {
            if (!item.tags) return false;
            const tags = item.tags
                .replace(/^\[|\]$/g, "")
                .split(",")
                .map(t => t.trim())
                .filter(Boolean);
            return tags.includes(scopeFilter);
        });
    }

    return rawData;
}

// ─── Chart config builders ──────────────────────────────────────────────────

function build_custom_statistics_config(graph, data) {
    const { graphType, title } = graph;

    const runMap = new Map();
    for (const item of data) {
        if (!runMap.has(item.run_start)) {
            runMap.set(item.run_start, {
                passed: 0, failed: 0, skipped: 0,
                label: get_run_label(item),
            });
        }
        const e = runMap.get(item.run_start);
        e.passed  += parseInt(item.passed)  || 0;
        e.failed  += parseInt(item.failed)  || 0;
        e.skipped += parseInt(item.skipped) || 0;
    }

    const labels = [], passed = [], failed = [], skipped = [];
    for (const [run_start, e] of runMap) {
        labels.push(graphType === "line" ? run_start : e.label);
        passed.push(e.passed);
        failed.push(e.failed);
        skipped.push(e.skipped);
    }

    if (graphType === "percentages") {
        for (let i = 0; i < labels.length; i++) {
            const total = passed[i] + failed[i] + skipped[i];
            passed[i]  = total ? Math.round((passed[i]  / total) * 100) : 0;
            failed[i]  = total ? Math.round((failed[i]  / total) * 100) : 0;
            skipped[i] = total ? Math.round((skipped[i] / total) * 100) : 0;
        }
    }

    const styling = graphType === "line" ? lineConfig : barConfig;
    const stack = graphType !== "line" ? "Stack 0" : undefined;
    const graphData = {
        labels,
        datasets: [
            { label: "Failed",  data: failed,  backgroundColor: failedBackgroundColor,  borderColor: failedBackgroundBorderColor,  ...styling, stack },
            { label: "Skipped", data: skipped, backgroundColor: skippedBackgroundColor, borderColor: skippedBackgroundBorderColor, ...styling, stack },
            { label: "Passed",  data: passed,  backgroundColor: passedBackgroundColor,  borderColor: passedBackgroundBorderColor,  ...styling, stack },
        ],
    };

    let config;
    if (graphType === "line") {
        config = get_graph_config("line", graphData, title, "Date", "Amount", false);
    } else {
        config = get_graph_config("bar", graphData, title, "Run", graphType === "percentages" ? "Percentage" : "Amount");
    }
    if (!settings.show.dateLabels) config.options.scales.x.ticks.display = false;
    return config;
}

function build_custom_duration_config(graph, data) {
    const { graphType, dataType, title } = graph;
    const attr = dataType === "keyword" ? "total_time_s" : "elapsed_s";

    if (graphType === "bar") {
        const map = new Map();
        for (const item of data) {
            const label = get_run_label(item);
            const dur = Math.round(parseFloat(item[attr] || 0) * 100) / 100;
            map.set(label, (map.get(label) || 0) + dur);
        }
        const allLabels = [...map.keys()];
        const labels = allLabels.slice(-30);
        const durations = labels.map(l => Math.round(map.get(l) * 100) / 100);
        const graphData = {
            labels,
            datasets: [{
                label: title,
                data: durations,
                backgroundColor: blueBackgroundColor,
                borderColor: blueBackgroundBorderColor,
                ...barConfig,
            }],
        };
        const config = get_graph_config("bar", graphData, title, "Run", "Duration (s)");
        config.options.plugins.legend = { display: false };
        if (!settings.show.dateLabels) config.options.scales.x.ticks.display = false;
        return config;
    }

    // line: time-series using run_start as x
    const map = new Map();
    for (const item of data) {
        const ts = item.run_start;
        const dur = Math.round(parseFloat(item[attr] || 0) * 100) / 100;
        map.set(ts, (map.get(ts) || 0) + dur);
    }
    const lineData = Array.from(map.entries()).map(([ts, dur]) => ({
        x: strip_tz_suffix(ts),
        y: Math.round(dur * 100) / 100,
    }));
    const graphData = {
        datasets: [{
            label: title,
            data: lineData,
            backgroundColor: blueBackgroundColor,
            borderColor: blueBackgroundBorderColor,
            ...lineConfig,
        }],
    };
    const config = get_graph_config("line", graphData, title, "Date", "Duration (s)", false);
    config.options.plugins.legend = { display: false };
    if (!settings.show.dateLabels) config.options.scales.x.ticks.display = false;
    return config;
}

function build_custom_most_failed_config(graph, data) {
    const { dataType, title } = graph;
    const result = get_most_failed_data(dataType, "bar", data, false);
    const graphData = result[0];
    const callbackData = result[1];
    const capType = dataType.charAt(0).toUpperCase() + dataType.slice(1);
    const config = get_graph_config("bar", graphData, title, capType, "Fails");
    config.options.plugins.legend = { display: false };
    config.options.plugins.tooltip = {
        callbacks: {
            label: (tooltipItem) => callbackData[tooltipItem.label],
        },
    };
    delete config.options.onClick;
    return config;
}

function build_custom_most_flaky_config(graph, data) {
    const { title } = graph;
    const result = get_most_flaky_data("test", "bar", data, false, false, 10);
    const graphData = result[0];
    const config = get_graph_config("bar", graphData, title, "Test", "Status Flips");
    config.options.plugins.legend = { display: false };
    delete config.options.onClick;
    return config;
}

function build_custom_most_time_consuming_config(graph, data) {
    const { dataType, title } = graph;
    const result = get_most_time_consuming_or_most_used_data(dataType, "bar", data, false, false);
    const graphData = result[0];
    const callbackData = result[1];
    const capType = dataType.charAt(0).toUpperCase() + dataType.slice(1);
    const config = get_graph_config("bar", graphData, title, capType, "Duration");
    config.options.plugins.legend = { display: false };
    config.options.plugins.tooltip = {
        callbacks: {
            label: (tooltipItem) => {
                const key = tooltipItem.label;
                const runStarts = callbackData.run_starts[key] || [];
                const aliases = callbackData.aliases[key] || runStarts;
                return runStarts.map((runStart, idx) => {
                    const info = callbackData.details[key]?.[runStart];
                    const displayName = aliases[idx] || runStart;
                    if (!info) return displayName;
                    return `${displayName}: ${info.duration}s`;
                });
            },
        },
    };
    delete config.options.onClick;
    return config;
}

function get_custom_graph_config(graph) {
    const data = get_custom_filtered_data(graph);
    if (!data || data.length === 0) return null;
    switch (graph.template) {
        case "statistics":          return build_custom_statistics_config(graph, data);
        case "duration":            return build_custom_duration_config(graph, data);
        case "most_failed":         return build_custom_most_failed_config(graph, data);
        case "most_flaky":          return build_custom_most_flaky_config(graph, data);
        case "most_time_consuming": return build_custom_most_time_consuming_config(graph, data);
        default:                    return null;
    }
}

// ─── HTML builders ──────────────────────────────────────────────────────────

function build_custom_graph_html(graph, editMode) {
    const deleteBtn = editMode
        ? `<button type="button" class="btn-close btn-close-sm delete-custom-graph" aria-label="Remove graph" data-graph-id="${graph.id}"></button>`
        : "";
    return `<div class="graph-header">
                <h6>${graph.title}</h6>
                <div class="graph-controls">
                    ${deleteBtn}
                </div>
            </div>
            <div class="graph-body">
                <canvas id="customGraph-${graph.id}"></canvas>
            </div>`;
}

// ─── Chart rendering ─────────────────────────────────────────────────────────

function render_custom_graph_chart(graph) {
    const canvasId = `customGraph-${graph.id}`;
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    if (window[canvasId]) {
        window[canvasId].destroy();
        window[canvasId] = null;
    }

    const config = get_custom_graph_config(graph);
    if (!config) {
        const body = canvas.closest(".graph-body");
        if (body) {
            body.innerHTML = `<div class="text-center text-muted p-3" style="font-size:0.85rem;">No data available for this scope</div>`;
        }
        return;
    }
    window[canvasId] = new Chart(canvasId, config);
}

function update_custom_graph_charts_for_section(sectionKey) {
    const graphs = (settings.customGraphs || []).filter(g => g.section === sectionKey);
    for (const graph of graphs) {
        render_custom_graph_chart(graph);
    }
}

// Called by all.js after every filter/data update cycle
function update_custom_graphs() {
    for (const section of ["run", "suite", "test", "keyword", "unified"]) {
        update_custom_graph_charts_for_section(section);
    }
}

// Render all custom graphs for `sectionKey` into the given GridStack instance
function render_custom_graphs(gridStack, sectionKey, editMode) {
    const grid = `grid${sectionKey.charAt(0).toUpperCase() + sectionKey.slice(1)}`;
    const savedLayout = settings.layouts?.[grid] ? JSON.parse(settings.layouts[grid]) : null;
    const graphs = (settings.customGraphs || []).filter(g => g.section === sectionKey);

    for (const graph of graphs) {
        const saved = savedLayout?.find(l => l.id === `customGraph-${graph.id}`);
        const item = document.createElement("div");
        item.classList.add("grid-stack-item");
        item.setAttribute("gs-w",     saved ? saved.w : 4);
        item.setAttribute("gs-h",     saved ? saved.h : 4);
        if (saved) {
            item.setAttribute("gs-x", saved.x);
            item.setAttribute("gs-y", saved.y);
        }
        item.setAttribute("gs-min-w", 2);
        item.setAttribute("gs-min-h", 3);
        item.setAttribute("gs-max-w", 12);
        item.setAttribute("gs-max-h", 12);
        item.setAttribute("data-gs-id", `customGraph-${graph.id}`);
        item.innerHTML = `<div class="grid-stack-item-content">${build_custom_graph_html(graph, editMode)}</div>`;
        gridStack.makeWidget(item);
    }

    update_custom_graph_charts_for_section(sectionKey);
}

// ─── "Add Custom Graph" tile ─────────────────────────────────────────────────

function render_add_custom_graph_tile(gridStack, sectionKey) {
    const tileId = `addCustomGraphTile-${sectionKey}`;
    if (gridStack.el.querySelector(`[data-gs-id="${tileId}"]`)) return;

    const item = document.createElement("div");
    item.classList.add("grid-stack-item");
    item.setAttribute("gs-w",        2);
    item.setAttribute("gs-h",        2);
    item.setAttribute("gs-min-w",    2);
    item.setAttribute("gs-min-h",    2);
    item.setAttribute("gs-max-w",    2);
    item.setAttribute("gs-max-h",    2);
    item.setAttribute("gs-no-resize","true");
    item.setAttribute("data-gs-id",  tileId);
    item.innerHTML = `<div class="grid-stack-item-content add-stat-widget-tile" data-section="${sectionKey}">
        <div class="add-stat-widget-tile-inner">
            <div class="add-stat-widget-plus">+</div>
            <div class="add-stat-widget-tile-label">Add custom graph</div>
        </div>
    </div>`;
    gridStack.makeWidget(item);

    item.querySelector(".add-stat-widget-tile").addEventListener("click", () => {
        open_add_custom_graph_modal(sectionKey);
    });
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

function add_custom_graph(section, template, graphType, dataType, scopeType, scopeFilter, title) {
    const id = generate_custom_graph_id();
    const graph = { id, section, template, graphType, dataType, scopeType, scopeFilter, title };
    const list = settings.customGraphs ? [...settings.customGraphs] : [];
    list.push(graph);
    set_local_storage_item("customGraphs", list);
    return graph;
}

function remove_custom_graph(id) {
    const list = (settings.customGraphs || []).filter(g => g.id !== id);
    set_local_storage_item("customGraphs", list);
}

// ─── Delete button wiring ─────────────────────────────────────────────────────

function handle_delete_custom_graph(id, gridStack) {
    const canvasId = `customGraph-${id}`;
    if (window[canvasId]) {
        window[canvasId].destroy();
        window[canvasId] = null;
    }
    const el = gridStack?.el?.querySelector(`[data-gs-id="customGraph-${id}"]`);
    if (el && gridStack) gridStack.removeWidget(el);
    remove_custom_graph(id);
    document.dispatchEvent(new CustomEvent("layout-user-action"));
}

function wire_delete_custom_graph_buttons(gridStack, sectionKey) {
    const graphs = (settings.customGraphs || []).filter(g => g.section === sectionKey);
    for (const graph of graphs) {
        const btn = document.querySelector(`.delete-custom-graph[data-graph-id="${graph.id}"]`);
        if (btn) {
            btn.addEventListener("click", () => handle_delete_custom_graph(graph.id, gridStack));
        }
    }
}

// ─── Modal ───────────────────────────────────────────────────────────────────

function open_add_custom_graph_modal(sectionKey) {
    const modal = document.getElementById("addCustomGraphModal");
    if (!modal) return;
    modal.dataset.pendingSection = sectionKey;
    bootstrap.Modal.getOrCreateInstance(modal).show();
}

function populate_template_select() {
    const select = document.getElementById("addCustomGraphTemplate");
    if (!select) return;
    select.innerHTML = "";
    for (const tmpl of CUSTOM_GRAPH_TEMPLATES) {
        const opt = document.createElement("option");
        opt.value = tmpl.key;
        opt.textContent = tmpl.label;
        select.appendChild(opt);
    }
    sync_modal_dependent_fields();
}

function sync_modal_dependent_fields() {
    const templateKey = document.getElementById("addCustomGraphTemplate")?.value;
    const tmpl = CUSTOM_GRAPH_TEMPLATES.find(t => t.key === templateKey);
    if (!tmpl) return;

    // Graph type options
    const gtSelect = document.getElementById("addCustomGraphType");
    if (gtSelect) {
        gtSelect.innerHTML = "";
        for (const gt of tmpl.graphTypes) {
            const opt = document.createElement("option");
            opt.value = gt.value;
            opt.textContent = gt.label;
            gtSelect.appendChild(opt);
        }
    }

    // Data type options
    const dtSelect = document.getElementById("addCustomGraphDataType");
    if (dtSelect) {
        dtSelect.innerHTML = "";
        for (const dt of tmpl.dataTypes) {
            const opt = document.createElement("option");
            opt.value = dt.value;
            opt.textContent = dt.label;
            dtSelect.appendChild(opt);
        }
    }

    // Scope label and placeholder
    const scopeLabel = document.getElementById("addCustomGraphScopeLabel");
    const scopeInput = document.getElementById("addCustomGraphScope");
    if (scopeLabel) scopeLabel.textContent = tmpl.scopeLabel;
    if (scopeInput) scopeInput.placeholder = tmpl.scopePlaceholder;

    // Auto-fill title only when the user hasn't typed one
    const titleInput = document.getElementById("addCustomGraphTitle");
    if (titleInput && !titleInput.dataset.userEdited) {
        titleInput.value = tmpl.label;
    }
}

function setup_add_custom_graph_modal() {
    const modal = document.getElementById("addCustomGraphModal");
    if (!modal) return;

    populate_template_select();

    document.getElementById("addCustomGraphTemplate")?.addEventListener("change", () => {
        const titleInput = document.getElementById("addCustomGraphTitle");
        if (titleInput) titleInput.dataset.userEdited = "";
        sync_modal_dependent_fields();
    });

    const titleInput = document.getElementById("addCustomGraphTitle");
    titleInput?.addEventListener("input", () => {
        if (titleInput) {
            titleInput.dataset.userEdited = titleInput.value.trim() ? "1" : "";
        }
    });

    document.getElementById("addCustomGraphConfirm")?.addEventListener("click", () => {
        const section    = modal.dataset.pendingSection || "run";
        const templateKey = document.getElementById("addCustomGraphTemplate")?.value;
        const graphType  = document.getElementById("addCustomGraphType")?.value;
        const dataType   = document.getElementById("addCustomGraphDataType")?.value;
        const scopeInput = document.getElementById("addCustomGraphScope");
        const scopeFilter = scopeInput?.value.trim() || "";
        const titleVal   = document.getElementById("addCustomGraphTitle")?.value.trim() || "Custom Graph";

        const tmpl = CUSTOM_GRAPH_TEMPLATES.find(t => t.key === templateKey);
        if (!tmpl) return;

        // Require a name for name-scoped templates
        if (tmpl.scopeType === "name" && !scopeFilter) {
            scopeInput?.classList.add("is-invalid");
            return;
        }
        scopeInput?.classList.remove("is-invalid");

        const graph = add_custom_graph(section, templateKey, graphType, dataType, tmpl.scopeType, scopeFilter, titleVal);

        // Inject the new widget into the live GridStack
        const capSection = section.charAt(0).toUpperCase() + section.slice(1);
        const grid = window[`grid${capSection}`];
        if (grid) {
            const item = document.createElement("div");
            item.classList.add("grid-stack-item");
            item.setAttribute("gs-w",     4);
            item.setAttribute("gs-h",     4);
            item.setAttribute("gs-min-w", 2);
            item.setAttribute("gs-min-h", 3);
            item.setAttribute("gs-max-w", 12);
            item.setAttribute("gs-max-h", 12);
            item.setAttribute("data-gs-id", `customGraph-${graph.id}`);
            item.innerHTML = `<div class="grid-stack-item-content">${build_custom_graph_html(graph, true)}</div>`;
            grid.makeWidget(item);
            render_custom_graph_chart(graph);

            const deleteBtn = item.querySelector(`.delete-custom-graph[data-graph-id="${graph.id}"]`);
            if (deleteBtn) {
                deleteBtn.addEventListener("click", () => handle_delete_custom_graph(graph.id, grid));
            }
        }

        document.dispatchEvent(new CustomEvent("layout-user-action"));

        // Reset modal fields
        if (titleInput)  { titleInput.value = ""; titleInput.dataset.userEdited = ""; }
        if (scopeInput)  { scopeInput.value = ""; }

        bootstrap.Modal.getInstance(modal)?.hide();
    });

    // Reset validation state when modal is shown
    modal.addEventListener("show.bs.modal", () => {
        document.getElementById("addCustomGraphScope")?.classList.remove("is-invalid");
        const titleInput = document.getElementById("addCustomGraphTitle");
        if (titleInput) titleInput.dataset.userEdited = "";
        sync_modal_dependent_fields();
    });
}

export {
    render_custom_graphs,
    render_add_custom_graph_tile,
    update_custom_graphs,
    setup_add_custom_graph_modal,
    wire_delete_custom_graph_buttons,
    open_add_custom_graph_modal,
};
