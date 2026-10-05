import { settings } from "../variables/settings.js";
import { get_graph_config } from "../graph_data/graph_config.js";
import { format_duration, strip_tz_suffix } from "../common.js";
import { escape_html_for_merge } from "../variables/globals.js";
import {
    barConfig,
    lineConfig,
    passedBackgroundColor,
    passedBackgroundBorderColor,
    failedBackgroundColor,
    failedBackgroundBorderColor,
    skippedBackgroundColor,
    skippedBackgroundBorderColor,
} from "../variables/chartconfig.js";
import { get_custom_graph_field } from "./fields.js";

const CUSTOM_GRAPH_PALETTE = [
    "54, 162, 235", "255, 99, 132", "75, 192, 192", "255, 159, 64", "153, 102, 255",
    "255, 205, 86", "201, 203, 207", "141, 211, 199", "231, 138, 195", "166, 216, 84",
];
const CUSTOM_GRAPH_STATUS_COLORS = {
    passed: { backgroundColor: passedBackgroundColor, borderColor: passedBackgroundBorderColor },
    failed: { backgroundColor: failedBackgroundColor, borderColor: failedBackgroundBorderColor },
    skipped: { backgroundColor: skippedBackgroundColor, borderColor: skippedBackgroundBorderColor },
};

function get_custom_graph_color(index, status = null) {
    if (status && CUSTOM_GRAPH_STATUS_COLORS[status]) return CUSTOM_GRAPH_STATUS_COLORS[status];
    const rgb = CUSTOM_GRAPH_PALETTE[index % CUSTOM_GRAPH_PALETTE.length];
    return { backgroundColor: `rgba(${rgb}, 0.7)`, borderColor: `rgb(${rgb})` };
}

function format_custom_graph_value(value, valueType) {
    if (value === null || value === undefined) return "";
    if (valueType === "duration") return format_duration(value);
    if (valueType === "percent") return `${value}%`;
    return String(value);
}

// "Duration" is the axis title get_graph_config keys its duration tick/tooltip formatting on
function get_custom_graph_value_title(result) {
    if (result.meta.valueType === "duration") return "Duration";
    if (result.meta.valueType === "percent") return "Percentage";
    return result.meta.metricLabel;
}

function get_custom_graph_axis_title(spec) {
    if (!spec.x) return "";
    const field = get_custom_graph_field(spec.source, spec.x.field);
    if (!field) return "";
    return spec.x.key ? `${field.label}: ${spec.x.key}` : field.label;
}

function build_custom_graph_line_config(spec, result, xTitle, valueTitle) {
    if (result.xKind === "run") {
        const datasets = result.series.map((item, index) => ({
            label: item.label,
            // _run_start is the tooltip title, the run start like the built-in duration graphs
            data: result.x.map((key, i) => ({ x: strip_tz_suffix(String(key)), y: item.values[i], _run_start: key })),
            ...get_custom_graph_color(index, item.status),
            ...lineConfig,
            spanGaps: true,
        }));
        return get_graph_config("line", { datasets }, "", "Date", valueTitle, false);
    }
    const graphData = {
        labels: result.xLabels,
        datasets: result.series.map((item, index) => ({
            label: item.label,
            data: item.values,
            ...get_custom_graph_color(index, item.status),
            ...lineConfig,
            spanGaps: true,
        })),
    };
    const config = get_graph_config("line", graphData, "", xTitle, valueTitle, false);
    const { type, time, ...categoryAxis } = config.options.scales.x;
    config.options.scales.x = { ...categoryAxis, type: "category" };
    return config;
}

function build_custom_graph_bar_config(spec, result, xTitle, valueTitle) {
    const horizontal = spec.viz.type === "hbar";
    const stacked = spec.viz.type === "stacked_bar" || (horizontal && result.series.length > 1);
    const graphData = {
        labels: result.xLabels,
        datasets: result.series.map((item, index) => ({
            label: item.label,
            data: item.values,
            ...get_custom_graph_color(index, item.status),
            ...barConfig,
        })),
    };
    const config = horizontal
        ? get_graph_config("timeline", graphData, "", valueTitle, xTitle)
        : get_graph_config("bar", graphData, "", xTitle, valueTitle);
    config.options.scales.x.stacked = stacked;
    config.options.scales.y.stacked = stacked;
    if (config.options.plugins.datalabels?.formatter) {
        config.options.plugins.datalabels.formatter = (value) => value > 0 ? format_custom_graph_value(value, result.meta.valueType) : null;
    }
    return config;
}

