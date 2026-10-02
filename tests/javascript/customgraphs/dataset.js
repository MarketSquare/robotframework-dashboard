// small dataset shaped like the decoded dashboard data: 3 runs, 2 suites, 3 tests per run

const runs = [
    {
        run_start: "2026-08-01 10:00:00", name: "Nightly", run_alias: "nightly-1", tags: "dev,project_web",
        total: 3, passed: 3, failed: 0, skipped: 0, elapsed_s: "30.5", project_version: "1.0",
        metadata: "['Browser: chromium', 'Team: Storefront']", custom_filters: "Pipeline=nightly:Release=2026.31",
    },
    {
        run_start: "2026-08-02 10:00:00", name: "Nightly", run_alias: "nightly-2", tags: "dev,project_web",
        total: 3, passed: 1, failed: 1, skipped: 1, elapsed_s: "40", project_version: "1.0",
        metadata: "['Browser: firefox', 'Team: Storefront']", custom_filters: "Pipeline=nightly:Release=2026.31",
    },
    {
        run_start: "2026-08-10 10:00:00+02:00", name: "Release", run_alias: "release-1", tags: "prod",
        total: 3, passed: 2, failed: 1, skipped: 0, elapsed_s: "50", project_version: "1.1",
        metadata: "", custom_filters: "Pipeline=release",
    },
];

const suites = runs.flatMap(run => [
    { run_start: run.run_start, name: "Login", full_name: "Web.Login", total: 2, passed: 2, failed: 0, skipped: 0, elapsed_s: "10", run_alias: run.run_alias },
    { run_start: run.run_start, name: "Cart", full_name: "Web.Cart", total: 1, passed: 1, failed: 0, skipped: 0, elapsed_s: "5", run_alias: run.run_alias },
]);

const testStatuses = {
    "2026-08-01 10:00:00": ["passed", "passed", "passed"],
    "2026-08-02 10:00:00": ["failed", "passed", "skipped"],
    "2026-08-10 10:00:00+02:00": ["passed", "failed", "passed"],
};
const testDefs = [
    { name: "Valid Login", full_name: "Web.Login.Valid Login", tags: "[smoke,login]", elapsed: [2, 3, 4] },
    { name: "Invalid Login", full_name: "Web.Login.Invalid Login", tags: "[login]", elapsed: [1, 1, 1] },
    { name: "Add To Cart", full_name: "Web.Cart.Add To Cart", tags: "[]", elapsed: [5, 7, 9] },
];
const tests = runs.flatMap((run, runIndex) => testDefs.map((def, testIndex) => {
    const status = testStatuses[run.run_start][testIndex];
    return {
        run_start: run.run_start, name: def.name, full_name: def.full_name, tags: def.tags,
        passed: status === "passed" ? 1 : 0, failed: status === "failed" ? 1 : 0, skipped: status === "skipped" ? 1 : 0,
        elapsed_s: String(def.elapsed[runIndex]), message: status === "failed" ? "AssertionError" : "",
        run_alias: run.run_alias, attempts: def.name === "Add To Cart" && runIndex === 1 ? "2" : "",
    };
}));

const keywords = runs.flatMap(run => [
    { run_start: run.run_start, name: "Click", owner: "Browser", passed: 10, failed: 0, skipped: 0, times_run: "10", total_time_s: "20", average_time_s: "2", min_time_s: "1", max_time_s: "3", run_alias: run.run_alias },
    { run_start: run.run_start, name: "Log", owner: "BuiltIn", passed: 5, failed: 0, skipped: 0, times_run: "5", total_time_s: "1", average_time_s: "0.2", min_time_s: "0.1", max_time_s: "0.3", run_alias: run.run_alias },
]);

const exceptions = [
    { run_start: runs[1].run_start, message: "TimeoutError", amount: 2, run_alias: runs[1].run_alias },
    { run_start: runs[2].run_start, message: "TimeoutError", amount: 1, run_alias: runs[2].run_alias },
];

function make_dataset() {
    return { runs: [...runs], suites: [...suites], tests: [...tests], keywords: [...keywords], exceptions: [...exceptions] };
}

export { make_dataset };
