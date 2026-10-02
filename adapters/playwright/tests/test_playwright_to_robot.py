import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from playwright_to_robot import convert  # noqa: E402
from robotframework_dashboard.processors import OutputProcessor, parse_merged_message  # noqa: E402

START = "2026-01-02T10:00:00.000Z"


def result(status, start=START, duration=100, retry=0, error=None, steps=None, annotations=None):
    return {
        "status": status,
        "startTime": start,
        "duration": duration,
        "retry": retry,
        "errors": [{"message": error}] if error else [],
        "steps": steps or [],
        "annotations": annotations or [],
    }


def spec(title, tests, tags=None):
    return {"title": title, "tags": tags or [], "tests": tests}


def pw_test(project, status, results, annotations=None):
    return {"projectName": project, "status": status, "results": results, "annotations": annotations or []}


def make_report(projects=("desktop",)):
    def per_project(make):
        return [make(p) for p in projects]

    return {
        "config": {
            "version": "1.63.0",
            "metadata": {"Environment": "ci"},
            "projects": [{"name": p} for p in projects],
        },
        "stats": {"startTime": START, "duration": 5000},
        "errors": [],
        "suites": [
            {
                "title": "shop/cart.spec.ts",
                "file": "shop/cart.spec.ts",
                "specs": [],
                "suites": [
                    {
                        "title": "Cart v2.0",
                        "specs": [
                            spec("passes", per_project(lambda p: pw_test(p, "expected", [result(
                                "passed", steps=[{"title": "Outer", "duration": 50,
                                                  "steps": [{"title": "Inner", "duration": 20}]}])])),
                                 tags=["smoke"]),
                            spec("fails", per_project(lambda p: pw_test(p, "unexpected", [
                                result("failed", error="\x1b[31mfirst\x1b[39m boom"),
                                result("timedOut", retry=1, error="second boom",
                                       steps=[{"title": "Step", "duration": 10, "error": {"message": "second boom"}}]),
                            ]))),
                            spec("flaky", per_project(lambda p: pw_test(p, "flaky", [
                                result("failed", error="boom"),
                                result("passed", retry=1),
                            ]))),
                            spec("skipped", per_project(lambda p: pw_test(p, "skipped", [result(
                                "skipped", annotations=[{"type": "skip", "description": "not ready"}])]))),
                            spec("expected failure", per_project(lambda p: pw_test(p, "expected", [
                                result("failed", error="known bug")], annotations=[{"type": "fail"}]))),
                        ],
                    }
                ],
            }
        ],
    }


@pytest.fixture
def processed(tmp_path):
    def run(report):
        report_path = tmp_path / "report.json"
        report_path.write_text(json.dumps(report), encoding="utf-8")
        output = convert(report_path, tmp_path / "output.xml")
        processor = OutputProcessor(output)
        processor.get_run_start()
        return processor, processor.get_output_data()

    return run


def by_name(data):
    return {row[2]: row for row in data["tests"]}


def test_run_start_is_playwright_start_time(processed):
    processor, data = processed(make_report())
    assert processor.generation_time == data["runs"][0][0]
    assert processor.generation_time.isoformat().startswith("2026-01-02")
    assert data["runs"][0][7] == 5.0  # elapsed seconds from stats.duration


def test_statuses(processed):
    _, data = processed(make_report())
    tests = by_name(data)
    # passed, failed, skipped flags
    assert tests["passes"][3:6] == (True, False, False)
    assert tests["fails"][3:6] == (False, True, False)
    assert tests["flaky"][3:6] == (True, False, False)
    assert tests["skipped"][3:6] == (False, False, True)
    assert tests["expected failure"][3:6] == (True, False, False)
    assert data["runs"][0][3:7] == (5, 3, 1, 1)


def test_suite_structure_single_project(processed):
    _, data = processed(make_report())
    # folder "shop", file "cart" (suffix stripped), describe with dots replaced
    assert by_name(data)["passes"][1] == "Playwright.shop.cart.Cart v2_0.passes"


