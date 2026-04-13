import { settings, get_run_label, is_custom_run_label_mode } from "../variables/settings.js";
import { inFullscreen, inFullscreenGraph } from "../variables/globals.js";
import { convert_timeline_data } from "./helpers.js";
import { failedConfig } from "../variables/chartconfig.js";
import { strip_tz_suffix } from "../common.js";

// function to prepare the data in the correct format for most failed graphs
function get_most_failed_data(dataType, graphType, filteredData, recent) {
    const useLibraryNames = settings?.switch?.useLibraryNames === true;
    function getTestKey(value, dataType) {
        if (dataType === "keyword" && useLibraryNames && value.owner) {
            return `${value.owner}.${value.name}`;
        }
        if (dataType === "suite" && settings.switch.suitePathsSuiteSection) {
            return value.full_name;
        } else if (dataType === "test" && settings.switch.suitePathsTestSection) {
            return value.full_name;
        } else {
            return value.name;
        }
    }
    const data = new Map();
    const aliases = new Map();
    const run_names = new Map();
    for (const value of filteredData) {
        if (value.failed > 0) {
            const key = getTestKey(value, dataType);
            if (!data.has(key)) {
                data.set(key, []);
                aliases.set(key, []);
                run_names.set(key, []);
            }
            data.get(key).push(value.run_start);
            aliases.get(key).push(value.run_alias);
            run_names.get(key).push(value.run_name);
        }
    }
    let sortedData = [...data.entries()].sort((a, b) => b[1].length - a[1].length);
    if (recent) {
        sortedData = sortedData.slice().sort((a, b) => {
            const latestA = a[1][a[1].length - 1];
            const latestB = b[1][b[1].length - 1];
            if (latestA > latestB) return -1;
            if (latestA < latestB) return 1;
            return 0;
        });
    }
    const limit = inFullscreen && inFullscreenGraph.includes("MostFailed") ? 50 : 10;
    if (graphType === "bar") {
        const datasets = [];
        const labels = [];
        const runStartsLabels = new Map();
        let count = 0;
        for (const [name, runStarts] of sortedData) {
            if (count === limit) break;
            labels.push(name);
            if (is_custom_run_label_mode()) {
                const labelMap = settings.show.aliases === "run_name" ? run_names : aliases;
                data.set(name, labelMap.get(name));
            }
            datasets.push(runStarts.length);
            runStartsLabels.set(name, runStarts);
            count++;
        }
        const graphData = {
            labels,
            datasets: [{
                data: datasets,
                ...failedConfig,
            }],
        };
        const callbackData = is_custom_run_label_mode()
            ? Object.fromEntries(sortedData.map(([name]) => [
                name,
                settings.show.aliases === "run_name" ? run_names.get(name) : aliases.get(name)
              ]))
            : Object.fromEntries(sortedData.map(([name]) => [name, runStartsLabels.get(name)]));

        return [graphData, callbackData];
    }
    else if (graphType === "timeline") {
        const labels = [];
        const runStartsSet = new Set();
        const runLabelsSet = new Set();
        let count = 0;
        for (const [name, runStarts] of sortedData) {
            if (count === limit) break;
            labels.push(name);
            runStarts.forEach(runStart => runStartsSet.add(runStart));
            count++;
        }
        const runStarts = Array.from(runStartsSet).sort((a, b) => new Date(strip_tz_suffix(a)).getTime() - new Date(strip_tz_suffix(b)).getTime());
        let datasets = [];
        let runAxis = 0;
        const pointMeta = {};
        for (const runStart of runStarts) {
            for (const label of labels) {
                const foundValues = filteredData.filter(value =>
                    getTestKey(value, dataType) === label &&
                    value.run_start === runStart &&
                    value.failed > 0
                );
                if (foundValues.length > 0) {
                    const value = foundValues[0];
                    pointMeta[`${label}::${runAxis}`] = {
                        status: "FAIL",
                        elapsed_s: value.elapsed_s || 0,
                        message: value.message || '',
                        passed: value.passed || 0,
                        failed: value.failed || 0,
                        skipped: value.skipped || 0,
                    };
                    datasets.push({
                        label: label,
                        data: [{ x: [runAxis, runAxis + 1], y: label }],
                        ...failedConfig,
                    });
                    foundValues.forEach(v => runLabelsSet.add(get_run_label(v)));
                }
            }
            runAxis++;
        }
        datasets = convert_timeline_data(datasets);
        const runStartsArray = is_custom_run_label_mode() ? Array.from(runLabelsSet) : runStarts;
        const graphData = {
            labels,
            datasets,
        };
        return [graphData, runStartsArray, pointMeta];
    }
}

export {
    get_most_failed_data
};