function build_custom_graph_donut_config(spec, result) {
    const values = result.series[0].values;
    const colors = result.x.map((key, index) => get_custom_graph_color(index, spec.x && get_custom_graph_field(spec.source, spec.x.field)?.type === "status" ? key : null));
    const graphData = {
        labels: result.xLabels.map(String),
        datasets: [{
            data: values,
            backgroundColor: colors.map(color => color.backgroundColor),
            borderColor: colors.map(color => color.borderColor),
        }],
    };
    const config = get_graph_config("donut", graphData, "", "", "");
    // the built-in donuts shorten dotted suite names to their last part, which would turn
    // labels like project versions ("1.10") into nonsense here
    if (config.options.plugins.legend?.labels) {
        config.options.plugins.legend.labels.generateLabels = Chart.overrides.doughnut.plugins.legend.labels.generateLabels;
    }
    const total = values.reduce((sum, value) => sum + (value ?? 0), 0);
    config.options.plugins.datalabels.formatter = (value, context) => {
        if (!value || total === 0) return null;
        const percentage = Math.round((value / total) * 100);
        if (percentage <= 5) return null;
        const label = graphData.labels[context.dataIndex];
        return `${label}: ${format_custom_graph_value(value, result.meta.valueType)} (${percentage}%)`;
    };
    return config;
}

// cells get the colour of what they measure: failures red, skips yellow, pass rate from red to green
function get_custom_graph_heatmap_color(spec, value, max) {
    if (value === null || value === undefined) return "rgba(128, 128, 128, 0.08)";
    if (spec.metric.agg === "pass_rate") {
        const ratio = Math.max(0, Math.min(1, value / 100));
        const red = Math.round(206 + (151 - 206) * ratio);
        const green = Math.round(62 + (189 - 62) * ratio);
        const blue = Math.round(1 + (97 - 1) * ratio);
        return `rgba(${red}, ${green}, ${blue}, 0.85)`;
    }
    const rgb = { fail_count: "206, 62, 1", skip_count: "254, 216, 79" }[spec.metric.agg] || "54, 162, 235";
    const ratio = max > 0 ? value / max : 0;
    return value === 0 ? "rgba(128, 128, 128, 0.08)" : `rgba(${rgb}, ${(0.15 + 0.85 * ratio).toFixed(2)})`;
}

