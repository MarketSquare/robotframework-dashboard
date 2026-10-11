import { describe, it, expect } from 'vitest';

import { message_images, resolve_attachment, node_images, detail_images, file_url, message_trace, node_traces, test_traces } from '@js/live/attachments.js';
import { create_run_state, apply_event } from '@js/live/projection.js';

// what Browser library and SeleniumLibrary log
const BROWSER = '</td></tr><tr><td colspan="3"><a href="browser/screenshot/fail-1.png" target="_blank">' +
    '<img src="browser/screenshot/fail-1.png" width="800px"/></a>';
const SELENIUM = '<a href="selenium-screenshot-2.png"><img src=\'selenium-screenshot-2.png\' width="800px"></a>';

describe('images in messages', () => {
    it('finds the img src of Browser and SeleniumLibrary screenshots', () => {
        expect(message_images(BROWSER)).toEqual(['browser/screenshot/fail-1.png']);
        expect(message_images(SELENIUM)).toEqual(['selenium-screenshot-2.png']);
        expect(message_images('<b>no image</b>')).toEqual([]);
        expect(message_images(`${BROWSER}${BROWSER}`)).toHaveLength(1);
    });

    it('resolves relative paths against the output directory', () => {
        expect(resolve_attachment('browser/screenshot/fail-1.png', '/proj/results')).toBe('/proj/results/browser/screenshot/fail-1.png');
        expect(resolve_attachment('browser/screenshot/fail-1.png', 'C:\\proj\\results\\')).toBe('C:\\proj\\results\\browser\\screenshot\\fail-1.png');
        expect(resolve_attachment('C:\\shots\\a.png', '/proj')).toBe('C:\\shots\\a.png');
        expect(resolve_attachment('https://ci/a.png', '/proj')).toBe('https://ci/a.png');
        expect(resolve_attachment('data:image/png;base64,AAA', '/proj')).toBe('data:image/png;base64,AAA');
    });

    it('makes file URLs for a page without a host', () => {
        expect(file_url('C:\\proj\\a b.png')).toBe('file:///C:/proj/a%20b.png');
        expect(file_url('/proj/a.png')).toBe('file:///proj/a.png');
    });
});

describe('images of a test', () => {
    function ev(type, fields) {
        return { v: 1, seq: 0, t: 1, type, ...fields };
    }

    it('collects the images of the test and the steps below it, in order', () => {
        const state = create_run_state();
        [
            ev('suite.started', { id: 's1', name: 'S', tests: 1 }),
            ev('test.started', { id: 's1-t1', parent: 's1', name: 'T' }),
            ev('step.started', { id: 's1-t1-k1', parent: 's1-t1', kind: 'KEYWORD', name: 'Click' }),
            ev('message.logged', { parent: 's1-t1-k1', level: 'FAIL', text: BROWSER, html: true }),
            ev('message.logged', { parent: 's1-t1-k1', level: 'INFO', text: '<img src="not-html.png">' }),
            ev('step.ended', { id: 's1-t1-k1', status: 'FAIL', elapsed: 1 }),
            ev('message.logged', { parent: 's1-t1', level: 'INFO', text: SELENIUM, html: true }),
        ].forEach((e) => apply_event(state, e));
        const test = state.tests.get('s1-t1');
        expect(node_images(state, test, '/out')).toEqual([
            '/out/selenium-screenshot-2.png',
            '/out/browser/screenshot/fail-1.png',
        ]);
        expect(node_images(state, state.steps.get('s1-t1-k1'), '/out')).toEqual(['/out/browser/screenshot/fail-1.png']);
    });
});


describe('screenshots of a failure', () => {
    it('shows the run-on-failure screenshot of the teardown with the failed step', () => {
        const state = create_run_state();
        const e = (type, fields) => ({ v: 1, seq: 0, t: 1, type, ...fields });
        [
            e('suite.started', { id: 's1', name: 'S', tests: 1 }),
            e('test.started', { id: 's1-t1', parent: 's1', name: 'T' }),
            e('step.started', { id: 's1-t1-k1', parent: 's1-t1', kind: 'KEYWORD', name: 'Should Be True' }),
            e('step.ended', { id: 's1-t1-k1', status: 'FAIL', elapsed: 0 }),
            e('step.started', { id: 's1-t1-k2', parent: 's1-t1', kind: 'TEARDOWN', name: 'Take Screenshot' }),
            e('message.logged', { parent: 's1-t1-k2', level: 'INFO', text: '<img src="shots/fail.png">', html: true }),
            e('step.ended', { id: 's1-t1-k2', status: 'PASS', elapsed: 0 }),
        ].forEach((ev) => apply_event(state, ev));
        expect(detail_images(state, state.steps.get('s1-t1-k1'), '/out')).toEqual(['/out/shots/fail.png']);
        expect(node_images(state, state.steps.get('s1-t1-k1'), '/out')).toEqual([]);
    });
});

describe('Playwright traces of Browser library', () => {
    const TRACE = 'C:\\out\\browser\\traces\\trace_context=53c7ab64.zip';
    const message = `Successfully created context and trace file will be saved to: ${TRACE}`;

    it('reads the trace path from the New Context message', () => {
        expect(message_trace(message)).toBe(TRACE);
        expect(message_trace('Successfully created context. ')).toBeNull();
    });

    it('a test has the traces of its own steps and of the setup of its suites', () => {
        const state = create_run_state();
        [
            { type: 'suite.started', id: 's1', name: 'S', longname: 'S', tests: 2 },
            { type: 'step.started', id: 's1-k1', parent: 's1', kind: 'SETUP', name: 'New Context' },
            { type: 'message.logged', parent: 's1-k1', level: 'INFO', text: message },
            { type: 'test.started', id: 's1-t1', parent: 's1', name: 'T', longname: 'S.T' },
            { type: 'step.started', id: 's1-t1-k1', parent: 's1-t1', kind: 'KEYWORD', name: 'New Context' },
            { type: 'message.logged', parent: 's1-t1-k1', level: 'INFO', text: message.replace('53c7ab64', 'aaaa') },
        ].forEach((e, i) => apply_event(state, { v: 1, seq: i + 1, t: 100, ...e }));
        const test = state.tests.get('s1-t1');
        expect(node_traces(state, test)).toEqual([TRACE.replace('53c7ab64', 'aaaa')]);
        expect(test_traces(state, test)).toEqual([TRACE.replace('53c7ab64', 'aaaa'), TRACE]);
    });
});
