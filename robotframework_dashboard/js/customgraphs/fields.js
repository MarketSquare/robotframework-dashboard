// field catalog for the custom graphs: which fields each source offers, what type they are,
// and which filter operators / aggregations / groupings that type allows

const CUSTOM_GRAPH_SOURCES = [
    { key: "runs", label: "Runs" },
    { key: "suites", label: "Suites" },
    { key: "tests", label: "Tests" },
    { key: "keywords", label: "Keywords" },
    { key: "exceptions", label: "Exceptions" },
];

// joined from the parent run on every source, so every source can be filtered and grouped by them
const CUSTOM_GRAPH_RUN_FIELDS = [
    { key: "run", label: "Run", type: "run" },
    { key: "run_date", label: "Run date", type: "datetime" },
    { key: "run_name", label: "Run name", type: "string" },
    { key: "run_tags", label: "Run tags", type: "tags" },
    { key: "project_version", label: "Project version", type: "string" },
    { key: "metadata", label: "Metadata", type: "kv" },
    { key: "custom_filters", label: "Custom filter", type: "kv" },
];

const CUSTOM_GRAPH_STATUS_FIELDS = [
    { key: "status", label: "Status", type: "status" },
    { key: "passed", label: "Passed", type: "number" },
    { key: "failed", label: "Failed", type: "number" },
    { key: "skipped", label: "Skipped", type: "number" },
];

const CUSTOM_GRAPH_SOURCE_FIELDS = {
    runs: [
        ...CUSTOM_GRAPH_STATUS_FIELDS,
        { key: "total", label: "Total", type: "number" },
        { key: "elapsed_s", label: "Duration", type: "duration" },
    ],
    suites: [
        { key: "name", label: "Suite name", type: "string" },
        { key: "full_name", label: "Suite full name", type: "string" },
        { key: "parent", label: "Parent suite", type: "string" },
        ...CUSTOM_GRAPH_STATUS_FIELDS,
        { key: "total", label: "Total", type: "number" },
        { key: "elapsed_s", label: "Duration", type: "duration" },
    ],
    tests: [
        { key: "name", label: "Test name", type: "string" },
        { key: "full_name", label: "Test full name", type: "string" },
        { key: "suite", label: "Suite", type: "string" },
        { key: "tags", label: "Test tags", type: "tags" },
        { key: "message", label: "Message", type: "string" },
        ...CUSTOM_GRAPH_STATUS_FIELDS,
        { key: "elapsed_s", label: "Duration", type: "duration" },
        { key: "attempts", label: "Attempts", type: "number" },
    ],
    keywords: [
        { key: "name", label: "Keyword name", type: "string" },
        { key: "library", label: "Library", type: "string" },
        ...CUSTOM_GRAPH_STATUS_FIELDS,
        { key: "times_run", label: "Times run", type: "number" },
        { key: "total_time_s", label: "Total duration", type: "duration" },
        { key: "average_time_s", label: "Average duration", type: "duration" },
        { key: "min_time_s", label: "Min duration", type: "duration" },
        { key: "max_time_s", label: "Max duration", type: "duration" },
    ],
    exceptions: [
        { key: "message", label: "Exception message", type: "string" },
        { key: "amount", label: "Amount", type: "number" },
    ],
};

const CUSTOM_GRAPH_OPS = {
    string: [
        { key: "is", label: "is" },
        { key: "is_not", label: "is not" },
        { key: "contains", label: "contains" },
        { key: "not_contains", label: "does not contain" },
        { key: "matches", label: "matches regex" },
    ],
    number: [
        { key: "eq", label: "=" },
        { key: "neq", label: "≠" },
        { key: "gt", label: ">" },
        { key: "gte", label: "≥" },
        { key: "lt", label: "<" },
        { key: "lte", label: "≤" },
    ],
    status: [
        { key: "is", label: "is" },
        { key: "is_not", label: "is not" },
    ],
    tags: [
        { key: "has", label: "has" },
        { key: "has_not", label: "does not have" },
        { key: "contains", label: "has a tag containing" },
    ],
    kv: [
        { key: "is", label: "is" },
        { key: "is_not", label: "is not" },
        { key: "contains", label: "contains" },
    ],
    datetime: [
        { key: "after", label: "on or after" },
        { key: "before", label: "before" },
        { key: "last_days", label: "in the last N days" },
    ],
    run: [],
};
CUSTOM_GRAPH_OPS.duration = CUSTOM_GRAPH_OPS.number;

