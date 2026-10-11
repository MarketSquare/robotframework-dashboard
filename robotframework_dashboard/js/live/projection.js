// Run state projected from robotframework-events (format v1): suites, tests and their step trees.
// Pure data, no DOM, so it can be tested on recorded event files.

const LOOP_HEAD = 3; // iterations always shown at the start of a loop
// any other step (or test) with more children than this shows them in parts, so a redraw stays fast
// (a test of 20,000 keywords took 260 ms to redraw in full)
const LONG_CHILDREN = 200;
const LONG_HEAD = 100; // children shown at the start of a long list
const LONG_REVEAL = 500; // children each "more steps" press adds

function create_run_state() {
    return {
        status: null, // null (waiting), RUNNING, or the final run status
        run: null, // the run.started event
        planned: null, // full names of every test the run will execute (top-level suite.started)
        total: 0,
        startT: null,
        endT: null,
        lastT: null,
        suites: new Map(), // id -> suite node; children are suite and test ids in run order
        rootSuiteId: null,
        tests: new Map(), // id -> test node
        testOrder: [],
        steps: new Map(), // id -> step node
        runningTestId: null,
        runningStepId: null, // the deepest step that is running
        resultFiles: {}, // kind -> path
        suiteSources: new Map(), // suite id -> source, inherited by tests
    };
}

function live_new_node(ev, extra) {
    return {
        id: ev.id,
        parent: ev.parent ?? null,
        status: "RUNNING",
        startT: ev.t,
        elapsed: null,
        message: "",
        children: [],
        messages: [],
        ...extra,
    };
}

function apply_event(state, ev) {
    switch (ev.type) {
        case "run.started": {
            const fresh = create_run_state();
            Object.assign(state, fresh);
            state.status = "RUNNING";
            state.run = ev;
            state.startT = ev.t;
            break;
        }
        case "suite.started":
            if (!state.total && ev.tests) state.total = ev.tests; // the root suite carries the total
            if (!ev.parent && Array.isArray(ev.planned) && !state.planned) state.planned = ev.planned;
            if (state.startT === null) state.startT = ev.t;
            if (!state.status) state.status = "RUNNING";
            state.suiteSources.set(ev.id, ev.source ?? (ev.parent ? state.suiteSources.get(ev.parent) : null));
            if (!state.suites.has(ev.id)) {
                const parentSuite = state.suites.get(ev.parent);
                if (parentSuite) parentSuite.children.push(ev.id);
                if (!ev.parent && state.rootSuiteId === null) state.rootSuiteId = ev.id;
            }
            state.suites.set(ev.id, live_new_node(ev, { name: ev.name, longname: ev.longname }));
            break;
        case "suite.ended":
            live_finish(state.suites.get(ev.id), ev);
            break;
        case "test.started": {
            const suiteSource = state.suiteSources.get(ev.parent);
            const test = live_new_node(ev, {
                name: ev.name, longname: ev.longname, lineno: ev.lineno, tags: ev.tags || [],
                source: ev.source ?? suiteSource ?? null,
            });
            if (!state.tests.has(ev.id)) {
                state.testOrder.push(ev.id);
                const suite = state.suites.get(ev.parent);
                if (suite) suite.children.push(ev.id);
            }
            state.tests.set(ev.id, test);
            state.runningTestId = ev.id;
            state.runningStepId = null;
            break;
        }
        case "test.ended":
            live_finish(state.tests.get(ev.id), ev);
            if (state.runningTestId === ev.id) { state.runningTestId = null; state.runningStepId = null; }
            break;
        case "step.started": {
            const parent = state.steps.get(ev.parent) || state.tests.get(ev.parent);
            const step = live_new_node(ev, {
                kind: ev.kind, name: ev.name || "", owner: ev.owner || "", args: ev.args || [],
                assign: ev.assign, lineno: ev.lineno, condition: ev.condition, flavor: ev.flavor,
                values: ev.values, patterns: ev.patterns, flatten: !!ev.flatten,
                source: ev.source ?? (parent ? parent.source : null),
                testId: parent ? (parent.testId || (state.tests.has(parent.id) ? parent.id : null)) : null,
            });
            state.steps.set(ev.id, step);
            if (parent) parent.children.push(ev.id);
            state.runningStepId = ev.id;
            break;
        }
        case "step.ended": {
            const step = state.steps.get(ev.id);
            live_finish(step, ev);
            if (step && state.runningStepId === ev.id) {
                // the parent step, if it is still running, is the running one again
                const parent = state.steps.get(step.parent);
                state.runningStepId = parent && parent.status === "RUNNING" ? parent.id : null;
            }
            break;
        }
        case "message.logged": {
            const owner = state.steps.get(ev.parent) || state.tests.get(ev.parent);
            if (owner) owner.messages.push({ t: ev.t, level: ev.level, text: ev.text || "", html: !!ev.html });
            break;
        }
        case "status.changed": {
            const node = ev.item === "test" ? state.tests.get(ev.id) : state.suites.get(ev.id);
            if (node) { node.status = ev.status; node.message = ev.message || ""; }
            break;
        }
        case "resultfile.created":
            state.resultFiles[ev.kind] = ev.path;
            break;
        case "run.ended":
            state.status = ev.status;
            state.endT = ev.t;
            state.runningTestId = null;
            state.runningStepId = null;
            break;
    }
    if (ev.t) state.lastT = ev.t;
}

