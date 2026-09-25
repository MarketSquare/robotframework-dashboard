import { settings } from '../variables/settings.js';
import { failedBackgroundBorderColor, failedConfig, passedBackgroundBorderColor, passedConfig, skippedBackgroundBorderColor, skippedConfig } from '../variables/chartconfig.js';
import { build_date_range, get_run_start_date } from './pipeline.js';
import { get_runs_for_date_histogram } from './availability.js';
import { setup_lowest_highest_dates } from './modal_options.js';

// Drag to zoom for the date filter: the bars are the runs per time bucket inside the current
// window, and dragging across them writes the four date/time inputs. Those inputs stay the only
// place the range lives, so the window *is* the selection: zooming in is a drag, zooming out is
// widening them (or the Reset button), and filter profiles need to know nothing about the chart.

const MINUTE = 60 * 1000;
// the window is drawn with the smallest bucket that keeps the bar count at or below this
const MAX_HISTOGRAM_BUCKETS = 60;
// at most this many bars carry a label under them
const MAX_HISTOGRAM_LABELS = 12;
// at most this many runs of a bucket are listed in its tooltip
const MAX_TOOLTIP_RUNS = 6;
// the three status rows of a run, in the order the run statistics graph lists them
const TOOLTIP_STATUS_ROWS = [
    { key: "failed", label: "Failed", color: failedBackgroundBorderColor },
    { key: "skipped", label: "Skipped", color: skippedBackgroundBorderColor },
    { key: "passed", label: "Passed", color: passedBackgroundBorderColor },
];
// the default gridline colour of the dashboard is a 10% wash, too faint to count buckets along
const HISTOGRAM_GRID_COLOR = "rgba(128, 128, 128, 0.35)";
// a window far wider than its largest bucket would still build a bar per month, so the loop that
// walks the buckets is capped as well
const BUCKET_LIMIT = 600;
const BUCKET_UNITS = [
    { key: "minute", label: "1 minute", ms: MINUTE },
    { key: "5minutes", label: "5 minutes", ms: 5 * MINUTE },
    { key: "15minutes", label: "15 minutes", ms: 15 * MINUTE },
    { key: "hour", label: "1 hour", ms: 60 * MINUTE },
    { key: "6hours", label: "6 hours", ms: 6 * 60 * MINUTE },
    { key: "day", label: "1 day", ms: 24 * 60 * MINUTE },
    { key: "week", label: "1 week", ms: 7 * 24 * 60 * MINUTE },
    { key: "month", label: "1 month", ms: 30 * 24 * 60 * MINUTE },
];
const DAY_MS = 24 * 60 * MINUTE;
// a drag shorter than this is a click on a single bar instead of a range
const CLICK_TOLERANCE_PIXELS = 4;

// the buckets the bars were built from, needed to turn a pixel back into a date range
let dateHistogramBuckets = [];

const pad = (value) => String(value).padStart(2, "0");

function pick_bucket_unit(spanMs) {
    return BUCKET_UNITS.find(unit => spanMs / unit.ms <= MAX_HISTOGRAM_BUCKETS) ?? BUCKET_UNITS[BUCKET_UNITS.length - 1];
}

// buckets start on their own boundary (a whole hour, midnight, a Monday, the first of the month)
// so the bars line up with how a reader thinks about the unit instead of with the window edge
function floor_to_bucket(date, unit) {
    const floored = new Date(date.getTime());
    floored.setSeconds(0, 0);
    if (unit.key === "minute") { return floored; }
    if (unit.ms < 60 * MINUTE) {
        const step = unit.ms / MINUTE;
        floored.setMinutes(Math.floor(floored.getMinutes() / step) * step);
        return floored;
    }
    floored.setMinutes(0);
    if (unit.key === "hour") { return floored; }
    if (unit.key === "6hours") {
        floored.setHours(Math.floor(floored.getHours() / 6) * 6);
        return floored;
    }
    floored.setHours(0);
    if (unit.key === "day") { return floored; }
    if (unit.key === "week") {
        floored.setDate(floored.getDate() - ((floored.getDay() + 6) % 7)); // back to Monday
        return floored;
    }
    floored.setDate(1);
    return floored;
}

