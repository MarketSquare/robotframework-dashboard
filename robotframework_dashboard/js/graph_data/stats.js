// function to prepare the data for the run stats canvas
function get_stats_data(filteredRuns, filteredSuites, filteredTests, filteredKeywords) {
    const data = {
        totalRuns: Object.keys(filteredRuns).length,
        totalSuites: Object.keys(filteredSuites).length,
        totalTests: Object.keys(filteredTests).length,
        totalKeywords: filteredKeywords.reduce((sum, k) => sum + parseInt(k.times_run), 0),
    };
    const testStats = {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0,
        names: new Set(),
    };
    for (const test of filteredTests) {
        testStats.total++;
        testStats.names.add(test.name);
        if (test.passed == 1) testStats.passed++;
        if (test.failed == 1) testStats.failed++;
        if (test.skipped == 1) testStats.skipped++;
        testStats.duration += parseFloat(test.elapsed_s);
    }
    data.totalUniqueTests = testStats.names.size;
    data.totalPassed = `${testStats.passed} (${Math.round(testStats.passed / testStats.total * 100)}%)`;
    data.totalFailed = `${testStats.failed} (${Math.round(testStats.failed / testStats.total * 100)}%)`;
    data.totalSkipped = `${testStats.skipped} (${Math.round(testStats.skipped / testStats.total * 100)}%)`;
    let totalRunDuration = 0;
    const passRates = filteredRuns.map(run => {
        totalRunDuration += parseFloat(run.elapsed_s);
        return Math.round((run.passed / run.total) * 100);
    });
    data.totalRunTime = Math.round(totalRunDuration);
    data.averageRunTime = Math.round(totalRunDuration / data.totalRuns);
    data.averageTestTime = Math.round(testStats.duration / testStats.total * 100) / 100;
    data.averagePassRate = `${Math.round(passRates.reduce((a, b) => a + b, 0) / passRates.length)}%`;
    return data;
}

// function to prepare suite stat widget data
function get_suite_stats_data(filteredSuites) {
    const stats = { total: 0, passed: 0, failed: 0, skipped: 0, duration: 0, names: new Set() };
    for (const suite of filteredSuites) {
        stats.total++;
        stats.names.add(suite.name);
        if (suite.passed == 1) stats.passed++;
        if (suite.failed == 1) stats.failed++;
        if (suite.skipped == 1) stats.skipped++;
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
    let totalDuration = 0;
    const names = new Set();
    for (const kw of filteredKeywords) {
        const runs = parseInt(kw.times_run) || 0;
        totalExecutions += runs;
        names.add(kw.name);
        if (kw.passed == 1) passed += runs;
        if (kw.failed == 1) failed += runs;
        totalDuration += parseFloat(kw.total_elapsed_s || kw.elapsed_s || 0);
    }
    const pct = (n) => totalExecutions > 0 ? Math.round(n / totalExecutions * 100) : 0;
    return {
        totalExecutions,
        uniqueKeywords: names.size,
        passedKeywords: `${passed} (${pct(passed)}%)`,
        failedKeywords: `${failed} (${pct(failed)}%)`,
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