// the cells are placed on the unique keys, not on the labels: runs with the same name (run name
// or alias labels) would otherwise share a column and draw on top of each other
function build_custom_graph_heatmap_config(spec, result, xTitle) {
    const columns = result.x.map(String);
    const rows = result.series.map(item => String(item.key));
    const columnLabels = new Map(columns.map((key, index) => [key, String(result.xLabels[index])]));
    const rowLabels = new Map(result.series.map(item => [String(item.key), String(item.label)]));
    const data = [];
    let max = 0;
    result.series.forEach(item => {
        item.values.forEach((value, index) => {
            data.push({ x: columns[index], y: String(item.key), v: value });
            if (value !== null && value > max) max = value;
        });
    });
    const showValues = data.length <= 150;
    const seriesField = get_custom_graph_field(spec.source, spec.series.field);
    return {
        type: "matrix",
        data: {
            datasets: [{
                data,
                backgroundColor: (context) => get_custom_graph_heatmap_color(spec, context.raw?.v, max),
                borderWidth: 1,
                borderColor: "rgba(128, 128, 128, 0.2)",
                width: ({ chart }) => Math.max(1, (chart.chartArea?.width ?? 0) / Math.max(1, columns.length) - 2),
                height: ({ chart }) => Math.max(1, (chart.chartArea?.height ?? 0) / Math.max(1, rows.length) - 2),
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
                x: {
                    type: "category",
                    labels: columns,
                    offset: true,
                    grid: { display: false },
                    title: { display: settings.show.axisTitles, text: result.xKind === "run" ? "Run" : xTitle },
                    ticks: {
                        minRotation: 45,
                        maxRotation: 45,
                        display: result.xKind !== "run" || settings.show.dateLabels,
                        callback(value) { return (columnLabels.get(this.getLabelForValue(value)) ?? "").slice(0, 40); },
                    },
                },
                y: {
                    type: "category",
                    labels: rows,
                    // rows come ordered highest first; a vertical category axis starts at the bottom
                    reverse: true,
                    offset: true,
                    grid: { display: false },
                    title: { display: settings.show.axisTitles, text: seriesField ? seriesField.label : "" },
                    ticks: { callback(value) { return (rowLabels.get(this.getLabelForValue(value)) ?? "").slice(0, 40); } },
                },
            },
            plugins: {
                legend: { display: false },
                subtitle: result.meta.hiddenSeries > 0
                    ? { display: true, text: `${result.meta.hiddenSeries} more rows not shown` }
                    : { display: false },
                datalabels: {
                    display: (context) => showValues && context.raw?.v !== null && context.raw?.v !== 0,
                    formatter: (raw) => format_custom_graph_value(raw.v, result.meta.valueType),
                    color: "#000",
                    font: { size: 10 },
                },
                tooltip: {
                    callbacks: {
                        title: (items) => `${rowLabels.get(items[0].raw.y)} · ${columnLabels.get(items[0].raw.x)}`,
                        label: (item) => `${result.meta.metricLabel}: ${format_custom_graph_value(item.raw.v, result.meta.valueType) || "no data"}`,
                    },
                },
            },
        },
    };
}

// returns the Chart.js config of a custom graph, or null when the result is empty
function build_custom_graph_chart_config(spec, result) {
    if (result.x.length === 0 || result.series.length === 0) return null;
    const xTitle = get_custom_graph_axis_title(spec);
    const valueTitle = get_custom_graph_value_title(result);
    if (spec.viz.type === "heatmap") return build_custom_graph_heatmap_config(spec, result, xTitle);
    let config;
    if (spec.viz.type === "line") config = build_custom_graph_line_config(spec, result, xTitle, valueTitle);
    else if (spec.viz.type === "donut") config = build_custom_graph_donut_config(spec, result);
    else config = build_custom_graph_bar_config(spec, result, xTitle, valueTitle);

    if (spec.viz.type !== "donut") {
        config.options.plugins.legend = { display: !!spec.series && settings.show.legends };
    }
    if (result.meta.valueType === "percent" && config.options.scales) {
        const valueAxis = spec.viz.type === "hbar" ? config.options.scales.x : config.options.scales.y;
        valueAxis.max = 100;
    }
    // clicking opens the log of a run, which only means something when the x axis is a run
    if (result.xKind !== "run" || spec.viz.type === "donut") delete config.options.onClick;
    if (result.meta.hiddenSeries > 0) {
        config.options.plugins.subtitle = { display: true, text: `${result.meta.hiddenSeries} more series not shown` };
    }
    return config;
}

function build_custom_graph_table_html(spec, result) {
    const xTitle = escape_html_for_merge(get_custom_graph_axis_title(spec) || "");
    const headers = result.series.map(item => `<th>${escape_html_for_merge(item.label)}</th>`).join("");
    const rows = result.xLabels.map((label, index) => {
        const cells = result.series
            .map(item => `<td>${escape_html_for_merge(format_custom_graph_value(item.values[index], result.meta.valueType))}</td>`)
            .join("");
        return `<tr><td>${escape_html_for_merge(label)}</td>${cells}</tr>`;
    }).join("");
    return `<div class="custom-graph-table-wrapper">
                <table class="table table-sm custom-graph-table">
                    <thead><tr><th>${xTitle}</th>${headers}</tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`;
}

export {
    build_custom_graph_chart_config,
    build_custom_graph_table_html,
    format_custom_graph_value,
};
