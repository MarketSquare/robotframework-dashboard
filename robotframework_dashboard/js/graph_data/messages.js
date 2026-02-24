import { settings } from "../variables/settings.js";
import { inFullscreen, inFullscreenGraph } from "../variables/globals.js";
import { failedConfig } from "../variables/chartconfig.js";
import { message_config } from "../variables/data.js";
import { convert_timeline_data } from "./helpers.js";

// function to prepare the data in the correct format for messages graphs
function get_messages_data(dataType, graphType, filteredData) {
    const data = new Map();
    const aliases = new Map();
    for (const value of filteredData) {
        if (value.message && (value.failed === 1 || value.skipped === 1)) {
            if (!data.has(value.message)) {
                data.set(value.message, []);
                aliases.set(value.message, []);
            }
            data.get(value.message).push(value.run_start);
            aliases.get(value.message).push(value.run_alias);
        }
    }
    // If there is a message config use that to merge the data
    if (!message_config.includes("placeholder_message_config")) {
        function matches_message_config(str, rule) {
            rule = rule.replace(/\$\{.*?\}/g, "*") // match any ${something} string
            var escapeRegex = (str) => str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1"); // escape the test messages to prevent regex mismatches
            return new RegExp("^" + rule.split("*").map(escapeRegex).join(".*") + "$").test(str);
        }
        for (const config of message_config) {
            for (const [message, runStarts] of data) {
                if (message == config) { continue }
                if (matches_message_config(message, config)) {
                    if (!data.has(config)) {
                        data.set(config, []);
                    }
                    data.get(config).push(...runStarts);
                    data.delete(message)
                }
            }
        }

        for (const [message, runStarts] of data) {
            arrayWithDuplicates = data.get(message)
            data.set(message, [...new Set(arrayWithDuplicates)])
        }
    }
    const limit = inFullscreen && inFullscreenGraph.includes("Messages") ? 50 : 10;
    const sortedData = [...data.entries()].sort((a, b) => b[1].length - a[1].length); // Sort messages by failure count
    if (graphType === "bar") {
        const [datasets, labels] = [[], []];
        let count = 0;

        for (const [message, runStarts] of sortedData) {
            if (count == limit) break;
            labels.push(message);
            datasets.push(runStarts.length);
            if (settings.show.aliases) {
                data.set(message, aliases.get(message));
            }
            count++;
        }
        const graphData = {
            labels,
            datasets: [{
                data: datasets,
                ...failedConfig,
            }],
        };
        const callbackData = Object.fromEntries(sortedData.map(([message, runs]) => [message, aliases.get(message)]));
        return [graphData, callbackData];
    } else if (graphType === "timeline") {
        const labels = [];
        const runStartsSet = new Set();
        const runAliasesSet = new Set();
        let count = 0;
        for (const [message, runStarts] of sortedData) { // Collect unique run starts and labels
            if (count == limit) break;
            labels.push(message);
            runStarts.forEach(runStart => runStartsSet.add(runStart));
            count++;
        }
        const runStarts = Array.from(runStartsSet).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
        var datasets = [];
        let runAxis = 0;
        const pointMeta = {};
        function check_label(message, label) {
            return !message_config.includes("placeholder_message_config")
                ? matches_message_config(message, label)
                : message === label;
        }
        for (const runStart of runStarts) {
            for (const label of labels) {
                const foundValues = filteredData.filter(value => check_label(value.message, label) && value.run_start === runStart);
                if (foundValues.length > 0) {
                    const value = foundValues[0];
                    pointMeta[`${label}::${runAxis}`] = {
                        status: value.passed == 1 ? "PASS" : value.failed == 1 ? "FAIL" : "SKIP",
                        elapsed_s: value.elapsed_s || 0,
                        message: value.message || '',
                    };
                    datasets.push({
                        label: label,
                        data: [{ x: [runAxis, runAxis + 1], y: label }],
                        ...failedConfig,
                    });
                    foundValues.forEach(value => runAliasesSet.add(value.run_alias));
                }
            }
            runAxis++;
        }
        datasets = convert_timeline_data(datasets)
        const runStartsArray = settings.show.aliases ? Array.from(runAliasesSet) : runStarts;
        const graphData = {
            labels,
            datasets,
        };
        return [graphData, runStartsArray, pointMeta];
    }
}

export {
    get_messages_data
};