import { debounce } from "../common.js";
import { escape_html_for_merge } from "../variables/globals.js";
import { settings } from "../variables/settings.js";
import {
    CUSTOM_GRAPH_SOURCES,
    CUSTOM_GRAPH_DATE_BUCKETS,
    CUSTOM_GRAPH_STATUS_LABELS,
    get_custom_graph_field,
    get_custom_graph_ops,
    get_custom_graph_groupable_fields,
    get_custom_graph_filterable_fields,
    get_custom_graph_aggs,
    get_custom_graph_agg,
    get_custom_graph_agg_fields,
} from "./fields.js";
import {
    CUSTOM_GRAPH_VIZ_TYPES,
    CUSTOM_GRAPH_ORDERS,
    create_default_custom_graph_spec,
    validate_custom_graph_spec,
    sanitize_custom_graph_spec,
    is_custom_graph_status_grouped,
    custom_graph_supports_percent,
} from "./spec.js";
import { CUSTOM_GRAPH_PRESETS } from "./presets.js";
import { get_custom_graph_rows } from "./engine.js";
import { save_custom_graph, draw_custom_graph_into, destroy_custom_graph_chart, get_custom_graph_data } from "./widgets.js";

const CUSTOM_GRAPH_PREVIEW_ID = "customGraphPreview-graph";
const CUSTOM_GRAPH_MAX_SUGGESTIONS = 200;
// sections with section filters, and the data sources those filters narrow down (widgets.js)
const CUSTOM_GRAPH_SECTION_FILTER_DATA = { suite: "suite and test", test: "test and suite", keyword: "keyword" };

let customGraphDraft = create_default_custom_graph_spec();
let customGraphEditingId = null;
let customGraphSection = "run";
let customGraphJsonError = "";
// the filter value to focus once the builder tab is shown after picking a preset
let customGraphPendingFocus = null;

// theme.js swaps the outline button classes once when the theme is applied, so buttons built
// later have to pick the class of the current theme themselves
function get_custom_graph_button_class() {
    return document.documentElement.classList.contains("dark-mode") ? "btn-outline-light" : "btn-outline-dark";
}

function custom_graph_option(value, label, selected) {
    return `<option value="${escape_html_for_merge(value)}"${selected ? " selected" : ""}>${escape_html_for_merge(label)}</option>`;
}

function custom_graph_datalist(id, values) {
    return `<datalist id="${id}">${values.map(value => `<option value="${escape_html_for_merge(value)}"></option>`).join("")}</datalist>`;
}

// distinct values present in the data, offered as suggestions while typing a filter or key;
// without kvKey a kv field suggests its keys instead of its values
function get_custom_graph_suggestions(field, kvKey = undefined) {
    const values = new Set();
    const rows = get_custom_graph_rows(customGraphDraft.source, get_custom_graph_data(customGraphDraft), {
        suitePaths: settings.switch.suitePathsTestSection === true,
    });
    for (const row of rows) {
        const value = row[field.key];
        if (field.type === "tags") value.forEach(tag => values.add(tag));
        else if (field.type === "kv" && kvKey === undefined) Object.keys(value).forEach(key => values.add(key));
        else if (field.type === "kv") { if (value[kvKey] !== undefined) values.add(value[kvKey]); }
        else if (value !== "" && value !== undefined && value !== null) values.add(String(value));
        if (values.size >= CUSTOM_GRAPH_MAX_SUGGESTIONS * 2) break;
    }
    return [...values]
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        .slice(0, CUSTOM_GRAPH_MAX_SUGGESTIONS);
}

function build_custom_graph_value_input(condition, field, index) {
    const value = escape_html_for_merge(condition.value ?? "");
    const attributes = `class="form-control form-control-sm custom-graph-filter-value" data-index="${index}" aria-label="Value"`;
    if (field.type === "status") {
        const options = Object.entries(CUSTOM_GRAPH_STATUS_LABELS)
            .map(([key, label]) => custom_graph_option(key, label, condition.value === key)).join("");
        return `<select class="form-select form-select-sm custom-graph-filter-value" data-index="${index}" aria-label="Value">
                    ${custom_graph_option("", "Choose…", !condition.value)}${options}
                </select>`;
    }
    if (field.type === "datetime") {
        return condition.op === "last_days"
            ? `<input type="number" min="0" step="1" ${attributes} placeholder="Days" value="${value}">`
            : `<input type="date" ${attributes} value="${value}">`;
    }
    if (field.type === "number" || field.type === "duration") {
        const placeholder = field.type === "duration" ? "Seconds" : "Value";
        return `<input type="number" step="any" ${attributes} placeholder="${placeholder}" value="${value}">`;
    }
    const listId = `customGraphFilterValues${index}`;
    const suggestions = field.type === "kv" && !condition.key ? [] : get_custom_graph_suggestions(field, field.type === "kv" ? condition.key : undefined);
    return `<input type="text" ${attributes} placeholder="Value" value="${value}" list="${listId}">${custom_graph_datalist(listId, suggestions)}`;
}

