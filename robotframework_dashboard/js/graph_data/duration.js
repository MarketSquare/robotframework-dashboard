import { settings } from "../variables/settings.js";
import { inFullscreen, inFullscreenGraph } from "../variables/globals.js";
import { barConfig, lineConfig } from "../variables/chartconfig.js";
import { compareRunIds } from "../variables/graphs.js";
import { exclude_from_suite_data } from "./helpers.js";

// function to prepare the data in the correct format for duration graphs
function get_duration_graph_data(dataType, graphType, objectDataAttribute, filteredData) {
    const suiteSelectSuitesCombined = document.getElementById("suiteSelectSuites").value === "All Suites Combined";
    const suiteSelectTests = document.getElementById("suiteSelectTests").value;
    const testSelect = document.getElementById("testSelect").value;
    const testTagsSelect = document.getElementById("testTagsSelect").value;
    const keywordSelect = document.getElementById("keywordSelect").value;
    const useLibraryNames = settings?.switch?.useLibraryNames === true;
    const limit = inFullscreen && inFullscreenGraph.includes("Duration") ? 100 : 30;
    const should_include = (value) => {
        // --- keyword filtering ---
        if (dataType === "keyword") {
            const keywordKey = useLibraryNames && value.owner
                ? `${value.owner}.${value.name}`
                : value.name;

            if (keywordKey !== keywordSelect) return false;
        }
        // --- suite/test filtering ---
        if (exclude_from_suite_data(dataType, value)) return false;
        if (settings.switch.suitePathsTestSection) {
            if (dataType === "test" && suiteSelectTests !== "All" &&
                value.full_name !== `${suiteSelectTests}.${value.name}`) {
                return false;
            }
        } else {
            if (dataType === "test" && suiteSelectTests !== "All" &&
                !value.full_name.includes(`.${suiteSelectTests}.${value.name}`) &&
                value.full_name !== `${suiteSelectTests}.${value.name}`) {
                return false;
            }
        }
        if (dataType === "test" && testSelect !== "All" && value.name !== testSelect) return false;
        if (dataType === "test" && testTagsSelect !== "All") {
            const tags = value.tags?.replace(/\[|\]/g, "").split(",").map(t => t.trim()) || [];
            if (!tags.includes(testTagsSelect)) return false;
        }
        return true;
    };

    const collect_raw_entries = () => {
        const entries = [];
        for (const value of filteredData) {
            if (!should_include(value)) continue;
            const label = settings.show.aliases ? value.run_alias : value.run_start;
            const duration = Math.round(value[objectDataAttribute] * 100) / 100;
            entries.push({ label, name: value.name, duration });
        }
        return entries;
    };

    const combine_entries = (entries) => {
        const map = new Map();
        for (const { label, duration } of entries) {
            map.set(label, (map.get(label) || 0) + duration);
        }
        return Array.from(map.entries())
            .sort(([a], [b]) => new Date(a) - new Date(b))
            .slice(-limit)
            .map(([label, total]) => [label, Math.round(total * 100) / 100]);
    };

    const generate_grouped_line_data = (sets) => {
        const grouped = new Map();
        for (const points of sets.values()) {
            for (const { x, y } of points) {
                const ts = x.getTime();
                grouped.set(ts, (grouped.get(ts) || 0) + y);
            }
        }
        return Array.from(grouped.entries()).map(([ts, y]) => ({
            x: new Date(Number(ts)),
            y,
        })).sort((a, b) => a.x - b.x);
    };

    if (graphType === "bar") {
        const rawEntries = collect_raw_entries();

        if (dataType === "suite" && suiteSelectSuitesCombined) {
            const combined = combine_entries(rawEntries);
            return {
                labels: combined.map(([label]) => label),
                datasets: [{
                    label: "All Suites Combined",
                    data: combined.map(([, val]) => val),
                    stack: "Stack 0",
                    ...barConfig,
                }],
            };
        } else {
            const labels = [], data = new Map();
            for (const entry of rawEntries.slice(0, limit)) {
                labels.push(entry.label);
                for (const [key, arr] of data.entries()) {
                    arr.push(key === entry.name ? entry.duration : 0);
                }
                if (!data.has(entry.name)) {
                    const arr = Array(labels.length - 1).fill(0);
                    arr.push(entry.duration);
                    data.set(entry.name, arr);
                }
            }
            return {
                labels,
                datasets: Array.from(data.entries()).map(([label, dataset]) => ({
                    label: label.slice(0, 40),
                    data: dataset,
                    stack: "Stack 0",
                    ...barConfig,
                })),
            };
        }
    } else if (graphType === "line") {
        const sets = new Map();
        for (const value of filteredData) {
            if (!should_include(value)) continue;
            const name = suiteSelectSuitesCombined && dataType === "suite" ? "All Suites Combined" : value.name;
            const run_start = new Date(value.run_start.replace(" ", "T"));
            const val = Math.round(value[objectDataAttribute] * 100) / 100;
            if (!sets.has(name)) sets.set(name, [{ x: run_start, y: val }]);
            else sets.get(name).push({ x: run_start, y: val });
        }

        if (dataType === "suite" && suiteSelectSuitesCombined) {
            return [{
                label: "All Suites Combined",
                fill: false,
                data: generate_grouped_line_data(sets),
                ...lineConfig,
            }];
        }

        return Array.from(sets.entries()).map(([label, data]) => ({
            label: label.slice(0, 40),
            fill: false,
            data,
            ...lineConfig,
        }));
    }
}

function get_compare_suite_duration_data(filteredData) {
    const labelSet = new Set();
    const dataMap = new Map();
    const datasets = [];
    const selectedRuns = [...new Set(
        compareRunIds
            .map(id => document.getElementById(id)?.value)
            .filter(val => val && val !== "None")
    )];

    for (const value of filteredData) {
        for (const run of selectedRuns) {
            if (value.run_start === run || value.run_alias === run) {
                if (settings.switch.suitePathsCompareSection) {
                    labelSet.add(value.full_name)
                } else {
                    labelSet.add(value.name);
                }
                if (!dataMap.has(run)) dataMap.set(run, []);
                dataMap.get(run).push(value.elapsed_s);
            }
        }
    }
    for (const run of selectedRuns) {
        datasets.push({
            label: run,
            data: dataMap.get(run) || [],
            fill: true
        });
    }
    return {
        labels: [...labelSet],
        datasets
    };
}

export {
    get_duration_graph_data,
    get_compare_suite_duration_data
};