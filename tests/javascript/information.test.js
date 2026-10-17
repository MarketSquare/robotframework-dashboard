import { describe, it, expect, vi } from 'vitest';

vi.mock('@js/variables/information.js', () => ({ informationMap: {} }));
vi.mock('@js/variables/svg.js', () => ({ getActiveDecorationName: () => null }));

const listeners = [];
globalThis.document = {
    getElementById: () => null,
    querySelectorAll: () => [],
    addEventListener: (type) => listeners.push(type),
};

const { setup_information_popups } = await import('@js/information.js');

describe('setup_information_popups', () => {
    it('adds the delegated document listeners once, however often the page is rebuilt', () => {
        setup_information_popups();
        setup_information_popups();
        setup_information_popups();
        expect(listeners.filter(type => type === 'mouseover')).toHaveLength(1);
        expect(listeners.filter(type => type === 'click')).toHaveLength(1);
    });
});
