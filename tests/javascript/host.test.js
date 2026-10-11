import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// host.js reads acquireVsCodeApi when it loads and window.robotdashboardHost on every use
async function load_host() {
    vi.resetModules();
    return (await import('@js/host.js')).host;
}

function message(data) {
    return Object.assign(new Event('message'), { data });
}

describe('host bridge', () => {
    beforeEach(() => {
        globalThis.window = new EventTarget();
    });
    afterEach(() => {
        delete globalThis.window;
        delete globalThis.acquireVsCodeApi;
    });

    it('has no host in a plain browser, and posting does nothing', async () => {
        const host = await load_host();
        expect(host.present).toBe(false);
        expect(host.kind).toBeNull();
        expect(() => host.post({ type: 'ready' })).not.toThrow();
    });

    it('talks to VS Code through acquireVsCodeApi', async () => {
        const sent = [];
        globalThis.acquireVsCodeApi = () => ({ postMessage: (m) => sent.push(m) });
        const host = await load_host();
        host.post({ type: 'ready' });
        expect(host.kind).toBe('vscode');
        expect(sent).toEqual([{ type: 'ready' }]);
    });

    it('talks to a JCEF host (PyCharm) with JSON strings, also when it appears after loading', async () => {
        const host = await load_host();
        expect(host.present).toBe(false);
        const sent = [];
        window.robotdashboardHost = { postMessage: (json) => sent.push(json) };
        host.post({ type: 'dataRequest' });
        expect(host.kind).toBe('jcef');
        expect(sent).toEqual(['{"type":"dataRequest"}']);
    });

    it('waits for the first message of a type', async () => {
        const host = await load_host();
        const answer = host.next('dashboardData');
        window.dispatchEvent(message({ type: 'events', events: [] }));
        window.dispatchEvent(message({ type: 'dashboardData', runs: 'abc' }));
        window.dispatchEvent(message({ type: 'dashboardData', runs: 'later' }));
        expect((await answer).runs).toBe('abc');
    });

    it('passes host messages with a type to the handler', async () => {
        const host = await load_host();
        const received = [];
        host.onMessage((m) => received.push(m.type));
        window.dispatchEvent(message({ type: 'reset' }));
        window.dispatchEvent(message('not a host message'));
        expect(received).toEqual(['reset']);
    });
});
