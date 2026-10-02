import { strip_tz_suffix } from "../common.js";
import { get_custom_graph_field, get_custom_graph_agg, CUSTOM_GRAPH_STATUS_LABELS } from "./fields.js";

const CUSTOM_GRAPH_MAX_SERIES = 10;
// a heatmap draws its series as rows, so it can show many more of them than lines or bars
const CUSTOM_GRAPH_MAX_HEATMAP_ROWS = 50;
const CUSTOM_GRAPH_STATUS_ORDER = ["passed", "failed", "skipped"];
const CUSTOM_GRAPH_SUM_AGGS = new Set(["count", "sum", "distinct", "pass_count", "fail_count", "skip_count", "flips"]);

// keyed by the source array: the filter pipeline hands over new arrays on every filter change,
// so the rows are only rebuilt then and are shared by all custom graphs in between
const customGraphRowCache = new WeakMap();

function parse_custom_graph_tags(value) {
    if (!value) return [];
    return String(value).replace(/^\[|\]$/g, "").split(",").map(tag => tag.trim()).filter(Boolean);
}

// metadata is stored as a python list repr: "['Browser: chromium', 'Team: Storefront']"
function parse_custom_graph_metadata(value) {
    const result = {};
    if (!value) return result;
    const entries = String(value).match(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g) || [];
    for (const entry of entries) {
        const text = entry.slice(1, -1);
        const separator = text.indexOf(":");
        if (separator > 0) result[text.slice(0, separator).trim()] = text.slice(separator + 1).trim();
    }
    return result;
}

// custom filters are stored as "Pipeline=nightly:Release=2026.35"
function parse_custom_graph_custom_filters(value) {
    const result = {};
    if (!value) return result;
    for (const part of String(value).split(":")) {
        const separator = part.indexOf("=");
        if (separator > 0) result[part.slice(0, separator).trim()] = part.slice(separator + 1).trim();
    }
    return result;
}

function get_custom_graph_parent(fullName) {
    const name = String(fullName ?? "");
    const separator = name.lastIndexOf(".");
    return separator > 0 ? name.slice(0, separator) : "";
}

