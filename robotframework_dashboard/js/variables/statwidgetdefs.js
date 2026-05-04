// Definitions of all available stat widget data sources, grouped by section.
// Used to populate the "Add Stat Widget" modal and to resolve stat values at render time.

const STAT_WIDGET_DEFS = [
    // Run scope
    { key: "run.totalRuns",          label: "Executed Runs",       section: "Run"     },
    { key: "run.passedRuns",         label: "Passed Runs",         section: "Run"     },
    { key: "run.failedRuns",         label: "Failed Runs",         section: "Run"     },
    { key: "run.skippedRuns",        label: "Skipped Runs",        section: "Run"     },
    { key: "run.totalRunTime",       label: "Total Run Time",      section: "Run"     },
    { key: "run.averageRunTime",     label: "Avg Run Time",        section: "Run"     },
    { key: "run.averagePassRate",    label: "Avg Pass Rate",       section: "Run"     },
    // Suite scope
    { key: "suite.totalSuites",      label: "Executed Suites",     section: "Suite"   },
    { key: "suite.uniqueSuites",     label: "Unique Suites",       section: "Suite"   },
    { key: "suite.passedSuites",     label: "Passed Suites",       section: "Suite"   },
    { key: "suite.failedSuites",     label: "Failed Suites",       section: "Suite"   },
    { key: "suite.skippedSuites",    label: "Skipped Suites",      section: "Suite"   },
    { key: "suite.passRate",         label: "Suite Pass Rate",     section: "Suite"   },
    { key: "suite.totalTime",        label: "Total Suite Time",    section: "Suite"   },
    { key: "suite.avgTime",          label: "Avg Suite Time",      section: "Suite"   },
    // Test scope
    { key: "test.totalTests",        label: "Executed Tests",      section: "Test"    },
    { key: "test.uniqueTests",       label: "Unique Tests",        section: "Test"    },
    { key: "test.passedTests",       label: "Passed Tests",        section: "Test"    },
    { key: "test.failedTests",       label: "Failed Tests",        section: "Test"    },
    { key: "test.skippedTests",      label: "Skipped Tests",       section: "Test"    },
    { key: "test.passRate",          label: "Test Pass Rate",      section: "Test"    },
    { key: "test.totalTime",         label: "Total Test Time",     section: "Test"    },
    { key: "test.avgTime",           label: "Avg Test Time",       section: "Test"    },
    // Keyword scope
    { key: "keyword.totalExecutions", label: "Keyword Executions", section: "Keyword" },
    { key: "keyword.uniqueKeywords",  label: "Unique Keywords",    section: "Keyword" },
    { key: "keyword.passedKeywords",  label: "Passed Keywords",    section: "Keyword" },
    { key: "keyword.failedKeywords",  label: "Failed Keywords",    section: "Keyword" },
    { key: "keyword.skippedKeywords", label: "Skipped Keywords",   section: "Keyword" },
    { key: "keyword.passRate",        label: "Keyword Pass Rate",  section: "Keyword" },
    { key: "keyword.totalTime",       label: "Total Keyword Time", section: "Keyword" },
    { key: "keyword.avgTime",         label: "Avg Keyword Time",   section: "Keyword" },
];

const STAT_WIDGET_COLORS = [
    { value: "white-text",  label: "Default" },
    { value: "blue-text",   label: "Blue"    },
    { value: "green-text",  label: "Green"   },
    { value: "red-text",    label: "Red"     },
    { value: "yellow-text", label: "Yellow"  },
];

const STAT_WIDGET_BG_COLORS = [
    { value: "",          label: "Default" },
    { value: "blue-bg",   label: "Blue"    },
    { value: "green-bg",  label: "Green"   },
    { value: "red-bg",    label: "Red"     },
    { value: "yellow-bg", label: "Yellow"  },
];

// Stat-widget property names whose values are raw seconds and must be passed through format_duration
const TIME_PROPS = new Set([
    'totalRunTime', 'averageRunTime', 'averageTestTime', // run scope
    'totalTime', 'avgTime',                               // suite / test / keyword scope
]);

export { STAT_WIDGET_DEFS, STAT_WIDGET_COLORS, STAT_WIDGET_BG_COLORS, TIME_PROPS };
