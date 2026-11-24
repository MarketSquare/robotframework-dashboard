import { read_json_array } from "./json_array.js";
import { get_run_projects } from "./run_projects.js";

const RECENT_RUN_LIMIT = 20;
const RESULT_DATASETS = ["suites", "tests", "keywords", "exceptions"];

async function decode_result_payload(payload, include_run = null, on_progress = () => {}) {
    if (payload.includes("placeholder_")) return [];
    const binary = atob(payload);
    const compressed = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) compressed[i] = binary.charCodeAt(i);
    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate"));
    if (include_run) {
        const accept = typeof include_run === "function" ? include_run : row => include_run.has(row.run_start);
        return read_json_array(stream, accept, on_progress);
    }
    const records = await new Response(stream).json();
    if (!Array.isArray(records)) throw new TypeError("The result data must be an array.");
    return records;
}

async function load_result_details(payloads, starts, on_progress = () => {}) {
    const data = {};
    for (const dataset of RESULT_DATASETS) {
        on_progress({ dataset, recent: starts !== null });
        try {
            data[dataset] = await decode_result_payload(payloads[dataset], starts,
                progress => on_progress({ dataset, recent: true, ...progress }));
        } catch (error) {
            throw new Error(`Could not read ${dataset}: ${error.message}`, { cause: error });
        }
    }
    return data;
}

// Discover matching run IDs without retaining the full suite history in memory.
async function find_suite_run_starts(payload, path, on_progress = () => {}) {
    const starts = new Set();
    await decode_result_payload(payload, suite => {
        if (suite.full_name === path || suite.full_name.startsWith(path + ".")) starts.add(suite.run_start);
        return false;
    }, progress => on_progress({ dataset: "suites", recent: true, ...progress }));
    return starts;
}

function requested_load_limit(search) {
    const value = new URLSearchParams(search).get("loadRuns");
    return ["1", "5", "20", "50", "100"].includes(value) ? Number(value) : null;
}

// Same Amount per project semantics for the initial smaller load and later filters.
function select_run_amount(runList, amount) {
    if (Number(amount) <= 0) return [];
    const indexesByProject = new Map();
    runList.forEach((run, index) => {
        for (const project of get_run_projects(run)) {
            if (!indexesByProject.has(project)) indexesByProject.set(project, []);
            indexesByProject.get(project).push(index);
        }
    });
    const kept = new Set();
    for (const indexes of indexesByProject.values()) {
        for (const index of indexes.slice(-amount)) kept.add(index);
    }
    return runList.filter((_, index) => kept.has(index));
}

function select_recent_runs(all_runs, count, search = "") {
    const params = new URLSearchParams(search);
    const names = [...new Set(all_runs.map(run => run.name))].sort();
    const requestedName = params.get("run");
    const runName = names.includes(requestedName) ? requestedName : null;
    const availableTags = new Set(all_runs.flatMap(run => String(run.tags || "").split(",")));
    const tags = params.getAll("tag").filter(tag => availableTags.has(tag));
    const tagMode = params.get("tagMode") || "AND";
    const matching = all_runs.filter(run => {
        if (runName && run.name !== runName) return false;
        if (!tags.length || tags.includes("All")) return true;
        const runTags = String(run.tags || "").split(",");
        if (tagMode === "OR") return tags.some(tag => runTags.includes(tag));
        if (tagMode === "NOT") return !tags.some(tag => runTags.includes(tag));
        return tags.every(tag => runTags.includes(tag));
    });
    const newest = [...matching].sort((a, b) => {
        const timestamp = run => Date.parse(String(run.run_start).replace(" ", "T").replace(/(\.\d{3})\d+/, "$1"));
        return timestamp(a) - timestamp(b) || String(a.run_start).localeCompare(String(b.run_start));
    });
    const selected = select_run_amount(newest, count);
    const starts = new Set(selected.map(run => run.run_start));
    // Preserve the original order used by the existing filtering/graph pipeline.
    return {
        runs: matching.filter(run => starts.has(run.run_start)),
        starts,
        runName,
        matchingRuns: matching.length,
        totalRuns: all_runs.length,
        runLimit: count,
        availableNames: names,
    };
}

// Load transactionally: callers receive complete arrays for one scope, never a partly loaded dataset.
async function load_result_payloads(payloads, { search = "", maxRuns = null, on_progress = () => {}, on_runs = () => {} } = {}) {
    on_progress({ dataset: "runs", recent: maxRuns !== null });
    const allRuns = await decode_result_payload(payloads.runs);
    on_runs(allRuns);

    async function read_scope(limit, recovered = false) {
        const scope = limit === null ? null : select_recent_runs(allRuns, limit, search);
        const data = { runs: scope ? scope.runs : allRuns, ...await load_result_details(payloads, scope?.starts ?? null, on_progress) };
        return { data, allRuns, scope: scope ? { ...scope, runs: undefined, loadedRuns: data.runs.length, recovered } : null };
    }

    if (maxRuns !== null) return read_scope(maxRuns);
    try {
        return await read_scope(null);
    } catch (error) {
        console.warn("Full history could not be opened. Opening recent results instead.", error);
        on_progress({ dataset: "recovery", recent: true });
        return read_scope(RECENT_RUN_LIMIT, true);
    }
}

export { decode_result_payload, find_suite_run_starts, load_result_details, load_result_payloads, requested_load_limit, select_recent_runs, select_run_amount };
