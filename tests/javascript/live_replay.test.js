import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

import { events_paths_for_output, parse_events_text, read_events_file, replay_state_at } from '@js/live/replay.js';
import { create_run_state, apply_event, test_counts } from '@js/live/projection.js';

// recorded with robotframework-events on its tests/data/sample.robot (shared fixture)
const fixture = fileURLToPath(new URL('./fixtures/live_sample_events.jsonl', import.meta.url));
const text = readFileSync(fixture, 'utf-8');
const events = parse_events_text(text);

describe('events file of an output file', () => {
    it('replaces output with events, like log.html, gzipped first', () => {
        expect(events_paths_for_output('/runs/a/output.xml')).toEqual(['/runs/a/events.jsonl.gz', '/runs/a/events.jsonl']);
        expect(events_paths_for_output('results/output-20261010.json')).toEqual([
            'results/events-20261010.jsonl.gz',
            'results/events-20261010.jsonl',
        ]);
    });

    it('keeps Windows separators and relative paths', () => {
        expect(events_paths_for_output('C:\\runs\\output.xml')[1]).toBe('C:\\runs\\events.jsonl');
        expect(events_paths_for_output('../runs/smoke.xml')[1]).toBe('../runs/smoke.jsonl');
    });

    it('has no events file without an output file', () => {
        expect(events_paths_for_output('')).toEqual([]);
        expect(events_paths_for_output('http://server/log.html')).toEqual([]);
    });
});

describe('reading events files', () => {
    it('parses every line of the recorded run', () => {
        expect(events.length).toBe(text.trim().split('\n').length);
        expect(events[0].type).toBe('run.started');
        expect(events.at(-1).type).toBe('run.ended');
    });

    it('skips damaged lines, such as a line cut off by a crash', () => {
        const damaged = `${text.split('\n')[0]}\n{"v":1,"seq":2\nnot json\n\n[1,2]\n`;
        expect(parse_events_text(damaged).map((e) => e.type)).toEqual(['run.started']);
    });

    it('reads plain and gzipped files from a file picker', async () => {
        const plain = new File([text], 'events.jsonl');
        const gzipped = new File([gzipSync(text)], 'events.jsonl.gz');
        expect(await read_events_file(plain)).toEqual(events);
        expect(await read_events_file(gzipped)).toEqual(events);
    });
});

describe('replay states', () => {
    function replayed(index) {
        const state = create_run_state();
        events.slice(0, index + 1).forEach((e) => apply_event(state, e));
        return state;
    }

    it('ends at the final state of the run', () => {
        const state = replay_state_at(events, events.length - 1);
        expect(state.status).toBe('FAIL');
        expect(test_counts(state)).toMatchObject({ PASS: 1, FAIL: 1, SKIP: 1, done: 3 });
    });

    it('shows the run at any moment, moving forward or back', () => {
        const middle = events.findIndex((e) => e.type === 'step.started' && e.id === 's1-t1-k2-k2');
        let state = replay_state_at(events, events.length - 1);
        state = replay_state_at(events, middle, state, events.length - 1); // back
        expect(state.status).toBe('RUNNING');
        expect(state.runningStepId).toBe('s1-t1-k2-k2');
        expect(state.tests.size).toBe(1);

        state = replay_state_at(events, middle + 20, state, middle); // forward from there
        expect([...state.steps.keys()]).toEqual([...replayed(middle + 20).steps.keys()]);
        expect(state.lastT).toBe(events[middle + 20].t);
    });
});
