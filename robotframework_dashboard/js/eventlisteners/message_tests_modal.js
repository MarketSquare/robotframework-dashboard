import { escape_html } from "../escape.js";
import { add_alert } from "../common.js";
import { use_logs } from "../variables/data.js";
import { open_test_log } from "../log.js";

// the tests of the message the modal shows, a click on a test name opens the log of its latest run
let shownTests = [];

// opens the modal with the tests behind one message of the test messages graph (get_message_tests)
function open_message_tests_modal(message, tests) {
    shownTests = tests;
    document.getElementById("messageTestsMessage").textContent = message;
    const runs = tests.reduce((total, test) => total + test.count, 0);
    document.getElementById("messageTestsSummary").textContent =
        `${tests.length} ${tests.length === 1 ? "test" : "tests"}, ${runs} ${runs === 1 ? "time" : "times"} in total`;
    document.getElementById("messageTestsList").innerHTML = tests.map((test, index) => {
        const name = use_logs
            ? `<a class="message-test-log" href="#" data-index="${index}" title="Open the log of the latest run with this message">${escape_html(test.name)}</a>`
            : `<span>${escape_html(test.name)}</span>`;
        return `<li class="list-group-item d-flex justify-content-between align-items-center" title="${escape_html(test.fullName)}">
                ${name}<span class="badge bg-secondary ms-3">${test.count}</span></li>`;
    }).join("");
    bootstrap.Modal.getOrCreateInstance(document.getElementById("messageTestsModal")).show();
}

function copy_message_tests() {
    const text = shownTests.map(test => test.name).join("\n");
    // the clipboard API is missing on a dashboard served over plain http
    if (!navigator.clipboard) {
        add_alert("Copying is not available here; select the test names and copy them instead", "danger");
        return;
    }
    navigator.clipboard.writeText(text)
        .then(() => add_alert("Copied the test names to the clipboard!", "success"))
        .catch(() => add_alert("Could not copy the test names", "danger"));
}

function setup_message_tests_modal() {
    document.getElementById("copyMessageTests").addEventListener("click", copy_message_tests);
    document.getElementById("messageTestsList").addEventListener("click", (event) => {
        const link = event.target.closest(".message-test-log");
        if (!link) return;
        event.preventDefault();
        const test = shownTests[Number(link.dataset.index)];
        if (test) open_test_log(test.runStart, test.id);
    });
}

export { open_message_tests_modal, setup_message_tests_modal };