// days, weeks and months advance by calendar field: adding their length in milliseconds would
// shift every bucket after a DST switch by an hour
function advance_bucket(date, unit) {
    const next = new Date(date.getTime());
    if (unit.key === "day") { next.setDate(next.getDate() + 1); return next; }
    if (unit.key === "week") { next.setDate(next.getDate() + 7); return next; }
    if (unit.key === "month") { next.setMonth(next.getMonth() + 1); return next; }
    return new Date(next.getTime() + unit.ms);
}

// the same rule the overview run cards use: any failure makes the run failed, a run without
// passes that skipped something is skipped
function get_run_status(run) {
    if (run.failed > 0) { return "failed"; }
    if (run.skipped > 0 && run.passed === 0) { return "skipped"; }
    return "passed";
}

function find_bucket_index(buckets, time) {
    let low = 0;
    let high = buckets.length - 1;
    while (low <= high) {
        const middle = (low + high) >> 1;
        if (time < buckets[middle].start.getTime()) { high = middle - 1; }
        else if (time >= buckets[middle].end.getTime()) { low = middle + 1; }
        else { return middle; }
    }
    return -1;
}

function build_histogram_buckets(runList, from, to, unit) {
    const buckets = [];
    let start = floor_to_bucket(from, unit);
    while (start <= to && buckets.length < BUCKET_LIMIT) {
        const end = advance_bucket(start, unit);
        buckets.push({ start: start, end: end, passed: 0, failed: 0, skipped: 0, runs: [] });
        start = end;
    }
    let total = 0;
    for (const run of runList) {
        const runStart = get_run_start_date(run);
        if (runStart < from || runStart > to) { continue; }
        const index = find_bucket_index(buckets, runStart.getTime());
        if (index === -1) { continue; }
        buckets[index][get_run_status(run)] += 1;
        buckets[index].runs.push({ start: runStart, name: run.name, passed: run.passed, failed: run.failed, skipped: run.skipped });
        total += 1;
    }
    for (const bucket of buckets) {
        bucket.runs.sort((a, b) => a.start - b.start);
    }
    return { buckets: buckets, unit: unit, total: total };
}

// no year on the bars: the axis has to stay readable at a label every few buckets, and the
// full dates are right below the chart in the from/to inputs
function format_bucket_label(date, unit) {
    const day = `${pad(date.getDate())}.${pad(date.getMonth() + 1)}`;
    if (unit.key === "month") { return `${pad(date.getMonth() + 1)}.${date.getFullYear()}`; }
    if (unit.ms < DAY_MS) { return `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}`; }
    return day;
}

