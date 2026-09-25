import { runs, suites } from '../variables/data.js';
import { escape_html_for_merge, filteredSuites, filteredTests } from '../variables/globals.js';
import { schedule_filter_option_availability_refresh } from './availability.js';

function get_suite_path_children(parentPath) {
    const isRoot = !parentPath || parentPath === "All";
    const depth = isRoot ? 0 : parentPath.split(".").length;
    const childPaths = new Set();
    for (const suite of suites) {
        const parts = suite.full_name.split(".");
        if (isRoot) {
            childPaths.add(parts[0]);
        } else if (suite.full_name === parentPath || suite.full_name.startsWith(parentPath + ".")) {
            if (parts.length > depth) {
                childPaths.add(parts.slice(0, depth + 1).join("."));
            }
        }
    }
    return [...childPaths].sort();
}

function setup_suite_path_navigator(path) {
    const normalized = (!path || path === "") ? "All" : path;
    document.getElementById("suitePathValue").value = normalized;

    // Active indicator — shown whenever a real path is selected
    const indicator = document.getElementById("filterSuitePathSelectedIndicator");
    if (indicator) indicator.style.display = normalized === "All" ? "none" : "";

    const breadcrumbEl = document.getElementById("suitePathBreadcrumb");
    if (normalized === "All") {
        breadcrumbEl.innerHTML = `<span class="text-muted">All</span>`;
    } else {
        const parts = normalized.split(".");
        const segments = [{ label: "All", path: "All" }];
        parts.forEach((part, i) => segments.push({ label: part, path: parts.slice(0, i + 1).join(".") }));
        breadcrumbEl.innerHTML = segments.map((seg, i) => {
            const isLast = i === segments.length - 1;
            const escaped = escape_html_for_merge(seg.label);
            const escapedPath = escape_html_for_merge(seg.path);
            if (isLast) return `<span class="fw-semibold">${escaped}</span>`;
            return `<a class="suite-path-nav-link text-decoration-none" data-path="${escapedPath}" style="cursor: pointer;">${escaped}</a>`
                + `<span class="text-muted mx-1">›</span>`;
        }).join("");
        breadcrumbEl.querySelectorAll(".suite-path-nav-link").forEach(el => {
            el.addEventListener("click", () => setup_suite_path_navigator(el.dataset.path));
        });
    }

    const childrenEl = document.getElementById("suitePathChildren");
    const children = get_suite_path_children(normalized);
    if (children.length === 0) {
        childrenEl.innerHTML = '<span class="text-muted fst-italic">No sub-suites</span>';
    } else {
        childrenEl.innerHTML = children.map(child => {
            const label = child.split(".").pop();
            return `<button class="btn btn-outline-light btn-sm suite-path-child-btn" data-path="${escape_html_for_merge(child)}" style="margin-bottom: 3px;">${escape_html_for_merge(label)}</button>`;
        }).join("");
        childrenEl.querySelectorAll(".suite-path-child-btn").forEach(btn => {
            btn.addEventListener("click", () => setup_suite_path_navigator(btn.dataset.path));
        });
    }

    document.getElementById("suitePathFilter").hidden = suites.length === 0;
    // the path lives in a hidden input, so no change event reaches the filter modal listener
    schedule_filter_option_availability_refresh();
}

function apply_suite_path_run_filter(runs, selectedPath, suiteList) {
    if (!selectedPath || selectedPath === "All") return runs;

    const matches = (full_name) => full_name === selectedPath || full_name.startsWith(selectedPath + ".");
    const validRunStarts = new Set(suiteList.filter(s => matches(s.full_name)).map(s => s.run_start));
    return runs.filter(r => validRunStarts.has(r.run_start));
}

// Run-level part of the suite path filter: removes runs that have no suite matching the path.
// Uses filteredSuites (all suites, already timezone/millisecond-transformed) so run_start
// values line up with the transformed filteredRuns entries.
function filter_runs_by_suite_path(runs) {
    const selectedPath = document.getElementById("suitePathValue").value;
    return apply_suite_path_run_filter(runs, selectedPath, filteredSuites);
}

// Data-level part of the suite path filter: narrows filteredSuites/filteredTests to the
// selected path prefix. Called after filter_data so filteredRuns is already final.
function filter_suite_path_data() {
    const selectedPath = document.getElementById("suitePathValue").value;
    if (!selectedPath || selectedPath === "All") return;

    const matches = (full_name) => full_name === selectedPath || full_name.startsWith(selectedPath + ".");
    filteredSuites = filteredSuites.filter(s => matches(s.full_name));
    filteredTests = filteredTests.filter(t => matches(t.full_name));
}

function clear_suite_path_filter() {
    setup_suite_path_navigator("All");
}

export {
    apply_suite_path_run_filter,
    clear_suite_path_filter,
    filter_runs_by_suite_path,
    filter_suite_path_data,
    setup_suite_path_navigator,
};