function to_custom_graph_number(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

// the overall status of a row; runs, suites and keywords carry counts, tests carry 0/1 flags
function get_custom_graph_row_status(row) {
    if (row.failed > 0) return "failed";
    if (row.skipped > 0 && row.passed === 0) return "skipped";
    return "passed";
}

function build_custom_graph_rows(source, data) {
    const runsByStart = new Map((data.runs || []).map(run => [run.run_start, run]));
    return (data[source] || []).map(item => {
        const run = source === "runs" ? item : runsByStart.get(item.run_start);
        const row = {
            run: item.run_start,
            runItem: run || item,
            run_date: strip_tz_suffix(String(item.run_start ?? "")),
            run_name: run?.name ?? "",
            run_tags: parse_custom_graph_tags(run?.tags),
            project_version: run?.project_version || "",
            metadata: parse_custom_graph_metadata(run?.metadata),
            custom_filters: parse_custom_graph_custom_filters(run?.custom_filters),
        };
        if (source !== "exceptions") {
            row.passed = to_custom_graph_number(item.passed);
            row.failed = to_custom_graph_number(item.failed);
            row.skipped = to_custom_graph_number(item.skipped);
            row.status = get_custom_graph_row_status(row);
        }
        if (source === "runs") {
            row.total = to_custom_graph_number(item.total);
            row.elapsed_s = to_custom_graph_number(item.elapsed_s);
        } else if (source === "suites") {
            row.name = item.name ?? "";
            row.full_name = item.full_name ?? "";
            row.parent = get_custom_graph_parent(item.full_name);
            row.total = to_custom_graph_number(item.total);
            row.elapsed_s = to_custom_graph_number(item.elapsed_s);
        } else if (source === "tests") {
            row.name = item.name ?? "";
            row.full_name = item.full_name ?? "";
            row.suite = get_custom_graph_parent(item.full_name);
            row.tags = parse_custom_graph_tags(item.tags);
            row.message = item.message ?? "";
            row.elapsed_s = to_custom_graph_number(item.elapsed_s);
            row.attempts = to_custom_graph_number(item.attempts) || 1;
        } else if (source === "keywords") {
            row.name = item.name ?? "";
            row.library = item.owner ?? "";
            row.times_run = to_custom_graph_number(item.times_run);
            row.total_time_s = to_custom_graph_number(item.total_time_s);
            row.average_time_s = to_custom_graph_number(item.average_time_s);
            row.min_time_s = to_custom_graph_number(item.min_time_s);
            row.max_time_s = to_custom_graph_number(item.max_time_s);
        } else if (source === "exceptions") {
            row.message = item.message ?? "";
            row.amount = to_custom_graph_number(item.amount);
        }
        return row;
    });
}

function get_custom_graph_rows(source, data) {
    const items = data[source] || [];
    const cached = customGraphRowCache.get(items);
    if (cached && cached.runs === data.runs) return cached.rows;
    const rows = build_custom_graph_rows(source, data);
    customGraphRowCache.set(items, { runs: data.runs, rows });
    return rows;
}

function format_custom_graph_datetime(date) {
    const pad = (value) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// returns a predicate for one where-condition, or null when the condition is incomplete
// (the builder adds empty rows that should not filter anything until they are filled in)
function compile_custom_graph_condition(condition, source, now) {
    const field = get_custom_graph_field(source, condition.field);
    const target = condition.value;
    if (!field || target === undefined || target === null || String(target).trim() === "") return null;
    if (field.type === "kv" && !condition.key) return null;
    const text = String(target).trim();
    const lower = text.toLowerCase();
    const key = field.key;
    switch (field.type) {
        case "string":
        case "kv": {
            const read = field.type === "kv"
                ? (row) => row[key][condition.key]
                : (row) => row[key];
            if (condition.op === "matches") {
                let regex;
                try { regex = new RegExp(text, "i"); } catch { return null; }
                return (row) => regex.test(String(read(row) ?? ""));
            }
            return {
                is: (row) => String(read(row) ?? "") === text,
                is_not: (row) => String(read(row) ?? "") !== text,
                contains: (row) => String(read(row) ?? "").toLowerCase().includes(lower),
                not_contains: (row) => !String(read(row) ?? "").toLowerCase().includes(lower),
            }[condition.op] ?? null;
        }
        case "number":
        case "duration": {
            const number = Number(text);
            if (!Number.isFinite(number)) return null;
            return {
                eq: (row) => row[key] === number,
                neq: (row) => row[key] !== number,
                gt: (row) => row[key] > number,
                gte: (row) => row[key] >= number,
                lt: (row) => row[key] < number,
                lte: (row) => row[key] <= number,
            }[condition.op] ?? null;
        }
        case "status":
            return {
                is: (row) => row.status === lower,
                is_not: (row) => row.status !== lower,
            }[condition.op] ?? null;
        case "tags":
            return {
                has: (row) => row[key].includes(text),
                has_not: (row) => !row[key].includes(text),
                contains: (row) => row[key].some(tag => tag.toLowerCase().includes(lower)),
            }[condition.op] ?? null;
        case "datetime": {
            if (condition.op === "last_days") {
                const days = Number(text);
                if (!Number.isFinite(days)) return null;
                const cutoff = format_custom_graph_datetime(new Date(now.getTime() - days * 86400000));
                return (row) => row[key] >= cutoff;
            }
            return {
                after: (row) => row[key] >= text,
                before: (row) => row[key] < text,
            }[condition.op] ?? null;
        }
        default:
            return null;
    }
}

function get_custom_graph_date_bucket(dateTime, bucket) {
    const day = dateTime.slice(0, 10);
    if (bucket === "month") return day.slice(0, 7);
    if (bucket === "week") {
        const date = new Date(`${day}T00:00:00`);
        if (Number.isNaN(date.getTime())) return day;
        date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
        return format_custom_graph_datetime(date).slice(0, 10);
    }
    return day;
}

// every group a row falls into, with the weight it counts for: a row with several tags lands in
// every tag group, and a status group on a run/suite/keyword row is weighted by its counts
function get_custom_graph_group_values(group, row, field) {
    if (!group || !field) return [{ key: "", weight: 1 }];
    const value = row[field.key];
    switch (field.type) {
        case "run":
            return [{ key: value, weight: 1 }];
        case "datetime":
            return [{ key: get_custom_graph_date_bucket(value, group.bucket), weight: 1 }];
        case "status":
            return CUSTOM_GRAPH_STATUS_ORDER
                .filter(status => row[status] > 0)
                .map(status => ({ key: status, weight: row[status] }));
        case "tags":
            return value.length > 0
                ? value.map(tag => ({ key: tag, weight: 1 }))
                : [{ key: "(no tags)", weight: 1 }];
        case "kv":
            return [{ key: value[group.key] ?? "(none)", weight: 1 }];
        default:
            return [{ key: value === "" || value === undefined ? "(empty)" : String(value), weight: 1 }];
    }
}

function get_custom_graph_percentile(sortedValues, percentile) {
    if (sortedValues.length === 0) return null;
    const index = Math.max(0, Math.ceil((percentile / 100) * sortedValues.length) - 1);
    return sortedValues[index];
}

function create_custom_graph_accumulator(metric) {
    const field = metric.field;
    switch (metric.agg) {
        case "count": {
            let total = 0;
            return { add: (row, weight) => { total += weight; }, value: () => total };
        }
        case "sum":
        case "avg":
        case "min":
        case "max":
        case "median":
        case "p90":
        case "p95": {
            const values = [];
            return {
                add: (row) => { values.push(row[field]); },
                value: () => {
                    if (values.length === 0) return metric.agg === "sum" ? 0 : null;
                    if (metric.agg === "sum") return values.reduce((a, b) => a + b, 0);
                    if (metric.agg === "avg") return values.reduce((a, b) => a + b, 0) / values.length;
                    if (metric.agg === "min") return values.reduce((a, b) => a < b ? a : b);
                    if (metric.agg === "max") return values.reduce((a, b) => a > b ? a : b);
                    const sorted = [...values].sort((a, b) => a - b);
                    if (metric.agg === "median") {
                        const middle = Math.floor(sorted.length / 2);
                        return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
                    }
                    return get_custom_graph_percentile(sorted, metric.agg === "p90" ? 90 : 95);
                },
            };
        }
        case "distinct": {
            const seen = new Set();
            return {
                add: (row) => {
                    const value = row[field];
                    seen.add(Array.isArray(value) ? value.join(",") : String(value ?? ""));
                },
                value: () => seen.size,
            };
        }
        case "pass_rate": {
            let passed = 0, total = 0;
            return {
                add: (row) => {
                    passed += row.passed;
                    total += row.passed + row.failed + (metric.ignoreSkips ? 0 : row.skipped);
                },
                value: () => total > 0 ? (passed / total) * 100 : null,
            };
        }
        case "pass_count":
        case "fail_count":
        case "skip_count": {
            const column = { pass_count: "passed", fail_count: "failed", skip_count: "skipped" }[metric.agg];
            let total = 0;
            return { add: (row) => { total += row[column]; }, value: () => total };
        }
        case "flips": {
            // a flip is a pass <-> fail change of the same item between consecutive runs;
            // skips are left out so a skipped run in between does not count as two flips
            const histories = new Map();
            return {
                add: (row) => {
                    if (row.status === "skipped") return;
                    const entity = row.full_name || row.name || "";
                    if (!histories.has(entity)) histories.set(entity, []);
                    histories.get(entity).push([row.run_date, row.status]);
                },
                value: () => {
                    let flips = 0;
                    for (const history of histories.values()) {
                        history.sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
                        for (let i = 1; i < history.length; i++) {
                            if (history[i][1] !== history[i - 1][1]) flips++;
                        }
                    }
                    return flips;
                },
            };
        }
        default:
            return { add: () => {}, value: () => null };
    }
}

function round_custom_graph_value(value) {
    if (value === null || value === undefined) return null;
    return Math.round(value * 100) / 100;
}

function get_custom_graph_value_type(spec) {
    const agg = spec.metric.agg;
    if (agg === "pass_rate" || spec.viz?.percent) return "percent";
    if (!get_custom_graph_agg(agg)?.needs || agg === "distinct") return "count";
    return get_custom_graph_field(spec.source, spec.metric.field)?.type === "duration" ? "duration" : "number";
}

function get_custom_graph_metric_label(spec) {
    const agg = get_custom_graph_agg(spec.metric.agg);
    if (!agg) return "";
    if (!agg.needs) return agg.label;
    const field = get_custom_graph_field(spec.source, spec.metric.field);
    return field ? `${agg.label} ${field.label.toLowerCase()}` : agg.label;
}

function get_custom_graph_x_kind(spec) {
    const field = spec.x ? get_custom_graph_field(spec.source, spec.x.field) : null;
    if (!field) return "none";
    if (field.type === "run") return "run";
    if (field.type === "datetime") return "time";
    return "category";
}

function order_custom_graph_keys(keys, totals, order, chronological, limit) {
    let ordered;
    if (order === "value_desc" || (order === "auto" && !chronological)) {
        ordered = [...keys].sort((a, b) => totals.get(b) - totals.get(a));
    } else if (order === "value_asc") {
        ordered = [...keys].sort((a, b) => totals.get(a) - totals.get(b));
    } else if (order === "label") {
        ordered = [...keys].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
    } else {
        ordered = [...keys].sort((a, b) => {
            const left = strip_tz_suffix(String(a));
            const right = strip_tz_suffix(String(b));
            return left < right ? -1 : left > right ? 1 : 0;
        });
    }
    if (!limit || limit <= 0 || ordered.length <= limit) return ordered;
    // a time axis keeps the most recent values, a ranking keeps the top
    return chronological && order === "auto" ? ordered.slice(-limit) : ordered.slice(0, limit);
}

// runs a validated panel spec against the data ({ runs, suites, tests, keywords, exceptions })
// and returns the result table every visualization is built from; options.rowFilter is an extra
// predicate on the normalized rows (the section filters, which live in the DOM)
function run_custom_graph_query(spec, data, options = {}) {
    const source = spec.source;
    const now = options.now || new Date();
    const runLabel = options.runLabel || ((run) => run.run_start);
    const rowFilter = options.rowFilter || null;
    const predicates = (spec.where || [])
        .map(condition => compile_custom_graph_condition(condition, source, now))
        .filter(Boolean);
    const xField = spec.x ? get_custom_graph_field(source, spec.x.field) : null;
    const seriesField = spec.series ? get_custom_graph_field(source, spec.series.field) : null;
    const xKind = get_custom_graph_x_kind(spec);

    const cells = new Map();
    const runLabels = new Map();
    let rowCount = 0;
    for (const row of get_custom_graph_rows(source, data)) {
        if (!predicates.every(predicate => predicate(row))) continue;
        if (rowFilter && !rowFilter(row)) continue;
        rowCount++;
        if (xKind === "run" && !runLabels.has(row.run)) runLabels.set(row.run, runLabel(row.runItem));
        for (const xGroup of get_custom_graph_group_values(spec.x, row, xField)) {
            if (!cells.has(xGroup.key)) cells.set(xGroup.key, new Map());
            const column = cells.get(xGroup.key);
            for (const seriesGroup of get_custom_graph_group_values(spec.series, row, seriesField)) {
                if (!column.has(seriesGroup.key)) column.set(seriesGroup.key, create_custom_graph_accumulator(spec.metric));
                column.get(seriesGroup.key).add(row, xGroup.weight * seriesGroup.weight);
            }
        }
    }

    const values = new Map();
    const xTotals = new Map();
    const seriesTotals = new Map();
    for (const [xKey, column] of cells) {
        const columnValues = new Map();
        let xTotal = 0;
        for (const [seriesKey, accumulator] of column) {
            const value = round_custom_graph_value(accumulator.value());
            columnValues.set(seriesKey, value);
            xTotal += value ?? 0;
            seriesTotals.set(seriesKey, (seriesTotals.get(seriesKey) ?? 0) + (value ?? 0));
        }
        values.set(xKey, columnValues);
        xTotals.set(xKey, xTotal);
    }

    const chronological = xKind === "run" || xKind === "time";
    const order = spec.order || "auto";
    let candidateKeys = [...cells.keys()];
    // a "most failed" style ranking should not be padded with items that never failed
    if (CUSTOM_GRAPH_SUM_AGGS.has(spec.metric.agg) && (order === "value_desc" || (order === "auto" && !chronological))) {
        candidateKeys = candidateKeys.filter(key => xTotals.get(key) > 0);
    }
    const xKeys = order_custom_graph_keys(candidateKeys, xTotals, order, chronological, spec.limit);

    const heatmap = spec.viz?.type === "heatmap";
    let seriesKeys;
    if (seriesField?.type === "status") {
        seriesKeys = CUSTOM_GRAPH_STATUS_ORDER;
    } else {
        seriesKeys = [...seriesTotals.keys()].sort((a, b) => seriesTotals.get(b) - seriesTotals.get(a));
    }
    // rows of only zeros would bury the few rows with failures in a failure heatmap
    if (heatmap && CUSTOM_GRAPH_SUM_AGGS.has(spec.metric.agg)) {
        seriesKeys = seriesKeys.filter(key => seriesTotals.get(key) > 0);
    }
    const maxSeries = heatmap ? CUSTOM_GRAPH_MAX_HEATMAP_ROWS : CUSTOM_GRAPH_MAX_SERIES;
    const hiddenSeries = Math.max(0, seriesKeys.length - maxSeries);
    seriesKeys = seriesKeys.slice(0, maxSeries);

    const emptyValue = CUSTOM_GRAPH_SUM_AGGS.has(spec.metric.agg) ? 0 : null;
    const series = seriesKeys.map(seriesKey => ({
        key: seriesKey,
        label: !seriesField
            ? get_custom_graph_metric_label(spec)
            : seriesField.type === "status" ? CUSTOM_GRAPH_STATUS_LABELS[seriesKey] : seriesKey,
        status: seriesField?.type === "status" ? seriesKey : null,
        values: xKeys.map(xKey => values.get(xKey)?.get(seriesKey) ?? emptyValue),
    }));

    if (spec.viz?.percent) {
        xKeys.forEach((_, index) => {
            const total = series.reduce((sum, item) => sum + (item.values[index] ?? 0), 0);
            series.forEach(item => {
                item.values[index] = total > 0 ? round_custom_graph_value(((item.values[index] ?? 0) / total) * 100) : 0;
            });
        });
    }

    return {
        xKind,
        x: xKeys,
        xLabels: xKeys.map(xKey => {
            if (xKind === "run") return runLabels.get(xKey) ?? xKey;
            if (xKind === "none") return "All";
            if (xField?.type === "status") return CUSTOM_GRAPH_STATUS_LABELS[xKey] ?? xKey;
            return xKey;
        }),
        series,
        meta: {
            rowCount,
            hiddenSeries,
            valueType: get_custom_graph_value_type(spec),
            metricLabel: get_custom_graph_metric_label(spec),
        },
    };
}

export {
    run_custom_graph_query,
    get_custom_graph_rows,
    get_custom_graph_metric_label,
    get_custom_graph_x_kind,
    parse_custom_graph_tags,
    parse_custom_graph_metadata,
    parse_custom_graph_custom_filters,
};
