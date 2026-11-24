import { data_load_scope, filteredAmount } from "./variables/data.js";
import { filteredRuns } from "./variables/globals.js";
import { requested_load_limit } from "./data_loading.js";

let lastLoadProgressAt = 0;
let lastLoadDataset = "";

function setup_loading_screen() {
    const params = new URLSearchParams(window.location.search);
    for (const form of document.querySelectorAll(".data-load-form")) {
        form.querySelector("[data-load-count]").value = String(requested_load_limit(window.location.search) || 20);
        form.addEventListener("submit", event => {
            event.preventDefault();
            const url = new URL(window.location.href);
            const count = form.querySelector("[data-load-count]").value;
            if (count === "all") url.searchParams.delete("loadRuns");
            else url.searchParams.set("loadRuns", count);
            url.searchParams.set("run", form.querySelector("[data-load-project]").value || "All");
            window.location.assign(url.href);
        });
    }
    for (const button of document.querySelectorAll(".data-load-reset")) {
        button.addEventListener("click", () => {
            const url = new URL(window.location.href);
            const page = url.searchParams.get("page");
            url.search = "";
            if (page) url.searchParams.set("page", page);
            url.searchParams.set("loadRuns", "20");
            window.location.assign(url.href);
        });
    }
    update_loading_projects(params.get("run") ? [{ name: params.get("run") }] : []);
}

function update_loading_projects(run_list) {
    const names = [...new Set(run_list.map(run => run.name))].sort();
    const selected = new URLSearchParams(window.location.search).get("run");
    for (const select of document.querySelectorAll("[data-load-project]")) {
        select.replaceChildren();
        for (const name of ["", ...names]) {
            const option = document.createElement("option");
            option.value = name;
            option.textContent = name || "All projects";
            select.appendChild(option);
        }
        if (names.includes(selected)) select.value = selected;
    }
}

function show_data_load_progress({ dataset, recent, scanned }) {
    const now = performance.now();
    const changed = dataset !== lastLoadDataset;
    if (!changed && now - lastLoadProgressAt < 250) return;
    lastLoadProgressAt = now;
    lastLoadDataset = dataset;
    const status = document.getElementById("dataLoadStatus");
    const progress = document.getElementById("dataLoadProgress");
    if (status && changed) {
        const labels = { recovery: "Opening recent results so you can continue...", charts: "Preparing charts..." };
        status.textContent = labels[dataset] || `Opening ${recent ? "recent " : ""}${dataset === "runs" ? "run information" : dataset}...`;
    }
    if (progress) progress.textContent = scanned === undefined ? "" : `${scanned.toLocaleString()} records checked`;
}

function show_loaded_history() {
    if (!data_load_scope) return;
    const { loadedRuns, totalRuns, recovered } = data_load_scope;
    const notice = document.getElementById("dataLoadNotice");
    if (!notice) return;
    // A complete selection needs no partial-history notice, even if other projects aren't open.
    notice.hidden = loadedRuns === totalRuns || (filteredRuns.length > 0 && filteredRuns.length === Number(filteredAmount));
    if (notice.hidden) return;
    const counts = `${filteredRuns.length.toLocaleString()} of ${filteredAmount.toLocaleString()} matching runs.`;
    document.getElementById("dataLoadScope").textContent = filteredRuns.length
        ? (recovered ? `We couldn\u2019t open the full report, so we\u2019re showing the latest ${counts}` : `Showing ${counts}`)
        : "No runs match these filters.";
    const dates = filteredRuns.map(run => String(run.run_start).slice(0, 10)).sort();
    document.getElementById("dataLoadRange").textContent = dates.length
        ? `${dates[0]} to ${dates.at(-1)}. Use Filters to choose a different date range, select a project, or try showing more runs.`
        : "Use Filters to change or reset your selections.";
}

function show_data_load_error(error) {
    console.error("Dashboard could not be opened.", error);
    for (const id of ["overview", "unified", "dashboard", "compare", "tables"]) {
        const page = document.getElementById(id);
        if (page) page.style.display = "none";
    }
    const loading = document.getElementById("loading");
    if (!loading) return;
    loading.style.display = "";
    loading.dataset.state = "error";
    document.getElementById("dataLoadStatus").textContent = "This report could not be opened.";
    document.getElementById("dataLoadProgress").textContent = "Try fewer recent runs or a single project. If this continues, ask the report owner to regenerate it. Your saved results have not changed.";
    document.getElementById("dataLoadOptions").open = true;
    document.getElementById("dataLoadTechnical").hidden = false;
    document.getElementById("dataLoadError").textContent = error?.message || String(error);
}

export { setup_loading_screen, update_loading_projects, show_data_load_progress, show_loaded_history, show_data_load_error };