def test_suite_structure_multiple_projects(processed):
    _, data = processed(make_report(projects=("desktop", "mobile")))
    names = sorted(row[1] for row in data["tests"] if row[2] == "passes")
    assert names == ["Playwright.desktop.shop.cart.Cart v2_0.passes", "Playwright.mobile.shop.cart.Cart v2_0.passes"]
    assert data["runs"][0][3] == 10


def test_tags_and_messages(processed):
    _, data = processed(make_report())
    tests = by_name(data)
    assert tests["passes"][9] == "[smoke]"
    assert tests["flaky"][9] == "[flaky]"
    assert tests["expected failure"][9] == "[fail]"
    assert tests["skipped"][8] == "not ready"
    assert tests["fails"][8] == "second boom"


def test_retries_become_merge_history(processed):
    _, data = processed(make_report())
    tests = by_name(data)
    assert json.loads(tests["fails"][11]) == [
        {"status": "FAIL", "message": "first boom"},  # ANSI colour codes stripped
        {"status": "FAIL", "message": "second boom"},
    ]
    assert json.loads(tests["flaky"][11]) == [
        {"status": "FAIL", "message": "boom"},
        {"status": "PASS", "message": ""},
    ]
    assert tests["passes"][11] == ""


def test_merge_message_round_trips_through_dashboard_parser(tmp_path):
    from robot.api import ExecutionResult

    report_path = tmp_path / "report.json"
    report_path.write_text(json.dumps(make_report()), encoding="utf-8")
    output = convert(report_path, tmp_path / "output.xml")
    flaky = next(t for t in ExecutionResult(str(output)).suite.all_tests if t.name == "flaky")
    message, attempts = parse_merged_message(flaky.message, "PASS")
    assert message == ""
    assert [a["status"] for a in attempts] == ["FAIL", "PASS"]


def test_steps_become_keywords(processed):
    _, data = processed(make_report())
    keywords = {row[1]: row for row in data["keywords"]}
    assert set(keywords) == {"Outer", "Inner", "Step"}
    assert keywords["Outer"][10] == "Playwright"
    assert keywords["Step"][3] == 1  # failed once


def test_metadata(processed):
    _, data = processed(make_report())
    metadata = data["runs"][0][-1]
    assert "Environment: ci" in metadata
    assert "Playwright Version: 1.63.0" in metadata


def test_same_report_converts_to_same_run_start(tmp_path):
    report_path = tmp_path / "report.json"
    report_path.write_text(json.dumps(make_report()), encoding="utf-8")
    first = OutputProcessor(convert(report_path, tmp_path / "a.xml")).get_run_start()
    second = OutputProcessor(convert(report_path, tmp_path / "b.xml")).get_run_start()
    assert first == second


def broken_report():
    """A beforeAll hook failed: Playwright fails the first test and skips the rest without annotation."""
    report = make_report()
    hook_error = "Error: connect ECONNREFUSED 127.0.0.1:27017\n\n  3 | test.beforeAll(...)\n    at db.spec.ts:3:11"
    report["suites"].append({
        "title": "db.spec.ts",
        "file": "db.spec.ts",
        "specs": [],
        "suites": [{
            "title": "Needs database",
            "specs": [
                spec("first", [pw_test("desktop", "unexpected", [result("failed", error=hook_error)])]),
                spec("second", [pw_test("desktop", "skipped", [result("skipped"), result("skipped", retry=1)])]),
            ],
        }],
    })
    return report


def test_tests_that_did_not_run_fail(processed):
    _, data = processed(broken_report())
    tests = by_name(data)
    assert tests["second"][3:6] == (False, True, False)
    assert tests["second"][8] == "Test did not run: Error: connect ECONNREFUSED 127.0.0.1:27017"
    assert tests["second"][9] == "[not-run]"
    assert tests["second"][11] == ""  # no attempt history for a test that never ran
    # an intentional test.skip() stays a skip
    assert tests["skipped"][3:6] == (False, False, True)


def test_not_run_as_skip(tmp_path):
    report_path = tmp_path / "report.json"
    report_path.write_text(json.dumps(broken_report()), encoding="utf-8")
    processor = OutputProcessor(convert(report_path, tmp_path / "output.xml", not_run_fails=False))
    processor.get_run_start()
    assert by_name(processor.get_output_data())["second"][3:6] == (False, False, True)


