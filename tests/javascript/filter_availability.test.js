import { describe, it, expect, vi } from 'vitest';

// Mock the modules that only exist once the data is embedded in the generated HTML.
// The availability computation itself takes its run data as an argument, so the empty
// mock data does not matter.
vi.mock('@js/variables/data.js', () => import('./mocks/data.js'));
vi.mock('@js/variables/globals.js', () => import('./mocks/globals.js'));
vi.mock('@js/variables/graphs.js', () => import('./mocks/graphs.js'));

import { compute_filter_option_availability, normalize_filter_selections } from '@js/filter.js';

// The example from issue #296: two custom filter dimensions where filter_1=A only ever
// occurs together with filter_2=C.
function issue_296_runs() {
    return [
        make_run({ name: 'test_1', run_start: '2026-01-01 10:00:00', custom_filters: 'filter_1=A:filter_2=C' }),
        make_run({ name: 'test_2', run_start: '2026-01-02 10:00:00', custom_filters: 'filter_1=A:filter_2=C' }),
        make_run({ name: 'test_3', run_start: '2026-01-03 10:00:00', custom_filters: 'filter_1=B:filter_2=D' }),
        make_run({ name: 'test_4', run_start: '2026-01-04 10:00:00', custom_filters: 'filter_1=B:filter_2=D' }),
    ];
}

function make_run(run) {
    return {
        name: 'run',
        run_start: '2026-01-01 10:00:00',
        tags: '',
        project_version: null,
        metadata: '[]',
        custom_filters: '',
        ...run,
    };
}

// builds the profile shape of capture_current_filters(); every filter left out of the
// arguments defaults to "no filtering"
function selections({ runs = 'All', runTags = [], tagMode = 'AND', projectVersions = [], metadata = 'All',
    suitePath = 'All', customFilters = {}, customFilterModes = {}, dates = {} } = {}) {
    const checkboxes = (values, allChecked) => [
        { value: 'All', checked: allChecked },
        ...values.map(value => ({ value: value, checked: true })),
    ];
    const profile = {
        runs: runs,
        runTags: [{ id: 'All', checked: runTags.length === 0 }, ...runTags.map(tag => ({ id: tag, checked: true }))],
        tagMode: tagMode,
        projectVersions: checkboxes(projectVersions, projectVersions.length === 0),
        metadata: metadata,
        suitePath: suitePath,
        customFilters: {},
        customFilterModes: customFilterModes,
        ...dates,
    };
    for (const [dimName, values] of Object.entries(customFilters)) {
        profile.customFilters[dimName] = checkboxes(values, values.length === 0);
    }
    return normalize_filter_selections(profile);
}

// the counts of one custom filter dimension as a plain object, for readable assertions
function custom_counts(availability, dimName) {
    return Object.fromEntries(availability.customFilters[dimName]);
}

