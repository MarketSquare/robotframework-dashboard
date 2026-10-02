import { settings, get_run_label } from "../variables/settings.js";
import { set_local_storage_item } from "../localstorage.js";
import { add_alert, generate_id } from "../common.js";
import { apply_widget_control_icons } from "../theme.js";
import { open_log_from_label } from "../log.js";
import { get_transformed_data } from "../filter/pipeline.js";
import { get_suite_data_exclusion } from "../graph_data/helpers.js";
import {
    escape_html_for_merge,
    inFullscreen,
    inFullscreenGraph,
    filteredRuns,
    filteredSuites,
    filteredTests,
    filteredKeywords,
    filteredExceptions,
} from "../variables/globals.js";
import { CUSTOM_GRAPH_SECTIONS, validate_custom_graph_spec } from "./spec.js";
import { run_custom_graph_query } from "./engine.js";
import { build_custom_graph_chart_config, build_custom_graph_table_html } from "./viz.js";
import { open_custom_graph_builder } from "./builder.js";

// graphs switched to their data table with the "show data" button, for this page load only
const customGraphDataView = new Set();
// not kept on window like the built-in graphs: window[canvasId] would resolve to the canvas
// element itself (named element access), since custom graph ids are not declared up front
const customGraphCharts = new Map();
const CUSTOM_GRAPH_FILTER_SECTIONS = ["suite", "test", "keyword"];
const CUSTOM_GRAPH_FULLSCREEN_LIMIT_FACTOR = 5;
let customGraphFullscreenId = null;
let customGraphScrollY = 0;

// graphs written by hand into a json config may lack a (unique) id or a section; they get stable
// ones here, the index keeps the id the same across page loads so the saved layout still matches
function get_custom_graphs(sectionKey = null) {
    const graphs = (Array.isArray(settings.customGraphs) ? settings.customGraphs : [])
        .filter(graph => graph && typeof graph === "object" && !Array.isArray(graph));
    const usedIds = new Set();
    const needsId = [];
    graphs.forEach((graph, index) => {
        if (!CUSTOM_GRAPH_SECTIONS.includes(graph.section)) graph.section = "run";
        if (typeof graph.id === "string" && /^[\w-]{1,40}$/.test(graph.id) && !usedIds.has(graph.id)) usedIds.add(graph.id);
        else needsId.push([graph, index]);
    });
    for (const [graph, index] of needsId) {
        let id = `graph${index}`;
        while (usedIds.has(id)) id += "x";
        graph.id = id;
        usedIds.add(id);
    }
    return sectionKey ? graphs.filter(graph => graph.section === sectionKey) : graphs;
}

function get_custom_graph_data(spec) {
    if (spec.useGlobalFilters) {
        return { runs: filteredRuns, suites: filteredSuites, tests: filteredTests, keywords: filteredKeywords, exceptions: filteredExceptions };
    }
    return {
        runs: get_transformed_data("runs"),
        suites: get_transformed_data("suites"),
        tests: get_transformed_data("tests"),
        keywords: get_transformed_data("keywords"),
        exceptions: get_transformed_data("exceptions"),
    };
}

function get_custom_graph_select_value(id) {
    return document.getElementById(id)?.value ?? "";
}

// the section filters of the section a graph is placed in, applied with the same rules as the
// built-in graphs of that section; null when the graph does not follow them or its data is unrelated
function get_custom_graph_section_filter(spec) {
    if (!spec.useSectionFilters) return null;
    if (spec.section === "suite") {
        if (!document.getElementById("suiteSelectSuites")) return null;
        const exclude = get_suite_data_exclusion("suite");
        if (spec.source === "suites") return (row) => !exclude(row);
        if (spec.source === "tests") return (row) => !exclude({ name: row.suite.split(".").pop(), full_name: row.suite });
        return null;
    }
    if (spec.section === "test") {
        const suite = get_custom_graph_select_value("suiteSelectTests") || "All";
        const test = get_custom_graph_select_value("testSelect") || "All";
        const tag = get_custom_graph_select_value("testTagsSelect") || "All";
        const usePaths = settings.switch.suitePathsTestSection;
        if (spec.source === "tests") {
            return (row) => {
                if (suite !== "All") {
                    const expectedFull = `${suite}.${row.name}`;
                    const isMatch = usePaths
                        ? row.full_name === expectedFull
                        : row.full_name.includes(`.${suite}.${row.name}`) || row.full_name === expectedFull;
                    if (!isMatch) return false;
                }
                if (test !== "All" && row.name !== test) return false;
                return tag === "All" || row.tags.includes(tag);
            };
        }
        if (spec.source === "suites") return (row) => suite === "All" || (usePaths ? row.full_name === suite : row.name === suite);
        return null;
    }
    if (spec.section === "keyword" && spec.source === "keywords") {
        const selected = get_custom_graph_select_value("keywordSelect");
        if (!selected) return null;
        const useLibraryNames = settings.switch.useLibraryNames === true;
        return (row) => (useLibraryNames && row.library ? `${row.library}.${row.name}` : row.name) === selected;
    }
    return null;
}