def test_messages_lose_code_frame_and_call_log():
    from playwright_to_robot import clean_message

    message = (
        "\x1b[31mError: expect(locator).toHaveText(expected) failed\x1b[39m\n\nExpected: \"2\"\nReceived: \"1\"\n\n"
        "Call log:\n  - waiting for locator('#cart')\n\n  12 |   await expect(cart).toHaveText('2');\n"
        "    at C:/project/tests/cart.spec.ts:12:11"
    )
    assert clean_message(message) == 'Error: expect(locator).toHaveText(expected) failed\n\nExpected: "2"\nReceived: "1"'
    assert clean_message("Error: boom\n\n> 5 |     throw new Error('boom');") == "Error: boom"


def reporter_report():
    """Steps as dashboard-reporter.js writes them: categories, start times, function groups."""
    report = make_report()
    steps = [
        {"title": "Before Hooks", "category": "hook", "startTime": "2026-01-02T10:00:00.000Z", "duration": 300,
         "steps": [{"title": 'Fixture "page"', "category": "fixture", "startTime": "2026-01-02T10:00:00.000Z",
                    "duration": 200, "steps": []}]},
        {"title": "search", "owner": "ShopPage", "category": "function", "startTime": "2026-01-02T10:00:01.000Z",
         "duration": 60, "steps": [{"title": 'Fill "dash"', "category": "pw:api",
                                    "startTime": "2026-01-02T10:00:01.000Z", "duration": 60, "steps": []}]},
        {"title": 'Expect "toHaveText"', "category": "expect", "startTime": "2026-01-02T10:00:02.000Z",
         "duration": 10, "steps": [], "error": {"message": "Error: expect failed\n\nCall log:\n  - waiting"}},
        {"title": "screenshot", "category": "attach", "startTime": "2026-01-02T10:00:03.000Z", "duration": 0,
         "steps": []},
    ]
    report["suites"][0]["suites"][0]["specs"].append(
        spec("with reporter", [pw_test("desktop", "unexpected", [result("failed", error="Error: expect failed",
                                                                         steps=steps)])]))
    return report


def reporter_test(tmp_path, **kwargs):
    from robot.api import ExecutionResult

    report_path = tmp_path / "report.json"
    report_path.write_text(json.dumps(reporter_report()), encoding="utf-8")
    output = convert(report_path, tmp_path / "output.xml", **kwargs)
    return next(t for t in ExecutionResult(str(output)).suite.all_tests if t.name == "with reporter")


def test_reporter_steps_become_keywords(tmp_path):
    test = reporter_test(tmp_path)
    keywords = [(k.name, k.owner, k.args, k.status) for k in test.body]
    assert keywords == [
        ("Before Hooks", "Hooks", (), "PASS"),
        ("search", "ShopPage", (), "PASS"),
        ('Expect "toHaveText"', "Expect", (), "FAIL"),  # matcher name kept; attach step dropped
    ]
    hook, search, expect = test.body
    assert (hook.body[0].name, hook.body[0].owner) == ('Fixture "page"', "Fixtures")
    assert (search.body[0].name, search.body[0].owner, search.body[0].args) == ("Fill {}", "Playwright API", ("dash",))
    assert expect.message == "Error: expect failed"
    # real start times from the reporter, not laid out back to back
    assert (expect.start_time - hook.start_time).total_seconds() == 2.0


def test_reporter_hooks_can_be_left_out(tmp_path):
    test = reporter_test(tmp_path, include_hooks=False)
    assert [k.name for k in test.body] == ["search", 'Expect "toHaveText"']


def test_step_keyword_placeholders():
    from playwright_to_robot import step_keyword

    assert step_keyword('Navigate to "/login"', "pw:api") == ("Navigate to {}", ("/login",))
    assert step_keyword('Fill "a \\"b\\""', "pw:api") == ("Fill {}", ('a \\"b\\"',))
    assert step_keyword("Click", "pw:api") == ("Click", ())
    assert step_keyword('Expect "toBeVisible"', "expect") == ('Expect "toBeVisible"', ())
    assert step_keyword('Open "shop"', "test.step") == ('Open "shop"', ())
