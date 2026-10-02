// starting points offered in the gallery; picking one loads it into the builder.
// focusFilter is the index of a where-condition the user still has to fill in
const CUSTOM_GRAPH_PRESETS = [
    {
        key: "statisticsPerRun",
        label: "Statistics per run",
        description: "Passed, failed and skipped tests per run. Add a tag or name filter to narrow it down.",
        spec: {
            title: "Statistics per run", source: "tests",
            where: [{ field: "tags", op: "has", value: "" }],
            x: { field: "run" }, series: { field: "status" },
            metric: { agg: "count" }, viz: { type: "stacked_bar" },
        },
        focusFilter: 0,
    },
    {
        key: "durationTrend",
        label: "Duration trend of one test",
        description: "The duration of a single test across runs.",
        spec: {
            title: "Duration trend", source: "tests",
            where: [{ field: "name", op: "is", value: "" }],
            x: { field: "run" }, series: null,
            metric: { agg: "avg", field: "elapsed_s" }, viz: { type: "line" },
        },
        focusFilter: 0,
    },
    {
        key: "mostFailed",
        label: "Most failed tests",
        description: "The 10 tests that failed most often.",
        spec: {
            title: "Most failed tests", source: "tests", where: [],
            x: { field: "name" }, series: null,
            metric: { agg: "fail_count" }, order: "value_desc", limit: 10, viz: { type: "hbar" },
        },
    },
    {
        key: "mostFlaky",
        label: "Most flaky tests",
        description: "The 10 tests that switch between pass and fail most often.",
        spec: {
            title: "Most flaky tests", source: "tests", where: [],
            x: { field: "name" }, series: null,
            metric: { agg: "flips" }, order: "value_desc", limit: 10, viz: { type: "hbar" },
        },
    },
    {
        key: "slowestTests",
        label: "Slowest tests",
        description: "The 10 tests with the highest average duration.",
        spec: {
            title: "Slowest tests", source: "tests", where: [],
            x: { field: "name" }, series: null,
            metric: { agg: "avg", field: "elapsed_s" }, order: "value_desc", limit: 10, viz: { type: "hbar" },
        },
    },
    {
        key: "passRatePerVersion",
        label: "Pass rate per project version",
        description: "The test pass rate of every project version.",
        spec: {
            title: "Pass rate per version", source: "runs", where: [],
            x: { field: "project_version" }, series: null,
            metric: { agg: "pass_rate" }, order: "label", viz: { type: "bar" },
        },
    },
    {
        key: "passRatePerTag",
        label: "Pass rate per tag",
        description: "The 10 test tags with the lowest pass rate.",
        spec: {
            title: "Pass rate per tag", source: "tests", where: [],
            x: { field: "tags" }, series: null,
            metric: { agg: "pass_rate" }, order: "value_asc", limit: 10, viz: { type: "hbar" },
        },
    },
    {
        key: "keywordTimePerLibrary",
        label: "Keyword time per library",
        description: "How the total keyword duration is spread over the libraries.",
        spec: {
            title: "Keyword time per library", source: "keywords", where: [],
            x: { field: "library" }, series: null,
            metric: { agg: "sum", field: "total_time_s" }, viz: { type: "donut" },
        },
    },
    {
        key: "topFailureMessages",
        label: "Top failure messages",
        description: "The 10 most common messages of failed tests.",
        spec: {
            title: "Top failure messages", source: "tests",
            where: [{ field: "status", op: "is", value: "failed" }],
            x: { field: "message" }, series: null,
            metric: { agg: "count" }, order: "value_desc", limit: 10, viz: { type: "hbar" },
        },
    },
    {
        key: "failureHeatmap",
        label: "Failure heatmap",
        description: "Which tests failed in which of the last 30 runs.",
        spec: {
            title: "Failure heatmap", source: "tests", where: [],
            x: { field: "run" }, series: { field: "name" },
            metric: { agg: "fail_count" }, limit: 30, viz: { type: "heatmap" },
        },
    },
    {
        key: "retriedTestsPerRun",
        label: "Retried tests per run",
        description: "How many tests needed more than one attempt in every run.",
        spec: {
            title: "Retried tests per run", source: "tests",
            where: [{ field: "attempts", op: "gt", value: "1" }],
            x: { field: "run" }, series: null,
            metric: { agg: "count" }, viz: { type: "bar" },
        },
    },
];

export { CUSTOM_GRAPH_PRESETS };
