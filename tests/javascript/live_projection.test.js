import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
    create_run_state,
    apply_event,
    test_counts,
    suite_counts,
    step_label,
    step_tag,
    step_args,
    visible_children,
    step_path,
    LONG_REVEAL,
} from '@js/live/projection.js';

// recorded with robotframework-events on its tests/data/sample.robot (shared fixture)
const fixture = fileURLToPath(new URL('./fixtures/live_sample_events.jsonl', import.meta.url));
const events = readFileSync(fixture, 'utf-8').trim().split('\n').map(line => JSON.parse(line));

function replay(list = events) {
    const state = create_run_state();
    list.forEach(ev => apply_event(state, ev));
    return state;
}

function ev(type, fields = {}) {
    return { v: 1, seq: 0, t: 100, type, ...fields };
}

describe('live projection on a recorded run', () => {
    it('ends with the run status and the test counts', () => {
        const state = replay();
        expect(state.status).toBe('FAIL');
        expect(test_counts(state)).toMatchObject({ PASS: 1, FAIL: 1, SKIP: 1, done: 3, total: 3, pending: 0 });
        expect(state.runningStepId).toBeNull();
    });

    it('builds each test step tree with ids from the events', () => {
        const state = replay();
        const test = state.tests.get('s1-t1');
        expect(test.children[0]).toBe('s1-t1-k1');
        const setup = state.steps.get('s1-t1-k1');
        expect(setup).toMatchObject({ kind: 'SETUP', name: 'Log', owner: 'BuiltIn', status: 'PASS', testId: 's1-t1' });
        expect(setup.messages.map(m => m.text)).toEqual(['test setup']);
    });

    it('marks the failing step and the steps that did not run', () => {
        const state = replay();
        expect(state.steps.get('s1-t2-k2')).toMatchObject({ status: 'FAIL', message: '1 != 2' });
        expect(state.steps.get('s1-t2-k3').status).toBe('NOT RUN');
    });

    it('inherits the source from the suite', () => {
        const state = replay();
        expect(state.steps.get('s1-t1-k2-k1').source).toMatch(/sample\.robot$/);
    });

    it('remembers the result files', () => {
        expect(replay().resultFiles.OUTPUT).toMatch(/output\.xml$/);
    });
});

describe('live projection while running', () => {
    it('tracks the deepest running step and falls back to its parent when it ends', () => {
        const upToNested = events.slice(0, events.findIndex(e => e.type === 'step.started' && e.id === 's1-t1-k2-k2') + 1);
        const state = replay(upToNested);
        expect(state.status).toBe('RUNNING');
        expect(state.runningTestId).toBe('s1-t1');
        expect(state.runningStepId).toBe('s1-t1-k2-k2');
        expect(step_path(state, 's1-t1-k2-k2')).toEqual(['s1-t1-k2', 's1-t1-k2-k2']);

        apply_event(state, ev('step.ended', { id: 's1-t1-k2-k2', status: 'PASS', elapsed: 0.001 }));
        expect(state.runningStepId).toBe('s1-t1-k2');
    });

    it('applies status changes made by a suite teardown', () => {
        const state = replay();
        apply_event(state, ev('status.changed', { id: 's1-t1', item: 'test', status: 'FAIL', message: 'Parent suite teardown failed' }));
        expect(state.tests.get('s1-t1')).toMatchObject({ status: 'FAIL', message: 'Parent suite teardown failed' });
    });

    it('starts over on a new run', () => {
        const state = replay();
        apply_event(state, ev('run.started', { run: 'r2', rf: '7.5' }));
        expect(state.tests.size).toBe(0);
        expect(state.steps.size).toBe(0);
        expect(state.status).toBe('RUNNING');
    });
});

describe('step labels', () => {
    const state = replay();
    const find = kind => [...state.steps.values()].find(s => s.kind === kind);

    it('shows control structure data', () => {
        expect(step_label(find('FOR'))).toBe('${i}    IN RANGE    3');
        expect(step_label(find('ITERATION'))).toBe('${i} = 0');
        expect(step_label(find('IF'))).toBe('${i} == 1');
        expect(step_tag(find('ITERATION'))).toBe('ITER');
        expect(step_tag(find('KEYWORD'))).toBe('');
    });

    it('shows keyword arguments and VAR values', () => {
        expect(step_args(state.steps.get('s1-t1-k1'))).toBe('test setup');
        expect(step_label(find('VAR'))).toBe('${x}');
        expect(step_args(find('VAR'))).toBe('1');
    });
});

