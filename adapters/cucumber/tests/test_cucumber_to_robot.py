import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from cucumber_to_robot import clean_message, convert, step_name  # noqa: E402
from robotframework_dashboard.processors import OutputProcessor  # noqa: E402

FIXTURES = Path(__file__).resolve().parent / "fixtures"
FORMATS = ("json", "ndjson")
# The fixtures are a real run of sample/ with -Dsample.unlucky=1 (every random check fails),
# and a rerun of the failed scenarios with -Dsample.unlucky=0.
RANDOM_FAILURES = ("Adding a product", "Adding several products", "Search results appear quickly")


@pytest.fixture
def processed(tmp_path):
    def run(reports, **kwargs):
        output = convert(reports, tmp_path / "output.xml", **kwargs)
        processor = OutputProcessor(output)
        processor.get_run_start()
        return processor, processor.get_output_data()

    return run


def by_name(data):
    return {row[2]: row for row in data["tests"]}


def keyword_names(data):
    return {(row[1], row[10]) for row in data["keywords"]}


@pytest.mark.parametrize("fmt", FORMATS)
def test_statuses_tags_and_messages(processed, fmt):
    _, data = processed(FIXTURES / f"report.{fmt}")
    tests = by_name(data)
    assert len(tests) == 10
    assert data["runs"][0][3:7] == (10, 4, 6, 0)
    assert tests["Checking out"][3:6] == (False, True, False)
    assert tests["Checking out"][8] == (
        'NoSuchElementException: no such element: Unable to locate element: {"method":"css selector","selector":"#checkout"}')
    assert tests["Paying with a gift card"][8] == "Undefined step: I pay with a gift card"
    assert tests["Paying with a gift card"][9] == "[cart,undefined,wip]"
    assert tests["Order confirmation"][8] == "PendingException: email check is not automated yet"
    assert tests["Order confirmation"][9] == "[cart,pending]"
    assert tests["Adding several products"][8] == "AssertionFailedError: cart count ==> expected: <4> but was: <3>"
    assert tests["Search ignores case"][3:6] == (True, False, False)


@pytest.mark.parametrize("fmt", FORMATS)
def test_outline_rows_get_example_numbers(processed, fmt):
    _, data = processed(FIXTURES / f"report.{fmt}")
    names = [row[2] for row in data["tests"] if row[2].startswith("Searching")]
    assert names == [f"Searching shows the matching products [Example {n}]" for n in (1, 2, 3)]


def test_suite_structure_json(processed):
    _, data = processed(FIXTURES / "report.json")
    # "features/" is shared by every feature and dropped; the feature name is the suite name
    assert by_name(data)["Checking out"][1] == "Cucumber.checkout.Shopping cart.Checking out"
    assert by_name(data)["Search ignores case"][1] == "Cucumber.Search products.Search ignores case"


def test_suite_structure_ndjson_has_rules(processed):
    _, data = processed(FIXTURES / "report.ndjson")
    assert by_name(data)["Checking out"][1] == "Cucumber.checkout.Shopping cart.An order can be placed.Checking out"


@pytest.mark.parametrize("fmt", FORMATS)
def test_steps_become_placeholder_keywords(processed, fmt):
    _, data = processed(FIXTURES / f"report.{fmt}")
    keywords = keyword_names(data)
    assert ("I search for {}", "SearchSteps") in keywords
    assert ("I see {} results", "SearchSteps") in keywords
    assert ("the shop is open", "SearchSteps") in keywords
    assert ("startBrowser", "Hooks") in keywords
    assert ("I pay with a gift card", "Undefined") in keywords
    assert not any('"' in name for name, _ in keywords)


@pytest.mark.parametrize("fmt", FORMATS)
def test_raw_step_names(processed, fmt):
    _, data = processed(FIXTURES / f"report.{fmt}", raw_names=True)
    keywords = keyword_names(data)
    assert ('I search for "ROBOT"', "SearchSteps") in keywords
    assert ("I search for {}", "SearchSteps") not in keywords


@pytest.mark.parametrize("fmt", FORMATS)
def test_no_hooks(processed, fmt):
    _, data = processed(FIXTURES / f"report.{fmt}", include_hooks=False)
    owners = {owner for _, owner in keyword_names(data)}
    assert "Hooks" not in owners
    assert "SearchSteps" in owners


@pytest.mark.parametrize("fmt", FORMATS)
def test_no_steps(processed, fmt):
    _, data = processed(FIXTURES / f"report.{fmt}", include_steps=False)
    assert data["keywords"] == []
    assert by_name(data)["Checking out"][4] is True  # status still comes from the steps