function format_bucket_datetime(date) {
    return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// the end of a bucket is the start of the next one, so the last minute it contains is a minute
// before that. A bucket that begins and ends on one day names that day once.
function format_bucket_range(bucket) {
    const last = new Date(bucket.end.getTime() - MINUTE);
    const end = bucket.start.toDateString() === last.toDateString()
        ? `${pad(last.getHours())}:${pad(last.getMinutes())}`
        : format_bucket_datetime(last);
    return `${format_bucket_datetime(bucket.start)} - ${end}`;
}

function format_date_input_value(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function format_time_input_value(date) {
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// the window the bars cover: the selected range, or the full span of the runs while the range
// is incomplete or inverted (the pipeline is the one that reports an inverted range)
function get_histogram_window(runList) {
    const range = build_date_range(
        document.getElementById("fromDate").value,
        document.getElementById("fromTime").value,
        document.getElementById("toDate").value,
        document.getElementById("toTime").value,
    );
    if (range) { return range; }
    if (runList.length === 0) { return null; }
    const times = runList.map(run => get_run_start_date(run).getTime());
    return { from: new Date(Math.min(...times)), to: new Date(Math.max(...times)) };
}

// Chart.js only draws a gridline under a tick that carries a label, which leaves a row of empty
// buckets as one wide gap with nothing to read a time off. The separators are therefore drawn
// per bucket edge here: the categories are evenly spaced, so the edges are plain arithmetic.
const dateHistogramSeparatorsPlugin = {
    id: "dateHistogramSeparators",
    beforeDatasetsDraw(chart) {
        const { ctx, chartArea } = chart;
        const buckets = chart.data.labels.length;
        if (!buckets) { return; }
        const bucketWidth = (chartArea.right - chartArea.left) / buckets;
        ctx.save();
        ctx.strokeStyle = HISTOGRAM_GRID_COLOR;
        ctx.lineWidth = 1;
        for (let edge = 0; edge <= buckets; edge++) {
            // the half pixel keeps the line on one device pixel instead of blurring over two
            const x = Math.round(chartArea.left + edge * bucketWidth) + 0.5;
            ctx.beginPath();
            ctx.moveTo(x, chartArea.top);
            ctx.lineTo(x, chartArea.bottom);
            ctx.stroke();
        }
        ctx.restore();
    },
};

// what a bucket holds: a block per run with the three status rows the run statistics graph
// shows. Long buckets are cut off, the tooltip would otherwise outgrow the modal.
function build_tooltip_content(histogram, dataIndex) {
    const bucket = histogram.buckets[dataIndex];
    if (!bucket) { return null; }
    const runs = bucket.runs.slice(0, MAX_TOOLTIP_RUNS).map(run => ({
        label: `${format_run_time(run.start, histogram.unit)} ${run.name}`,
        rows: TOOLTIP_STATUS_ROWS.map(row => ({ label: row.label, color: row.color, value: run[row.key] })),
    }));
    return {
        title: format_bucket_range(bucket),
        runs: runs,
        hiddenRuns: Math.max(bucket.runs.length - MAX_TOOLTIP_RUNS, 0),
    };
}

// the title of the tooltip already carries the date of the bucket, so a run only repeats it
// when one bar covers more than a single day
function format_run_time(date, unit) {
    const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
    return unit.ms > DAY_MS ? `${pad(date.getDate())}.${pad(date.getMonth() + 1)} ${time}` : time;
}

function add_tooltip_line(parent, className, text) {
    const line = document.createElement("div");
    line.className = className;
    line.textContent = text;
    parent.appendChild(line);
    return line;
}

// Chart.js paints its tooltip on the canvas, which clips whatever is taller than the chart and
// gives every line the same colour. A block per run needs neither, so this chart renders its
// tooltip as an element beside the canvas, in the shape the Chart.js one has.
function render_tooltip_element(context) {
    const element = document.getElementById("dateHistogramTooltip");
    if (!element) { return; }
    const { chart, tooltip } = context;
    if (tooltip.opacity === 0) {
        element.hidden = true;
        return;
    }
    const content = build_tooltip_content(chart.$dateHistogram, tooltip.dataPoints[0]?.dataIndex);
    if (!content) {
        element.hidden = true;
        return;
    }
    element.replaceChildren();
    add_tooltip_line(element, "date-histogram-tooltip-title", content.title);
    if (content.runs.length === 0) {
        add_tooltip_line(element, "date-histogram-tooltip-empty", "No runs");
    }
    for (const run of content.runs) {
        const block = document.createElement("div");
        block.className = "date-histogram-tooltip-run";
        add_tooltip_line(block, "date-histogram-tooltip-run-name", run.label);
        for (const row of run.rows) {
            const line = add_tooltip_line(block, "date-histogram-tooltip-row", `${row.label}: ${row.value}`);
            const dot = document.createElement("span");
            dot.className = "date-histogram-tooltip-dot";
            dot.style.backgroundColor = row.color;
            line.prepend(dot);
        }
        element.appendChild(block);
    }
    if (content.hiddenRuns > 0) {
        add_tooltip_line(element, "date-histogram-tooltip-more",
            `+ ${content.hiddenRuns} more ${content.hiddenRuns === 1 ? "run" : "runs"}`);
    }
    element.hidden = false;
    // the tooltip follows the bar it belongs to, but may not leave the chart on either side
    const offset = 12;
    const maxLeft = chart.width - element.offsetWidth - offset;
    const left = tooltip.caretX + offset > maxLeft ? tooltip.caretX - element.offsetWidth - offset : tooltip.caretX + offset;
    element.style.left = `${Math.max(Math.min(left, maxLeft), offset)}px`;
}

function build_date_histogram_config(histogram) {
    // a separator sits at every bucket edge, but a label at every bucket would be unreadable,
    // so only every nth tick keeps its text
    const labelStep = Math.ceil(histogram.buckets.length / MAX_HISTOGRAM_LABELS);
    const dataset = (label, key, config) => ({
        label: label,
        data: histogram.buckets.map(bucket => bucket[key]),
        ...config,
    });
    return {
        type: "bar",
        plugins: [dateHistogramSeparatorsPlugin],
        data: {
            labels: histogram.buckets.map(bucket => format_bucket_label(bucket.start, histogram.unit)),
            datasets: [
                dataset("Failed", "failed", failedConfig),
                dataset("Skipped", "skipped", skippedConfig),
                dataset("Passed", "passed", passedConfig),
            ],
        },
        options: {
            normalized: true,
            responsive: true,
            maintainAspectRatio: false,
            // the whole column answers the pointer: a bar of one run is a few pixels high, and an
            // empty bucket has nothing to hover at all
            interaction: { mode: "index", intersect: false },
            // the chart is rebuilt on every drag, where a growing bar would fight the next drag
            animation: false,
            plugins: {
                legend: { display: settings.show.legends },
                datalabels: { display: false },
                tooltip: { enabled: false, external: render_tooltip_element },
            },
            scales: {
                x: {
                    stacked: true,
                    // the separators of the plugin above are the gridlines of this scale
                    grid: { display: false },
                    // every bucket keeps a tick of its own, so the labels below fall on a fixed
                    // multiple of buckets instead of wherever autoSkip decides to put them
                    ticks: {
                        autoSkip: false,
                        // without this the ticks stop at the default of 11, below the bucket count
                        // of most windows
                        maxTicksLimit: histogram.buckets.length,
                        maxRotation: 0,
                        callback: function (value, index) {
                            return index % labelStep === 0 ? this.getLabelForValue(value) : "";
                        },
                    },
                },
                y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } },
            },
        },
    };
}

function show_histogram_message(message) {
    const messageElement = document.getElementById("dateHistogramEmpty");
    const wrapper = document.getElementById("dateHistogramWrapper");
    const bucketLabel = document.getElementById("dateHistogramBucket");
    if (window.dateHistogramChart) {
        window.dateHistogramChart.destroy();
        window.dateHistogramChart = null;
    }
    dateHistogramBuckets = [];
    if (wrapper) { wrapper.hidden = true; }
    if (bucketLabel) { bucketLabel.textContent = ""; }
    if (messageElement) {
        messageElement.textContent = message;
        messageElement.hidden = false;
    }
}

// (re)draw the bars for the current window. Chart.js cannot size a canvas inside a hidden
// element, and writing into the modal while it fades out competes with the animation, so this
// only runs while the modal is on screen.
function render_date_histogram() {
    const wrapper = document.getElementById("dateHistogramWrapper");
    if (!wrapper || !document.getElementById("filtersModal")?.classList.contains("show")) { return; }
    const runList = get_runs_for_date_histogram();
    const histogramWindow = get_histogram_window(runList);
    if (!histogramWindow) {
        show_histogram_message("No runs match the other filters.");
        return;
    }
    const unit = pick_bucket_unit(histogramWindow.to - histogramWindow.from);
    const histogram = build_histogram_buckets(runList, histogramWindow.from, histogramWindow.to, unit);
    if (histogram.total === 0) {
        show_histogram_message(runList.length === 0
            ? "No runs match the other filters."
            : "No runs in the selected date range.");
        return;
    }
    document.getElementById("dateHistogramEmpty").hidden = true;
    wrapper.hidden = false;
    document.getElementById("dateHistogramBucket").textContent = `1 bar = ${unit.label}`;
    if (window.dateHistogramChart) { window.dateHistogramChart.destroy(); }
    // the chart is not kept under the id of its canvas: an element id is a property of window of
    // its own, so window.dateHistogramGraph would be the canvas until the first chart overwrites it
    window.dateHistogramChart = new Chart("dateHistogramGraph", build_date_histogram_config(histogram));
    // the external tooltip handler is only handed the chart, so the buckets ride along on it
    window.dateHistogramChart.$dateHistogram = histogram;
    dateHistogramBuckets = histogram.buckets;
}

// the modal fires an event per control and the histogram redraws on each of them, so the redraw
// is collapsed into one call per frame
let dateHistogramFrame = null;

function schedule_date_histogram_refresh() {
    if (dateHistogramFrame !== null) { return; }
    dateHistogramFrame = requestAnimationFrame(() => {
        dateHistogramFrame = null;
        render_date_histogram();
    });
}

// writing the range back into the inputs, which the filter pipeline reads and which the modal
// listeners watch for the active filter dot, the profile state and the option counts
function set_date_range_inputs(from, to) {
    document.getElementById("fromDate").value = format_date_input_value(from);
    document.getElementById("fromTime").value = format_time_input_value(from);
    document.getElementById("toDate").value = format_date_input_value(to);
    document.getElementById("toTime").value = format_time_input_value(to);
    document.getElementById("toTime").dispatchEvent(new Event("change", { bubbles: true }));
}

function clamp_to_chart_area(chart, pixel) {
    return Math.min(Math.max(pixel, chart.chartArea.left), chart.chartArea.right);
}

function get_bucket_index_at_pixel(chart, pixel) {
    const index = chart.scales.x.getValueForPixel(clamp_to_chart_area(chart, pixel));
    return Math.min(Math.max(Math.round(index), 0), dateHistogramBuckets.length - 1);
}

// A selection always covers whole buckets: the bars are what the user aims at, and it keeps the
// zoom predictable. The range ends a minute before the next bucket because the inputs only carry
// minutes, and the date filter is inclusive on both sides.
function select_bucket_range(firstIndex, lastIndex) {
    const first = dateHistogramBuckets[Math.min(firstIndex, lastIndex)];
    const last = dateHistogramBuckets[Math.max(firstIndex, lastIndex)];
    if (!first || !last) { return; }
    set_date_range_inputs(first.start, new Date(last.end.getTime() - MINUTE));
}

function setup_date_histogram() {
    const wrapper = document.getElementById("dateHistogramWrapper");
    if (!wrapper) { return; }
    const canvas = document.getElementById("dateHistogramGraph");
    const selection = document.getElementById("dateHistogramSelection");
    let dragStartPixel = null;

    const draw_selection = (pixel) => {
        const chart = window.dateHistogramChart;
        const from = clamp_to_chart_area(chart, Math.min(dragStartPixel, pixel));
        const to = clamp_to_chart_area(chart, Math.max(dragStartPixel, pixel));
        selection.style.left = `${from}px`;
        selection.style.width = `${to - from}px`;
        selection.hidden = false;
    };

    canvas.addEventListener("pointerdown", (event) => {
        if (!window.dateHistogramChart) { return; }
        dragStartPixel = event.offsetX;
        canvas.setPointerCapture(event.pointerId);
        draw_selection(event.offsetX);
    });
    canvas.addEventListener("pointermove", (event) => {
        if (dragStartPixel === null) { return; }
        draw_selection(event.offsetX);
    });
    canvas.addEventListener("pointerup", (event) => {
        if (dragStartPixel === null) { return; }
        const chart = window.dateHistogramChart;
        const startIndex = get_bucket_index_at_pixel(chart, dragStartPixel);
        const endIndex = get_bucket_index_at_pixel(chart, event.offsetX);
        const isClick = Math.abs(event.offsetX - dragStartPixel) < CLICK_TOLERANCE_PIXELS;
        dragStartPixel = null;
        selection.hidden = true;
        select_bucket_range(startIndex, isClick ? startIndex : endIndex);
    });
    canvas.addEventListener("pointercancel", () => {
        dragStartPixel = null;
        selection.hidden = true;
    });
    document.getElementById("dateHistogramReset").addEventListener("click", () => {
        setup_lowest_highest_dates();
        document.getElementById("toTime").dispatchEvent(new Event("change", { bubbles: true }));
    });
    // every filter shapes which runs the bars hold, and the date inputs shape the window. Only
    // the committed change is watched: an input event fires per keystroke in the date pickers,
    // where a half typed date reads as no range at all and would make the window jump.
    document.getElementById("filtersModal").addEventListener("change", schedule_date_histogram_refresh);
}

export {
    build_histogram_buckets,
    build_tooltip_content,
    get_run_status,
    pick_bucket_unit,
    render_date_histogram,
    schedule_date_histogram_refresh,
    setup_date_histogram,
};