const CUSTOM_GRAPH_GROUPABLE_TYPES = new Set(["run", "datetime", "string", "status", "tags", "kv"]);
const CUSTOM_GRAPH_NUMERIC_TYPES = new Set(["number", "duration"]);

const CUSTOM_GRAPH_DATE_BUCKETS = [
    { key: "day", label: "Day" },
    { key: "week", label: "Week" },
    { key: "month", label: "Month" },
];

// needs: null = no field, "numeric" = a number/duration field, "any" = any non-kv field
// status: only offered on sources with passed/failed/skipped columns
const CUSTOM_GRAPH_AGGS = [
    { key: "count", label: "Count", needs: null },
    { key: "sum", label: "Sum", needs: "numeric" },
    { key: "avg", label: "Average", needs: "numeric" },
    { key: "min", label: "Minimum", needs: "numeric" },
    { key: "max", label: "Maximum", needs: "numeric" },
    { key: "median", label: "Median", needs: "numeric" },
    { key: "p90", label: "90th percentile", needs: "numeric" },
    { key: "p95", label: "95th percentile", needs: "numeric" },
    { key: "distinct", label: "Distinct count", needs: "any" },
    { key: "pass_rate", label: "Pass rate (%)", needs: null, status: true },
    { key: "pass_count", label: "Passed", needs: null, status: true },
    { key: "fail_count", label: "Failed", needs: null, status: true },
    { key: "skip_count", label: "Skipped", needs: null, status: true },
    { key: "flips", label: "Status flips (flakiness)", needs: null, status: true },
];

const CUSTOM_GRAPH_STATUS_LABELS = { passed: "Passed", failed: "Failed", skipped: "Skipped" };

function get_custom_graph_source_fields(source) {
    if (!CUSTOM_GRAPH_SOURCE_FIELDS[source]) return [];
    return [...CUSTOM_GRAPH_SOURCE_FIELDS[source], ...CUSTOM_GRAPH_RUN_FIELDS];
}

function get_custom_graph_field(source, key) {
    return get_custom_graph_source_fields(source).find(field => field.key === key);
}

function get_custom_graph_ops(type) {
    return CUSTOM_GRAPH_OPS[type] || [];
}

function custom_graph_source_has_status(source) {
    return !!get_custom_graph_field(source, "status");
}

function is_custom_graph_groupable(field) {
    return !!field && CUSTOM_GRAPH_GROUPABLE_TYPES.has(field.type);
}

function get_custom_graph_groupable_fields(source) {
    return get_custom_graph_source_fields(source).filter(is_custom_graph_groupable);
}

function get_custom_graph_filterable_fields(source) {
    return get_custom_graph_source_fields(source).filter(field => get_custom_graph_ops(field.type).length > 0);
}

function get_custom_graph_aggs(source) {
    const hasStatus = custom_graph_source_has_status(source);
    return CUSTOM_GRAPH_AGGS.filter(agg => !agg.status || hasStatus);
}

function get_custom_graph_agg(key) {
    return CUSTOM_GRAPH_AGGS.find(agg => agg.key === key);
}

function get_custom_graph_agg_fields(source, aggKey) {
    const agg = get_custom_graph_agg(aggKey);
    if (!agg || !agg.needs) return [];
    const fields = get_custom_graph_source_fields(source);
    if (agg.needs === "numeric") return fields.filter(field => CUSTOM_GRAPH_NUMERIC_TYPES.has(field.type));
    return fields.filter(field => field.type !== "kv");
}

export {
    CUSTOM_GRAPH_SOURCES,
    CUSTOM_GRAPH_AGGS,
    CUSTOM_GRAPH_DATE_BUCKETS,
    CUSTOM_GRAPH_NUMERIC_TYPES,
    CUSTOM_GRAPH_STATUS_LABELS,
    get_custom_graph_source_fields,
    get_custom_graph_field,
    get_custom_graph_ops,
    custom_graph_source_has_status,
    is_custom_graph_groupable,
    get_custom_graph_groupable_fields,
    get_custom_graph_filterable_fields,
    get_custom_graph_aggs,
    get_custom_graph_agg,
    get_custom_graph_agg_fields,
};