@pytest.mark.parametrize("fmt", FORMATS)
def test_rerun_makes_flaky_tests(processed, fmt):
    _, data = processed(FIXTURES / f"report.{fmt}", reruns=[FIXTURES / f"rerun.{fmt}"])
    tests = by_name(data)
    assert data["runs"][0][3:7] == (10, 7, 3, 0)
    for name in RANDOM_FAILURES:
        assert tests[name][3] is True
        assert "flaky" in tests[name][9]
        assert [attempt["status"] for attempt in json.loads(tests[name][11])] == ["FAIL", "PASS"]
    still_failing = json.loads(tests["Checking out"][11])
    assert [attempt["status"] for attempt in still_failing] == ["FAIL", "FAIL"]
    assert "flaky" not in tests["Checking out"][9]
    assert tests["Search ignores case"][11] == ""


@pytest.mark.parametrize("fmt", FORMATS)
def test_same_report_converts_to_same_run_start(tmp_path, fmt):
    first = OutputProcessor(convert(FIXTURES / f"report.{fmt}", tmp_path / "a.xml")).get_run_start()
    second = OutputProcessor(convert(FIXTURES / f"report.{fmt}", tmp_path / "b.xml")).get_run_start()
    assert first == second


def test_metadata(processed):
    _, data = processed(FIXTURES / "report.ndjson", metadata={"Browser": "chrome"})
    metadata = data["runs"][0][-1]
    assert "Browser: chrome" in metadata
    assert "Cucumber: cucumber-jvm 8.0.4" in metadata


def test_multiple_reports_are_one_run(processed):
    _, data = processed([FIXTURES / "report.json", FIXTURES / "rerun.json"])
    assert len(data["runs"]) == 1
    assert data["runs"][0][3] == 16
    # same scenario in both files: kept apart instead of silently merged
    assert "Checking out (2)" in by_name(data)


def test_log_and_attachments(tmp_path):
    from robot.api import ExecutionResult

    output = convert(FIXTURES / "report.json", tmp_path / "output.xml", log_path=tmp_path / "log.html",
                     include_attachments=True)
    assert (tmp_path / "log.html").exists()
    test = next(t for t in ExecutionResult(str(output)).suite.all_tests if t.name == "Checking out")
    failing = next(k for k in test.body if getattr(k, "name", "") == "I go to the checkout")
    assert "Session ID" in failing.body[0].message  # full error kept for log.html
    after = next(k for k in test.body if getattr(k, "name", "") == "stopBrowser")
    assert '<img src="data:image/png;base64,' in after.body[0].message
    not_run = next(k for k in test.body if getattr(k, "name", "") == "I see the order summary")
    assert not_run.status == "NOT RUN"
    background = next(item for item in test.body if item.type == "GROUP")
    assert background.name == "Background"


# ---------------------------------------------------------------------------------------
# Hand-written NDJSON for what cucumber-jvm doesn't produce: retries and untyped hooks
# ---------------------------------------------------------------------------------------

def ts(second):
    return {"seconds": 1767348000 + second, "nanos": 0}


def ndjson(attempts, hook_type=True, doc_string=False):
    """One scenario with a Before hook, one step and an After hook, run once per attempt status."""
    pickle_step = {"id": "ps1", "text": 'I buy "socks"', "astNodeIds": ["st1"]}
    if doc_string:
        pickle_step["argument"] = {"docString": {"content": "some text"}}
    envelopes = [
        {"meta": {"implementation": {"name": "cucumber-js", "version": "12.0.0"}}},
        {"testRunStarted": {"timestamp": ts(0)}},
        {"gherkinDocument": {"uri": "features/buy.feature", "feature": {"name": "Buying", "children": [
            {"scenario": {"id": "sc1", "name": "Buy", "location": {"line": 3}, "steps": [{"id": "st1"}]}}]}}},
        {"pickle": {"id": "p1", "uri": "features/buy.feature", "name": "Buy", "astNodeIds": ["sc1"],
                    "tags": [{"name": "@shop"}], "steps": [pickle_step]}},
        {"stepDefinition": {"id": "sd1", "pattern": {"source": "I buy {string}"},
                            "sourceReference": {"uri": "features/steps/buy_steps.js"}}},
        {"hook": {"id": "h1", "sourceReference": {"uri": "features/support/hooks.js"},
                  **({"type": "BEFORE_TEST_CASE"} if hook_type else {})}},
        {"hook": {"id": "h2", "name": "close browser", "sourceReference": {"uri": "features/support/hooks.js"},
                  **({"type": "AFTER_TEST_CASE"} if hook_type else {})}},
        {"testCase": {"id": "tc1", "pickleId": "p1", "testSteps": [
            {"id": "ts1", "hookId": "h1"},
            {"id": "ts2", "pickleStepId": "ps1", "stepDefinitionIds": ["sd1"], "stepMatchArgumentsLists": [
                {"stepMatchArguments": [{"group": {"start": 6, "value": '"socks"', "children": [
                    {"start": 7, "value": "socks"}]}, "parameterTypeName": "string"}]}]},
            {"id": "ts3", "hookId": "h2"},
        ]}},
    ]
    for number, status in enumerate(attempts):
        started = f"tcs{number}"
        envelopes.append({"testCaseStarted": {"id": started, "testCaseId": "tc1", "attempt": number,
                                              "timestamp": ts(number * 10)}})
        for offset, (step, step_status) in enumerate((("ts1", "PASSED"), ("ts2", status), ("ts3", "PASSED"))):
            result = {"status": step_status, "duration": {"seconds": 1, "nanos": 0}}
            if step_status == "FAILED":
                result["message"] = f"AssertionError: try {number}\n    at buy_steps.js:3:9"
            envelopes.append({"testStepStarted": {"testCaseStartedId": started, "testStepId": step,
                                                  "timestamp": ts(number * 10 + offset)}})
            envelopes.append({"testStepFinished": {"testCaseStartedId": started, "testStepId": step,
                                                   "testStepResult": result,
                                                   "timestamp": ts(number * 10 + offset + 1)}})
        envelopes.append({"testCaseFinished": {"testCaseStartedId": started, "timestamp": ts(number * 10 + 3),
                                               "willBeRetried": number < len(attempts) - 1}})
    envelopes.append({"testRunFinished": {"timestamp": ts(len(attempts) * 10)}})
    return "\n".join(json.dumps(envelope) for envelope in envelopes)