function build_custom_graph_filter_row(condition, index) {
    const source = customGraphDraft.source;
    const field = get_custom_graph_field(source, condition.field);
    const fieldOptions = get_custom_graph_filterable_fields(source)
        .map(item => custom_graph_option(item.key, item.label, item.key === condition.field)).join("");
    const opOptions = get_custom_graph_ops(field.type)
        .map(op => custom_graph_option(op.key, op.label, op.key === condition.op)).join("");
    const keyListId = `customGraphFilterKeys${index}`;
    const keyInput = field.type === "kv"
        ? `<input type="text" class="form-control form-control-sm custom-graph-filter-key" data-index="${index}" aria-label="Key"
                placeholder="Key" value="${escape_html_for_merge(condition.key ?? "")}" list="${keyListId}">${custom_graph_datalist(keyListId, get_custom_graph_suggestions(field))}`
        : "";
    return `<div class="custom-graph-filter-row" data-index="${index}">
                <select class="form-select form-select-sm custom-graph-filter-field" data-index="${index}" aria-label="Field">${fieldOptions}</select>
                ${keyInput}
                <select class="form-select form-select-sm custom-graph-filter-op" data-index="${index}" aria-label="Operator">${opOptions}</select>
                ${build_custom_graph_value_input(condition, field, index)}
                <button type="button" class="btn ${get_custom_graph_button_class()} btn-sm custom-graph-filter-remove" data-index="${index}" aria-label="Remove condition">✕</button>
            </div>`;
}

function render_custom_graph_group(prefix, group, noneLabel) {
    const source = customGraphDraft.source;
    const select = document.getElementById(`customGraph${prefix}`);
    const keyInput = document.getElementById(`customGraph${prefix}Key`);
    const bucketSelect = document.getElementById(`customGraph${prefix}Bucket`);
    select.innerHTML = custom_graph_option("", noneLabel, !group) + get_custom_graph_groupable_fields(source)
        .map(field => custom_graph_option(field.key, field.label, group?.field === field.key)).join("");
    const field = group ? get_custom_graph_field(source, group.field) : null;
    keyInput.hidden = field?.type !== "kv";
    keyInput.value = group?.key ?? "";
    const keyList = document.getElementById(`customGraph${prefix}KeyOptions`);
    keyList.innerHTML = field?.type === "kv"
        ? get_custom_graph_suggestions(field).map(key => `<option value="${escape_html_for_merge(key)}"></option>`).join("")
        : "";
    bucketSelect.hidden = field?.type !== "datetime";
    bucketSelect.innerHTML = CUSTOM_GRAPH_DATE_BUCKETS
        .map(bucket => custom_graph_option(bucket.key, bucket.label, (group?.bucket ?? "day") === bucket.key)).join("");
}

