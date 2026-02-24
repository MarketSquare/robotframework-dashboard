import { settings } from "../variables/settings.js";
import { inFullscreen, inFullscreenGraph } from "../variables/globals.js";
import { blueConfig } from "../variables/chartconfig.js";
import { convert_timeline_data } from "./helpers.js";

// function to prepare the most time consuming or most used data for suites/tests/keywords
function get_most_time_consuming_or_most_used_data(dataType, graphType, filteredData, onlyLastRun, mostUsed = false) {
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
    const limit = inFullscreen && inFullscreenGraph.includes("MostTimeConsuming") ? 50 : 10;
    if (onlyLastRun) {
        const latestRunStart = filteredData[filteredData.length - 1].run_start;
        filteredData = filteredData.filter(
            (item) => item.run_start === latestRunStart
        );

        filteredData.sort((a, b) => {
            if (mostUsed) {
                return Number(b.times_run) - Number(a.times_run);
            } else {
                const durA =
                    dataType === "keyword"
                        ? Number(a.total_time_s)
                        : Number(a.elapsed_s);
                const durB =
                    dataType === "keyword"
                        ? Number(b.total_time_s)
                        : Number(b.elapsed_s);
                return durB - durA;
            }
        });
        filteredData = filteredData.slice(0, limit);
    }

    const perRunMap = new Map();
    for (const value of filteredData) {
        const run = value.run_start;
        const key = getTestKey(value, dataType);
        const metric = mostUsed
            ? Number(value.times_run)
            : dataType === "keyword"
                ? Number(value.total_time_s)
                : Number(value.elapsed_s);
        if (!onlyLastRun) {
            if (!perRunMap.has(run)) {
                perRunMap.set(run, {
                    key,
                    metric,
                    alias: value.run_alias,
                    runStart: run,
                    timesRun: Number(value.times_run),
                    passed: value.passed || 0,
                    failed: value.failed || 0,
                    skipped: value.skipped || 0,
                });
            } else {
                const existing = perRunMap.get(run);
                if (metric > existing.metric) {
                    perRunMap.set(run, {
                        key,
                        metric,
                        alias: value.run_alias,
                        runStart: run,
                        timesRun: Number(value.times_run),
                        passed: value.passed || 0,
                        failed: value.failed || 0,
                        skipped: value.skipped || 0,
                    });
                }
            }
        } else {
            perRunMap.set(`${key}_${run}`, {
                key,
                metric,
                alias: value.run_alias,
                runStart: run,
                timesRun: Number(value.times_run),
                passed: value.passed || 0,
                failed: value.failed || 0,
                skipped: value.skipped || 0,
            });
        }
    }

    const hitCount = new Map();
    const aliases = new Map();
    const perRunEntries = Array.from(perRunMap.values());
    const details = new Map();
    for (const entry of perRunEntries) {
        if (!details.has(entry.key)) {
            details.set(entry.key, {});
        }

        details.get(entry.key)[entry.runStart] = {
            duration: entry.metric,
            timesRun: entry.timesRun || entry.metricRunCount || 0,
            passed: entry.passed || 0,
            failed: entry.failed || 0,
            skipped: entry.skipped || 0,
        };
    }

    for (const entry of perRunEntries) {
        if (!hitCount.has(entry.key)) {
            hitCount.set(entry.key, []);
            aliases.set(entry.key, []);
        }
        hitCount.get(entry.key).push(entry.runStart);
        aliases.get(entry.key).push(entry.alias);
    }

    let sortedData;
    if (onlyLastRun) {
        sortedData = [...perRunEntries]
            .sort((a, b) => b.metric - a.metric)
            .slice(0, limit)
            .map((entry) => [entry.key, [entry.runStart]]);
    } else {
        sortedData = [...hitCount.entries()].sort(
            (a, b) => b[1].length - a[1].length
        );
    }

    if (graphType === "bar") {
        const labels = [];
        const datasets = [];
        for (const [key, values] of sortedData) {
            labels.push(key);
            if (mostUsed && onlyLastRun) {
                const match = filteredData.find(
                    (f) => getTestKey(f, dataType) === key
                );
                datasets.push(match ? Number(match.times_run) : 0);
            } else {
                datasets.push(values.length);
            }
        }

        const graphData = {
            labels,
            datasets: [
                {
                    data: datasets,
                    ...blueConfig,
                },
            ],
        };
        return [
            graphData,
            {
                aliases: Object.fromEntries(sortedData.map(([name]) => [
                    name,
                    settings.show.aliases
                        ? perRunEntries.filter((e) => e.key === name).map((e) => e.alias)
                        : perRunEntries.filter((e) => e.key === name).map((e) => e.runStart)
                ])),
                run_starts: Object.fromEntries(sortedData.map(([name]) => [
                    name,
                    perRunEntries.filter((e) => e.key === name).map((e) => e.runStart)
                ])),
                details: Object.fromEntries(details)
            }
        ];
    }
    if (graphType === "timeline") {
        const labels = [];
        const runStarts = Array.from(perRunMap.values()).sort(
            (a, b) => new Date(a.runStart) - new Date(b.runStart)
        );

        const sortedKeys = sortedData.map(([key]) => key);
        const limitKeys = sortedKeys.slice(0, limit);
        labels.push(...limitKeys);
        let datasets = [];
        let runAxis = 0;
        for (const s of runStarts) {
            if (!limitKeys.includes(s.key)) continue;
            datasets.push({
                label: s.key,
                data: [{ x: [runAxis, runAxis + 1], y: s.key }],
                ...blueConfig,
            });
            if (!onlyLastRun) runAxis++;
        }
        datasets = convert_timeline_data(datasets);
        const runStartOutput = runStarts.map((r) => r.runStart);
        const aliasOutput = runStarts.map((r) => r.alias);
        return [
            { labels, datasets },
            {
                runs: runStartOutput,
                aliases: aliasOutput,
                details: Object.fromEntries(details)
            }
        ];
    }
}

export { 
    get_most_time_consuming_or_most_used_data 
};