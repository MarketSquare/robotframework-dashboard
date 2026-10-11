// What earlier runs say about the live run: the usual duration of each test, for the remaining time
// and the "slower than usual" badge. Pure data, no DOM.

const SLOWER_FACTOR = 1.5; // a test is slower than usual above 1.5 times its median duration
const SLOWER_MIN_SECONDS = 1; // and only when that is at least a second longer, not for millisecond tests

function live_median(values) {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

// medians of earlier durations, per test full name; skipped tests do not count, their duration says
// nothing about a real run
function build_duration_history(historyTests) {
    const testDurations = new Map();
    for (const test of historyTests || []) {
        if (test.skipped) continue;
        const seconds = parseFloat(test.elapsed_s);
        if (!Number.isFinite(seconds)) continue;
        if (!testDurations.has(test.full_name)) testDurations.set(test.full_name, []);
        testDurations.get(test.full_name).push(seconds);
    }
    return { tests: new Map([...testDurations].map(([name, values]) => [name, live_median(values)])) };
}

// the usual duration of a test, or null when no earlier run had it
function usual_duration(history, test) {
    return history.tests.get(test.longname) ?? null;
}

// seconds the test took (or takes so far, while running)
function test_seconds(test, now) {
    if (test.status === "RUNNING") return Math.max(0, now - test.startT);
    return test.elapsed;
}

// true when the test takes clearly longer than in earlier runs; a running test counts as soon as it is
function slower_than_usual(history, test, now) {
    const usual = usual_duration(history, test);
    const seconds = test_seconds(test, now);
    if (usual === null || seconds === null || seconds === undefined) return false;
    return seconds > usual * SLOWER_FACTOR && seconds - usual >= SLOWER_MIN_SECONDS;
}

// planned tests (full names, from the top-level suite.started) that have not started yet
function remaining_tests(state) {
    const started = new Map();
    for (const test of state.tests.values()) started.set(test.longname, (started.get(test.longname) || 0) + 1);
    const remaining = [];
    for (const name of state.planned) {
        const count = started.get(name) || 0;
        if (count) started.set(name, count - 1);
        else remaining.push(name);
    }
    // a planned name can differ from the started test (variables resolved in a test name): never more than are left
    const left = Math.max(0, state.planned.length - state.tests.size);
    return remaining.slice(remaining.length - left);
}

// expected seconds until the run ends: the usual duration of every planned test that has not started, plus
// what remains of the running tests. Tests without history count with the average of those that have one.
// null outside a run, without a plan (events of robotframework-events before 0.4.0), or when fewer than half
// of the tests still to run have a history; 0 when the running tests take longer than usual.
function eta_seconds(history, state, now) {
    if (state.status !== "RUNNING" || !Array.isArray(state.planned)) return null;
    const waiting = remaining_tests(state).map((name) => history.tests.get(name) ?? null);
    const running = [...state.tests.values()].filter((test) => test.status === "RUNNING");
    const runningUsual = running.map((test) => usual_duration(history, test));
    const known = [...waiting, ...runningUsual].filter((seconds) => seconds !== null);
    const total = waiting.length + running.length;
    if (total === 0) return 0;
    if (known.length * 2 < total) return null;
    const average = known.reduce((sum, seconds) => sum + seconds, 0) / known.length;
    let eta = waiting.reduce((sum, seconds) => sum + (seconds ?? average), 0);
    running.forEach((test, index) => {
        eta += Math.max(0, (runningUsual[index] ?? average) - (now - test.startT));
    });
    return eta;
}

export { build_duration_history, usual_duration, slower_than_usual, eta_seconds };