function render_custom_graph_form() {
    const draft = customGraphDraft;
    document.getElementById("customGraphTitle").value = draft.title;
    document.getElementById("customGraphSource").innerHTML = CUSTOM_GRAPH_SOURCES
        .map(source => custom_graph_option(source.key, source.label, source.key === draft.source)).join("");
    document.getElementById("customGraphFilters").innerHTML = draft.where
        .map((condition, index) => build_custom_graph_filter_row(condition, index)).join("");
    render_custom_graph_group("X", draft.x, "None (a single bar)");
    render_custom_graph_group("Series", draft.series, "None");

    const agg = get_custom_graph_agg(draft.metric.agg);
    document.getElementById("customGraphAgg").innerHTML = get_custom_graph_aggs(draft.source, is_custom_graph_status_grouped(draft))
        .map(item => custom_graph_option(item.key, item.label, item.key === draft.metric.agg)).join("");
    const aggField = document.getElementById("customGraphAggField");
    aggField.hidden = !agg?.needs;
    aggField.innerHTML = get_custom_graph_agg_fields(draft.source, draft.metric.agg)
        .map(field => custom_graph_option(field.key, field.label, field.key === draft.metric.field)).join("");
    document.getElementById("customGraphIgnoreSkipsGroup").hidden = draft.metric.agg !== "pass_rate";
    document.getElementById("customGraphIgnoreSkips").checked = draft.metric.ignoreSkips === true;

    document.getElementById("customGraphOrder").innerHTML = CUSTOM_GRAPH_ORDERS
        .map(order => custom_graph_option(order.key, order.label, order.key === draft.order)).join("");
    document.getElementById("customGraphLimit").value = draft.limit || "";

    document.getElementById("customGraphViz").innerHTML = CUSTOM_GRAPH_VIZ_TYPES
        .map(viz => `<button type="button" class="btn ${get_custom_graph_button_class()} btn-sm custom-graph-viz-btn${viz.key === draft.viz.type ? " active" : ""}"
                        data-viz="${viz.key}" aria-pressed="${viz.key === draft.viz.type}">${viz.label}</button>`).join("");
    document.getElementById("customGraphPercentGroup").hidden = !custom_graph_supports_percent(draft);
    document.getElementById("customGraphPercent").checked = draft.viz.percent === true;
    document.getElementById("customGraphGlobalFilters").checked = draft.useGlobalFilters !== false;
    const sectionData = CUSTOM_GRAPH_SECTION_FILTER_DATA[customGraphSection];
    document.getElementById("customGraphSectionFiltersGroup").hidden = !sectionData;
    document.getElementById("customGraphSectionFilters").checked = draft.useSectionFilters === true;
    if (sectionData) {
        document.getElementById("customGraphSectionFiltersLabel").textContent =
            `Follow the ${customGraphSection} section filters (affects ${sectionData} data)`;
    }
}

function read_custom_graph_group(prefix) {
    const fieldKey = document.getElementById(`customGraph${prefix}`).value;
    if (!fieldKey) return null;
    const field = get_custom_graph_field(customGraphDraft.source, fieldKey);
    const group = { field: fieldKey };
    if (field?.type === "kv") group.key = document.getElementById(`customGraph${prefix}Key`).value.trim();
    if (field?.type === "datetime") group.bucket = document.getElementById(`customGraph${prefix}Bucket`).value;
    return group;
}

function read_custom_graph_form() {
    const draft = structuredClone(customGraphDraft);
    draft.title = document.getElementById("customGraphTitle").value;
    draft.source = document.getElementById("customGraphSource").value;
    draft.where = [...document.querySelectorAll("#customGraphFilters .custom-graph-filter-row")].map(row => {
        const condition = {
            field: row.querySelector(".custom-graph-filter-field").value,
            op: row.querySelector(".custom-graph-filter-op").value,
            value: row.querySelector(".custom-graph-filter-value").value,
        };
        const keyInput = row.querySelector(".custom-graph-filter-key");
        if (keyInput) condition.key = keyInput.value.trim();
        return condition;
    });
    // a source change invalidates every field below it; sanitize_custom_graph_spec repairs them
    if (draft.source !== customGraphDraft.source) return draft;
    draft.x = read_custom_graph_group("X");
    draft.series = read_custom_graph_group("Series");
    draft.metric = { agg: document.getElementById("customGraphAgg").value };
    if (get_custom_graph_agg(draft.metric.agg)?.needs) draft.metric.field = document.getElementById("customGraphAggField").value;
    if (draft.metric.agg === "pass_rate") draft.metric.ignoreSkips = document.getElementById("customGraphIgnoreSkips").checked;
    draft.order = document.getElementById("customGraphOrder").value;
    draft.limit = parseInt(document.getElementById("customGraphLimit").value, 10) || 0;
    draft.viz = { type: customGraphDraft.viz.type, percent: document.getElementById("customGraphPercent").checked };
    draft.useGlobalFilters = document.getElementById("customGraphGlobalFilters").checked;
    draft.useSectionFilters = !!CUSTOM_GRAPH_SECTION_FILTER_DATA[customGraphSection]
        && document.getElementById("customGraphSectionFilters").checked;
    return draft;
}

