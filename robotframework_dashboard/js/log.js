import { runs, suites, tests, server, use_logs } from './variables/data.js';
import { format_date_to_string, transform_file_path, combine_paths } from './common.js';
import { settings, get_run_label } from './variables/settings.js';
import { filteredRuns } from './variables/globals.js';

// function to open the log files through the graphs
function open_log_file(event, chartElement, callbackData = undefined, directRunStart = undefined, directTestName = undefined) {
    if (!use_logs) { return }
    const graphType = event.chart.config._config.type
    const graphId = event.chart.canvas.id
    var runStart = ""
    if (directRunStart) {
        runStart = directRunStart
    } else if (graphType == "doughnut") {
        runStart = callbackData
    } else if (callbackData) {
        const index = chartElement[0].element.$context.raw.x[0]
        runStart = callbackData[index]
    } else if (graphType == "line" && !graphId.includes("Statistics")) {
        runStart = format_date_to_string(new Date(chartElement[0].element.$context.raw.x))
    } else if (graphId == "compareStatisticsGraph" || graphId == "compareSuiteDurationGraph") {
        const dataset = event.chart.data.datasets[chartElement[0].datasetIndex]
        runStart = dataset.runStart ?? dataset.label
    } else {
        // labels can repeat (run name labels), the run_start of the column can't
        const index = chartElement[0].index
        runStart = event.chart.data.runStarts?.[index] ?? event.chart.data.labels[index]
    }
    // Match against filteredRuns: its run_start has been timezone-converted/stripped to
    // match what the chart actually displays. Falling back to the original `runs` global
    // (UTC strings) breaks when the user has the "convert to local timezone" toggle on,
    // since the chart label no longer equals the UTC run_start.
    // an exact match first: two runs can start in the same second, which only the milliseconds tell apart
    var output = filteredRuns.find(run => run.run_start === runStart)
    if (!output) { output = filteredRuns.find(run => run.run_start.slice(0, 19) === runStart.slice(0, 19)) }
    if (!output) { output = filteredRuns.find(run => get_run_label(run) === runStart) }
    // Fallback to the raw runs array for safety (e.g. if the run was filtered out)
    if (!output) { output = runs.find(run => run.run_start.slice(0, 19) === runStart.slice(0, 19)) }
    if (!output) { output = runs.find(run => get_run_label(run) === runStart) }
    var path = output ? output.path : ""
    if (path == "") {
        alert("Log file error: this output didn't have a path in the database so the log file cannot be found!");
        return
    }
    path = update_log_path_with_id(path, graphId, chartElement, event, directTestName)
    open_log_from_path(path)
}

