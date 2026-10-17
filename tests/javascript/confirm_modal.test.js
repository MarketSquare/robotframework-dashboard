import { describe, it, expect, beforeEach } from 'vitest';

// a minimal element that dispatches the listeners added to it
function make_element() {
    const listeners = {};
    return {
        innerHTML: '',
        classList: { add() {}, remove() {} },
        addEventListener: (type, handler) => { (listeners[type] ??= []).push(handler); },
        removeEventListener: (type, handler) => { listeners[type] = (listeners[type] ?? []).filter(item => item !== handler); },
        fire(type) { [...(listeners[type] ?? [])].forEach(handler => handler()); },
        count(type) { return (listeners[type] ?? []).length; },
    };
}

let elements;
let created;
beforeEach(() => {
    elements = { confirmModal: make_element(), confirmModalMessage: make_element(), confirmCancel: make_element(), confirmOk: make_element() };
    created = 0;
    const instances = new Map();
    globalThis.document = { getElementById: (id) => elements[id], querySelectorAll: () => [] };
    globalThis.bootstrap = {
        Modal: {
            getOrCreateInstance(element) {
                if (!instances.has(element)) {
                    created++;
                    instances.set(element, { show() {}, hide: () => element.fire('hidden.bs.modal') });
                }
                return instances.get(element);
            },
        },
    };
});

const { confirm_action } = await import('@js/eventlisteners/confirm_modal.js');

describe('confirm_action', () => {
    it('resolves false when the modal is closed with Escape or the backdrop', async () => {
        const answer = confirm_action('Delete?');
        elements.confirmModal.fire('hidden.bs.modal');
        expect(await answer).toBe(false);
        expect(elements.confirmOk.count('click')).toBe(0);
    });

    it('resolves true on OK and reuses one modal instance', async () => {
        const first = confirm_action('Delete?');
        elements.confirmOk.fire('click');
        expect(await first).toBe(true);
        const second = confirm_action('Delete again?');
        elements.confirmCancel.fire('click');
        expect(await second).toBe(false);
        expect(created).toBe(1);
    });
});
