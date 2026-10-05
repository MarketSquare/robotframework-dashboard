import {
    CUSTOM_GRAPH_SOURCES,
    CUSTOM_GRAPH_DATE_BUCKETS,
    get_custom_graph_field,
    get_custom_graph_ops,
    is_custom_graph_groupable,
    get_custom_graph_aggs,
    get_custom_graph_agg,
    get_custom_graph_agg_fields,
} from "./fields.js";

const CUSTOM_GRAPH_SPEC_VERSION = 1;
const CUSTOM_GRAPH_SECTIONS = ["run", "suite", "test", "keyword", "unified"];
const CUSTOM_GRAPH_VIZ_TYPES = [
    { key: "line", label: "Line" },
    { key: "bar", label: "Bar" },
    { key: "stacked_bar", label: "Stacked bar" },
    { key: "hbar", label: "Horizontal bar" },
    { key: "donut", label: "Donut" },
    { key: "heatmap", label: "Heatmap" },
    { key: "table", label: "Table" },
];
const CUSTOM_GRAPH_ORDERS = [
    { key: "auto", label: "Automatic" },
    { key: "value_desc", label: "Highest value first" },
    { key: "value_asc", label: "Lowest value first" },
    { key: "label", label: "Alphabetical" },
];
const CUSTOM_GRAPH_PERCENT_VIZ_TYPES = ["bar", "stacked_bar", "hbar"];
const CUSTOM_GRAPH_MAX_TITLE = 60;
const CUSTOM_GRAPH_MAX_LIMIT = 500;
const CUSTOM_GRAPH_MAX_REGEX = 100;
// a quantified group that itself contains a quantifier, like (a+)+ or (\w*)*: the shape behind
// catastrophic backtracking. A regex runs on every row on every redraw, and json configs are
// shared, so such a pattern could freeze the dashboard on load
const CUSTOM_GRAPH_NESTED_QUANTIFIER = /\((?:[^()\\]|\\.)*[+*}](?:[^()\\]|\\.)*\)(?:[+*]|\{\d*,)/;

// returns the problem with a "matches regex" filter value, or "" when it can be used
function get_custom_graph_regex_problem(pattern) {
    if (pattern.length > CUSTOM_GRAPH_MAX_REGEX) return `regular expressions can be at most ${CUSTOM_GRAPH_MAX_REGEX} characters`;
    if (CUSTOM_GRAPH_NESTED_QUANTIFIER.test(pattern)) return `"${pattern}" repeats a group that already repeats (like (a+)+), which can freeze the dashboard`;
    try { new RegExp(pattern); } catch { return `"${pattern}" is not a valid regular expression`; }
    return "";
}

function is_custom_graph_status_grouped(spec) {
    return [spec.x, spec.series].some(group => group && get_custom_graph_field(spec.source, group.field)?.type === "status");
}

// percent splits every column into the share of each series, which needs series to split
// into and values that add up
function custom_graph_supports_percent(spec) {
    return CUSTOM_GRAPH_PERCENT_VIZ_TYPES.includes(spec.viz?.type) && !!spec.series && !!get_custom_graph_agg(spec.metric?.agg)?.sums;
}

function create_default_custom_graph_spec(section = "run") {
    return {
        v: CUSTOM_GRAPH_SPEC_VERSION,
        id: "",
        section,
        title: "Custom graph",
        source: "tests",
        where: [],
        x: { field: "run" },
        series: { field: "status" },
        metric: { agg: "count" },
        order: "auto",
        limit: 0,
        viz: { type: "stacked_bar", percent: false },
        useGlobalFilters: true,
        useSectionFilters: false,
    };
}

function validate_custom_graph_group(raw, source, label, errors) {
    if (!raw || typeof raw !== "object" || !raw.field) return null;
    const field = get_custom_graph_field(source, raw.field);
    if (!is_custom_graph_groupable(field)) {
        errors.push(`${label}: "${raw.field}" is not a field that can be grouped on for ${source}`);
        return { field: String(raw.field) };
    }
    const group = { field: field.key };
    if (field.type === "kv") {
        group.key = String(raw.key ?? "").trim();
        if (!group.key) errors.push(`${label}: choose which ${field.label.toLowerCase()} key to group on`);
    }
    if (field.type === "datetime") {
        group.bucket = CUSTOM_GRAPH_DATE_BUCKETS.some(bucket => bucket.key === raw.bucket) ? raw.bucket : "day";
    }
    return group;
}

function validate_custom_graph_condition(raw, source, errors) {
    const condition = {
        field: String(raw?.field ?? ""),
        op: String(raw?.op ?? ""),
        value: raw?.value === undefined || raw?.value === null ? "" : String(raw.value),
    };
    const field = get_custom_graph_field(source, condition.field);
    if (!field || get_custom_graph_ops(field.type).length === 0) {
        errors.push(`Filter: "${condition.field}" is not a field that can be filtered on for ${source}`);
        return condition;
    }
    if (!get_custom_graph_ops(field.type).some(op => op.key === condition.op)) {
        errors.push(`Filter: "${condition.op}" is not a valid operator for ${field.label.toLowerCase()}`);
    }
    if (field.type === "kv") {
        condition.key = String(raw.key ?? "").trim();
        if (!condition.key) errors.push(`Filter: choose which ${field.label.toLowerCase()} key to filter on`);
    }
    if (condition.op === "matches" && condition.value.trim() !== "") {
        const problem = get_custom_graph_regex_problem(condition.value.trim());
        if (problem) errors.push(`Filter: ${problem}`);
    }
    return condition;
}

// returns a clean spec with every unknown key dropped and every default filled in, plus the
// problems found; json configs come from other people, so nothing is trusted as-is
function validate_custom_graph_spec(raw) {
    const errors = [];
    const defaults = create_default_custom_graph_spec();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return { spec: defaults, errors: ["The graph definition is not an object"] };
    }
    // a newer spec version may mean something else by the same keys, so it is not reinterpreted
    if (Number(raw.v) > CUSTOM_GRAPH_SPEC_VERSION) {
        return { spec: defaults, errors: ["This graph was made with a newer version of the dashboard"] };
    }
    const spec = {
        v: CUSTOM_GRAPH_SPEC_VERSION,
        id: typeof raw.id === "string" && /^[\w-]{1,40}$/.test(raw.id) ? raw.id : "",
        section: CUSTOM_GRAPH_SECTIONS.includes(raw.section) ? raw.section : defaults.section,
        title: String(raw.title ?? "").trim().slice(0, CUSTOM_GRAPH_MAX_TITLE) || defaults.title,
        source: raw.source,
        where: [],
        x: null,
        series: null,
        metric: { agg: "count" },
        order: CUSTOM_GRAPH_ORDERS.some(order => order.key === raw.order) ? raw.order : "auto",
        limit: Math.min(CUSTOM_GRAPH_MAX_LIMIT, Math.max(0, parseInt(raw.limit, 10) || 0)),
        viz: { type: "bar", percent: false },
        useGlobalFilters: raw.useGlobalFilters !== false,
        useSectionFilters: raw.useSectionFilters === true,
    };
    if (!CUSTOM_GRAPH_SOURCES.some(source => source.key === raw.source)) {
        errors.push(`Data: "${raw.source}" is not a known source`);
        spec.source = defaults.source;
        return { spec, errors };
    }

    spec.where = (Array.isArray(raw.where) ? raw.where : [])
        .map(condition => validate_custom_graph_condition(condition, spec.source, errors));
    spec.x = validate_custom_graph_group(raw.x, spec.source, "X axis", errors);
    spec.series = validate_custom_graph_group(raw.series, spec.source, "Split by", errors);
    if (spec.x && spec.series && spec.x.field === spec.series.field && spec.x.key === spec.series.key) {
        errors.push("Split by: choose a different field than the X axis");
    }

    const agg = get_custom_graph_agg(raw.metric?.agg);
    const statusGrouped = is_custom_graph_status_grouped(spec);
    if (!agg || !get_custom_graph_aggs(spec.source).includes(agg)) {
        errors.push(`Metric: "${raw.metric?.agg}" is not available for ${spec.source}`);
    } else if (!get_custom_graph_aggs(spec.source, statusGrouped).includes(agg)) {
        errors.push(`Metric: ${spec.source} grouped by status can only show count, passed, failed or skipped`);
    } else {
        spec.metric = { agg: agg.key };
        if (agg.needs) {
            const field = get_custom_graph_agg_fields(spec.source, agg.key).find(item => item.key === raw.metric.field);
            spec.metric.field = field ? field.key : String(raw.metric.field ?? "");
            if (!field) errors.push(`Metric: choose a field to calculate the ${agg.label.toLowerCase()} of`);
        }
        if (agg.key === "pass_rate") spec.metric.ignoreSkips = raw.metric.ignoreSkips === true;
    }

    const vizType = CUSTOM_GRAPH_VIZ_TYPES.find(viz => viz.key === raw.viz?.type);
    if (!vizType) errors.push(`Chart: "${raw.viz?.type}" is not a known chart type`);
    spec.viz = { type: vizType ? vizType.key : "bar", percent: false };
    spec.viz.percent = raw.viz?.percent === true && custom_graph_supports_percent(spec);
    if (spec.viz.type === "donut" && spec.series) {
        errors.push("Chart: a donut shows a single series, remove the split by");
    }
    if (spec.viz.type === "heatmap" && (!spec.x || !spec.series)) {
        errors.push("Chart: a heatmap needs an X axis (columns) and a split by (rows)");
    }
    return { spec, errors };
}

