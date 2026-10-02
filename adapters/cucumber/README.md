# Cucumber adapter (experimental)

Show [Cucumber](https://cucumber.io/) results in
[robotframework-dashboard](https://github.com/marketsquare/robotframework-dashboard) — trends over
runs, flaky scenarios, failure messages, tags, step (keyword) statistics, compare, tables —
**without any change to the dashboard**.

Built and tested with Cucumber-JVM (Java, with Selenium in the sample). The converter reads the
standard Cucumber report formats, so reports of other Cucumber implementations (cucumber-js,
cucumber-ruby, …) work too.

> **Status: experiment.** Feedback is very welcome; see [Known limitations](#known-limitations).

## How it works

robotdashboard reads Robot Framework `output.xml` files. This adapter converts a Cucumber report
into one, using Robot Framework's own result model, so the rest of the dashboard (database,
dashboard HTML, server, filters, log linking) works unchanged.

```
 Cucumber run                    adapter                          robotdashboard
┌─────────────────────┐   ┌──────────────────────────┐   ┌─────────────────────────────┐
│ mvn test            │──►│ cucumber_to_robot.py     │──►│ robotdashboard -o …xml      │
│ (json: or message:) │   │ report → output.xml      │   │ → database → dashboard.html │
└─────────────────────┘   └──────────────────────────┘   └─────────────────────────────┘
   cucumber.json or            output-<name>.xml               robot_dashboard.html
   cucumber.ndjson             log-<name>.html (optional)
```

Each Cucumber run becomes one run in the dashboard. Keep your database file between runs to build
up history.

## Contents

| Path | What it is |
|---|---|
| `cucumber_to_robot.py` | The converter (single file, command line + importable `convert()` function) |
| `demo.py` | Runs the sample a few times (rerunning failed scenarios) and builds a dashboard from it |
| `sample/` | Small Maven project: Cucumber 8, JUnit Platform, Selenium 4, headless Chrome. Features with tags, a Background, a Scenario Outline, Rules, hooks, a screenshot on failure, an undefined and a pending step, and random failures |
| `tests/` | Unit tests for the converter, on real reports of the sample (`tests/fixtures/`) |

## Requirements

- Python 3.8+ with robotframework-dashboard installed (`pip install robotframework-dashboard`).
  This pulls in Robot Framework 7+, which the converter needs.
  Working from a clone of this repository instead? Run the dashboard from source with
  `python -m robotframework_dashboard.main` wherever this guide says `robotdashboard`.
- Only for the sample and the demo: a **JDK 17 or newer** and Chrome. Maven is not needed; the
  sample comes with the Maven wrapper (`mvnw`), which downloads it. Selenium Manager downloads the
  matching chromedriver.

The converter has no other dependencies and does not need Java.

## Quick start: the demo

From the repository root:

```bash
python adapters/cucumber/demo.py --runs 5                  # converts the Cucumber JSON reports
python adapters/cucumber/demo.py --runs 5 --format ndjson  # converts the Cucumber Messages reports
```

The first run downloads Maven and the dependencies, which takes a minute. Then open
`adapters/cucumber/demo_output/robot_dashboard.html` in a browser. The folder also holds the raw
reports, the converted `output-run<N>.xml` / `log-run<N>.html` files and the `cucumber.db`
database. Everything in it is regenerated on every demo run and is git-ignored.

The sample fails some scenarios on purpose (a missing checkout button, an undefined and a pending
step) and others at random. After each run the demo reruns the failed scenarios once, so the
random ones show up as flaky.

## Using it with your own Cucumber project

### 1. Produce a report

Add the `json` or `message` plugin, in `junit-platform.properties` (JUnit Platform runner):

```properties
cucumber.plugin=pretty, json:target/cucumber.json
# or, more detail:
cucumber.plugin=pretty, message:target/cucumber.ndjson
```

or `@CucumberOptions(plugin = {"json:target/cucumber.json"})` with the older JUnit 4 runner.

Cucumber 8 needs a JSON library on the test classpath to write either report; add
`tools.jackson.core:jackson-databind` (Jackson 3) or `com.fasterxml.jackson.core:jackson-databind`
plus `jackson-datatype-jdk8` (Jackson 2) if you don't have one already. Cucumber says so clearly
when it's missing.

**Which format?** Both work, and most projects already have JSON. The Messages format (NDJSON) is
richer:

| | JSON | NDJSON |
|---|---|---|
| step start times | reconstructed (steps laid out back to back) | exact |
| `Rule:` | flattened | own suite level |
| retries within one run (cucumber-js `--retry`) | — | attempt history + `flaky` tag |
| hook types (Before / BeforeStep / …) | yes | yes |
| run start and duration | from the first scenario | exact |
| Cucumber and Java version as metadata | — | yes |

Don't switch formats for a project that already has history in the dashboard: with Rules, the
NDJSON format adds a suite level, so test names change.

### 2. Convert it

```bash
python adapters/cucumber/cucumber_to_robot.py target/cucumber.json \
    -o target/output-cucumber.xml \
    -l target/log-cucumber.html
```

| Option | Default | Meaning |
|---|---|---|
| `reports` | — | One or more reports of the **same** run (e.g. one per runner class or Maven module); JSON and NDJSON are detected from the content |
| `-o`, `--output` | `output-cucumber.xml` | `output.xml` to write |
| `-n`, `--name` | `Cucumber` | Name of the root suite; shown as the project name in the dashboard |
| `-l`, `--log` | none | Also write a Robot Framework `log.html` (needed for [log linking](#log-linking)) |
| `-r`, `--rerun` | none | Report of a rerun of the failed scenarios; adds their attempts (see [Reruns](#reruns-and-flaky-scenarios)). Repeatable |
| `-m`, `--metadata` | none | Run metadata `KEY=VALUE`, e.g. `-m Browser=chrome -m Environment=staging`. Repeatable |
| `--start-time` | from the report | Run start (ISO 8601), for old Cucumber versions that write no timestamps |
| `--raw-step-names` | off | Use the literal step text as keyword name, see [Step names](#step-names) |
| `--no-steps` | off | Don't convert steps and hooks to keywords |
| `--no-hooks` | off | Don't convert hooks to keywords |
| `--attachments` | off | Embed attachments (`scenario.attach()`: screenshots, text) in the output, shown in `log.html` |

Keep the word `output` in the file name (`output-<something>.xml`): the dashboard's `-f` folder
scan only picks up files named like that, and log linking relies on it.

To call it from Python instead:

```python
from cucumber_to_robot import convert
convert("target/cucumber.json", "target/output-cucumber.xml", name="Web shop",
        log_path="target/log-cucumber.html", metadata={"Browser": "chrome"})
```

### 3. Add it to the dashboard

```bash
robotdashboard -d cucumber.db -o target/output-cucumber.xml:cucumber:nightly -n robot_dashboard.html
```

- `-d` — the database. Reuse the same file for every run to build history.
- `:cucumber:nightly` after the path adds run tags, usable in the dashboard filters. Cross-browser
  runs: tag them `chrome` / `firefox`, or give each browser its own `--name`.
- `--projectversion 1.4.2` labels the run with the version of your application under test.
- Converting and adding the same report twice is harmless: the run start comes from Cucumber, so
  the dashboard recognises the duplicate and skips it.

### Reruns and flaky scenarios

Cucumber-JVM doesn't retry failed scenarios itself. The usual way is the `rerun` plugin plus a
second invocation for the scenarios it lists. Give the second report to the converter with
`--rerun`: each rerun scenario gets its attempt history (the same format as Robot Framework's
`rebot --merge`), and a scenario that passes on the rerun is PASS with tag `flaky`, which feeds the
dashboard's flaky graphs.

```properties
cucumber.plugin=json:target/cucumber.json, rerun:target/rerun.txt
```

```bash
mvn test
# the JUnit Platform engine takes the failed scenarios as feature:line list, not as @rerun.txt
mvn test -Dcucumber.features="$(tr -s ' \r\n' ',' < target/rerun.txt)" \
         -Dcucumber.plugin=json:target/cucumber-rerun.json \
         -Dsurefire.excludeJUnit5Engines=cucumber
python cucumber_to_robot.py target/cucumber.json --rerun target/cucumber-rerun.json -o output-cucumber.xml
```

`-Dsurefire.excludeJUnit5Engines=cucumber` stops the scenarios from running twice when you use a
`@Suite` runner class. `demo.py` shows the whole flow.

With cucumber-js `--retry`, retries are in the NDJSON report itself; no `--rerun` needed.

### 4. Running it in CI

A typical job: run the tests, convert, upload to a dashboard server (or add to a database you keep
as a build artifact). Example for GitHub Actions, with a dashboard server started with
`robotdashboard --server`:

```yaml
- name: Cucumber tests
  run: mvn -B test                 # junit-platform.properties writes target/cucumber.json
  continue-on-error: true          # still publish results when tests fail

- name: Convert to output.xml
  run: |
    python cucumber_to_robot.py target/cucumber.json \
      -o target/output-${{ github.run_id }}.xml \
      -l target/log-${{ github.run_id }}.html \
      -m Browser=chrome -m Branch=${{ github.ref_name }}

- name: Upload to the dashboard server
  run: |
    curl -f -F "file=@target/output-${{ github.run_id }}.xml" \
         -F "tags=cucumber:${{ github.ref_name }}" \
         http://dashboard.example.com:8543/add-output-file
    curl -f -F "file=@target/log-${{ github.run_id }}.html" \
         http://dashboard.example.com:8543/add-log-file
```

Without a server, run `robotdashboard -d cucumber.db -o … -n robot_dashboard.html` in the job and
publish the HTML (and keep `cucumber.db` for the next run, e.g. as a cached artifact).

### Log linking

With `-l` the converter also writes a Robot Framework `log.html` next to the `output.xml`. Name
them as a pair (`output-X.xml` ↔ `log-X.html`) and generate the dashboard with `--uselogs` to make
the graphs clickable. The log shows features, scenarios, hooks and steps with their arguments and
the full error with stack trace; with `--attachments` also the screenshots.

## How Cucumber maps to the dashboard

| Cucumber | In the dashboard |
|---|---|
| one run (one or more report files) | one run; start time and duration come from the report |
| `--name` (default `Cucumber`) | project name / top-level suite |
| feature file folders `features/checkout/cart.feature` | suite `checkout` (folders every feature shares, like `features/`, are dropped) |
| `Feature: Shopping cart` | suite `Shopping cart` |
| `Rule:` (NDJSON only) | suite level below the feature |
| Scenario | test |
| Scenario Outline row | test `<name> [Example N]`, N = row in its Examples table |
| tags `@smoke` (including feature tags) | test tag `smoke` |
| step `When I search for "shoes"` | keyword `I search for {}` with argument `shoes`; doc strings and data tables are extra arguments |
| step definition class / file (`SearchSteps`) | keyword library |
| `Background:` | `Background` group holding its steps (Robot Framework 7.2+, else just the steps) |
| `@Before` / `@After` / `@BeforeStep` / `@AfterStep` hooks | keywords named after the hook method, library = hook class |
| passed / skipped | PASS / SKIP |
| failed / pending / undefined / ambiguous | FAIL, plus tag `pending` / `undefined` / `ambiguous` for the last three |
| steps after a failing step | keyword status NOT RUN |
| error | test message: first lines of the exception, without stack trace, Selenium session details or Java package (`NoSuchElementException: no such element: …`); feeds the message graphs. The full error stays in `log.html` |
| `scenario.attach(…)` | with `--attachments`: image or text in `log.html` |
| rerun / retry attempts | attempt history per test; passing on a later attempt adds tag `flaky` |

Dots inside names are replaced with `_` because the dashboard uses `.` as the suite separator. Two
scenarios with the same name in one feature get ` (2)` appended.

### Step names

The dashboard groups keywords by name. Using the literal step text would make
`I search for "shoes"` and `I search for "socks"` two different keywords, so argument values are
replaced by `{}`: both become `I search for {}`, with the value as keyword argument. The positions
of the arguments come from Cucumber itself, so this is exact for any parameter type.

`--raw-step-names` keeps the literal text, for projects whose steps have no arguments worth
merging or that prefer to see every variant.

The Gherkin keyword (Given/When/Then/And) is not part of the name: the same step definition is
often used as both `Given` and `And`.

## Known limitations

1. **Optional text splits a step definition.** `I add {int} product(s)` used as both
   `I add 1 product` and `I add 3 products` gives two keywords. The JSON report has no step
   definition expressions; the NDJSON report does, so this can be fixed for NDJSON later.
2. **Step timings are approximate with JSON.** It has durations but no start times, so steps are
   placed back to back from the scenario start. NDJSON has exact times.
3. **Only the last attempt's steps are kept.** Earlier attempts keep their status and error message.
4. **Browser and environment aren't in the report.** Pass them with `-m` or run tags.
5. **`@BeforeAll` / `@AfterAll` failures** show up as the run's message; when they abort the run
   there are no scenarios to show.
6. **Robot Framework wording** stays in the UI ("keywords", "library", "Robot Framework Dashboard"
   as the default title — use `-t` to set your own title).

## Running the adapter's tests

```bash
python -m pytest adapters/cucumber/tests
```

The tests convert real reports of the sample (both formats, plus a rerun) and small hand-written
ones, and read the result back with the dashboard's own parser, so they also catch changes on the
dashboard side that would break the adapter. They need neither Java nor a browser.

To refresh the fixtures after changing the sample: run it with `-Dsample.unlucky=1` (every random
check fails), rerun the failed scenarios with `-Dsample.unlucky=0`, and copy the four reports from
`sample/target/cucumber/` to `tests/fixtures/`. Replace your user name in local paths and the
base64 screenshots (a 1×1 PNG is enough) before committing.
