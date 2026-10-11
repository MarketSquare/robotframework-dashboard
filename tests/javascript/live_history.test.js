import { describe, it, expect } from 'vitest';

import { build_duration_history, usual_duration, slower_than_usual, eta_seconds } from '@js/live/history.js';
import { create_run_state, apply_event } from '@js/live/projection.js';

const historyTests = [
    { full_name: 'Shop.Checkout', elapsed_s: '2.0', skipped: 0 },
    { full_name: 'Shop.Checkout', elapsed_s: '4.0', skipped: 0 },
    { full_name: 'Shop.Checkout', elapsed_s: '0.0', skipped: 1 }, // skipped runs do not count
    { full_name: 'Shop.Login', elapsed_s: '0.01', skipped: 0 },
    { full_name: 'Shop.Search', elapsed_s: '10.0', skipped: 0 },
    { full_name: 'Shop.Pay', elapsed_s: '20.0', skipped: 0 },
];
const history = build_duration_history(historyTests);

function test(longname, status, { elapsed = null, startT = 0 } = {}) {
    return { longname, status, elapsed, startT };
}

function ev(type, fields = {}) {
    return { v: 1, seq: 0, t: 100, type, ...fields };
}

// a run of `planned` tests where the tests in `done` have ended and `running` runs since t=100
function run_state(planned, done = [], running = null) {
    const state = create_run_state();
    apply_event(state, ev('run.started', { run: 'r', rf: '7.5' }));
    apply_event(state, ev('suite.started', { id: 's1', name: 'Shop', longname: 'Shop', tests: planned.length, planned }));
    [...done, ...(running ? [running] : [])].forEach((name, index) => {
        const id = `s1-t${index + 1}`;
        apply_event(state, ev('test.started', { id, parent: 's1', name, longname: `Shop.${name}` }));
        if (name !== running) apply_event(state, ev('test.ended', { id, status: 'PASS', elapsed: 1 }));
    });
    return state;
}

describe('usual durations from the history', () => {
    it('takes the median of earlier non-skipped durations', () => {
        expect(usual_duration(history, test('Shop.Checkout', 'PASS'))).toBe(3);
    });

    it('has nothing for a test without history', () => {
        expect(usual_duration(history, test('Shop.New Test', 'PASS'))).toBeNull();
        expect(slower_than_usual(history, test('Shop.New Test', 'PASS', { elapsed: 100 }), 0)).toBe(false);
    });
});

describe('slower than usual', () => {
    it('flags a finished test above 1.5 times its median', () => {
        expect(slower_than_usual(history, test('Shop.Checkout', 'PASS', { elapsed: 5 }), 0)).toBe(true);
        expect(slower_than_usual(history, test('Shop.Checkout', 'PASS', { elapsed: 4 }), 0)).toBe(false);
    });

    it('flags a running test as soon as it is slower', () => {
        expect(slower_than_usual(history, test('Shop.Checkout', 'RUNNING', { startT: 100 }), 104)).toBe(false);
        expect(slower_than_usual(history, test('Shop.Checkout', 'RUNNING', { startT: 100 }), 105)).toBe(true);
    });

    it('ignores millisecond tests that are only relatively slower', () => {
        expect(slower_than_usual(history, test('Shop.Login', 'PASS', { elapsed: 0.5 }), 0)).toBe(false);
    });
});

describe('remaining time', () => {
    const planned = ['Shop.Checkout', 'Shop.Search', 'Shop.Pay'];

    it('adds up the usual duration of the planned tests that did not start', () => {
        expect(eta_seconds(history, run_state(planned), 100)).toBe(3 + 10 + 20);
    });

    it('follows the selection: only the planned tests count', () => {
        expect(eta_seconds(history, run_state(['Shop.Search']), 100)).toBe(10);
    });

    it('counts what remains of the running test', () => {
        const state = run_state(planned, ['Checkout'], 'Search');
        expect(eta_seconds(history, state, 104)).toBe(20 + (10 - 4));
        expect(eta_seconds(history, state, 150)).toBe(20); // running longer than usual: nothing left of it
    });

    it('uses the average for tests without history, and gives up when most have none', () => {
        expect(eta_seconds(history, run_state(['Shop.Search', 'Shop.Pay', 'Shop.New']), 100)).toBe(10 + 20 + 15);
        expect(eta_seconds(history, run_state(['Shop.Search', 'Shop.New', 'Shop.Other']), 100)).toBeNull();
    });

    it('has no estimate without a plan (older events) or after the run', () => {
        const state = run_state(planned);
        state.planned = null;
        expect(eta_seconds(history, state, 100)).toBeNull();
        const ended = run_state(planned);
        apply_event(ended, ev('run.ended', { status: 'PASS' }));
        expect(eta_seconds(history, ended, 100)).toBeNull();
    });
});
