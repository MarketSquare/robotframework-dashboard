import { parse_test_attempts } from "./helpers.js";
import { strip_tz_suffix } from "../common.js";

function run_time(runStart) {
    return new Date(strip_tz_suffix(runStart).replace(" ", "T")).getTime();
}

// the runs of one test that have a message or a rerun history, newest first: the full messages the
// graph tooltips shorten
function get_test_messages(tests, isTest) {
    return tests
        .filter(test => isTest(test))
        .map(test => ({ test, attempts: parse_test_attempts(test) }))
        .filter(({ test, attempts }) => test.message || attempts.length > 0)
        .sort((a, b) => run_time(b.test.run_start) - run_time(a.test.run_start))
        .map(({ test, attempts }) => ({
            runStart: test.run_start,
            id: test.id,
            fullName: test.full_name,
            status: test.passed == 1 ? "PASS" : test.failed == 1 ? "FAIL" : "SKIP",
            message: test.message || "",
            attempts,
        }));
}

export { get_test_messages };