function update_custom_graph_save_button() {
    const { errors } = validate_custom_graph_spec(customGraphDraft);
    document.getElementById("customGraphSave").disabled = errors.length > 0 || customGraphJsonError !== "";
    return errors;
}

function render_custom_graph_preview() {
    const errors = update_custom_graph_save_button();
    document.getElementById("customGraphErrors").innerHTML = errors
        .map(error => `<div>${escape_html_for_merge(error)}</div>`).join("");
    const body = document.getElementById("customGraphPreviewBody");
    if (!body.offsetParent) return;
    draw_custom_graph_into(body, customGraphDraft, CUSTOM_GRAPH_PREVIEW_ID, { forceCreate: true });
}

const schedule_custom_graph_preview = debounce(render_custom_graph_preview, 250);

function apply_custom_graph_change(draft) {
    customGraphDraft = sanitize_custom_graph_spec(draft);
    render_custom_graph_form();
    schedule_custom_graph_preview();
}

function render_custom_graph_gallery() {
    const cards = [{ key: "", label: "Start from scratch", description: "An empty graph to build yourself." }, ...CUSTOM_GRAPH_PRESETS]
        .map(preset => {
            const viz = preset.spec ? CUSTOM_GRAPH_VIZ_TYPES.find(item => item.key === preset.spec.viz.type)?.label : "";
            return `<button type="button" class="custom-graph-preset" data-preset="${preset.key}">
                        <span class="custom-graph-preset-title">${escape_html_for_merge(preset.label)}</span>
                        <span class="custom-graph-preset-description">${escape_html_for_merge(preset.description)}</span>
                        ${viz ? `<span class="custom-graph-preset-chart">${escape_html_for_merge(viz)}</span>` : ""}
                    </button>`;
        }).join("");
    document.getElementById("customGraphGallery").innerHTML = cards;
}

function show_custom_graph_tab(name) {
    const tab = document.getElementById(`customGraph${name}Tab-tab`);
    if (tab) bootstrap.Tab.getOrCreateInstance(tab).show();
}

function load_custom_graph_preset(key) {
    const preset = CUSTOM_GRAPH_PRESETS.find(item => item.key === key);
    const spec = preset
        ? validate_custom_graph_spec({ ...preset.spec, section: customGraphSection }).spec
        : create_default_custom_graph_spec(customGraphSection);
    customGraphDraft = sanitize_custom_graph_spec(spec);
    customGraphPendingFocus = preset?.focusFilter ?? null;
    render_custom_graph_form();
    show_custom_graph_tab("Builder");
}

function export_custom_graph_definition(spec) {
    const { id, section, ...definition } = spec;
    return JSON.stringify(definition, null, 2);
}

function apply_custom_graph_json() {
    const textarea = document.getElementById("customGraphJson");
    const errorsEl = document.getElementById("customGraphJsonErrors");
    let parsed;
    try {
        parsed = JSON.parse(textarea.value);
    } catch (error) {
        customGraphJsonError = `Invalid JSON: ${error.message}`;
        errorsEl.innerHTML = `<div>${escape_html_for_merge(customGraphJsonError)}</div>`;
        update_custom_graph_save_button();
        return;
    }
    customGraphJsonError = "";
    const { spec, errors } = validate_custom_graph_spec({ ...parsed, section: customGraphSection });
    customGraphDraft = spec;
    errorsEl.innerHTML = errors.map(error => `<div>${escape_html_for_merge(error)}</div>`).join("");
    update_custom_graph_save_button();
}

function open_custom_graph_builder(sectionKey, graph = null) {
    const modal = document.getElementById("customGraphModal");
    if (!modal) return;
    customGraphSection = sectionKey;
    customGraphEditingId = graph?.id ?? null;
    customGraphJsonError = "";
    customGraphPendingFocus = null;
    customGraphDraft = graph
        ? sanitize_custom_graph_spec(validate_custom_graph_spec(graph).spec)
        : create_default_custom_graph_spec(sectionKey);
    document.getElementById("customGraphModalLabel").textContent = graph ? "Edit Custom Graph" : "Add Custom Graph";
    document.getElementById("customGraphSave").textContent = graph ? "Save Graph" : "Add Graph";
    document.getElementById("customGraphErrors").innerHTML = "";
    document.getElementById("customGraphJsonErrors").innerHTML = "";
    render_custom_graph_form();
    show_custom_graph_tab(graph ? "Builder" : "Gallery");
    bootstrap.Modal.getOrCreateInstance(modal).show();
}

