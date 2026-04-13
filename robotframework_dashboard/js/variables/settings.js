import { 
    defaultGraphTypes,
    overviewSections,
    unifiedSections,
    dashboardSections,
    dashboardGraphs,
    compareSections,
    compareGraphs,
    tableSections,
    tableGraphs
} from './graphs.js';

// settings var
var settings = {
    switch: {
        runTags: false,
        runName: true,
        totalStats: true,
        latestRuns: true,
        percentageFilters: true,
        versionFilters: true,
        sortFilters: true,
        suitePathsSuiteSection: false,
        suitePathsTestSection: false,
        suitePathsCompareSection: false,
        useLibraryNames: false,
    },
    show: {
        unified: false,
        dateLabels: true,
        legends: true,
        aliases: "run_start",
        milliseconds: false,
        axisTitles: true,
        animation: true,
        duration: 1500,
        rounding: 6,
        prefixes: true,
        timezones: false,
        convertTimezone: false,
        suitesSelectionInSuiteStats: "First Suite",
        suitesSelectionInTestStats: "First Suite",
    },
    theme_colors: {
        light: {
            background: '#eee',
            card: '#ffffff',
            highlight: '#3451b2',
            text: '#000000',
        },
        dark: {
            background: '#0f172a',
            card: 'rgba(30, 41, 59, 0.9)',
            highlight: '#a8b1ff',
            text: '#eee',
        },
        custom: {
            light: {},
            dark: {},
        }
    },
    branding: {
        title: "",
        logo: "",
    },
    menu: {
        overview: false,
        dashboard: true,
        compare: false,
        tables: false,
    },
    graphTypes: defaultGraphTypes,
    view: {
        overview: {
            sections: {
                show: overviewSections,
                hide: [],
            },
            graphs: {
                show: [],
                hide: [],
            }
        },
        unified: {
            sections: {
                show: unifiedSections,
                hide: [],
            },
            graphs: {
                show: dashboardGraphs,
                hide: [],
            }
        },
        dashboard: {
            sections: {
                show: dashboardSections,
                hide: [],
            },
            graphs: {
                show: dashboardGraphs,
                hide: [],
            },
        },
        compare: {
            sections: {
                show: compareSections,
                hide: [],
            },
            graphs: {
                show: compareGraphs,
                hide: [],
            },
        },
        tables: {
            sections: {
                show: tableSections,
                hide: [],
            },
            graphs: {
                show: tableGraphs,
                hide: [],
            },
        },
    }
};

// Returns the run label for an item (run/suite/test/keyword) based on the current aliases mode.
// Handles legacy boolean values stored in localStorage for backward compatibility.
function get_run_label(item) {
    const mode = settings.show.aliases;
    if (mode === "alias" || mode === true) return item.run_alias;
    if (mode === "run_name") return item.run_name ?? item.name;
    return item.run_start;
}

// Returns true when any non-run_start label mode is active.
function is_custom_run_label_mode() {
    const mode = settings.show.aliases;
    return mode === "alias" || mode === true || mode === "run_name";
}

export { 
    settings,
    get_run_label,
    is_custom_run_label_mode
};