function live_finish(node, ev) {
    if (!node) return;
    node.status = ev.status;
    node.elapsed = ev.elapsed ?? null;
    node.message = ev.message || "";
}

// tests per status below a suite, its child suites included
function suite_counts(state, suite) {
    const counts = { PASS: 0, FAIL: 0, SKIP: 0, RUNNING: 0, tests: 0 };
    const visit = (node) => {
        for (const id of node.children) {
            const child = state.suites.get(id);
            if (child) {
                visit(child);
                continue;
            }
            const test = state.tests.get(id);
            if (!test) continue;
            counts.tests++;
            counts[test.status] = (counts[test.status] || 0) + 1;
        }
    };
    visit(suite);
    return counts;
}

function test_counts(state) {
    const counts = { PASS: 0, FAIL: 0, SKIP: 0, RUNNING: 0 };
    for (const test of state.tests.values()) counts[test.status] = (counts[test.status] || 0) + 1;
    const done = counts.PASS + counts.FAIL + counts.SKIP;
    const total = Math.max(state.total, state.tests.size);
    return { ...counts, done, total, pending: Math.max(0, total - done - counts.RUNNING) };
}

// the label shown for a step: keyword name, or the control structure's own data
function step_label(step) {
    switch (step.kind) {
        case "KEYWORD":
        case "SETUP":
        case "TEARDOWN":
            return step.name;
        case "FOR":
            return [...(step.assign || []), step.flavor, ...(step.values || [])].filter(Boolean).join("    ");
        case "ITERATION":
            return step.assign ? Object.entries(step.assign).map(([k, v]) => `${k} = ${v}`).join("    ") : "";
        case "IF":
        case "ELSE IF":
        case "WHILE":
            return step.condition || "";
        case "EXCEPT":
            return (step.patterns || []).join("    ");
        case "GROUP":
        case "VAR":
            return step.name || "";
        case "RETURN":
            return (step.values || []).join("    ");
        default:
            return step.name || "";
    }
}

// the short tag shown before control structures, setups and teardowns (none for plain keywords)
function step_tag(step) {
    if (step.kind === "KEYWORD") return "";
    if (step.kind === "ITERATION") return "ITER";
    return step.kind;
}

// the arguments column: keyword arguments, and the values a VAR sets
function step_args(step) {
    if (step.kind === "VAR") return (step.values || []).join("    ");
    return (step.args || []).join("    ");
}

// children of a step or test as shown: long loops keep their first iterations, the last, the running and
// the failed ones; other long lists keep their first LONG_HEAD (plus what the viewer revealed) and last
// children. The rest folds into { folded: n, loopId, long } entries.
function visible_children(state, node, expandedLoops, revealed = new Map()) {
    const ids = node.children;
    const loop = node.kind === "FOR" || node.kind === "WHILE";
    if (loop && (ids.length <= LOOP_HEAD + 2 || expandedLoops.has(node.id))) return ids;
    if (!loop && ids.length <= LONG_CHILDREN) return ids;
    const head = loop ? LOOP_HEAD : LONG_HEAD + (revealed.get(node.id) || 0);
    const tail = loop ? 1 : 3;
    const result = [];
    let folded = 0;
    const flush = () => {
        if (folded) result.push(loop ? { folded, loopId: node.id } : { folded, loopId: node.id, long: true });
        folded = 0;
    };
    ids.forEach((id, index) => {
        const child = state.steps.get(id);
        const keep = index < head || index >= ids.length - tail || child.status === "RUNNING" || child.status === "FAIL";
        if (keep) {
            flush();
            result.push(id);
        } else {
            folded++;
        }
    });
    flush();
    return result;
}

// ids from the test down to the given step, used to auto-expand the path to the running step
function step_path(state, stepId) {
    const path = [];
    let step = state.steps.get(stepId);
    while (step) {
        path.unshift(step.id);
        step = state.steps.get(step.parent);
    }
    return path;
}

export {
    LONG_REVEAL,
    create_run_state,
    apply_event,
    test_counts,
    suite_counts,
    step_label,
    step_tag,
    step_args,
    visible_children,
    step_path,
};