// function to open the log file
function open_log_from_path(path) {
    if (path.startsWith("http://") || path.startsWith("https://")) {
        window.open(path, "_blank")
        return
    }
    var fileUrl = ""
    if (server) { // server url
        // the suite/test anchor of update_log_path_with_id stays outside the encoded query value
        const anchor = path.match(/#s\d[\w-]*$/)?.[0] ?? "";
        fileUrl = `/log?path=${encodeURIComponent(path.slice(0, path.length - anchor.length))}${anchor}`
    } else if (/^[A-Za-z]:/.test(path) || path.startsWith("/")) { // absolute path
        if (window.location.href.includes("file:///")) { // local machine url
            fileUrl = `file:///${path}`
        } else { // remote machine file server
            fileUrl = combine_paths(window.location.href, path)
        }
    } else { // relative path — resolve against the dashboard's own location
        fileUrl = new URL(path, window.location.href).href
    }
    window.open(fileUrl, "_blank")
}

// function to open the log when clicking on the labels
function open_log_from_label(chart, click) {
    if (!use_logs) { return }
    let resetCoordinates = chart.canvas.getBoundingClientRect();
    const xCoor = click.clientX - resetCoordinates.left;
    const yCoor = click.clientY - resetCoordinates.top;
    const xScale = chart.scales.x;
    const ticks = xScale.ticks;
    if (ticks.length === 0 || yCoor < xScale.top || yCoor > xScale.bottom || xCoor < xScale.left || xCoor > xScale.right) return;
    // a timeline's linear axis draws the label of run N halfway between N and N + 1
    const isTimeline = chart.config._config.options.indexAxis === "y";
    const pixel_of = (i) => isTimeline ? xScale.getPixelForValue(ticks[i].value + 0.5) : xScale.getPixelForTick(i);
    // the tick nearest to the click, by its own pixel position: Chart.js skips ticks on a crowded
    // axis, so the tick index is not the label index and the ticks are not spread evenly
    let nearest = 0;
    for (let i = 1; i < ticks.length; i++) {
        if (Math.abs(pixel_of(i) - xCoor) < Math.abs(pixel_of(nearest) - xCoor)) nearest = i;
    }
    const spacing = ticks.length > 1 ? Math.abs(pixel_of(1) - pixel_of(0)) : xScale.width;
    if (Math.abs(pixel_of(nearest) - xCoor) > spacing / 2) return;
    // the tick value is the index of the column: its run_start when the graph data carries it, else its label
    const tick = ticks[nearest];
    const runStart = chart.data.runStarts?.[tick.value];
    const identifier = isTimeline ? tick.label : (chart.data.labels?.[tick.value] ?? tick.label);
    const run = runStart !== undefined
        ? filteredRuns.find(run => run.run_start === runStart)
        : filteredRuns.find(run => get_run_label(run) === identifier)
    if (run) {
        const path = transform_file_path(run.path)
        if (path == "") {
            alert("Log file error: this output didn't have a path in the database so the log file cannot be found!");
            return
        }
        open_log_from_path(path)
    }
}

// function to add the suite or test id to the log path url
function update_log_path_with_id(path, graphId, chartElement, event, directTestName = undefined) {
    if (graphId.includes("run") || graphId.includes("keyword")) {
        return transform_file_path(path)
    } // can"t select a run or keyword in the suite/log log.html
    const graphType = event.chart.config._config.type
    var name = ""
    var id = ""
    var runStart = runs.find(run => run.path === path).run_start
    if (graphId.includes("suite") || graphId.includes("Suite")) {
        if (graphId == "suiteStatisticsGraph" || graphId == "compareSuiteDurationGraph") {
            name = event.chart.tooltip.title[0].split(": ").pop()
        } else if (graphId == "suiteDurationGraph") {
            name = event.chart.tooltip.body[0].lines[0].split(": ")[0]
        } else if (graphId == "suiteMostFailedGraph" || graphId == "suiteMostTimeConsumingGraph") {
            name = chartElement[0].element.$context.raw.y
        }
        id = suites.find(suite => suite.name === name && suite.run_start === runStart)
    } else { // it contains a test
        if (directTestName) {
            name = directTestName
        } else if (graphId == "testStatisticsGraph" || graphId == "testMostFlakyGraph" || graphId == "testRecentMostFlakyGraph" || graphId == "testMostFailedGraph" || graphId == "testRecentMostFailedGraph" || graphId == "testMostTimeConsumingGraph" || graphId == "compareTestsGraph") {
            name = chartElement[0].element.$context.raw.y
        } else if (graphId == "testDurationGraph") {
            if (graphType == "bar") {
                name = event.chart.tooltip.dataPoints[0].dataset.label
            } else {
                const datasetIndex = chartElement[0].datasetIndex
                name = event.chart.legend.legendItems[datasetIndex].text
            }
        } else { // this exception is for the Test Messages graph as you can"t tell which test it relates to (might be more than 1!)
            return transform_file_path(path)
        }
        id = tests.find(test => test.name === name && test.run_start === runStart)
    }
    if (id == undefined) {
        return transform_file_path(path)
    }
    return `${transform_file_path(path)}#${id.id}`
}

export {
    open_log_file,
    open_log_from_path,
    open_log_from_label,
};