describe('loop folding', () => {
    function loop_state(iterations, failAt = -1) {
        const state = create_run_state();
        apply_event(state, ev('run.started', { run: 'r' }));
        apply_event(state, ev('test.started', { id: 's1-t1', parent: 's1', name: 'T' }));
        apply_event(state, ev('step.started', { id: 's1-t1-k1', parent: 's1-t1', kind: 'FOR' }));
        for (let i = 1; i <= iterations; i++) {
            const id = `s1-t1-k1-k${i}`;
            apply_event(state, ev('step.started', { id, parent: 's1-t1-k1', kind: 'ITERATION' }));
            apply_event(state, ev('step.ended', { id, status: i === failAt ? 'FAIL' : 'PASS' }));
        }
        return state;
    }

    it('shows short loops completely', () => {
        const state = loop_state(5);
        expect(visible_children(state, state.steps.get('s1-t1-k1'), new Set())).toHaveLength(5);
    });

    it('folds the middle of long loops but keeps failed and last iterations', () => {
        const state = loop_state(20, 10);
        const visible = visible_children(state, state.steps.get('s1-t1-k1'), new Set());
        expect(visible).toEqual([
            's1-t1-k1-k1', 's1-t1-k1-k2', 's1-t1-k1-k3',
            { folded: 6, loopId: 's1-t1-k1' },
            's1-t1-k1-k10',
            { folded: 9, loopId: 's1-t1-k1' },
            's1-t1-k1-k20',
        ]);
    });

    it('shows every iteration once the loop is opened', () => {
        const state = loop_state(20);
        expect(visible_children(state, state.steps.get('s1-t1-k1'), new Set(['s1-t1-k1']))).toHaveLength(20);
    });
});


describe('long step lists', () => {
    // a test with `count` keywords directly in its body, one of them failed
    function long_test(count, failedIndex) {
        const state = create_run_state();
        apply_event(state, ev('test.started', { id: 's1-t1', parent: 's1', name: 'Big' }));
        for (let i = 1; i <= count; i++) {
            const id = `s1-t1-k${i}`;
            apply_event(state, ev('step.started', { id, parent: 's1-t1', kind: 'KEYWORD', name: 'Log' }));
            apply_event(state, ev('step.ended', { id, status: i === failedIndex ? 'FAIL' : 'PASS', elapsed: 0 }));
        }
        return state;
    }

    it('shows short lists in full', () => {
        const state = long_test(200);
        expect(visible_children(state, state.tests.get('s1-t1'), new Set())).toHaveLength(200);
    });

    it('shows the start, the failed and the last steps of a long list', () => {
        const state = long_test(5000, 2500);
        const visible = visible_children(state, state.tests.get('s1-t1'), new Set());
        const ids = visible.filter((e) => typeof e === 'string');
        expect(ids).toHaveLength(100 + 1 + 3);
        expect(ids).toContain('s1-t1-k2500');
        expect(visible.filter((e) => typeof e === 'object').map((e) => e.folded)).toEqual([2399, 2497]);
        expect(visible.every((e) => typeof e === 'string' || e.long)).toBe(true);
    });

    it('reveals more steps on request', () => {
        const state = long_test(5000);
        const revealed = new Map([['s1-t1', LONG_REVEAL]]);
        const ids = visible_children(state, state.tests.get('s1-t1'), new Set(), revealed).filter((e) => typeof e === 'string');
        expect(ids).toHaveLength(100 + LONG_REVEAL + 3);
    });
});

describe('suite tree', () => {
    it('keeps suites with their tests in run order, and their results', () => {
        const state = replay();
        expect(state.rootSuiteId).toBe('s1');
        const suite = state.suites.get('s1');
        expect(suite).toMatchObject({ name: 'Sample', status: 'FAIL' });
        expect(suite.children).toEqual(['s1-t1', 's1-t2', 's1-t3']);
        expect(suite_counts(state, suite)).toMatchObject({ PASS: 1, FAIL: 1, SKIP: 1, tests: 3 });
    });

    it('nests child suites and counts their tests in the parent', () => {
        const state = create_run_state();
        [
            ev('suite.started', { id: 's1', name: 'Root', tests: 2 }),
            ev('suite.started', { id: 's1-s1', parent: 's1', name: 'A' }),
            ev('test.started', { id: 's1-s1-t1', parent: 's1-s1', name: 'T1' }),
            ev('test.ended', { id: 's1-s1-t1', status: 'PASS', elapsed: 1 }),
            ev('suite.ended', { id: 's1-s1', status: 'PASS', elapsed: 1 }),
            ev('suite.started', { id: 's1-s2', parent: 's1', name: 'B' }),
            ev('test.started', { id: 's1-s2-t1', parent: 's1-s2', name: 'T2' }),
        ].forEach((e) => apply_event(state, e));
        expect(state.suites.get('s1').children).toEqual(['s1-s1', 's1-s2']);
        expect(state.suites.get('s1-s2').status).toBe('RUNNING');
        expect(suite_counts(state, state.suites.get('s1'))).toMatchObject({ PASS: 1, RUNNING: 1, tests: 2 });
    });

    it('applies status changes to suites', () => {
        const state = replay();
        apply_event(state, ev('status.changed', { id: 's1', item: 'suite', status: 'FAIL', message: 'Suite teardown failed' }));
        expect(state.suites.get('s1').message).toBe('Suite teardown failed');
    });
});
