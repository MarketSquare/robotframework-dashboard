import { describe, it, expect, vi } from 'vitest';

// Mock dependencies that localstorage.js imports
vi.mock('@js/common.js', () => ({
    add_alert: vi.fn(),
    close_alert: vi.fn(),
    camelcase_to_underscore: (str) =>
        str.replace(/([A-Z]+)/g, '_$1').replace(/^_/, '').toLowerCase(),
}));
vi.mock('@js/variables/data.js', () => import('./mocks/data.js'));
vi.mock('@js/variables/globals.js', () => import('./mocks/globals.js'));
vi.mock('@js/variables/graphs.js', () => import('./mocks/graphs.js'));

// We need to test merge_deep and related functions.
// Since they use structuredClone (available in Node 17+), we can import them.

describe('localstorage.js pure logic', () => {
    describe('merge_deep logic', () => {
        // Re-implement the pure logic from localstorage.js to test it
        function isObject(v) {
            return v && typeof v === 'object' && !Array.isArray(v);
        }

        function merge_objects_base(local, defaults) {
            const merged = {};
            for (const key of new Set([...Object.keys(defaults), ...Object.keys(local)])) {
                if (!(key in defaults)) continue;
                if (!(key in local)) {
                    merged[key] = structuredClone(defaults[key]);
                    continue;
                }
                if (isObject(local[key]) && isObject(defaults[key])) {
                    merged[key] = merge_objects_base(local[key], defaults[key]);
                } else {
                    merged[key] = structuredClone(local[key]);
                }
            }
            return merged;
        }

        it('merges two flat objects keeping local values', () => {
            const local = { a: 1, b: 2 };
            const defaults = { a: 10, b: 20, c: 30 };
            const result = merge_objects_base(local, defaults);
            expect(result).toEqual({ a: 1, b: 2, c: 30 });
        });

        it('removes keys not in defaults', () => {
            const local = { a: 1, b: 2, extra: 99 };
            const defaults = { a: 10, b: 20 };
            const result = merge_objects_base(local, defaults);
            expect(result).toEqual({ a: 1, b: 2 });
            expect(result).not.toHaveProperty('extra');
        });

        it('adds missing defaults', () => {
            const local = { a: 1 };
            const defaults = { a: 10, b: 20 };
            const result = merge_objects_base(local, defaults);
            expect(result).toEqual({ a: 1, b: 20 });
        });

        it('merges nested objects recursively', () => {
            const local = { nested: { a: 1 } };
            const defaults = { nested: { a: 10, b: 20 } };
            const result = merge_objects_base(local, defaults);
            expect(result).toEqual({ nested: { a: 1, b: 20 } });
        });

        it('deep clones default values', () => {
            const defaults = { nested: { a: [1, 2, 3] } };
            const local = {};
            const result = merge_objects_base(local, defaults);
            result.nested.a.push(4);
            expect(defaults.nested.a).toEqual([1, 2, 3]);
        });

        it('deep clones local values', () => {
            const local = { arr: [1, 2, 3] };
            const defaults = { arr: [] };
            const result = merge_objects_base(local, defaults);
            result.arr.push(4);
            expect(local.arr).toEqual([1, 2, 3]);
        });

        it('handles empty objects', () => {
            expect(merge_objects_base({}, {})).toEqual({});
            expect(merge_objects_base({}, { a: 1 })).toEqual({ a: 1 });
            expect(merge_objects_base({ a: 1 }, {})).toEqual({});
        });
    });

    describe('set_nested_setting logic', () => {
        function set_nested_setting(obj, path, value) {
            const keys = path.split('.');
            const lastKey = keys.pop();
            let deep = obj;
            keys.forEach(k => {
                if (!deep.hasOwnProperty(k) || typeof deep[k] !== 'object') {
                    deep[k] = {};
                }
                deep = deep[k];
            });
            deep[lastKey] = value;
        }

        it('sets a top-level value', () => {
            const obj = { a: 1 };
            set_nested_setting(obj, 'a', 2);
            expect(obj.a).toBe(2);
        });

        it('sets a nested value', () => {
            const obj = { nested: { a: 1 } };
            set_nested_setting(obj, 'nested.a', 2);
            expect(obj.nested.a).toBe(2);
        });

        it('creates intermediate objects if missing', () => {
            const obj = {};
            set_nested_setting(obj, 'a.b.c', 42);
            expect(obj.a.b.c).toBe(42);
        });

        it('overwrites non-object intermediate', () => {
            const obj = { a: 'string' };
            set_nested_setting(obj, 'a.b', 42);
            expect(obj.a.b).toBe(42);
        });
    });

    describe('merge_deep logic', () => {
        // Reimplements the full merge_deep from localstorage.js
        function isObject(v) {
            return v && typeof v === 'object' && !Array.isArray(v);
        }

        function merge_objects_base(local, defaults) {
            const merged = {};
            for (const key of new Set([...Object.keys(defaults), ...Object.keys(local)])) {
                if (!(key in defaults)) continue;
                if (!(key in local)) {
                    merged[key] = structuredClone(defaults[key]);
                    continue;
                }
                if (isObject(local[key]) && isObject(defaults[key])) {
                    merged[key] = merge_objects_base(local[key], defaults[key]);
                } else {
                    merged[key] = structuredClone(local[key]);
                }
            }
            return merged;
        }

        function merge_view_section_or_graph(local, defaults, page = null) {
            const result = { show: [], hide: [] };
            const isOverview = page === 'overview';
            const allowed = new Set([...defaults.show, ...defaults.hide]);
            const localShow = new Set(local.show || []);
            const localHide = new Set(local.hide || []);
            for (const val of [...localShow]) {
                if (!allowed.has(val) && !isOverview) localShow.delete(val);
            }
            for (const val of [...localHide]) {
                if (!allowed.has(val)) localHide.delete(val);
            }
            for (const val of allowed) {
                if (!localShow.has(val) && !localHide.has(val)) localShow.add(val);
            }
            result.show = [...localShow];
            result.hide = [...localHide];
            return result;
        }

        function merge_view(localView, defaultView) {
            const result = {};
            for (const page of Object.keys(defaultView)) {
                const defaultPage = defaultView[page];
                const localPage = localView[page] || {};
                result[page] = {
                    sections: merge_view_section_or_graph(
                        localPage.sections || {},
                        defaultPage.sections,
                        page
                    ),
                    graphs: merge_view_section_or_graph(
                        localPage.graphs || {},
                        defaultPage.graphs
                    ),
                };
            }
            return result;
        }

        function merge_theme_colors(local, defaults) {
            const result = merge_objects_base(local, defaults);
            if (local.custom) {
                result.custom = structuredClone(local.custom);
            }
            return result;
        }

        function merge_layout(localLayout, mergedDefaults) {
            if (!localLayout) return localLayout;
            const result = structuredClone(localLayout);
            const allowedGraphs = collect_allowed_graphs(mergedDefaults);
            for (const key of Object.keys(result)) {
                try {
                    const arr = JSON.parse(result[key]);
                    const filtered = arr.filter(item => allowedGraphs.has(item.id));
                    result[key] = JSON.stringify(filtered);
                } catch (e) {
                    delete result[key];
                }
            }
            return result;
        }

        function collect_allowed_graphs(settings) {
            const allowed = new Set();
            const extract = (obj) => {
                if (!obj) return;
                for (const key of ['show', 'hide']) {
                    if (Array.isArray(obj[key])) {
                        for (const g of obj[key]) allowed.add(g);
                    }
                }
            };
            if (settings.view.dashboard) extract(settings.view.dashboard.graphs);
            if (settings.view.compare) extract(settings.view.compare.graphs);
            return allowed;
        }

        function merge_deep(local, defaults) {
            const result = {};
            for (const key of new Set([...Object.keys(defaults), ...Object.keys(local)])) {
                const defaultVal = defaults[key];
                const localVal = local[key];
                if (key !== 'layouts' && key !== 'libraries' && key !== 'theme' && key !== 'filterProfiles' && defaultVal === undefined && localVal !== undefined) {
                    continue;
                }
                if (defaultVal !== undefined && localVal === undefined) {
                    result[key] = structuredClone(defaultVal);
                    continue;
                }
                if (key === 'view') {
                    result[key] = merge_view(localVal, defaultVal);
                } else if (key === 'layouts') {
                    result[key] = merge_layout(localVal, defaults);
                } else if (key === 'theme_colors') {
                    result[key] = merge_theme_colors(localVal, defaultVal);
                } else if (isObject(localVal) && isObject(defaultVal)) {
                    result[key] = merge_objects_base(localVal, defaultVal);
                } else {
                    result[key] = structuredClone(localVal);
                }
            }
            return result;
        }

        describe('merge_view_section_or_graph', () => {
            it('adds missing defaults to show', () => {
                const local = { show: ['A'], hide: [] };
                const defaults = { show: ['A', 'B', 'C'], hide: [] };
                const result = merge_view_section_or_graph(local, defaults);
                expect(result.show).toContain('A');
                expect(result.show).toContain('B');
                expect(result.show).toContain('C');
            });

            it('preserves items in hide', () => {
                const local = { show: ['A'], hide: ['B'] };
                const defaults = { show: ['A', 'B'], hide: [] };
                const result = merge_view_section_or_graph(local, defaults);
                expect(result.show).toContain('A');
                expect(result.hide).toContain('B');
                expect(result.show).not.toContain('B');
            });

            it('removes unknown items from local show (non-overview)', () => {
                const local = { show: ['A', 'UNKNOWN'], hide: [] };
                const defaults = { show: ['A'], hide: [] };
                const result = merge_view_section_or_graph(local, defaults);
                expect(result.show).toContain('A');
                expect(result.show).not.toContain('UNKNOWN');
            });

            it('preserves unknown items in show for overview page', () => {
                const local = { show: ['A', 'DynamicProject'], hide: [] };
                const defaults = { show: ['A'], hide: [] };
                const result = merge_view_section_or_graph(local, defaults, 'overview');
                expect(result.show).toContain('DynamicProject');
            });

            it('removes unknown items from hide', () => {
                const local = { show: [], hide: ['UNKNOWN'] };
                const defaults = { show: ['A'], hide: [] };
                const result = merge_view_section_or_graph(local, defaults);
                expect(result.hide).not.toContain('UNKNOWN');
                expect(result.show).toContain('A');
            });

            it('handles empty local', () => {
                const local = {};
                const defaults = { show: ['A', 'B'], hide: ['C'] };
                const result = merge_view_section_or_graph(local, defaults);
                expect(result.show).toContain('A');
                expect(result.show).toContain('B');
                expect(result.show).toContain('C');
            });
        });

        describe('merge_view', () => {
            it('merges view pages with sections and graphs', () => {
                const localView = {
                    dashboard: {
                        sections: { show: ['Run Statistics'], hide: ['Suite Statistics'] },
                        graphs: { show: ['graphA'], hide: [] },
                    },
                };
                const defaultView = {
                    dashboard: {
                        sections: { show: ['Run Statistics', 'Suite Statistics', 'Test Statistics'], hide: [] },
                        graphs: { show: ['graphA', 'graphB'], hide: [] },
                    },
                };
                const result = merge_view(localView, defaultView);
                expect(result.dashboard.sections.show).toContain('Run Statistics');
                expect(result.dashboard.sections.show).toContain('Test Statistics');
                expect(result.dashboard.sections.hide).toContain('Suite Statistics');
                expect(result.dashboard.graphs.show).toContain('graphB');
            });

            it('creates page from defaults when missing in local', () => {
                const localView = {};
                const defaultView = {
                    dashboard: {
                        sections: { show: ['A'], hide: [] },
                        graphs: { show: ['G1'], hide: [] },
                    },
                };
                const result = merge_view(localView, defaultView);
                expect(result.dashboard.sections.show).toContain('A');
                expect(result.dashboard.graphs.show).toContain('G1');
            });
        });

        describe('merge_theme_colors', () => {
            it('merges standard color keys using merge_objects_base', () => {
                const local = { light: { background: '#fff' }, dark: { background: '#000' }, custom: {} };
                const defaults = { light: { background: '#eee', card: '#ffffff' }, dark: { background: '#0f172a', card: 'rgba(30,41,59,0.9)' }, custom: {} };
                const result = merge_theme_colors(local, defaults);
                expect(result.light.background).toBe('#fff');
                expect(result.light.card).toBe('#ffffff');
                expect(result.dark.background).toBe('#000');
            });

            it('preserves custom colors from local even if not in defaults', () => {
                const local = { light: {}, dark: {}, custom: { light: { myColor: '#abc' }, dark: {} } };
                const defaults = { light: {}, dark: {}, custom: {} };
                const result = merge_theme_colors(local, defaults);
                expect(result.custom.light.myColor).toBe('#abc');
            });

            it('deep clones custom to avoid mutation', () => {
                const local = { light: {}, dark: {}, custom: { light: { myColor: '#abc' }, dark: {} } };
                const defaults = { light: {}, dark: {}, custom: {} };
                const result = merge_theme_colors(local, defaults);
                result.custom.light.myColor = '#changed';
                expect(local.custom.light.myColor).toBe('#abc');
            });
        });

        describe('merge_layout', () => {
            it('filters layout entries to only allowed graph IDs', () => {
                const localLayout = {
                    section1: JSON.stringify([{ id: 'graphA' }, { id: 'graphB' }, { id: 'removed' }]),
                };
                const mergedDefaults = {
                    view: {
                        dashboard: { graphs: { show: ['graphA', 'graphB'], hide: [] } },
                        compare: { graphs: { show: [], hide: [] } },
                    },
                };
                const result = merge_layout(localLayout, mergedDefaults);
                const parsed = JSON.parse(result.section1);
                expect(parsed).toHaveLength(2);
                expect(parsed.map(p => p.id)).toEqual(['graphA', 'graphB']);
            });

            it('returns null when localLayout is null', () => {
                expect(merge_layout(null, {})).toBeNull();
            });

            it('returns undefined when localLayout is undefined', () => {
                expect(merge_layout(undefined, {})).toBeUndefined();
            });

            it('removes sections with invalid JSON', () => {
                const localLayout = {
                    valid: JSON.stringify([{ id: 'graphA' }]),
                    invalid: 'not-json',
                };
                const mergedDefaults = {
                    view: {
                        dashboard: { graphs: { show: ['graphA'], hide: [] } },
                        compare: { graphs: { show: [], hide: [] } },
                    },
                };
                const result = merge_layout(localLayout, mergedDefaults);
                expect(result.valid).toBeDefined();
                expect(result.invalid).toBeUndefined();
            });
        });

        describe('collect_allowed_graphs', () => {
            it('collects graph IDs from dashboard and compare views', () => {
                const settings = {
                    view: {
                        dashboard: { graphs: { show: ['g1', 'g2'], hide: ['g3'] } },
                        compare: { graphs: { show: ['g4'], hide: [] } },
                    },
                };
                const allowed = collect_allowed_graphs(settings);
                expect(allowed.has('g1')).toBe(true);
                expect(allowed.has('g2')).toBe(true);
                expect(allowed.has('g3')).toBe(true);
                expect(allowed.has('g4')).toBe(true);
            });

            it('handles missing dashboard or compare views', () => {
                const settings = { view: {} };
                const allowed = collect_allowed_graphs(settings);
                expect(allowed.size).toBe(0);
            });
        });

        describe('merge_deep (full integration)', () => {
            it('preserves layouts key even when not in defaults', () => {
                const local = { layouts: { sec: '[]' }, show: { aliases: true } };
                const defaults = {
                    show: { aliases: false, legends: true },
                    view: {
                        dashboard: { graphs: { show: [], hide: [] } },
                        compare: { graphs: { show: [], hide: [] } },
                    },
                };
                const result = merge_deep(local, defaults);
                expect(result.layouts).toBeDefined();
                expect(result.show.aliases).toBe(true);
                expect(result.show.legends).toBe(true);
            });

            it('preserves libraries key even when not in defaults', () => {
                const local = { libraries: { BuiltIn: true }, show: { aliases: false } };
                const defaults = { show: { aliases: false } };
                const result = merge_deep(local, defaults);
                expect(result.libraries).toBeDefined();
            });

            it('preserves filterProfiles key even when not in defaults', () => {
                const local = { filterProfiles: { myProfile: {} }, show: { aliases: false } };
                const defaults = { show: { aliases: false } };
                const result = merge_deep(local, defaults);
                expect(result.filterProfiles).toBeDefined();
            });

            it('removes unknown keys not in exceptions list', () => {
                const local = { unknownKey: 'value', show: { aliases: true } };
                const defaults = { show: { aliases: false } };
                const result = merge_deep(local, defaults);
                expect(result.unknownKey).toBeUndefined();
            });

            it('adds missing defaults', () => {
                const local = {};
                const defaults = { show: { aliases: false } };
                const result = merge_deep(local, defaults);
                expect(result.show.aliases).toBe(false);
            });

            it('delegates view key to merge_view', () => {
                const local = {
                    view: {
                        dashboard: {
                            sections: { show: ['A'], hide: ['B'] },
                            graphs: { show: [], hide: [] },
                        },
                    },
                };
                const defaults = {
                    view: {
                        dashboard: {
                            sections: { show: ['A', 'B', 'C'], hide: [] },
                            graphs: { show: ['G1'], hide: [] },
                        },
                    },
                };
                const result = merge_deep(local, defaults);
                expect(result.view.dashboard.sections.hide).toContain('B');
                expect(result.view.dashboard.sections.show).toContain('C');
                expect(result.view.dashboard.graphs.show).toContain('G1');
            });

            it('delegates theme_colors key to merge_theme_colors', () => {
                const local = {
                    theme_colors: {
                        light: { background: '#fff' },
                        dark: {},
                        custom: { light: { extra: '#123' }, dark: {} },
                    },
                };
                const defaults = {
                    theme_colors: {
                        light: { background: '#eee', card: '#ffffff' },
                        dark: { background: '#000' },
                        custom: {},
                    },
                };
                const result = merge_deep(local, defaults);
                expect(result.theme_colors.light.background).toBe('#fff');
                expect(result.theme_colors.light.card).toBe('#ffffff');
                expect(result.theme_colors.custom.light.extra).toBe('#123');
            });
        });
    });
});
