import { runs, suites, tests, server, use_logs } from './variables/data.js';
import { format_date_to_string, transform_file_path, combine_paths } from './common.js';
import { settings } from './variables/settings.js';
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
        const index = chartElement[0].datasetIndex
        runStart = event.chart.data.datasets[index].label
    } else {
        const index = chartElement[0].index
        runStart = event.chart.data.labels[index]
    }
    var output = runs.find(run => run.run_start.slice(0, 19) === runStart.slice(0, 19))
    var path = output ? output.path : runs.find(run => run.run_alias === runStart).path
    if (path == "") {
        alert("Log file error: this output didn't have a path in the database so the log file cannot be found!");
        return
    }
    path = update_log_path_with_id(path, graphId, chartElement, event, directTestName)
    open_log_from_path(path)
}

// function to open the log file
function open_log_from_path(path) {
    var fileUrl = ""
    if (server) { // server url
        fileUrl = `/log?path=${path}`
    } else if (window.location.href.includes("file:///")) { // local machine url
        fileUrl = `file:///${path}`
    } else { // remote machine file server
        fileUrl = combine_paths(window.location.href, path)
    }
    const win = window.open(fileUrl, "_blank")
}

// function to open the log when clicking on the labels
function open_log_from_label(chart, click) {
    if (!use_logs) { return }
    let resetCoordinates = chart.canvas.getBoundingClientRect();
    const xCoor = click.clientX - resetCoordinates.left;
    const yCoor = click.clientY - resetCoordinates.top;
    const { data, scales: { x: { top, bottom, left, height, width, ticks } } } = chart;
    const right = width / ticks.length;

    for (let i = 0; i < ticks.length; i++) {
        if (xCoor >= left + (right * i) && xCoor <= left + right + (right * i) && yCoor >= top && yCoor <= bottom) {
            var run
            const identifier = chart.config._config.options.indexAxis === "y" ? Object.values(ticks).map(item => item.label) : data.labels // exception for timelines
            if (settings.show.aliases) {
                run = filteredRuns.find(run => run.run_alias === identifier[i])
            } else {
                run = filteredRuns.find(run => run.run_start === identifier[i])
            }
            if (run) {
                const path = transform_file_path(run.path)
                if (path == "") {
                    alert("Log file error: this output didn't have a path in the database so the log file cannot be found!");
                    return
                }
                open_log_from_path(path)
            }
        }
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