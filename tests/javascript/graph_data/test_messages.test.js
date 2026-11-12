import { describe, it, expect, vi } from 'vitest';

vi.mock('@js/variables/settings.js', () => ({ settings: { switch: {}, show: {} }, get_run_label: (item) => item.run_start }));
vi.mock('@js/variables/globals.js', () => ({ inFullscreen: false, inFullscreenGraph: '', filteredRuns: [] }));
vi.mock('@js/variables/chartconfig.js', () => ({ barConfig: {} }));

import { get_test_messages } from '@js/graph_data/test_messages.js';

const test = (overrides) => ({
    name: 'Login', full_name: 'Shop.Login', id: 's1-t1', passed: 0, failed: 1, skipped: 0,
    message: '', attempts: '', ...overrides,
});

describe('get_test_messages', () => {
    it('lists the runs of the test with a message, newest first', () => {
        const tests = [
            test({ run_start: '2025-01-15 10:00:00', message: 'first failure' }),
            test({ run_start: '2025-01-17 10:00:00+02:00', message: 'latest failure' }),
            test({ run_start: '2025-01-16 10:00:00', passed: 1, failed: 0 }),
            test({ run_start: '2025-01-16 10:00:00', name: 'Other', full_name: 'Shop.Other', message: 'other test' }),
        ];
        const runs = get_test_messages(tests, row => row.name === 'Login');
        expect(runs.map(run => run.message)).toEqual(['latest failure', 'first failure']);
        expect(runs[0]).toEqual({
            runStart: '2025-01-17 10:00:00+02:00', id: 's1-t1', fullName: 'Shop.Login',
            status: 'FAIL', message: 'latest failure', attempts: [],
        });
    });

    it('keeps the full message, however long', () => {
        const message = 'x'.repeat(5000);
        const [run] = get_test_messages([test({ run_start: '2025-01-15 10:00:00', message })], () => true);
        expect(run.message).toBe(message);
    });

    it('includes a run that passed on a rerun, with its attempts', () => {
        const attempts = [{ status: 'FAIL', message: 'Timeout' }, { status: 'PASS', message: '' }];
        const runs = get_test_messages([
            test({ run_start: '2025-01-15 10:00:00', passed: 1, failed: 0, attempts: JSON.stringify(attempts) }),
        ], () => true);
        expect(runs).toHaveLength(1);
        expect(runs[0].status).toBe('PASS');
        expect(runs[0].attempts).toEqual(attempts);
    });

    it('gives the skip status and an empty list without messages', () => {
        const skipped = test({ run_start: '2025-01-15 10:00:00', failed: 0, skipped: 1, message: 'skipped' });
        expect(get_test_messages([skipped], () => true)[0].status).toBe('SKIP');
        expect(get_test_messages([test({ run_start: '2025-01-15 10:00:00' })], () => true)).toEqual([]);
    });
});