function setup_custom_graph_builder() {
    const modal = document.getElementById("customGraphModal");
    if (!modal) return;
    render_custom_graph_gallery();
    const form = document.getElementById("customGraphForm");
    const saveButton = document.getElementById("customGraphSave");

    // typing only refreshes the preview; re-rendering the form here would steal the focus
    form.addEventListener("input", (event) => {
        if (event.target.matches("select, input[type=checkbox]")) return;
        customGraphDraft = read_custom_graph_form();
        schedule_custom_graph_preview();
    });
    form.addEventListener("change", (event) => {
        if (!event.target.matches("select, input[type=checkbox]")) return;
        apply_custom_graph_change(read_custom_graph_form());
    });
    form.addEventListener("click", (event) => {
        const vizButton = event.target.closest(".custom-graph-viz-btn");
        const removeButton = event.target.closest(".custom-graph-filter-remove");
        if (vizButton) {
            const draft = read_custom_graph_form();
            draft.viz.type = vizButton.dataset.viz;
            apply_custom_graph_change(draft);
        } else if (removeButton) {
            const draft = read_custom_graph_form();
            draft.where.splice(Number(removeButton.dataset.index), 1);
            apply_custom_graph_change(draft);
        } else if (event.target.closest("#customGraphAddFilter")) {
            const draft = read_custom_graph_form();
            const fields = get_custom_graph_filterable_fields(draft.source);
            const field = fields.find(item => item.key === "test") || fields.find(item => item.key === "name") || fields[0];
            draft.where.push({ field: field.key, op: get_custom_graph_ops(field.type)[0].key, value: "" });
            apply_custom_graph_change(draft);
            document.querySelector(`#customGraphFilters .custom-graph-filter-field[data-index="${draft.where.length - 1}"]`)?.focus();
        }
    });

    document.getElementById("customGraphGallery").addEventListener("click", (event) => {
        const card = event.target.closest(".custom-graph-preset");
        if (card) load_custom_graph_preset(card.dataset.preset);
    });

    document.getElementById("customGraphJson").addEventListener("input", debounce(apply_custom_graph_json, 300));

    document.getElementById("customGraphGalleryTab-tab").addEventListener("shown.bs.tab", () => {
        saveButton.hidden = true;
    });
    document.getElementById("customGraphBuilderTab-tab").addEventListener("shown.bs.tab", () => {
        saveButton.hidden = false;
        // unparsable json typed in the json tab is dropped, the form shows the last valid draft
        customGraphJsonError = "";
        customGraphDraft = sanitize_custom_graph_spec(customGraphDraft);
        render_custom_graph_form();
        render_custom_graph_preview();
        if (customGraphPendingFocus !== null) {
            document.querySelector(`#customGraphFilters .custom-graph-filter-value[data-index="${customGraphPendingFocus}"]`)?.focus();
            customGraphPendingFocus = null;
        }
    });
    document.getElementById("customGraphJsonTab-tab").addEventListener("shown.bs.tab", () => {
        saveButton.hidden = false;
        customGraphJsonError = "";
        document.getElementById("customGraphJson").value = export_custom_graph_definition(customGraphDraft);
        document.getElementById("customGraphJsonErrors").innerHTML = "";
        update_custom_graph_save_button();
    });

    modal.addEventListener("shown.bs.modal", () => {
        if (document.getElementById("customGraphBuilderTab").classList.contains("active")) render_custom_graph_preview();
    });
    modal.addEventListener("hidden.bs.modal", () => destroy_custom_graph_chart(CUSTOM_GRAPH_PREVIEW_ID));

    saveButton.addEventListener("click", () => {
        // the json is parsed on a debounce while typing, a quick save must not use the previous draft
        if (document.getElementById("customGraphJsonTab").classList.contains("active")) apply_custom_graph_json();
        if (customGraphJsonError !== "") return;
        const { spec, errors } = validate_custom_graph_spec(customGraphDraft);
        if (errors.length > 0) return;
        save_custom_graph(spec, customGraphSection, customGraphEditingId);
        bootstrap.Modal.getInstance(modal)?.hide();
    });
}

export { open_custom_graph_builder, setup_custom_graph_builder };
