import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// The render-state hook the robot tests inject into the dashboard page (not part of the shipped JS).
// The file is an arrow function; evaluate it with stubbed browser globals, as Playwright would.
const SCRIPT = readFileSync(resolve(__dirname, '../robot/resources/scripts/dashboard_idle.js'), 'utf-8');

describe('dashboard_idle.js (test hook)', () => {
    const state = {};
    let win;
    const reset = () => Object.assign(state, {
        visible: {}, animated: 0, overlayOrModal: null, chartsRunning: false,
    });
    beforeEach(() => {
        reset();
        state.now = 1000;
        win = {};
        const $ = (selector) => ({
            is: () => !!state.visible[selector],
            length: selector === ':animated' ? state.animated : 0,
        });
        const document = { querySelector: () => state.overlayOrModal };
        const Chart = { instances: { a: {} }, animator: { running: () => state.chartsRunning } };
        const performance = { now: () => state.now };
        const install = new Function('window', '$', 'document', 'Chart', 'performance', `return (${SCRIPT});`);
        install(win, $, document, Chart, performance)();
    });
    // first quiet call after a busy one
    const settle = () => { state.now += 100; return win.dashboard_is_idle(); };

    it('defines window.dashboard_is_idle', () => {
        expect(typeof win.dashboard_is_idle).toBe('function');
    });

    it('is idle when nothing is rendering', () => {
        expect(win.dashboard_is_idle()).toBe(true);
    });

    it('returns a boolean, never a Promise (Playwright would treat a Promise as truthy)', () => {
        expect(win.dashboard_is_idle()).not.toBeInstanceOf(Promise);
    });

    it.each([
        ['page spinner', () => { state.visible['#loading'] = true; }],
        ['filter overlay', () => { state.visible['#filterLoadingOverlay'] = true; }],
        ['graph overlay / modal / backdrop', () => { state.overlayOrModal = {}; }],
        ['jQuery fade', () => { state.animated = 1; }],
        ['Chart.js animation', () => { state.chartsRunning = true; }],
    ])('is busy while %s is active and idle again 50 ms after it ends', (_, makeBusy) => {
        makeBusy();
        expect(win.dashboard_is_idle()).toBe(false);
        reset();
        // busy ended, but not quiet for 50 ms yet
        state.now += 20;
        expect(win.dashboard_is_idle()).toBe(false);
        expect(settle()).toBe(true);
    });
});
