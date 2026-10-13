import { describe, it, expect } from 'vitest';

import { playback_frames, playback_span, playback_frame_at } from '@js/live/playback.js';
import { create_run_state, apply_event } from '@js/live/projection.js';

function ev(type, t, fields) {
    return { v: 1, seq: 0, t, type, ...fields };
}

// Log In (user keyword: Fill Text, Click), Get Text (no screenshot), Click, as robotframework-events
// emits them with the option screenshots=actions
function state_with_frames() {
    const state = create_run_state();
    [
        ev('run.started', 1, { run: 'r', rf: '7.4', outputdir: '/out' }),
        ev('suite.started', 1, { id: 's1', name: 'Shop', longname: 'Shop', tests: 2 }),
        ev('test.started', 1, { id: 's1-t1', parent: 's1', name: 'Buy', longname: 'Shop.Buy' }),
        ev('step.started', 2, { id: 's1-t1-k1', parent: 's1-t1', kind: 'KEYWORD', name: 'Log In' }),
        ev('step.started', 2, { id: 's1-t1-k1-k1', parent: 's1-t1-k1', kind: 'KEYWORD', name: 'Fill Text', owner: 'Browser' }),
        ev('step.ended', 3, { id: 's1-t1-k1-k1', status: 'PASS', elapsed: 1 }),
        ev('step.screenshot', 3, { id: 's1-t1-k1-k1', path: 'rfevents-screenshots/00001.jpeg', library: 'Browser' }),
        ev('step.started', 3, { id: 's1-t1-k1-k2', parent: 's1-t1-k1', kind: 'KEYWORD', name: 'Click', owner: 'Browser' }),
        ev('step.ended', 4, { id: 's1-t1-k1-k2', status: 'PASS', elapsed: 1 }),
        ev('step.screenshot', 4, { id: 's1-t1-k1-k2', path: 'rfevents-screenshots/00002.jpeg', library: 'Browser' }),
        ev('step.ended', 4, { id: 's1-t1-k1', status: 'PASS', elapsed: 2 }),
        ev('step.started', 5, { id: 's1-t1-k2', parent: 's1-t1', kind: 'KEYWORD', name: 'Get Text', owner: 'Browser' }),
        ev('step.ended', 5, { id: 's1-t1-k2', status: 'PASS', elapsed: 0 }),
        ev('step.started', 6, { id: 's1-t1-k3', parent: 's1-t1', kind: 'KEYWORD', name: 'Click', owner: 'Browser' }),
        ev('step.ended', 7, { id: 's1-t1-k3', status: 'FAIL', elapsed: 1 }),
        ev('step.screenshot', 7, { id: 's1-t1-k3', path: 'rfevents-screenshots/00003.jpeg', library: 'Browser' }),
        ev('test.ended', 7, { id: 's1-t1', status: 'FAIL', elapsed: 6 }),
        ev('test.started', 8, { id: 's1-t2', parent: 's1', name: 'No Browser', longname: 'Shop.No Browser' }),
        ev('step.started', 8, { id: 's1-t2-k1', parent: 's1-t2', kind: 'KEYWORD', name: 'Log', owner: 'BuiltIn' }),
        ev('step.ended', 8, { id: 's1-t2-k1', status: 'PASS', elapsed: 0 }),
        ev('test.ended', 8, { id: 's1-t2', status: 'PASS', elapsed: 0 }),
    ].forEach((e) => apply_event(state, e));
    return state;
}

describe('screenshot timeline', () => {
    it('lists the screenshots of a test with their time, path and status', () => {
        const state = state_with_frames();
        expect(playback_frames(state, 's1-t1')).toEqual([
            { stepId: 's1-t1-k1-k1', t: 3, path: 'rfevents-screenshots/00001.jpeg', status: 'PASS' },
            { stepId: 's1-t1-k1-k2', t: 4, path: 'rfevents-screenshots/00002.jpeg', status: 'PASS' },
            { stepId: 's1-t1-k3', t: 7, path: 'rfevents-screenshots/00003.jpeg', status: 'FAIL' },
        ]);
        // no timeline for a test without screenshots
        expect(playback_frames(state, 's1-t2')).toEqual([]);
        expect(playback_frames(state, null)).toEqual([]);
    });

    it('covers the test, up to now while it runs', () => {
        const state = state_with_frames();
        expect(playback_span(state.tests.get('s1-t1'), 100)).toEqual({ start: 1, end: 7 });
        const running = { ...state.tests.get('s1-t1'), elapsed: null };
        expect(playback_span(running, 9)).toEqual({ start: 1, end: 9 });
    });

    it('shows the last screenshot taken by a moment', () => {
        const frames = playback_frames(state_with_frames(), 's1-t1');
        expect(playback_frame_at(frames, 2)).toBe(-1); // before the first one
        expect(playback_frame_at(frames, 3)).toBe(0);
        expect(playback_frame_at(frames, 5.5)).toBe(1);
        expect(playback_frame_at(frames, 99)).toBe(2);
    });

    it('starts again with the next run', () => {
        const state = state_with_frames();
        apply_event(state, ev('run.started', 9, { run: 'r2', rf: '7.4' }));
        expect(playback_frames(state, 's1-t1')).toEqual([]);
    });
});

describe('screenshot warnings', () => {
    it('keeps the libraries whose screenshots stopped, until the next run', () => {
        const state = create_run_state();
        apply_event(state, ev('run.started', 1, { run: 'r', rf: '7.4' }));
        apply_event(state, ev('screenshot.unavailable', 2, { library: 'SikuliLibrary', version: '2.0.3', reason: 'its API does not fit' }));
        expect(state.screenshotWarnings).toEqual([{ library: 'SikuliLibrary', version: '2.0.3', reason: 'its API does not fit' }]);
        apply_event(state, ev('run.started', 3, { run: 'r2', rf: '7.4' }));
        expect(state.screenshotWarnings).toEqual([]);
    });
});
