import { settings, get_run_label } from "../variables/settings.js";
import { inFullscreen, inFullscreenGraph } from "../variables/globals.js";
import { failedConfig } from "../variables/chartconfig.js";
import { convert_timeline_data } from "./helpers.js";
import { strip_tz_suffix } from "../common.js";

// function to prepare the data in the correct format for exceptions graphs
function get_exceptions_data(graphType, filteredData) {
    // Aggregate: message → [{run_start, amount, run_alias, run_name}]
    const data = new Map();
    for (const value of filteredData) {
        if (!data.has(value.message)) {
            data.set(value.message, []);
        }
        data.get(value.message).push(value);
    }
    const limit = inFullscreen && inFullscreenGraph.includes("keywordExceptions") ? 50 : 10;
    // Sort messages by total count descending
    const sortedData = [...data.entries()].sort((a, b) => {
        const totalB = b[1].reduce((sum, v) => sum + v.amount, 0);
        const totalA = a[1].reduce((sum, v) => sum + v.amount, 0);
        return totalB - totalA;
    });

    if (graphType === "bar") {
        const labels = [];
        const datasets = [];
        const callbackData = {};
        let count = 0;
        for (const [message, entries] of sortedData) {
            if (count === limit) break;
            const total = entries.reduce((sum, v) => sum + v.amount, 0);
            labels.push(message);
            datasets.push(total);
            callbackData[message] = entries.map(e => `${get_run_label(e)}: ${e.amount}`);
            count++;
        }
        const graphData = {
            labels,
            datasets: [{
                data: datasets,
                ...failedConfig,
            }],
        };
        return [graphData, callbackData];
    } else if (graphType === "timeline") {
        const labels = [];
        const runStartsSet = new Set();
        const runLabelsSet = new Set();
        let count = 0;
        for (const [message, entries] of sortedData) {
            if (count === limit) break;
            labels.push(message);
            entries.forEach(e => runStartsSet.add(e.run_start));
            count++;
        }
        const runStarts = Array.from(runStartsSet).sort((a, b) =>
            new Date(strip_tz_suffix(a)).getTime() - new Date(strip_tz_suffix(b)).getTime()
        );
        var datasets = [];
        let runAxis = 0;
        const pointMeta = {};
        for (const runStart of runStarts) {
            for (const label of labels) {
                const entries = (data.get(label) || []).filter(e => e.run_start === runStart);
                if (entries.length > 0) {
                    const entry = entries[0];
                    pointMeta[`${label}::${runAxis}`] = {
                        amount: entry.amount,
                        message: entry.message,
                    };
                    datasets.push({
                        label: label,
                        data: [{ x: [runAxis, runAxis + 1], y: label }],
                        ...failedConfig,
                    });
                    runLabelsSet.add(get_run_label(entry));
                }
            }
            runAxis++;
        }
        datasets = convert_timeline_data(datasets);
        const runStartsArray = (settings.show.aliases === "alias" || settings.show.aliases === "run_name")
            ? Array.from(runLabelsSet) : runStarts;
        const graphData = {
            labels,
            datasets,
        };
        return [graphData, runStartsArray, pointMeta];
    }
}

export {
    get_exceptions_data
};