function destroy_custom_graph_chart(chartId) {
    customGraphCharts.get(chartId)?.destroy();
    customGraphCharts.delete(chartId);
}

function create_custom_graph_chart(canvas, config, logClick) {
    destroy_custom_graph_chart(canvas.id);
    customGraphCharts.set(canvas.id, new Chart(canvas, config));
    // the canvas outlives its charts (edits and filter changes recreate them), so it gets one
    // listener that reads the current chart instead of one listener per chart
    canvas.dataset.logClick = logClick ? "true" : "";
    if (!canvas.dataset.logClickBound) {
        canvas.dataset.logClickBound = "true";
        canvas.addEventListener("click", (event) => {
            const chart = customGraphCharts.get(canvas.id);
            if (canvas.dataset.logClick && chart) open_log_from_label(chart, event);
        });
    }
}

function show_custom_graph_message(body, chartId, message) {
    destroy_custom_graph_chart(chartId);
    body.innerHTML = `<div class="custom-graph-message">${escape_html_for_merge(message)}</div>`;
}

// draws one spec into a graph body: a chart, its data table, or a message explaining why there
// is nothing to show. Shared by the grid tiles and the builder preview
function draw_custom_graph_into(body, rawSpec, chartId, { forceCreate = false, showTable = false, fullscreen = false } = {}) {
    const { spec, errors } = validate_custom_graph_spec(rawSpec);
    if (errors.length > 0) {
        show_custom_graph_message(body, chartId, errors[0]);
        return;
    }
    // like the built-in top 10 -> top 50, fullscreen shows more of a limited graph
    if (fullscreen && spec.limit > 0) spec.limit = Math.min(500, spec.limit * CUSTOM_GRAPH_FULLSCREEN_LIMIT_FACTOR);
    let result;
    try {
        result = run_custom_graph_query(spec, get_custom_graph_data(spec), {
            runLabel: get_run_label,
            rowFilter: get_custom_graph_section_filter(spec),
        });
    } catch (error) {
        console.error("Custom graph could not be calculated", error);
        show_custom_graph_message(body, chartId, "This graph could not be calculated");
        return;
    }
    if (result.x.length === 0 || result.series.length === 0) {
        show_custom_graph_message(body, chartId, "No data for the current filters");
        return;
    }
    if (showTable || spec.viz.type === "table") {
        destroy_custom_graph_chart(chartId);
        body.innerHTML = build_custom_graph_table_html(spec, result);
        return;
    }
    if (!body.querySelector("canvas") || body.querySelector("canvas").id !== chartId) {
        destroy_custom_graph_chart(chartId);
        body.innerHTML = `<canvas id="${chartId}"></canvas>`;
        forceCreate = true;
    }
    const config = build_custom_graph_chart_config(spec, result);
    const chart = customGraphCharts.get(chartId);
    if (forceCreate || !chart) {
        create_custom_graph_chart(body.querySelector("canvas"), config, result.xKind === "run" && !["donut", "heatmap"].includes(spec.viz.type));
    } else {
        chart.data = config.data;
        chart.options = config.options;
        chart.update();
    }
}

function draw_custom_graph(graph, forceCreate = false) {
    const body = document.getElementById(`customGraph-${graph.id}-body`);
    if (!body) return;
    draw_custom_graph_into(body, graph, `customGraph-${graph.id}-graph`, {
        forceCreate,
        showTable: customGraphDataView.has(graph.id),
        fullscreen: customGraphFullscreenId === graph.id,
    });
}

// redraws the graphs that follow the section filters of sectionKey, after one of them changed
function update_section_custom_graphs(sectionKey) {
    for (const graph of get_custom_graphs(sectionKey)) {
        if (graph.useSectionFilters) draw_custom_graph(graph, false);
    }
}