describe('filter option availability', () => {
    describe('custom filters influencing each other (issue #296)', () => {
        it('counts every value when no filter is selected', () => {
            const availability = compute_filter_option_availability(
                issue_296_runs(),
                selections({ customFilters: { filter_1: [], filter_2: [] } })
            );
            expect(custom_counts(availability, 'filter_1')).toEqual({ All: 4, A: 2, B: 2 });
            expect(custom_counts(availability, 'filter_2')).toEqual({ All: 4, C: 2, D: 2 });
        });

        it('reports the values of another dimension that the selection excludes as 0', () => {
            const availability = compute_filter_option_availability(
                issue_296_runs(),
                selections({ customFilters: { filter_1: ['A'], filter_2: [] } })
            );
            // filter_2=D only exists on runs with filter_1=B, so it can no longer match
            expect(custom_counts(availability, 'filter_2')).toEqual({ All: 2, C: 2, D: 0 });
        });

        it('leaves the counts of the selected dimension itself untouched', () => {
            const availability = compute_filter_option_availability(
                issue_296_runs(),
                selections({ customFilters: { filter_1: ['A'], filter_2: [] } })
            );
            // selecting A does not hide B: the counts of a filter ignore that filter itself
            expect(custom_counts(availability, 'filter_1')).toEqual({ All: 4, A: 2, B: 2 });
        });

        it('narrows both ways', () => {
            const availability = compute_filter_option_availability(
                issue_296_runs(),
                selections({ customFilters: { filter_1: [], filter_2: ['D'] } })
            );
            expect(custom_counts(availability, 'filter_1')).toEqual({ All: 2, A: 0, B: 2 });
        });

        it('takes the mode of the other dimension into account', () => {
            const availability = compute_filter_option_availability(
                issue_296_runs(),
                selections({
                    customFilters: { filter_1: ['A'], filter_2: [] },
                    customFilterModes: { filter_1: 'NOT', filter_2: 'OR' },
                })
            );
            // everything except filter_1=A remains, which is exactly the filter_2=D runs
            expect(custom_counts(availability, 'filter_2')).toEqual({ All: 2, C: 0, D: 2 });
        });

        it('counts what is left over when the dimension itself is in NOT mode', () => {
            const availability = compute_filter_option_availability(
                issue_296_runs(),
                selections({
                    customFilters: { filter_1: [], filter_2: [] },
                    customFilterModes: { filter_1: 'NOT', filter_2: 'OR' },
                })
            );
            // in NOT mode a value excludes its runs, so selecting A leaves the two B runs
            expect(custom_counts(availability, 'filter_1')).toEqual({ All: 4, A: 2, B: 2 });
            const runs = [
                make_run({ custom_filters: 'filter_1=A' }),
                make_run({ custom_filters: 'filter_1=A' }),
                make_run({ custom_filters: 'filter_1=B' }),
            ];
            const notMode = compute_filter_option_availability(runs, selections({
                customFilters: { filter_1: [] },
                customFilterModes: { filter_1: 'NOT' },
            }));
            expect(custom_counts(notMode, 'filter_1')).toEqual({ All: 3, A: 1, B: 2 });
        });

        it('counts runs without the dimension as None', () => {
            const runs = [
                make_run({ custom_filters: 'filter_1=A' }),
                make_run({ custom_filters: 'filter_2=C' }),
            ];
            const availability = compute_filter_option_availability(
                runs,
                selections({ customFilters: { filter_1: [], filter_2: [] } })
            );
            expect(custom_counts(availability, 'filter_1')).toEqual({ All: 2, A: 1, None: 1 });
        });
    });

    describe('the other filters', () => {
        const runs = [
            make_run({ name: 'alpha', tags: 'nightly,linux', project_version: '1.0', metadata: '["env:prod"]' }),
            make_run({ name: 'alpha', tags: 'nightly,windows', project_version: '1.1', metadata: '["env:test"]' }),
            make_run({ name: 'beta', tags: 'release,linux', project_version: null, metadata: '["env:prod"]' }),
        ];

        it('counts run names with the run tag filter applied', () => {
            const availability = compute_filter_option_availability(runs, selections({ runTags: ['nightly'] }));
            expect(Object.fromEntries(availability.runs)).toEqual({ All: 2, alpha: 2, beta: 0 });
        });

        it('counts run tags per run, so they do not add up to All', () => {
            const availability = compute_filter_option_availability(runs, selections({ runs: 'alpha' }));
            expect(Object.fromEntries(availability.runTags))
                .toEqual({ All: 2, nightly: 2, linux: 1, windows: 1, release: 0 });
        });

        it('counts what is left over when the run tags are in NOT mode', () => {
            const availability = compute_filter_option_availability(runs, selections({ tagMode: 'NOT' }));
            // excluding nightly leaves the one release run, excluding linux leaves the windows one
            expect(Object.fromEntries(availability.runTags))
                .toEqual({ All: 3, nightly: 1, linux: 1, windows: 2, release: 2 });
        });

        it('counts project versions and reports runs without one as None', () => {
            const availability = compute_filter_option_availability(runs, selections({ runTags: ['linux'] }));
            expect(Object.fromEntries(availability.projectVersions))
                .toEqual({ All: 2, '1.0': 1, '1.1': 0, None: 1 });
        });

        it('counts metadata values with the other filters applied', () => {
            const availability = compute_filter_option_availability(runs, selections({ projectVersions: ['1.1'] }));
            expect(Object.fromEntries(availability.metadata))
                .toEqual({ All: 1, 'env:prod': 0, 'env:test': 1 });
        });

        it('applies the date range to every filter', () => {
            const dated = [
                make_run({ name: 'alpha', run_start: '2026-01-01 10:00:00' }),
                make_run({ name: 'beta', run_start: '2026-02-01 10:00:00' }),
            ];
            const availability = compute_filter_option_availability(dated, selections({
                dates: { fromDate: '2026-01-01', fromTime: '00:00', toDate: '2026-01-31', toTime: '23:59' },
            }));
            expect(Object.fromEntries(availability.runs)).toEqual({ All: 1, alpha: 1, beta: 0 });
        });

        it('applies the selected suite path to every filter', () => {
            const suites = [
                { full_name: 'Webshop.Login', run_start: runs[0].run_start },
            ];
            const availability = compute_filter_option_availability(
                [make_run({ name: 'alpha', run_start: '2026-01-01 10:00:00' }), make_run({ name: 'beta', run_start: '2026-03-03 10:00:00' })],
                selections({ suitePath: 'Webshop' }),
                suites
            );
            expect(Object.fromEntries(availability.runs)).toEqual({ All: 1, alpha: 1, beta: 0 });
        });
    });
});
