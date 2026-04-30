// Definitions of all available stat widget data sources, grouped by section.
// Used to populate the "Add Stat Widget" modal and to resolve stat values at render time.

const STAT_WIDGET_DEFS = [
    // Run scope
    { key: "run.totalRuns",          label: "Executed Runs",       section: "Run",     defaultColor: "blue-text"   },
    { key: "run.totalSuites",        label: "Executed Suites",     section: "Run",     defaultColor: "blue-text"   },
    { key: "run.totalTests",         label: "Executed Tests",      section: "Run",     defaultColor: "blue-text"   },
    { key: "run.totalKeywords",      label: "Executed Keywords",   section: "Run",     defaultColor: "blue-text"   },
    { key: "run.totalUniqueTests",   label: "Unique Tests",        section: "Run",     defaultColor: "white-text"  },
    { key: "run.totalPassed",        label: "Passed",              section: "Run",     defaultColor: "green-text"  },
    { key: "run.totalFailed",        label: "Failed",              section: "Run",     defaultColor: "red-text"    },
    { key: "run.totalSkipped",       label: "Skipped",             section: "Run",     defaultColor: "yellow-text" },
    { key: "run.totalRunTime",       label: "Total Run Time",      section: "Run",     defaultColor: "white-text"  },
    { key: "run.averageRunTime",     label: "Avg Run Time",        section: "Run",     defaultColor: "white-text"  },
    { key: "run.averageTestTime",    label: "Avg Test Time",       section: "Run",     defaultColor: "white-text"  },
    { key: "run.averagePassRate",    label: "Avg Pass Rate",       section: "Run",     defaultColor: "green-text"  },
    // Suite scope
    { key: "suite.totalSuites",      label: "Executed Suites",     section: "Suite",   defaultColor: "blue-text"   },
    { key: "suite.uniqueSuites",     label: "Unique Suites",       section: "Suite",   defaultColor: "white-text"  },
    { key: "suite.passedSuites",     label: "Passed Suites",       section: "Suite",   defaultColor: "green-text"  },
    { key: "suite.failedSuites",     label: "Failed Suites",       section: "Suite",   defaultColor: "red-text"    },
    { key: "suite.skippedSuites",    label: "Skipped Suites",      section: "Suite",   defaultColor: "yellow-text" },
    { key: "suite.passRate",         label: "Pass Rate",           section: "Suite",   defaultColor: "green-text"  },
    { key: "suite.totalTime",        label: "Total Suite Time",    section: "Suite",   defaultColor: "white-text"  },
    { key: "suite.avgTime",          label: "Avg Suite Time",      section: "Suite",   defaultColor: "white-text"  },
    // Test scope
    { key: "test.totalTests",        label: "Executed Tests",      section: "Test",    defaultColor: "blue-text"   },
    { key: "test.uniqueTests",       label: "Unique Tests",        section: "Test",    defaultColor: "white-text"  },
    { key: "test.passedTests",       label: "Passed Tests",        section: "Test",    defaultColor: "green-text"  },
    { key: "test.failedTests",       label: "Failed Tests",        section: "Test",    defaultColor: "red-text"    },
    { key: "test.skippedTests",      label: "Skipped Tests",       section: "Test",    defaultColor: "yellow-text" },
    { key: "test.passRate",          label: "Pass Rate",           section: "Test",    defaultColor: "green-text"  },
    { key: "test.totalTime",         label: "Total Test Time",     section: "Test",    defaultColor: "white-text"  },
    { key: "test.avgTime",           label: "Avg Test Time",       section: "Test",    defaultColor: "white-text"  },
    // Keyword scope
    { key: "keyword.totalExecutions", label: "Keyword Executions", section: "Keyword", defaultColor: "blue-text"   },
    { key: "keyword.uniqueKeywords",  label: "Unique Keywords",    section: "Keyword", defaultColor: "white-text"  },
    { key: "keyword.passedKeywords",  label: "Passed Keywords",    section: "Keyword", defaultColor: "green-text"  },
    { key: "keyword.failedKeywords",  label: "Failed Keywords",    section: "Keyword", defaultColor: "red-text"    },
    { key: "keyword.totalTime",       label: "Total Keyword Time", section: "Keyword", defaultColor: "white-text"  },
    { key: "keyword.avgTime",         label: "Avg Keyword Time",   section: "Keyword", defaultColor: "white-text"  },
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

export { STAT_WIDGET_DEFS, STAT_WIDGET_COLORS, STAT_WIDGET_BG_COLORS };
