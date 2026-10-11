import { host } from "./host.js";
import { settings } from "./variables/settings.js";
import { passedBackgroundColor, failedBackgroundColor, skippedBackgroundColor } from "./variables/chartconfig.js";
import { open_log_from_path } from "./log.js";
import { runs, tests } from "./variables/data.js";
import { get_run_label } from "./variables/settings.js";
import { events_paths_for_output, read_events_file, replay_state_at } from "./live/replay.js";
import { build_duration_history, usual_duration, slower_than_usual, eta_seconds } from "./live/history.js";
import { detail_images, file_url } from "./live/attachments.js";
import {
    create_run_state,
    apply_event,
    test_counts,
    suite_counts,
    step_label,
    step_tag,
    step_args,
    visible_children,
    step_path,
    LONG_REVEAL,
} from "./live/projection.js";

// Live page: on the left the suites and tests of the run (filter chips, search), on the right the steps of
// the selected test and the details of the selected step. Fed by robotframework-events that a host
// (RobotCode in VS Code) posts to the page, or by the events file of a finished run (replay).

const GLYPHS = { PASS: "✓", FAIL: "✕", SKIP: "–", RUNNING: "●", "NOT RUN": "○" };
const BADGES = { PASS: "text-bg-success", FAIL: "text-bg-danger", SKIP: "text-bg-warning", RUNNING: "text-bg-danger" };
const runningColor = "rgba(13, 110, 253, 0.7)";
const pendingColor = "rgba(140, 149, 159, 0.35)";

// streamState follows the host's live events; liveState is what the page shows: the stream, or a replay
let streamState = create_run_state();
let liveState = streamState;
// { events, index, name } while a finished run is replayed; index is the last applied event
let replay = null;
let replayDots = [];
const liveUi = {
    follow: true,
    // explicit choices of the viewer win over the automatic expand/collapse
    stepsOpened: new Set(),
    stepsClosed: new Set(),
    loopsOpened: new Set(),
    suitesClosed: new Set(), // suites start open, like Playwright's file groups; the viewer closes them
    revealed: new Map(), // long step lists: how many more children the viewer revealed
    selectedTestId: null, // the test whose steps the right pane shows
    filter: "all", // test list: all, failed or skipped
    search: "", // test list: part of a name or tag
    scrollToStepId: null, // a step to bring into view in the steps pane once

    selectedStepId: null,
    userSelected: false,
    tab: "call",
    detailKey: null, // what the details card shows now; it is rebuilt only when this changes
};
// the duration of the selected test, the 100% of the step duration bars
let barTotal = 0;
let liveChart = null;
let renderScheduled = false;
// usual durations from the history in this dashboard, built when first needed
let durationHistory = null;
// image paths the host made viewable (a webview cannot load local files itself): path -> url
const hostImageUrls = new Map();
const requestedImages = new Set();
const answeredImages = new Set();

function duration_history() {
    if (!durationHistory) durationHistory = build_duration_history(tests);
    return durationHistory;
}

function reset_ui() {
    liveUi.follow = true;
    liveUi.detailKey = null;
    for (const key of ["stepsOpened", "stepsClosed", "loopsOpened", "revealed", "suitesClosed"]) liveUi[key].clear();
    liveUi.selectedStepId = null;
    liveUi.selectedTestId = null;
    liveUi.userSelected = false;
    liveUi.tab = "call";
    liveUi.scrollToStepId = null;
}

// --- helpers ---------------------------------------------------------------------

function live_el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
}

function live_status_class(status) {
    return status === "NOT RUN" ? "NOT-RUN" : status;
}