function is_custom_graph_group_valid(group, source) {
    return !!group && is_custom_graph_groupable(get_custom_graph_field(source, group.field));
}

// the builder edits a draft one control at a time; after every change this repairs whatever the
// change made inconsistent (e.g. a new source without the grouped field) so the form stays usable
function sanitize_custom_graph_spec(draft) {
    const spec = structuredClone(draft);
    const source = spec.source;
    spec.where = (spec.where || [])
        .filter(condition => {
            const field = get_custom_graph_field(source, condition.field);
            return field && get_custom_graph_ops(field.type).length > 0;
        })
        .map(condition => {
            const ops = get_custom_graph_ops(get_custom_graph_field(source, condition.field).type);
            return ops.some(op => op.key === condition.op) ? condition : { ...condition, op: ops[0].key, value: "" };
        });
    if (spec.x && !is_custom_graph_group_valid(spec.x, source)) spec.x = { field: "run" };
    if (spec.series && !is_custom_graph_group_valid(spec.series, source)) spec.series = null;
    if (spec.x && spec.series && spec.x.field === spec.series.field && spec.x.key === spec.series.key) spec.series = null;
    if (spec.viz?.type === "donut") spec.series = null;
    const aggs = get_custom_graph_aggs(source, is_custom_graph_status_grouped(spec));
    let agg = aggs.find(item => item.key === spec.metric?.agg);
    if (!agg) {
        agg = aggs[0];
        spec.metric = { agg: agg.key };
    }
    if (agg.needs) {
        const fields = get_custom_graph_agg_fields(source, agg.key);
        if (!fields.some(field => field.key === spec.metric.field)) spec.metric.field = fields[0]?.key;
    } else {
        delete spec.metric.field;
    }
    if (agg.key !== "pass_rate") delete spec.metric.ignoreSkips;
    if (spec.viz && !custom_graph_supports_percent(spec)) spec.viz.percent = false;
    return spec;
}

export {
    CUSTOM_GRAPH_SPEC_VERSION,
    CUSTOM_GRAPH_SECTIONS,
    CUSTOM_GRAPH_VIZ_TYPES,
    CUSTOM_GRAPH_ORDERS,
    CUSTOM_GRAPH_PERCENT_VIZ_TYPES,
    CUSTOM_GRAPH_MAX_TITLE,
    CUSTOM_GRAPH_MAX_LIMIT,
    create_default_custom_graph_spec,
    validate_custom_graph_spec,
    sanitize_custom_graph_spec,
    get_custom_graph_regex_problem,
    is_custom_graph_status_grouped,
    custom_graph_supports_percent,
};
