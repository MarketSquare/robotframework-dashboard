// Definitions for all supported custom graph template types.
// Each entry describes the available graph styles, data types, and scope flavour.
// scopeType "name"  → user supplies an exact item name to track across runs
// scopeType "tag"   → user supplies an optional tag string to filter the data pool
const CUSTOM_GRAPH_TEMPLATES = [
    {
        key: "statistics",
        label: "Statistics (pass/fail per run)",
        graphTypes: [
            { value: "amount",      label: "Bar – Amounts" },
            { value: "percentages", label: "Bar – Percentages" },
            { value: "line",        label: "Line" },
        ],
        dataTypes: [
            { value: "test",    label: "Tests" },
            { value: "suite",   label: "Suites" },
            { value: "keyword", label: "Keywords" },
        ],
        scopeType: "name",
        scopeLabel: "Name (exact match, required)",
        scopePlaceholder: "e.g. Login Test",
    },
    {
        key: "duration",
        label: "Duration trend",
        graphTypes: [
            { value: "bar",  label: "Bar" },
            { value: "line", label: "Line" },
        ],
        dataTypes: [
            { value: "test",    label: "Tests" },
            { value: "suite",   label: "Suites" },
            { value: "keyword", label: "Keywords" },
        ],
        scopeType: "name",
        scopeLabel: "Name (exact match, required)",
        scopePlaceholder: "e.g. Login Test",
    },
    {
        key: "most_failed",
        label: "Most Failed (tag-filtered)",
        graphTypes: [
            { value: "bar", label: "Bar" },
        ],
        dataTypes: [
            { value: "test",    label: "Tests" },
            { value: "suite",   label: "Suites" },
            { value: "keyword", label: "Keywords" },
        ],
        scopeType: "tag",
        scopeLabel: "Tag filter (leave blank for all data)",
        scopePlaceholder: "e.g. smoke",
    },
    {
        key: "most_flaky",
        label: "Most Flaky (tag-filtered)",
        graphTypes: [
            { value: "bar", label: "Bar" },
        ],
        dataTypes: [
            { value: "test", label: "Tests" },
        ],
        scopeType: "tag",
        scopeLabel: "Tag filter (leave blank for all data)",
        scopePlaceholder: "e.g. smoke",
    },
    {
        key: "most_time_consuming",
        label: "Most Time Consuming (tag-filtered)",
        graphTypes: [
            { value: "bar", label: "Bar" },
        ],
        dataTypes: [
            { value: "test",    label: "Tests" },
            { value: "suite",   label: "Suites" },
            { value: "keyword", label: "Keywords" },
        ],
        scopeType: "tag",
        scopeLabel: "Tag filter (leave blank for all data)",
        scopePlaceholder: "e.g. smoke",
    },
];

export { CUSTOM_GRAPH_TEMPLATES };