@pytest.fixture
def write_ndjson(tmp_path):
    def write(*args, **kwargs):
        path = tmp_path / "report.ndjson"
        path.write_text(ndjson(*args, **kwargs), encoding="utf-8")
        return path

    return write


def test_ndjson_retries_become_attempts(processed, write_ndjson):
    _, data = processed(write_ndjson(["FAILED", "FAILED", "PASSED"]))
    test = by_name(data)["Buy"]
    assert test[3] is True
    assert test[9] == "[flaky,shop]"
    assert json.loads(test[11]) == [
        {"status": "FAIL", "message": "AssertionError: try 0"},
        {"status": "FAIL", "message": "AssertionError: try 1"},
        {"status": "PASS", "message": ""},
    ]
    assert data["runs"][0][7] == 30.0


def test_ndjson_owners_from_uris_and_named_hooks(processed, write_ndjson):
    _, data = processed(write_ndjson(["PASSED"]))
    assert keyword_names(data) == {("Before hook", "hooks"), ("I buy {}", "buy_steps"), ("close browser", "hooks")}
    assert by_name(data)["Buy"][1] == "Cucumber.Buying.Buy"


def test_ndjson_untyped_hooks_are_placed_by_position(tmp_path, write_ndjson):
    from robot.api import ExecutionResult

    output = convert(write_ndjson(["PASSED"], hook_type=False), tmp_path / "output.xml")
    test = ExecutionResult(str(output)).suite.all_tests.__iter__().__next__()
    assert [keyword.name for keyword in test.body] == ["Before hook", "I buy {}", "close browser"]


def test_ndjson_doc_string_becomes_argument(tmp_path, write_ndjson):
    from robot.api import ExecutionResult

    output = convert(write_ndjson(["PASSED"], doc_string=True), tmp_path / "output.xml")
    test = next(iter(ExecutionResult(str(output)).suite.all_tests))
    assert test.body[1].args == ("socks", "some text")


# ---------------------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------------------

def test_clean_message_drops_selenium_details_and_stack():
    message = (
        "org.openqa.selenium.NoSuchElementException: no such element: #x\n"
        "  (Session info: chrome=154.0)\n"
        "Session ID: abc\r\n"
        "\tat org.openqa.selenium.remote.ErrorCodec.decode(ErrorCodec.java:169)"
    )
    assert clean_message(message) == "NoSuchElementException: no such element: #x"
    assert clean_message("org.opentest4j.AssertionFailedError: a ==> expected: <1> but was: <2>") == (
        "AssertionFailedError: a ==> expected: <1> but was: <2>")
    assert clean_message("plain text\nsecond line") == "plain text\nsecond line"


def test_step_name_placeholders():
    assert step_name('I search for "shoes" in 3 shops', [(13, '"shoes"'), (24, "3")], raw=False) == (
        "I search for {} in {} shops")
    assert step_name('I search for "shoes"', [(13, '"shoes"')], raw=True) == 'I search for "shoes"'
    # offsets that don't match the text are ignored rather than corrupting the name
    assert step_name("I wait", [(40, "5")], raw=False) == "I wait"
