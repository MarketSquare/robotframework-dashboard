import { describe, it, expect, vi } from 'vitest';

vi.mock('@js/variables/globals.js', () => ({ inFullscreen: false, inFullscreenGraph: '' }));
vi.mock('@js/variables/settings.js', () => ({ settings: { show: { rounding: 6 } } }));
vi.mock('@js/variables/chartconfig.js', () => ({ barConfig: {} }));

import { get_test_stats_data } from '@js/graph_data/stats.js';

const RECOVERED = '[{"status": "FAIL", "message": "boom"}, {"status": "PASS", "message": ""}]';
const HARD_FAIL = '[{"status": "FAIL", "message": "a"}, {"status": "FAIL", "message": "b"}]';

function makeTest(overrides) {
    return { name: 'Test', passed: 0, failed: 0, skipped: 0, elapsed_s: 1, attempts: '', ...overrides };
}

describe('get_test_stats_data', () => {
    it('counts passed, failed and skipped tests with percentages', () => {
        const data = get_test_stats_data([
            makeTest({ name: 'A', passed: 1 }),
            makeTest({ name: 'B', failed: 1 }),
            makeTest({ name: 'C', skipped: 1 }),
            makeTest({ name: 'D', passed: 1 }),
        ]);
        expect(data.totalTests).toBe(4);
        expect(data.uniqueTests).toBe(4);
        expect(data.passedTests).toBe('2 (50%)');
        expect(data.failedTests).toBe('1 (25%)');
        expect(data.skippedTests).toBe('1 (25%)');
        expect(data.passRate).toBe('50%');
    });

    it('reports the rerun history as widgets values', () => {
        const data = get_test_stats_data([
            makeTest({ name: 'A', passed: 1, attempts: RECOVERED }),
            makeTest({ name: 'B', failed: 1, attempts: HARD_FAIL }),
            makeTest({ name: 'C', passed: 1 }),
            makeTest({ name: 'D', passed: 1 }),
        ]);
        expect(data.reranTests).toBe(2);
        expect(data.recoveredOnRerun).toBe('1 (25%)');
        expect(data.failedAllAttempts).toBe('1 (25%)');
    });

    it('handles an empty list', () => {
        const data = get_test_stats_data([]);
        expect(data.passRate).toBe('N/A');
        expect(data.reranTests).toBe(0);
        expect(data.recoveredOnRerun).toBe('0 (0%)');
    });
});