// mirrors the fullscreen toggle of the built-in graphs (graph_view_buttons.js): the same classes,
// scroll lock and moved section filters, so the Escape handler there closes custom graphs too
function toggle_custom_graph_fullscreen(id, entering) {
    const graph = get_custom_graphs().find(item => item.id === id);
    const item = document.querySelector(`[data-gs-id="customGraph-${CSS.escape(id)}"]`);
    const content = item?.querySelector(".grid-stack-item-content");
    if (!graph || !content) return;
    if (entering) customGraphScrollY = window.scrollY;
    customGraphFullscreenId = entering ? id : null;
    inFullscreen = entering;
    inFullscreenGraph = entering ? `customGraph-${id}-Fullscreen` : "";
    document.getElementById("navigation").style.display = entering ? "none" : "";
    document.getElementById(`customGraph-${id}-Fullscreen`).hidden = entering;
    document.getElementById(`customGraph-${id}-Close`).hidden = !entering;
    content.classList.toggle("fullscreen", entering);
    document.body.classList.toggle("lock-scroll", entering);
    document.documentElement.classList.toggle("html-scroll", !entering);

    if (graph.useSectionFilters && CUSTOM_GRAPH_FILTER_SECTIONS.includes(graph.section)) {
        const filters = document.getElementById(`${graph.section}SectionFilters`);
        const container = document.getElementById(`${graph.section}SectionFiltersContainer`);
        if (filters && container) {
            if (entering) content.insertBefore(filters, content.firstChild);
            else container.insertBefore(filters, container.firstChild);
        }
    }
    setTimeout(() => {
        // a fixed body height keeps Chart.js from resizing the canvas in a loop
        const body = content.querySelector(".graph-body");
        if (body) body.style.height = entering ? `${body.clientHeight}px` : "";
        draw_custom_graph(graph, true);
        if (!entering) window.scrollTo({ top: customGraphScrollY, behavior: "auto" });
    }, 0);
}

function build_custom_graph_html(graph, editMode) {
    const id = escape_html_for_merge(graph.id);
    const controls = editMode
        ? `<a class="edit-custom-graph information" data-title="Edit graph" data-graph-id="${id}"></a>
           <a class="duplicate-custom-graph information" data-title="Duplicate graph" data-graph-id="${id}"></a>
           <a class="copy-custom-graph information" data-title="Copy graph definition" data-graph-id="${id}"></a>
           <a class="move-to-first-graph information" data-title="Move to First"></a>
           <a class="move-to-last-graph information" data-title="Move to Last"></a>
           <a class="delete-custom-graph information" data-title="Remove graph" data-graph-id="${id}"></a>`
        : `<a class="data-custom-graph information" data-title="Show data / graph" data-graph-id="${id}"></a>
           <a class="fullscreen-graph information" id="customGraph-${id}-Fullscreen" data-title="Fullscreen" data-graph-id="${id}"></a>
           <a class="close-graph information" id="customGraph-${id}-Close" data-title="Close" data-graph-id="${id}" hidden></a>`;
    return `<div class="graph-header">
                <h6 id="customGraph-${id}-title">${escape_html_for_merge(graph.title)}</h6>
                <div class="graph-controls custom-graph-controls">${controls}</div>
            </div>
            <div class="graph-body custom-graph-body" id="customGraph-${id}-body"></div>`;
}

function add_custom_graph_tile(gridStack, graph, editMode, saved = null) {
    const item = document.createElement("div");
    item.classList.add("grid-stack-item");
    item.setAttribute("gs-w", saved ? saved.w : 4);
    item.setAttribute("gs-h", saved ? saved.h : 4);
    if (saved) {
        item.setAttribute("gs-x", saved.x);
        item.setAttribute("gs-y", saved.y);
    }
    item.setAttribute("gs-min-w", 3);
    item.setAttribute("gs-min-h", 3);
    item.setAttribute("gs-max-w", 12);
    item.setAttribute("gs-max-h", 12);
    item.setAttribute("data-gs-id", `customGraph-${graph.id}`);
    item.innerHTML = `<div class="grid-stack-item-content">${build_custom_graph_html(graph, editMode)}</div>`;
    gridStack.makeWidget(item);
    return item;
}

// only places the tiles; the charts are drawn by create_custom_graphs once the grids are laid out
function render_custom_graphs(gridStack, sectionKey, editMode) {
    const gridId = `grid${sectionKey.charAt(0).toUpperCase() + sectionKey.slice(1)}`;
    const savedLayout = settings.layouts?.[gridId] ? JSON.parse(settings.layouts[gridId]) : null;
    for (const graph of get_custom_graphs(sectionKey)) {
        const saved = savedLayout?.find(layout => layout.id === `customGraph-${graph.id}`);
        add_custom_graph_tile(gridStack, graph, editMode, saved);
    }
}

function create_custom_graphs() {
    for (const graph of get_custom_graphs()) draw_custom_graph(graph, true);
}

function update_custom_graphs() {
    for (const graph of get_custom_graphs()) draw_custom_graph(graph, false);
}

function get_custom_graph_grid(sectionKey) {
    return window[`grid${sectionKey.charAt(0).toUpperCase() + sectionKey.slice(1)}`];
}

