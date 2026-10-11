// Host bridge: lets an editor that embeds the dashboard talk to the page. Two hosts are known:
// - VS Code webviews: the page talks through acquireVsCodeApi().postMessage(message)
// - JCEF browsers (PyCharm): the plugin defines window.robotdashboardHost = { postMessage(json) } before
//   the page's scripts run (for example a JBCefJSQuery wrapped in a small script) and sends messages
//   to the page with window.postMessage(message, "*")
// In a plain browser there is no host and post() does nothing.
//
// host -> page messages: { type: "events", events: [...] }, { type: "reset" }, { type: "showPage", page },
//   { type: "replay", events, name }, { type: "replayError", message },
//   { type: "dashboardData", runs, suites, tests, keywords, exceptions } (--embed, answer to "dataRequest")
// page -> host messages: { type: "ready" }, { type: "openSource", source, lineno }, { type: "openLog", path },
//   { type: "replayEvents", paths, name }, { type: "dataRequest" } (--embed: the page waits for its data),
//   { type: "openTrace", path } (a Playwright trace zip of Browser library: open it in the trace viewer)
//   (openLog: path as stored by robotdashboard, absolute or relative to the dashboard file, optionally "#<id>")

const vscodeApi = typeof acquireVsCodeApi === "function" ? acquireVsCodeApi() : null;

// looked up on every use: a JCEF host may define it after this script was parsed, but before it is used
function jcef_host() {
    const candidate = typeof window !== "undefined" ? window.robotdashboardHost : undefined;
    return candidate && typeof candidate.postMessage === "function" ? candidate : null;
}

const host = {
    get present() {
        return vscodeApi !== null || jcef_host() !== null;
    },
    get kind() {
        if (vscodeApi) return "vscode";
        return jcef_host() ? "jcef" : null;
    },
    post(message) {
        if (vscodeApi) {
            vscodeApi.postMessage(message);
            return;
        }
        const jcef = jcef_host();
        if (jcef) jcef.postMessage(JSON.stringify(message));
    },
    onMessage(handler) {
        window.addEventListener("message", (event) => {
            if (event.data && typeof event.data.type === "string") handler(event.data);
        });
    },
    // resolves with the first host message of this type
    next(type) {
        return new Promise((resolve) => {
            const listener = (event) => {
                if (event.data && event.data.type === type) {
                    window.removeEventListener("message", listener);
                    resolve(event.data);
                }
            };
            window.addEventListener("message", listener);
        });
    },
};

export { host };
