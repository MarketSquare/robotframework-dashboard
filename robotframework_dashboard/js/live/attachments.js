// Screenshots and other images that steps log as HTML messages (Browser, SeleniumLibrary,
// Screenshot), for the Screenshots tab, and Playwright traces (Browser). Pure data, no DOM.

const IMAGE_SRC = /<img\b[^>]*?\bsrc\s*=\s*(["'])(.*?)\1/gi;

// the src of every <img> in an HTML message, in order, without duplicates
function message_images(html) {
    const sources = [];
    for (const match of String(html || "").matchAll(IMAGE_SRC)) {
        const src = match[2].trim();
        if (src && !sources.includes(src)) sources.push(src);
    }
    return sources;
}

// where an image is: URLs and absolute paths as they are, relative paths against the output directory
// (log.html, which links them, lies there)
function resolve_attachment(src, outputdir) {
    if (/^(https?:|data:|file:)/i.test(src)) return src;
    if (/^([A-Za-z]:[\\/]|[\\/])/.test(src) || !outputdir) return src;
    const windows = outputdir.includes("\\");
    const separator = windows ? "\\" : "/";
    const relative = windows ? src.replace(/\//g, "\\") : src;
    return outputdir.replace(/[\\/]+$/, "") + separator + relative;
}

// the images logged by a test or step and everything below it, oldest first
function node_images(state, node, outputdir) {
    const images = [];
    const visit = (current) => {
        for (const message of current.messages || []) {
            if (!message.html) continue;
            for (const src of message_images(message.text)) {
                const path = resolve_attachment(src, outputdir);
                if (!images.includes(path)) images.push(path);
            }
        }
        for (const id of current.children || []) {
            const child = state.steps.get(id);
            if (child) visit(child);
        }
    };
    visit(node);
    return images;
}

// the images to show with a test or step: its own, and for a failed step also those of its test's teardown,
// where run-on-failure screenshots (Browser, SeleniumLibrary) end up
function detail_images(state, node, outputdir) {
    const images = node_images(state, node, outputdir);
    const test = node.status === "FAIL" && node.testId ? state.tests.get(node.testId) : null;
    if (!test) return images;
    for (const id of test.children) {
        const child = state.steps.get(id);
        if (!child || child.kind !== "TEARDOWN") continue;
        for (const path of node_images(state, child, outputdir)) if (!images.includes(path)) images.push(path);
    }
    return images;
}

// how a page without a host shows a local file
function file_url(path) {
    if (/^(https?:|data:|file:)/i.test(path)) return path;
    const normalized = path.replace(/\\/g, "/");
    return encodeURI(normalized.startsWith("/") ? `file://${normalized}` : `file:///${normalized}`);
}

// Browser library's New Context with tracing logs where the Playwright trace will be written (when the
// context closes): "Successfully created context and trace file will be saved to: <path>.zip"
const TRACE_MESSAGE = /trace file will be saved to:\s*(\S.*?\.zip)\s*$/i;

function message_trace(text) {
    const match = TRACE_MESSAGE.exec(String(text || ""));
    return match ? match[1] : null;
}

// the traces of a node and everything below it, oldest first
function node_traces(state, node) {
    const traces = [];
    const visit = (current) => {
        for (const message of current.messages || []) {
            const trace = message_trace(message.text);
            if (trace && !traces.includes(trace)) traces.push(trace);
        }
        for (const id of current.children || []) {
            const child = state.steps.get(id);
            if (child) visit(child);
        }
    };
    visit(node);
    return traces;
}

// the traces that cover a test: those its own steps started, and those of a context that a setup of one of
// its suites opened (one context, and so one trace, for all tests of the suite)
function test_traces(state, test) {
    const traces = node_traces(state, test);
    const suites = new Set();
    for (let id = test.parent; id; id = state.suites.get(id)?.parent) suites.add(id);
    for (const step of state.steps.values()) {
        if (!suites.has(step.parent)) continue;
        for (const trace of node_traces(state, step)) if (!traces.includes(trace)) traces.push(trace);
    }
    return traces;
}

export { message_images, resolve_attachment, node_images, detail_images, file_url, message_trace, node_traces, test_traces };
