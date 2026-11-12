import { escape_html } from "../escape.js";
import { use_logs } from "../variables/data.js";
import { open_test_log } from "../log.js";
import { get_run_label_by_run_start } from "../graph_data/helpers.js";

// the runs the modal shows, a click on a run opens its log at the test
let shownRuns = [];

function status_badge(status) {
    return `<span class="badge test-status-badge test-status-${status.toLowerCase()}">${escape_html(status)}</span>`;
}

// the message is shown as text, an *HTML* message included: the tables page renders those
function full_message(message) {
    return `<pre class="full-message">${escape_html(message)}</pre>`;
}

function attempt_lines(attempts) {
    if (attempts.length === 0) return "";
    const items = attempts.map((attempt, index) => `<li>
            <div class="small">${index + 1}. ${status_badge(attempt.status)}</div>
            ${attempt.message ? full_message(attempt.message) : ""}</li>`).join("");
    return `<div class="small mt-2">Attempts: ${attempts.map(attempt => escape_html(attempt.status)).join(" → ")}</div>
        <ol class="test-message-attempts">${items}</ol>`;
}

// opens the modal with the full messages of one test across the runs of a graph (get_test_messages)
function open_test_messages_modal(label, runs) {
    shownRuns = runs;
    document.getElementById("testMessagesTest").textContent = label;
    // a message clipped when it was stored (--messagelength) ends in an ellipsis
    const clipped = runs.some(run => [run.message, ...run.attempts.map(attempt => attempt.message)].some(message => message?.endsWith("…")));
    document.getElementById("testMessagesSummary").textContent = runs.length === 0
        ? "No messages for this test in the shown runs"
        : `${runs.length} ${runs.length === 1 ? "run" : "runs"} with a message, newest first`
            + (clipped ? ". A message ending in … was longer than the stored length (--messagelength)" : "");
    document.getElementById("testMessagesList").innerHTML = runs.map((run, index) => {
        const runLabel = escape_html(get_run_label_by_run_start(run.runStart));
        const name = use_logs
            ? `<a class="test-message-log" href="#" data-index="${index}" title="Open the log of this run at this test">${runLabel}</a>`
            : `<span>${runLabel}</span>`;
        // without suite paths one label can be several tests, the full name tells them apart
        return `<li class="list-group-item" title="${escape_html(run.fullName ?? "")}">
                <div class="d-flex justify-content-between align-items-center mb-1">${name}${status_badge(run.status)}</div>
                ${run.message ? full_message(run.message) : ""}${attempt_lines(run.attempts)}</li>`;
    }).join("");
    bootstrap.Modal.getOrCreateInstance(document.getElementById("testMessagesModal")).show();
}

function setup_test_messages_modal() {
    document.getElementById("testMessagesList").addEventListener("click", (event) => {
        const link = event.target.closest(".test-message-log");
        if (!link) return;
        event.preventDefault();
        const run = shownRuns[Number(link.dataset.index)];
        if (run) open_test_log(run.runStart, run.id);
    });
}

export { open_test_messages_modal, setup_test_messages_modal };