function live_format_seconds(seconds) {
    if (seconds === null || seconds === undefined) return "";
    if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

// now, in event time: a replay shows the moment of its current event
function live_now() {
    return replay ? liveState.lastT : Date.now() / 1000;
}

function live_duration(node) {
    if (node.status === "RUNNING") return live_format_seconds(Math.max(0, live_now() - node.startT));
    if (node.status === "NOT RUN") return "";
    return live_format_seconds(node.elapsed);
}

function live_format_time(t) {
    const d = new Date(t * 1000);
    return d.toTimeString().slice(0, 8);
}

function live_html_to_text(html) {
    // messages may contain HTML; only their text is shown, never their markup
    return new DOMParser().parseFromString(html, "text/html").body.textContent || "";
}

// --- expansion rules ---------------------------------------------------------------

// the step the viewer picked, or null while the details follow the run
function picked_step() {
    return liveUi.userSelected ? liveState.steps.get(liveUi.selectedStepId) || null : null;
}

function step_expanded(step, runningPath) {
    if (liveUi.stepsOpened.has(step.id)) return true;
    if (liveUi.stepsClosed.has(step.id)) return false;
    const picked = picked_step();
    if (picked && picked.id !== step.id && picked.id.startsWith(`${step.id}-`)) return true;
    return runningPath.has(step.id) || step.status === "FAIL";
}

// --- rendering ---------------------------------------------------------------------

function render_header(counts) {
    const badge = document.getElementById("liveBadge");
    const status = liveState.status;
    badge.className = `badge rounded-pill ${BADGES[status] || "text-bg-secondary"}`;
    if (status === "RUNNING" && replay) {
        badge.className = "badge rounded-pill text-bg-info";
        badge.textContent = "REPLAY";
    } else if (status === "RUNNING") {
        const dot = live_el("span", "spinner-grow spinner-grow-sm me-1");
        dot.style.width = dot.style.height = "0.6rem";
        badge.replaceChildren(dot, "LIVE");
    } else {
        badge.textContent = status || "WAITING";
    }
    const run = liveState.run;
    // events converted from an output file have no Python version or pid
    document.getElementById("liveRunInfo").textContent = run
        ? [`Robot Framework ${run.rf}`, run.python && `Python ${run.python}`, run.pid && `pid ${run.pid}`]
            .filter(Boolean).join(" | ")
        : "";
    document.getElementById("liveDone").textContent = `${counts.done}/${counts.total}`;
    document.getElementById("livePassed").textContent = counts.PASS;
    document.getElementById("liveFailed").textContent = counts.FAIL;
    document.getElementById("liveSkipped").textContent = counts.SKIP;
    const now = liveState.endT || (status === "RUNNING" ? live_now() : liveState.lastT);
    document.getElementById("liveElapsed").textContent =
        liveState.startT ? live_format_seconds(Math.max(0, now - liveState.startT)) : "0.0s";
    document.getElementById("liveProgress").style.width = counts.total ? `${(100 * counts.done) / counts.total}%` : "0%";
    const eta = eta_seconds(duration_history(), liveState, live_now());
    const etaNode = document.getElementById("liveEta");
    etaNode.textContent = eta === null ? "\u2013" : eta === 0 ? "any moment" : `~${live_format_seconds(eta)}`;
    etaNode.parentElement.title = eta === null
        ? "Shown when most tests still to run are in the history"
        : "The usual duration of the tests still to run, from earlier runs";

    // the canvas can be replaced by page rebuilds; a liveChart is bound to one canvas element
    if (!liveChart || liveChart.canvas !== document.getElementById("liveStatusGraph")) liveChart = create_live_chart();
    if (liveChart) {
        liveChart.data.datasets[0].data = [counts.PASS, counts.FAIL, counts.SKIP, counts.RUNNING, counts.pending];
        liveChart.update("none");
    }
}

function create_live_chart() {
    const canvas = document.getElementById("liveStatusGraph");
    if (!canvas) return null;
    const existing = Chart.getChart(canvas);
    if (existing) existing.destroy();
    return new Chart(canvas, {
        type: "doughnut",
        data: {
            labels: ["Passed", "Failed", "Skipped", "Running", "Pending"],
            datasets: [{
                data: [0, 0, 0, 0, 0],
                backgroundColor: [passedBackgroundColor, failedBackgroundColor, skippedBackgroundColor, runningColor, pendingColor],
                borderWidth: 0,
            }],
        },
        options: {
            maintainAspectRatio: false,
            animation: false,
            cutout: "60%",
            plugins: { datalabels: { display: false }, legend: { display: false } },
        },
    });
}

// --- test list (left pane) ---------------------------------------------------------------

function test_matcher() {
    const query = liveUi.search.trim().toLowerCase();
    return (test) => {
        if (liveUi.filter === "failed" && test.status !== "FAIL") return false;
        if (liveUi.filter === "skipped" && test.status !== "SKIP") return false;
        if (!query) return true;
        return `${test.longname || test.name} ${(test.tags || []).join(" ")}`.toLowerCase().includes(query);
    };
}

// a suite is listed when one of its tests matches; without a filter also before its tests started
function suite_matches(suite, match) {
    if (liveUi.filter === "all" && !liveUi.search.trim()) return true;
    return suite.children.some((id) => {
        const child = liveState.suites.get(id);
        if (child) return suite_matches(child, match);
        const test = liveState.tests.get(id);
        return test ? match(test) : false;
    });
}

// suites and their tests; a suite whose only child is a suite shares its row ("A \u203a B")
function render_tree() {
    const match = test_matcher();
    const rows = [];
    const root = liveState.suites.get(liveState.rootSuiteId);
    pendingNames = pending_test_names(match);
    if (root) render_suite(rows, root, 0, match);
    else for (const id of liveState.testOrder) if (match(liveState.tests.get(id))) rows.push(render_test_row(liveState.tests.get(id), 0));
    document.getElementById("liveTests").replaceChildren(...rows);
    document.getElementById("liveEmpty").hidden = liveState.testOrder.length > 0;
    const counts = test_counts(liveState);
    document.getElementById("liveChipAll").textContent = liveState.tests.size;
    document.getElementById("liveChipFailed").textContent = counts.FAIL;
    document.getElementById("liveChipSkipped").textContent = counts.SKIP;
    for (const chip of document.querySelectorAll("#liveChips .live-chip")) chip.classList.toggle("active", chip.dataset.filter === liveUi.filter);
}

function live_tree_row(className, depth) {
    const row = live_el("div", `live-tree-row ${className}`);
    row.style.paddingLeft = `${8 + depth * 16}px`;
    return row;
}

function render_suite(rows, suite, depth, match) {
    if (!suite_matches(suite, match)) return;
    const names = [suite.name];
    let inner = suite;
    while (inner.children.length === 1 && liveState.suites.has(inner.children[0])) {
        inner = liveState.suites.get(inner.children[0]);
        names.push(inner.name);
    }
    const open = !liveUi.suitesClosed.has(suite.id);
    const row = live_tree_row("live-suite-row", depth);
    row.dataset.suiteId = suite.id;
    row.title = inner.longname || "";
    row.append(
        live_el("span", `live-chevron ${open ? "open" : "closed"}`),
        live_el("span", `live-glyph ${live_status_class(suite.status)}`, GLYPHS[suite.status] || ""),
        live_el("span", "live-suite-name", names.join(" \u203a ")),
    );
    const counts = suite_counts(liveState, suite);
    const summary = live_el("span", "live-suite-counts");
    for (const [status, glyph, css] of [["PASS", "\u2713", "live-text-pass"], ["FAIL", "\u2715", "live-text-fail"], ["SKIP", "\u2013", "live-text-skip"]]) {
        if (counts[status]) summary.append(live_el("span", css, `${glyph} ${counts[status]}`));
    }
    row.append(summary, live_el("span", "live-time", live_duration(suite)));
    rows.push(row);
    if (!open) return;
    for (const id of inner.children) {
        const child = liveState.suites.get(id);
        if (child) render_suite(rows, child, depth + 1, match);
        else if (liveState.tests.has(id) && match(liveState.tests.get(id))) rows.push(render_test_row(liveState.tests.get(id), depth + 1));
    }
    const startedSuites = new Set(inner.children.filter((id) => liveState.suites.has(id)).map((id) => liveState.suites.get(id).name));
    render_pending(rows, inner.longname, depth + 1, startedSuites);
}

// --- planned tests that have not started (shown while the run is going) ------------------

let pendingNames = [];

// full names from the top-level suite.started that no started test has yet; only while running, a
// finished run lists what really ran. Only the "All" filter shows them, the others ask for a result.
function pending_test_names(match) {
    if (liveState.status !== "RUNNING" || !Array.isArray(liveState.planned) || liveUi.filter !== "all") return [];
    const started = new Set([...liveState.tests.values()].map((test) => test.longname));
    return liveState.planned.filter((name) => !started.has(name) && match({ longname: name, tags: [] }));
}

// the not yet started suites and tests directly inside the suite with full name `prefix`; suites that
// already started list their own. A name is split on dots, so a dot in a test name reads as a suite.
function render_pending(rows, prefix, depth, startedSuites) {
    const tests = [];
    const suites = new Map();
    for (const name of pendingNames) {
        if (!name.startsWith(`${prefix}.`)) continue;
        const rest = name.slice(prefix.length + 1);
        const dot = rest.indexOf(".");
        if (dot === -1) tests.push(rest);
        else if (!startedSuites.has(rest.slice(0, dot))) suites.set(rest.slice(0, dot), true);
    }
    for (const name of tests) {
        const row = live_tree_row("live-test-row live-pending", depth);
        row.title = `${prefix}.${name} (not started yet)`;
        row.append(live_el("span", "live-chevron"), live_el("span", "live-glyph", "○"), live_el("span", "live-test-name", name));
        rows.push(row);
    }
    for (const name of suites.keys()) {
        const row = live_tree_row("live-suite-row live-pending", depth);
        row.title = `${prefix}.${name} (not started yet)`;
        row.append(live_el("span", "live-chevron open"), live_el("span", "live-glyph", "○"), live_el("span", "live-suite-name", name));
        rows.push(row);
        render_pending(rows, `${prefix}.${name}`, depth + 1, new Set());
    }
}

function render_test_row(test, depth) {
    const classes = ["live-test-row"];
    if (test.status === "RUNNING") classes.push("running");
    if (test.id === liveUi.selectedTestId) classes.push("selected");
    const row = live_tree_row(classes.join(" "), depth);
    row.dataset.testId = test.id;
    row.title = test.longname || "";
    row.append(
        live_el("span", "live-chevron"),
        live_el("span", `live-glyph ${live_status_class(test.status)}`, GLYPHS[test.status] || ""),
        live_el("span", "live-test-name", test.name || test.longname),
    );
    if (slower_than_usual(duration_history(), test, live_now())) {
        const badge = live_el("span", "badge rounded-pill text-bg-warning live-slower", "slower");
        badge.title = `Slower than usual: usually ${live_format_seconds(usual_duration(duration_history(), test))}`;
        row.append(badge);
    }
    row.append(live_el("span", "live-time", live_duration(test)));
    return row;
}

// --- steps of the selected test (right pane) ---------------------------------------------

function live_seconds(node) {
    if (node.status === "RUNNING") return Math.max(0, live_now() - node.startT);
    return node.elapsed || 0;
}

// the suites a test is in, outermost first
function suite_path(test) {
    const names = [];
    let suite = liveState.suites.get(test.parent);
    while (suite) {
        names.unshift(suite.name);
        suite = liveState.suites.get(suite.parent);
    }
    return names;
}

function render_steps_pane() {
    const test = liveState.tests.get(liveUi.selectedTestId);
    const steps = document.getElementById("liveSteps");
    const failurePath = document.getElementById("liveFailurePath");
    const icon = document.getElementById("liveTestIcon");
    if (!test) {
        document.getElementById("liveTestPath").textContent = "";
        document.getElementById("liveTestName").textContent = liveState.testOrder.length ? "Select a test" : "";
        document.getElementById("liveTestDuration").textContent = "";
        icon.textContent = "";
        failurePath.hidden = true;
        steps.replaceChildren();
        return;
    }
    document.getElementById("liveTestPath").textContent = suite_path(test).join(" \u203a ");
    document.getElementById("liveTestName").textContent = test.name || test.longname;
    document.getElementById("liveTestDuration").textContent = live_duration(test);
    icon.className = `live-glyph ${live_status_class(test.status)}`;
    icon.textContent = GLYPHS[test.status] || "";

    const failure = test.status === "FAIL" ? test_failure(test.id) : null;
    failurePath.hidden = !failure;
    if (failure) {
        const crumbs = [live_el("span", "live-failure-label", "Failed at")];
        step_path(liveState, failure).forEach((id, index) => {
            const step = liveState.steps.get(id);
            if (index) crumbs.push(live_el("span", "live-failure-sep", "\u203a"));
            const crumb = live_el("span", "live-failure-crumb", [step_tag(step), step_label(step)].filter(Boolean).join(" ") || step.kind);
            crumb.dataset.stepId = id;
            crumbs.push(crumb);
        });
        failurePath.replaceChildren(...crumbs);
    }

    barTotal = live_seconds(test);
    const runningPath = new Set(liveState.runningStepId ? step_path(liveState, liveState.runningStepId) : []);
    const tree = live_el("div", "live-tree");
    render_steps(tree, test, 0, runningPath);
    if (!test.children.length) tree.append(live_el("div", "text-body-secondary small p-2", test.status === "RUNNING" ? "Starting..." : "No steps."));
    steps.replaceChildren(tree);
}

function render_steps(container, node, depth, runningPath) {
    for (const entry of visible_children(liveState, node, liveUi.loopsOpened, liveUi.revealed)) {
        if (typeof entry === "object") {
            const text = entry.long
                ? `${entry.folded} more steps${entry.folded > LONG_REVEAL ? ` (show ${LONG_REVEAL})` : ""}`
                : `${entry.folded} more iterations`;
            const folded = live_el("div", "live-folded", text);
            if (entry.long) folded.dataset.long = "true";
            folded.style.paddingLeft = `${12 + depth * 20 + 30}px`;
            folded.dataset.loopId = entry.loopId;
            container.append(folded);
            continue;
        }
        const step = liveState.steps.get(entry);
        const expanded = step.children.length > 0 && step_expanded(step, runningPath);
        container.append(render_step_row(step, depth, expanded));
        if (step.status === "FAIL" && step.message && !step.children.length) {
            const message = live_el("div", "live-step-message", step.message);
            message.style.paddingLeft = `${12 + depth * 20 + 46}px`;
            container.append(message);
        }
        if (expanded) render_steps(container, step, depth + 1, runningPath);
    }
}

function render_step_row(step, depth, expanded) {
    const row = live_el("div", `live-step ${live_status_class(step.status)}${step.id === liveUi.selectedStepId ? " selected" : ""}`);
    row.dataset.stepId = step.id;
    row.style.paddingLeft = `${12 + depth * 20}px`;
    const chevron = live_el("span", `live-chevron${step.children.length ? (expanded ? " open" : " closed") : ""}`);
    row.append(chevron, live_el("span", `live-glyph ${live_status_class(step.status)}`, GLYPHS[step.status] || ""));
    const tag = step_tag(step);
    if (tag) row.append(live_el("span", "live-tag", tag));
    const label = step_label(step);
    if (label) row.append(live_el("span", "live-name", label));
    if (step.owner && step.kind !== "VAR") row.append(live_el("span", "live-owner", step.owner));
    row.append(live_el("span", "live-args", step_args(step)));
    // how much of the test's time went into this step
    const bar = live_el("span", "live-bar");
    const fill = live_el("span", `live-bar-fill ${live_status_class(step.status)}`);
    fill.style.width = barTotal > 0 ? `${Math.min(100, Math.max(1, (100 * live_seconds(step)) / barTotal))}%` : "0%";
    bar.append(fill);
    row.append(bar, live_el("span", "live-time", live_duration(step)));
    row.title = step.source ? `${step.source}:${step.lineno ?? ""}` : "";
    return row;
}

// --- presses ------------------------------------------------------------------------------------
// The lists are redrawn several times a second during fast runs. A click needs press and release on
// the same element, which a redraw in between replaces, so the lists act on the press itself and
// find the row by its id.

// a step: show it in the details and open or close its children
function press_step(id) {
    const step = liveState.steps.get(id);
    if (!step) return;
    stop_following();
    const runningPath = new Set(liveState.runningStepId ? step_path(liveState, liveState.runningStepId) : []);
    const expanded = step.children.length > 0 && step_expanded(step, runningPath);
    liveUi.selectedStepId = id;
    liveUi.userSelected = true;
    liveUi.tab = step.status === "FAIL" ? "error" : "call";
    if (step.children.length) {
        if (expanded) { liveUi.stepsOpened.delete(id); liveUi.stepsClosed.add(id); }
        else { liveUi.stepsClosed.delete(id); liveUi.stepsOpened.add(id); }
    }
}

// left pane: a suite opens or closes, a test shows its steps
function press_in_tree(event) {
    if (event.button !== 0) return;
    const target = event.target.closest("[data-test-id], [data-suite-id]");
    if (!target) return;
    if (target.dataset.suiteId) {
        const id = target.dataset.suiteId;
        if (liveUi.suitesClosed.has(id)) liveUi.suitesClosed.delete(id);
        else liveUi.suitesClosed.add(id);
    } else {
        focus_test(target.dataset.testId);
    }
    schedule_render(true);
}

// right pane: steps, folded loops and long lists, and the crumbs of the failure path
function press_in_steps(event) {
    if (event.button !== 0) return;
    const target = event.target.closest("[data-loop-id], [data-step-id]");
    if (!target) return;
    if (target.dataset.loopId && target.dataset.long) {
        const id = target.dataset.loopId;
        liveUi.revealed.set(id, (liveUi.revealed.get(id) || 0) + LONG_REVEAL);
    } else if (target.dataset.loopId) liveUi.loopsOpened.add(target.dataset.loopId);
    else if (target.classList.contains("live-failure-crumb")) {
        stop_following();
        liveUi.selectedStepId = target.dataset.stepId;
        liveUi.userSelected = true;
        liveUi.scrollToStepId = target.dataset.stepId;
    } else press_step(target.dataset.stepId);
    schedule_render(true);
}

// --- detail drawer -----------------------------------------------------------------------

function render_detail() {
    const drawer = document.getElementById("liveDetail");
    const id = liveUi.selectedStepId;
    const test = id ? liveState.tests.get(id) : null;
    const step = id ? liveState.steps.get(id) || test : null;
    // the card keeps its place and height; without a selection it only shows a hint
    for (const tab of drawer.querySelectorAll(".live-tab")) tab.hidden = !step;
    if (!step) {
        liveUi.detailKey = null;
        document.getElementById("liveDetailTitle").textContent = "Details";
        document.getElementById("liveDetailBody").replaceChildren(
            live_el("div", "text-body-secondary small", "Click a test or step in the list to see its call, log and error."),
        );
        return;
    }

    const tag = test ? "TEST" : step_tag(step);
    const title = test ? test.name : step_label(step);
    document.getElementById("liveDetailTitle").textContent = [tag, title].filter(Boolean).join(" ") || step.kind;
    const logTab = document.getElementById("liveTabLog");
    logTab.textContent = step.messages.length ? `Log (${step.messages.length})` : "Log";
    const images = detail_images(liveState, step, liveState.run ? liveState.run.outputdir : null);
    const imagesTab = document.getElementById("liveTabImages");
    imagesTab.textContent = images.length ? `Screenshots (${images.length})` : "Screenshots";
    imagesTab.disabled = images.length === 0;
    if (liveUi.tab === "images" && !images.length) liveUi.tab = "call";
    const errorTab = document.getElementById("liveTabError");
    errorTab.disabled = step.status !== "FAIL";
    errorTab.classList.add("error-tab");
    if (liveUi.tab === "error" && errorTab.disabled) liveUi.tab = "call";
    for (const tab of drawer.querySelectorAll(".live-tab")) tab.classList.toggle("active", tab.dataset.tab === liveUi.tab);

    // rebuilding on every update would replace the buttons under the pointer, so only when the content changes
    const key = [id, liveUi.tab, step.status, step.messages.length, !!liveState.resultFiles.LOG, outline_button_class(),
        images.length, hostImageUrls.size].join("|");
    if (key === liveUi.detailKey) {
        for (const node of drawer.querySelectorAll("[data-duration-of]")) node.textContent = status_text(step);
        return;
    }
    liveUi.detailKey = key;
    const body = document.getElementById("liveDetailBody");
    if (liveUi.tab === "log") body.replaceChildren(render_log(step));
    else if (liveUi.tab === "images") body.replaceChildren(render_images(images));
    else if (test) body.replaceChildren(render_test(test, liveUi.tab === "error"));
    else if (liveUi.tab === "error") body.replaceChildren(render_error(step));
    else body.replaceChildren(render_call(step));
}

function live_field(fields, label, value, mono = false) {
    if (value === undefined || value === null || value === "") return;
    fields.append(live_el("span", "label", label));
    if (value instanceof Node) fields.append(value);
    else fields.append(live_el("span", mono ? "live-mono" : "", value));
}

function status_text(node) {
    return `${node.status}${live_duration(node) ? ` \u00B7 ${live_duration(node)}` : ""}`;
}

function status_node(node) {
    const span = live_el("span", "", status_text(node));
    span.dataset.durationOf = node.id;
    return span;
}

function location_link(step) {
    if (!step.source) return null;
    const text = `${step.source}${step.lineno ? `:${step.lineno}` : ""}`;
    if (!host.present) return live_el("span", "live-mono", text);
    const link = live_el("a", "live-mono", text);
    link.href = "#";
    link.addEventListener("click", (event) => { event.preventDefault(); open_source(step); });
    return link;
}

function open_source(step) {
    host.post({ type: "openSource", source: step.source, lineno: step.lineno });
}

function open_log(step) {
    open_log_from_path(`${liveState.resultFiles.LOG}#${step.id}`);
}

// the dashboard's own outline buttons; theme.js swaps light/dark on existing buttons only,
// so buttons made later take the class of the current theme
function outline_button_class() {
    const dark = document.documentElement.classList.contains("dark-mode");
    return `btn ${dark ? "btn-outline-light" : "btn-outline-dark"} btn-sm`;
}

function action_buttons(step) {
    const buttons = live_el("div", "d-flex flex-wrap gap-2 mt-3");
    if (host.present && step.source) {
        const source = live_el("button", outline_button_class(), "Go to source");
        source.type = "button";
        source.addEventListener("click", () => open_source(step));
        buttons.append(source);
    }
    const log = live_el("button", outline_button_class(), "Open in log.html");
    log.type = "button";
    log.disabled = !liveState.resultFiles.LOG || step.flatten;
    log.title = liveState.resultFiles.LOG ? "" : "Available once the run has written its log";
    log.addEventListener("click", () => open_log(step));
    buttons.append(log);
    return buttons;
}

function render_call(step) {
    const wrapper = live_el("div");
    const fields = live_el("div", "live-fields");
    live_field(fields, "Kind", step.kind);
    live_field(fields, "Library", step.owner);
    live_field(fields, "Arguments", (step.args || []).join("\n"), true);
    if (step.kind === "FOR") live_field(fields, "Values", (step.values || []).join("\n"), true);
    if (step.condition) live_field(fields, "Condition", step.condition, true);
    const assign = Array.isArray(step.assign) ? step.assign.join("    ") : step.assign && typeof step.assign === "object"
        ? Object.entries(step.assign).map(([k, v]) => `${k} = ${v}`).join("\n") : step.assign;
    live_field(fields, "Assign", assign, true);
    live_field(fields, "Status", status_node(step));
    live_field(fields, "Location", location_link(step));
    live_field(fields, "Id", step.id, true);
    wrapper.append(fields, action_buttons(step));
    return wrapper;
}

function render_test(test, errorTab) {
    const wrapper = live_el("div");
    if (errorTab) wrapper.append(live_el("div", "live-error-box", test.message || test.status));
    const fields = live_el("div", "live-fields");
    live_field(fields, "Test", test.longname);
    live_field(fields, "Status", status_node(test));
    if (!errorTab) live_field(fields, "Message", test.message, true);
    live_field(fields, "Tags", (test.tags || []).join(", "));
    live_field(fields, "Location", location_link(test));
    live_field(fields, "Id", test.id, true);
    wrapper.append(fields, action_buttons(test));
    return wrapper;
}

function render_log(step) {
    const wrapper = live_el("div");
    if (!step.messages.length) {
        wrapper.append(live_el("div", "text-body-secondary small", "No messages logged by this step."));
        return wrapper;
    }
    for (const message of step.messages) {
        const line = live_el("div", "live-log-line");
        line.append(
            live_el("span", "live-mono text-body-secondary", live_format_time(message.t)),
            live_el("span", `level-${message.level}`, message.level),
            live_el("span", "live-mono", message.html ? live_html_to_text(message.text) : message.text),
        );
        wrapper.append(line);
    }
    return wrapper;
}

// screenshots of the step and the steps below it; an editor host serves the local files
function render_images(images) {
    const wrapper = live_el("div", "live-images");
    const missing = host.present ? images.filter((path) => !hostImageUrls.has(path) && !requestedImages.has(path)) : [];
    if (missing.length) {
        missing.forEach((path) => requestedImages.add(path));
        host.post({ type: "resolveFiles", paths: missing });
    }
    for (const path of images) {
        const figure = live_el("figure", "live-shot");
        const url = host.present ? hostImageUrls.get(path) : file_url(path);
        if (url) {
            const image = live_el("img");
            image.src = url;
            image.alt = path;
            image.loading = "lazy";
            image.addEventListener("error", () => image.replaceWith(live_el("div", "text-body-secondary small", "Image not found.")));
            figure.append(image);
        } else {
            figure.append(live_el("div", "text-body-secondary small",
                answeredImages.has(path) ? "Image not available." : "Loading..."));
        }
        figure.append(live_el("figcaption", "live-mono small text-body-secondary", path));
        wrapper.append(figure);
    }
    return wrapper;
}

function render_error(step) {
    const wrapper = live_el("div");
    wrapper.append(live_el("div", "live-error-box", step.message || step.status));
    const fields = live_el("div", "live-fields");
    const test = liveState.tests.get(step.testId);
    live_field(fields, "Test", test ? test.longname : "");
    live_field(fields, "Path", step_path(liveState, step.id).map((id) => step_label(liveState.steps.get(id)) || liveState.steps.get(id).kind).join(" › "));
    live_field(fields, "Location", location_link(step));
    wrapper.append(fields);
    const buttons = action_buttons(step);
    const copy = live_el("button", outline_button_class(), "Copy message");
    copy.type = "button";
    copy.addEventListener("click", () => navigator.clipboard && navigator.clipboard.writeText(step.message || ""));
    buttons.append(copy);
    wrapper.append(buttons);
    return wrapper;
}

// --- follow mode -------------------------------------------------------------------------

// scrolls a list (not the page) so that a row is visible, centred when it was out of view
function scroll_list_to(box, row, center) {
    const rowRect = row.getBoundingClientRect();
    const boxRect = box.getBoundingClientRect();
    if (rowRect.top >= boxRect.top && rowRect.bottom <= boxRect.bottom) return;
    const offset = rowRect.top - boxRect.top + box.scrollTop;
    const target = center ? offset - box.clientHeight / 2 + rowRect.height / 2 : offset;
    const max = box.scrollHeight - box.clientHeight;
    if (Math.round(Math.min(Math.max(target, 0), max)) === Math.round(box.scrollTop)) return;
    box.scrollTop = target;
}

function follow_running_step() {
    if (!liveUi.follow) return;
    const test = liveState.runningTestId && document.querySelector(`#liveTests [data-test-id="${CSS.escape(liveState.runningTestId)}"]`);
    if (test) scroll_list_to(document.getElementById("liveTreeScroll"), test, false);
    const step = liveState.runningStepId && document.querySelector(`#liveSteps [data-step-id="${CSS.escape(liveState.runningStepId)}"]`);
    if (step) scroll_list_to(document.getElementById("liveTestsScroll"), step, true);
}

function stop_following() {
    if (!liveUi.follow || !settings.menu.live) return;
    liveUi.follow = false;
    schedule_render();
}

// the viewer switches to another test: stop following, show its steps and its failure if it has one
function focus_test(id) {
    stop_following();
    liveUi.selectedTestId = id;
    select_test(id);
    liveUi.scrollToStepId = liveUi.selectedStepId;
}

// a failed test shows the step that failed it, any other test shows itself
function select_test(id) {
    const failure = test_failure(id);
    liveUi.selectedStepId = failure || id;
    liveUi.userSelected = true;
    liveUi.tab = failure ? "error" : "call";
}

function resume_following() {
    liveUi.detailKey = null;
    liveUi.follow = true;
    liveUi.userSelected = false;
    schedule_render(true);
}

// only while a run is going: once it ended there is nothing live to go back to
function render_resume_button() {
    document.getElementById("liveResume").hidden = liveUi.follow || liveState.status !== "RUNNING" || replay !== null;
}

// the page fills the window below the navigation bar; the lists take the remaining height
function fit_to_window() {
    const page = document.getElementById("live");
    if (page.hidden) return;
    const nav = document.getElementById("navigation");
    page.style.setProperty("--live-top", `${nav ? nav.getBoundingClientRect().bottom : 0}px`);
}

// a step picked from the failure path or a test the viewer opened: bring its row into view once
function scroll_to_picked_step() {
    if (!liveUi.scrollToStepId) return;
    const row = document.querySelector(`#liveSteps [data-step-id="${CSS.escape(liveUi.scrollToStepId)}"]`);
    liveUi.scrollToStepId = null;
    if (row) scroll_list_to(document.getElementById("liveTestsScroll"), row, true);
}

// without a choice of the viewer: the first failed test, else the last one
function default_test() {
    const failed = liveState.testOrder.find((id) => liveState.tests.get(id).status === "FAIL");
    return failed || liveState.testOrder[liveState.testOrder.length - 1] || null;
}

// --- loop ----------------------------------------------------------------------------------

function render_live() {
    // live view: the details show the running step; after the run they keep the last one
    if (liveUi.follow && !liveUi.userSelected && liveState.runningStepId) {
        if (liveUi.selectedStepId !== liveState.runningStepId) liveUi.tab = "call";
        liveUi.selectedStepId = liveState.runningStepId;
    }
    const selected = liveUi.selectedStepId;
    if (selected && !liveState.steps.has(selected) && !liveState.tests.has(selected)) liveUi.selectedStepId = null;
    // the right pane shows the running test while following, otherwise what the viewer picked
    if (liveUi.follow && liveState.runningTestId) liveUi.selectedTestId = liveState.runningTestId;
    if (liveUi.selectedTestId && !liveState.tests.has(liveUi.selectedTestId)) liveUi.selectedTestId = null;
    if (!liveUi.selectedTestId) {
        liveUi.selectedTestId = default_test();
        if (liveUi.selectedTestId && !liveUi.userSelected && !liveState.runningTestId) select_test(liveUi.selectedTestId);
    }
    fit_to_window();
    render_header(test_counts(liveState));
    render_tree();
    render_steps_pane();
    render_detail();
    render_resume_button();
    render_replay_bar();
    follow_running_step();
    scroll_to_picked_step();
}

// the step that failed the test: follow failed children down to the deepest one
// (failures caught by TRY or Run Keyword And Ignore Error are skipped when the test passed)
function test_failure(testId) {
    const test = liveState.tests.get(testId);
    if (!test || test.status !== "FAIL") return null;
    let node = test;
    let failed = null;
    for (;;) {
        const next = node.children.map((id) => liveState.steps.get(id)).find((step) => step.status === "FAIL");
        if (!next) return failed ? failed.id : null;
        failed = next;
        node = next;
    }
}

// event batches redraw at most every RENDER_INTERVAL ms; the viewer's own actions redraw at once
const RENDER_INTERVAL = 200;
let lastRender = 0;
let renderTimer = null;

function schedule_render(immediate = false) {
    if (immediate) {
        clearTimeout(renderTimer);
        renderTimer = null;
        renderScheduled = false;
        lastRender = performance.now();
        render_live();
        return;
    }
    if (renderScheduled) return;
    renderScheduled = true;
    const wait = Math.max(0, RENDER_INTERVAL - (performance.now() - lastRender));
    renderTimer = setTimeout(() => requestAnimationFrame(() => {
        renderScheduled = false;
        renderTimer = null;
        lastRender = performance.now();
        render_live();
    }), wait);
}

// --- replay ------------------------------------------------------------------------------

function start_replay(events, name) {
    show_replay_error("");
    if (!events.length) {
        show_replay_error(`No events in ${name}.`);
        return;
    }
    // a finished run opens at its end; the slider goes back to any moment
    replay = { events, index: events.length - 1, name };
    liveState = replay_state_at(events, replay.index);
    reset_ui();
    const slider = document.getElementById("liveReplaySlider");
    slider.max = String(events.length - 1);
    slider.value = String(replay.index);
    render_replay_dots(events);
    show_live_page();
    schedule_render(true);
}

function move_replay(index) {
    if (!replay) return;
    const target = Math.max(0, Math.min(index, replay.events.length - 1));
    liveState = replay_state_at(replay.events, target, liveState, replay.index);
    replay.index = target;
    schedule_render(true);
}

// a dot per finished test at the moment it ended, coloured by status, drawn on the slider's rail
function render_replay_dots(events) {
    const dots = document.getElementById("liveReplayDots");
    dots.replaceChildren();
    const names = new Map();
    const last = Math.max(events.length - 1, 1);
    replayDots = [];
    events.forEach((event, index) => {
        if (event.type === "test.started") names.set(event.id, event.name);
        if (event.type !== "test.ended") return;
        const status = String(event.status || "").toUpperCase();
        const dot = live_el("span", `live-replay-dot live-replay-dot-${status.toLowerCase()}`);
        dot.style.left = `${(index / last) * 100}%`;
        dots.appendChild(dot);
        replayDots.push({ dot, name: names.get(event.id) || event.id, status, elapsed: event.elapsed });
    });
    hide_replay_tooltip();
}

// the slider sits on top of the dots, so the dot under the mouse is found by position;
// the tooltip has the shape of the Chart.js one, like the date histogram in the filter modal
function show_replay_tooltip(mouseX) {
    const tooltip = document.getElementById("liveReplayTooltip");
    const track = tooltip.parentElement.getBoundingClientRect();
    let best = null;
    let bestDistance = 6;
    for (const entry of replayDots) {
        const rect = entry.dot.getBoundingClientRect();
        const distance = Math.abs(rect.left + rect.width / 2 - mouseX);
        if (distance <= bestDistance) {
            best = entry;
            bestDistance = distance;
        }
    }
    if (!best) return hide_replay_tooltip();
    tooltip.replaceChildren(live_el("div", "date-histogram-tooltip-title", best.name));
    const row = live_el("div", "date-histogram-tooltip-row");
    const swatch = live_el("span", `date-histogram-tooltip-dot live-replay-dot-${best.status.toLowerCase()}`);
    const elapsed = best.elapsed === undefined ? "" : ` (${live_format_seconds(best.elapsed) || "0ms"})`;
    row.append(swatch, document.createTextNode(`${best.status}${elapsed}`));
    tooltip.appendChild(row);
    tooltip.hidden = false;
    const dot = best.dot.getBoundingClientRect();
    const center = dot.left + dot.width / 2 - track.left;
    const left = Math.max(0, Math.min(center - tooltip.offsetWidth / 2, track.width - tooltip.offsetWidth));
    tooltip.style.left = `${left}px`;
}

function hide_replay_tooltip() {
    document.getElementById("liveReplayTooltip").hidden = true;
}

function close_replay() {
    replay = null;
    liveState = streamState;
    document.getElementById("liveReplayRun").value = "";
    reset_ui();
    schedule_render(true);
}

function show_replay_error(text) {
    const error = document.getElementById("liveReplayError");
    error.textContent = text;
    error.hidden = !text;
}

function render_replay_bar() {
    document.getElementById("liveReplayBar").hidden = replay === null;
    if (!replay) return;
    document.getElementById("liveReplayName").textContent = `Replay: ${replay.name}`;
    const first = replay.events[0].t;
    const last = replay.events[replay.events.length - 1].t;
    const current = replay.events[replay.index].t;
    document.getElementById("liveReplayTime").textContent =
        `${live_format_seconds(current - first) || "0ms"} / ${live_format_seconds(last - first) || "0ms"}`;
}

// history runs to replay; only an editor host can read their events files, a browser page cannot
function fill_replay_runs() {
    const select = document.getElementById("liveReplayRun");
    select.hidden = !host.present;
    if (!host.present) return;
    const options = [...runs.keys()]
        .filter((i) => runs[i].path)
        .sort((a, b) => String(runs[b].run_start).localeCompare(String(runs[a].run_start)))
        .map((i) => {
            const option = live_el("option", "", get_run_label(runs[i]));
            option.value = String(i);
            return option;
        });
    select.replaceChildren(select.options[0], ...options);
}

function request_replay(index) {
    const run = runs[Number(index)];
    if (!run) return;
    show_replay_error("");
    host.post({ type: "replayEvents", paths: events_paths_for_output(run.path), name: get_run_label(run) });
}

async function replay_file(file) {
    try {
        start_replay(await read_events_file(file), file.name);
    } catch (error) {
        show_replay_error(`Could not read ${file.name}: ${error.message || error}`);
    }
}

function show_live_page() {
    if (!settings.menu.live) document.getElementById("menuLive").click();
}

// function to setup the live page and the host messages that feed it
function setup_live() {
    // without an editor host the Live page is hidden (see setup_menu) and nothing feeds it
    if (!host.present) return;
    host.onMessage((message) => {
        switch (message.type) {
            case "reset":
                streamState = create_run_state();
                if (!replay) {
                    liveState = streamState;
                    reset_ui();
                }
                break;
            case "events": {
                if (!Array.isArray(message.events)) return;
                const started = message.events.some((ev) => ev.type === "run.started");
                // a new live run ends a replay
                if (started && replay) close_replay();
                for (const ev of message.events) {
                    if (ev.type === "run.started" && !replay) reset_ui();
                    apply_event(streamState, ev);
                }
                if (started) show_live_page();
                break;
            }
            case "replay":
                if (Array.isArray(message.events)) start_replay(message.events, message.name || "run");
                break;
            case "replayError":
                show_replay_error(message.message || "The events file of this run was not found.");
                break;
            case "files":
                // answer to resolveFiles: urls for the paths the host may show (missing paths stay unavailable)
                for (const [path, url] of Object.entries(message.files || {})) hostImageUrls.set(path, url);
                for (const path of requestedImages) answeredImages.add(path);
                liveUi.detailKey = null;
                break;
            case "showPage":
                if (message.page === "live") show_live_page();
                break;
            default:
                return;
        }
        schedule_render();
    });

    document.getElementById("liveResume").addEventListener("click", resume_following);
    fill_replay_runs();
    document.getElementById("liveReplayRun").addEventListener("change", (event) => {
        if (event.target.value !== "") request_replay(event.target.value);
    });
    const fileInput = document.getElementById("liveReplayFileInput");
    document.getElementById("liveReplayFile").addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
        if (fileInput.files.length) void replay_file(fileInput.files[0]);
        fileInput.value = "";
    });
    // dragging the slider moves through the run; one state update per frame
    let pendingIndex = null;
    const replaySlider = document.getElementById("liveReplaySlider");
    replaySlider.addEventListener("mousemove", (event) => show_replay_tooltip(event.clientX));
    replaySlider.addEventListener("mouseleave", hide_replay_tooltip);
    document.getElementById("liveReplaySlider").addEventListener("input", (event) => {
        const first = pendingIndex === null;
        pendingIndex = Number(event.target.value);
        if (first) requestAnimationFrame(() => { move_replay(pendingIndex); pendingIndex = null; });
    });
    document.getElementById("liveReplayClose").addEventListener("click", close_replay);
    document.getElementById("liveTests").addEventListener("pointerdown", press_in_tree);
    document.getElementById("liveStepsCard").addEventListener("pointerdown", press_in_steps);
    document.getElementById("liveSearch").addEventListener("input", (event) => {
        liveUi.search = event.target.value;
        schedule_render(true);
    });
    for (const chip of document.querySelectorAll("#liveChips .live-chip")) {
        chip.addEventListener("click", () => { liveUi.filter = chip.dataset.filter; schedule_render(true); });
    }
    for (const tab of document.querySelectorAll("#liveDetail .live-tab")) {
        tab.addEventListener("click", () => { liveUi.tab = tab.dataset.tab; schedule_render(true); });
    }
    // only the viewer's own input ends live view: scroll events also come from the list being rebuilt
    // and from the page following the running step, many times a second during fast loops
    for (const list of [document.getElementById("liveTestsScroll"), document.getElementById("liveTreeScroll")]) {
        list.addEventListener("wheel", stop_following, { passive: true });
        list.addEventListener("touchmove", stop_following, { passive: true });
        list.addEventListener("pointerdown", (event) => {
            // a press on the scrollbar, which lies outside the content box
            if (event.offsetX > list.clientWidth || event.offsetY > list.clientHeight) stop_following();
        });
        list.addEventListener("keydown", (event) => {
            if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) stop_following();
        });
    }
    window.addEventListener("resize", fit_to_window);
    // a theme switch changes the colours of buttons made earlier
    new MutationObserver(() => {
        liveUi.detailKey = null;
        schedule_render(true);
    }).observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-bs-theme"] });

    // keep running durations and the elapsed time ticking
    setInterval(() => { if (liveState.status === "RUNNING" && !replay) schedule_render(); }, 500);
    render_live();
    host.post({ type: "ready" });
}

export { setup_live };