// saves a spec coming from the builder: replaces the graph with editingId, or adds a new one
function save_custom_graph(spec, sectionKey, editingId = null) {
    const graphs = [...get_custom_graphs()];
    if (editingId) {
        const index = graphs.findIndex(graph => graph.id === editingId);
        if (index === -1) return;
        const graph = { ...spec, id: editingId, section: graphs[index].section };
        graphs[index] = graph;
        set_local_storage_item("customGraphs", graphs);
        const title = document.getElementById(`customGraph-${editingId}-title`);
        if (title) title.textContent = graph.title;
        draw_custom_graph(graph, true);
    } else {
        const graph = { ...spec, id: generate_id(), section: sectionKey };
        graphs.push(graph);
        set_local_storage_item("customGraphs", graphs);
        const grid = get_custom_graph_grid(sectionKey);
        if (grid) {
            const item = add_custom_graph_tile(grid, graph, true);
            apply_widget_control_icons(item);
            draw_custom_graph(graph, true);
        }
    }
    document.dispatchEvent(new CustomEvent("layout-user-action"));
}

function duplicate_custom_graph(id) {
    const source = get_custom_graphs().find(graph => graph.id === id);
    if (!source) return;
    const title = `${source.title} (copy)`.slice(0, 60);
    save_custom_graph({ ...structuredClone(source), title }, source.section);
}

function delete_custom_graph(id, gridStack) {
    destroy_custom_graph_chart(`customGraph-${id}-graph`);
    const item = gridStack?.el?.querySelector(`[data-gs-id="customGraph-${CSS.escape(id)}"]`);
    if (item) gridStack.removeWidget(item);
    set_local_storage_item("customGraphs", get_custom_graphs().filter(graph => graph.id !== id));
    customGraphDataView.delete(id);
    document.dispatchEvent(new CustomEvent("layout-user-action"));
}

function copy_custom_graph_definition(id) {
    const graph = get_custom_graphs().find(item => item.id === id);
    if (!graph) return;
    const { id: _id, section: _section, ...definition } = validate_custom_graph_spec(graph).spec;
    const text = JSON.stringify(definition, null, 2);
    if (!navigator.clipboard) {
        add_alert("Copying is not available here; the JSON tab of the edit dialog shows the graph definition", "danger");
        return;
    }
    navigator.clipboard.writeText(text)
        .then(() => add_alert("Graph definition copied to the clipboard", "success"))
        .catch(() => add_alert("Could not copy the graph definition", "danger"));
}

// one delegated listener for every tile button, so tiles added or re-rendered later need no wiring
function setup_custom_graph_buttons() {
    document.addEventListener("click", (event) => {
        const button = event.target.closest(".edit-custom-graph, .duplicate-custom-graph, .delete-custom-graph, .data-custom-graph, .copy-custom-graph, .custom-graph-controls .fullscreen-graph, .custom-graph-controls .close-graph");
        if (!button) return;
        const id = button.dataset.graphId;
        if (button.classList.contains("fullscreen-graph") || button.classList.contains("close-graph")) {
            toggle_custom_graph_fullscreen(id, button.classList.contains("fullscreen-graph"));
            return;
        }
        if (button.classList.contains("edit-custom-graph")) {
            const graph = get_custom_graphs().find(item => item.id === id);
            if (graph) open_custom_graph_builder(graph.section, graph);
        } else if (button.classList.contains("duplicate-custom-graph")) {
            duplicate_custom_graph(id);
        } else if (button.classList.contains("delete-custom-graph")) {
            const gridEl = button.closest(".grid-stack");
            delete_custom_graph(id, gridEl ? window[gridEl.id] : null);
        } else if (button.classList.contains("data-custom-graph")) {
            if (customGraphDataView.has(id)) customGraphDataView.delete(id);
            else customGraphDataView.add(id);
            const graph = get_custom_graphs().find(item => item.id === id);
            if (graph) draw_custom_graph(graph, true);
        } else if (button.classList.contains("copy-custom-graph")) {
            copy_custom_graph_definition(id);
        }
    });
    // the built-in section filter listeners update their own graphs; this follows along for the
    // custom graphs (the event bubbles here after those listeners ran)
    document.addEventListener("change", (event) => {
        const filters = event.target.closest("#suiteSectionFilters, #testSectionFilters, #keywordSectionFilters");
        if (filters) update_section_custom_graphs(filters.id.replace("SectionFilters", ""));
    });
}

export {
    render_custom_graphs,
    create_custom_graphs,
    update_custom_graphs,
    update_section_custom_graphs,
    save_custom_graph,
    draw_custom_graph_into,
    destroy_custom_graph_chart,
    get_custom_graph_data,
    setup_custom_graph_buttons,
};
