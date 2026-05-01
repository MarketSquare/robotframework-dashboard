// function to prepare the data for the run stats canvas
function get_stats_data(filteredRuns, filteredSuites, filteredTests, filteredKeywords) {
    const wasExecuted = (row) => (parseInt(row.passed)||0) + (parseInt(row.failed)||0) + (parseInt(row.skipped)||0) > 0;
    const data = {
        totalRuns: filteredRuns.length,
        totalSuites: filteredSuites.filter(wasExecuted).length,
        totalTests: filteredTests.filter(wasExecuted).length,
        totalKeywords: filteredKeywords.reduce((sum, k) => sum + (parseInt(k.passed)||0) + (parseInt(k.failed)||0) + (parseInt(k.skipped)||0), 0),
    };
    let passedRuns = 0, failedRuns = 0, skippedRuns = 0;
    let totalRunDuration = 0;
    const passRates = filteredRuns.map(run => {
        totalRunDuration += parseFloat(run.elapsed_s);
        if (parseInt(run.failed) > 0) failedRuns++;
        else if (parseInt(run.skipped) === parseInt(run.total) && parseInt(run.total) > 0) skippedRuns++;
        else passedRuns++;
        return Math.round((run.passed / run.total) * 100);
    });
    const runPct = (n) => filteredRuns.length > 0 ? Math.round(n / filteredRuns.length * 100) : 0;
    data.passedRuns = `${passedRuns} (${runPct(passedRuns)}%)`;
    data.failedRuns = `${failedRuns} (${runPct(failedRuns)}%)`;
    data.skippedRuns = `${skippedRuns} (${runPct(skippedRuns)}%)`;
    data.totalRunTime = Math.round(totalRunDuration);
    data.averageRunTime = Math.round(totalRunDuration / data.totalRuns);
    data.averagePassRate = `${Math.round(passRates.reduce((a, b) => a + b, 0) / passRates.length)}%`;
    return data;
}

// function to prepare suite stat widget data
function get_suite_stats_data(filteredSuites) {
    const stats = { total: 0, passed: 0, failed: 0, skipped: 0, duration: 0, names: new Set() };
    for (const suite of filteredSuites) {
        const sPassed  = parseInt(suite.passed)  || 0;
        const sFailed  = parseInt(suite.failed)  || 0;
        const sSkipped = parseInt(suite.skipped) || 0;
        if (sPassed + sFailed + sSkipped === 0) continue; // all tests NOT_RUN — suite not executed
        stats.total++;
        stats.names.add(suite.name);
        // suite.passed/failed/skipped are counts of tests within the suite, not booleans
        if (sFailed > 0) stats.failed++;
        else if (sSkipped === parseInt(suite.total) && parseInt(suite.total) > 0) stats.skipped++;
        else stats.passed++;
        stats.duration += parseFloat(suite.elapsed_s || 0);
    }
    const pct = (n) => stats.total > 0 ? Math.round(n / stats.total * 100) : 0;
    return {
        totalSuites: stats.total,
        uniqueSuites: stats.names.size,
        passedSuites: `${stats.passed} (${pct(stats.passed)}%)`,
        failedSuites: `${stats.failed} (${pct(stats.failed)}%)`,
        skippedSuites: `${stats.skipped} (${pct(stats.skipped)}%)`,
        passRate: stats.total > 0 ? `${pct(stats.passed)}%` : 'N/A',
        totalTime: Math.round(stats.duration),
        avgTime: stats.total > 0 ? Math.round(stats.duration / stats.total * 100) / 100 : 0,
    };
}

// function to prepare test stat widget data
function get_test_stats_data(filteredTests) {
    const stats = { total: 0, passed: 0, failed: 0, skipped: 0, duration: 0, names: new Set() };
    for (const test of filteredTests) {
        if (test.passed == 0 && test.failed == 0 && test.skipped == 0) continue; // NOT_RUN
        stats.total++;
        stats.names.add(test.name);
        if (test.passed == 1) stats.passed++;
        if (test.failed == 1) stats.failed++;
        if (test.skipped == 1) stats.skipped++;
        stats.duration += parseFloat(test.elapsed_s || 0);
    }
    const pct = (n) => stats.total > 0 ? Math.round(n / stats.total * 100) : 0;
    return {
        totalTests: stats.total,
        uniqueTests: stats.names.size,
        passedTests: `${stats.passed} (${pct(stats.passed)}%)`,
        failedTests: `${stats.failed} (${pct(stats.failed)}%)`,
        skippedTests: `${stats.skipped} (${pct(stats.skipped)}%)`,
        passRate: stats.total > 0 ? `${pct(stats.passed)}%` : 'N/A',
        totalTime: Math.round(stats.duration),
        avgTime: stats.total > 0 ? Math.round(stats.duration / stats.total * 100) / 100 : 0,
    };
}

// function to prepare keyword stat widget data
function get_keyword_stats_data(filteredKeywords) {
    let totalExecutions = 0;
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    let totalDuration = 0;
    const names = new Set();
    for (const kw of filteredKeywords) {
        const kwPassed  = parseInt(kw.passed)  || 0;
        const kwFailed  = parseInt(kw.failed)  || 0;
        const kwSkipped = parseInt(kw.skipped) || 0;
        passed  += kwPassed;
        failed  += kwFailed;
        skipped += kwSkipped;
        totalExecutions += kwPassed + kwFailed + kwSkipped;
        if (kwPassed + kwFailed + kwSkipped > 0) names.add(kw.name); // exclude keywords with only NOT_RUN invocations
        totalDuration += parseFloat(kw.total_time_s || 0);
    }
    const pct = (n) => totalExecutions > 0 ? Math.round(n / totalExecutions * 100) : 0;
    return {
        totalExecutions,
        uniqueKeywords: names.size,
        passedKeywords:  `${passed}  (${pct(passed)}%)`,
        failedKeywords:  `${failed}  (${pct(failed)}%)`,
        skippedKeywords: `${skipped} (${pct(skipped)}%)`,
        passRate: totalExecutions > 0 ? `${pct(passed)}%` : 'N/A',
        totalTime: Math.round(totalDuration),
        avgTime: totalExecutions > 0 ? Math.round(totalDuration / totalExecutions * 100) / 100 : 0,
    };
}

export {
    get_stats_data,
    get_suite_stats_data,
    get_test_stats_data,
    get_keyword_stats_data,
};