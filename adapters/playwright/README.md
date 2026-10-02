# Playwright adapter (experimental)

Show [Playwright Test](https://playwright.dev/) results in
[robotframework-dashboard](https://github.com/marketsquare/robotframework-dashboard) — trends over
runs, flaky tests, failure messages, tags, compare, tables — **without any change to the dashboard**.

> **Status: experiment.** This lives on a branch to see how well Playwright results fit the
> dashboard. Feedback is very welcome; see [Known limitations](#known-limitations).

## How it works

robotdashboard reads Robot Framework `output.xml` files. This adapter converts a Playwright JSON
report into one, using Robot Framework's own result model, so the rest of the dashboard
(database, dashboard HTML, server, filters, log linking) works unchanged.

```
 Playwright run                 adapter                         robotdashboard
┌────────────────────┐   ┌──────────────────────────┐   ┌─────────────────────────────┐
│ npx playwright test│──►│ playwright_to_robot.py   │──►│ robotdashboard -o …xml      │
│ (json reporter)    │   │ report.json → output.xml │   │ → database → dashboard.html │
└────────────────────┘   └──────────────────────────┘   └─────────────────────────────┘
      report.json            output-<name>.xml               robot_dashboard.html
                             log-<name>.html (optional)
```

Each Playwright run becomes one run in the dashboard. Keep your database file between runs to
build up history.

## Contents

| Path | What it is |
|---|---|
| `playwright_to_robot.py` | The converter (single file, command line + importable `convert()` function) |
| `dashboard-reporter.js` | Optional Playwright reporter that also writes actions, `expect()`, hooks and fixtures, so you get keywords without `test.step()` |
| `demo.py` | Runs the sample suite a few times and builds a dashboard from it |
| `sample/` | Small Playwright project (two browser projects, tags, steps, a page object, retries, a flaky test, random failures) |
| `tests/` | Unit tests for the converter (Python) and the reporter (Node.js) |

## Requirements

- Python 3.8+ with robotframework-dashboard installed (`pip install robotframework-dashboard`).
  This pulls in Robot Framework 7+, which the converter needs.
  Working from a clone of this repository instead? Run the dashboard from source with
  `python -m robotframework_dashboard.main` wherever this guide says `robotdashboard`.
- Node.js 18+ and Playwright Test (any recent version; tested with 1.63) — only on the machine
  that runs the Playwright tests.

The converter has no other dependencies and does not need Node.js.

## Quick start: the demo

From the repository root:

```bash
# 1. install the sample Playwright project and a browser (once)
cd adapters/playwright/sample
npm install
npx playwright install chromium
cd ../../..

# 2. run the sample 5 times, convert every report and build the dashboard
python adapters/playwright/demo.py --runs 5
```

`demo.py` uses the [dashboard reporter](#keywords-without-teststep-the-dashboard-reporter) by
default. `--group-by-function` groups the actions per helper function and page object method;
`--reporter json` uses Playwright's own JSON reporter instead, to compare.

Open `adapters/playwright/demo_output/robot_dashboard.html` in a browser. The folder also holds the
raw Playwright reports, the converted `output-run<N>.xml` / `log-run<N>.html` files and the
`playwright.db` database. Everything in it is regenerated on every demo run and is git-ignored.

The sample fails some tests on purpose (a missing checkout button, a randomly failing search and a
test that sometimes only passes on retry), so the dashboard has something to show.

## Using it with your own Playwright project

### 1. Produce a JSON report

Add the `json` reporter next to whatever reporters you already use, in `playwright.config.ts`:

```ts
export default defineConfig({
  reporter: [
    ['list'],
    ['json', { outputFile: 'results/report.json' }],
  ],
  // optional: shows up as run metadata in the dashboard (metadata filter)
  metadata: { Environment: process.env.TEST_ENV ?? 'local' },
});
```

or on the command line, without changing the config:

```bash
npx playwright test --reporter=json > results/report.json
```

Sharded runs: merge the blob reports first with
`npx playwright merge-reports --reporter=json ./all-blob-reports > results/report.json`.

### Keywords without test.step(): the dashboard reporter

Playwright's JSON reporter only writes `test.step()` calls, so a suite without them gets no
keywords. `dashboard-reporter.js` writes the same JSON layout plus every step Playwright knows
about. Copy it into your project (it has no dependencies) and use it instead of, or next to, the
`json` reporter:

```ts
export default defineConfig({
  reporter: [
    ['list'],
    ['./dashboard-reporter.js', { outputFile: 'results/dashboard-report.json', groupByFunction: true }],
  ],
});
```

or `npx playwright test --reporter=./dashboard-reporter.js` with the options as environment
variables. Then convert `results/dashboard-report.json` exactly like a JSON report.

| Option | Environment variable | Default | Meaning |
|---|---|---|---|
| `outputFile` | `PLAYWRIGHT_DASHBOARD_OUTPUT_FILE` | `dashboard-report.json` | Where to write the report, relative to the config file |
| `groupByFunction` | `PLAYWRIGHT_DASHBOARD_GROUP_BY_FUNCTION` | `false` | Group actions per helper function / page object method, see below |
| `hooks` | `PLAYWRIGHT_DASHBOARD_HOOKS` | `true` | Include the Before Hooks / After Hooks steps (fixtures, browser start, `beforeEach`) |

What you get as keywords:

| Step | Keyword | Library |
|---|---|---|
| `test.step('Open shop')` | `Open shop` | `Playwright` |
| `page.click()`, `locator.fill('dash')`, `page.goto('/login')` | `Click`, `Fill {}`, `Navigate to {}`; the values become keyword arguments, so equal actions add up in the keyword graphs | `Playwright API` |
| `expect(…).toHaveText()` | `Expect "toHaveText"` | `Expect` |
| hooks, fixtures | `Before Hooks`, `beforeEach hook`, `Fixture "page"`, … | `Hooks` / `Fixtures` |
| with `groupByFunction`: a helper `open_shop(page)` | `open_shop`, holding its actions | file name (`shop`) |
| with `groupByFunction`: a page object method `ShopPage.search()` | `search`, holding its actions | class name (`ShopPage`) |

**How `groupByFunction` works.** For every action Playwright reports where in your code it was
called. The reporter looks up which named function encloses that line, and puts consecutive
actions from the same function under one keyword named after it. Actions written directly in a test
or `test.step()` body stay single keywords. The lookup uses the TypeScript compiler API when your
project has `typescript` 5 or older installed (TypeScript 7 no longer has it), and otherwise a scan
of the source lines that handles the usual function, arrow function and method styles. Limits:

- only the **innermost** named function is known: `ShopPage.open()` that just calls `open_shop()`
  shows as `open_shop`;
- calling the same helper twice in a row merges both calls into one keyword;
- anonymous callbacks (`items.forEach(async (item) => …)`) count as the named function around them.

For full control over names and nesting, wrap the work in `test.step()` or use Playwright's
`@step` decorator pattern for page objects; both show up as `test.step` keywords.

### 2. Convert it

```bash
python adapters/playwright/playwright_to_robot.py results/report.json \
    -o results/output-playwright.xml \
    -l results/log-playwright.html
```

| Option | Default | Meaning |
|---|---|---|
| `report` | — | Playwright JSON report (`json` reporter or `dashboard-reporter.js`) |
| `-o`, `--output` | `output-playwright.xml` | `output.xml` to write |
| `-n`, `--name` | `Playwright` | Name of the root suite; shown as the project name in the dashboard |
| `-l`, `--log` | none | Also write a Robot Framework `log.html` (needed for [log linking](#log-linking)) |
| `--no-steps` | off | Don't convert steps into keywords |
| `--no-hooks` | off | Leave out the hook and fixture steps of the dashboard reporter |
| `--not-run-as-skip` | off | Keep tests that [did not run](#tests-that-did-not-run) as SKIP instead of FAIL |

Keep the word `output` in the file name (`output-<something>.xml`): the dashboard's `-f` folder
scan only picks up files named like that, and log linking relies on it.

To call it from Python instead:

```python
from playwright_to_robot import convert
convert("results/report.json", "results/output-playwright.xml", name="Web shop", log_path="results/log-playwright.html")
```

### 3. Add it to the dashboard

```bash
robotdashboard -d playwright.db -o results/output-playwright.xml:playwright:nightly -n robot_dashboard.html
```

- `-d` — the database. Reuse the same file for every run to build history.
- `:playwright:nightly` after the path adds run tags, usable in the dashboard filters.
- `--projectversion 1.4.2` labels the run with the version of your application under test.
- `-f results/` adds every `output*.xml` in a folder at once.
- Converting and adding the same report twice is harmless: the run start comes from Playwright, so
  the dashboard recognises the duplicate and skips it.

All other robotdashboard options work as usual; see the
[CLI docs](https://marketsquare.github.io/robotframework-dashboard/basic-command-line-interface-cli.html).

### 4. Running it in CI

A typical job: run the tests, convert, upload to a dashboard server (or add to a database you keep
as a build artifact). Example for GitHub Actions, with a dashboard server started with
`robotdashboard --server`:

```yaml
- name: Playwright tests
  run: npx playwright test          # config writes results/report.json
  continue-on-error: true           # still publish results when tests fail

- name: Convert to output.xml
  run: |
    python playwright_to_robot.py results/report.json \
      -o results/output-${{ github.run_id }}.xml \
      -l results/log-${{ github.run_id }}.html

- name: Upload to the dashboard server
  run: |
    curl -f -F "file=@results/output-${{ github.run_id }}.xml" \
         -F "tags=playwright:${{ github.ref_name }}" \
         http://dashboard.example.com:8543/add-output-file
    curl -f -F "file=@results/log-${{ github.run_id }}.html" \
         http://dashboard.example.com:8543/add-log-file
```

Without a server, run `robotdashboard -d playwright.db -o … -n robot_dashboard.html` in the job and
publish the HTML (and keep `playwright.db` for the next run, e.g. as a cached artifact).

### Log linking

With `-l` the converter also writes a Robot Framework `log.html` next to the `output.xml`. Name
them as a pair (`output-X.xml` ↔ `log-X.html`) and generate the dashboard with `--uselogs` to make
the graphs clickable. The log shows the converted suites, tests, steps and error messages; it is not
the Playwright HTML report (no traces or screenshots).

## How Playwright maps to the dashboard

| Playwright | In the dashboard |
|---|---|
| one `npx playwright test` run | one run; its start time and duration come from the report |
| `--name` (default `Playwright`) | project name / top-level suite |
| project (`chromium`, `mobile`, …), only when there is more than one | suite level: `Playwright.chromium.…` |
| spec file `shop/cart.spec.ts` | suites `shop` › `cart` (`.spec.ts` / `.test.ts` stripped) |
| `test.describe('Cart')` | suite `Cart` |
| a test in one project | a test |
| tags `@smoke` | test tag `smoke` |
| `test.fail()` / `test.slow()` / `test.fixme()` | test tag `fail` / `slow` / `fixme` |
| result expected / flaky / unexpected / skipped | PASS / PASS + tag `flaky` / FAIL / SKIP |
| skipped without `test.skip()` / `test.fixme()` (did not run) | FAIL + tag `not-run`, see below |
| retries | attempt history per test, same as Robot Framework `--rerunfailed` + `rebot --merge`; feeds the flaky graphs |
| error message | test message without colour codes, code frame, stack and call log; feeds the message graphs |
| `test.skip(true, 'reason')` | SKIP with the reason as message |
| `test.step('…')`, nested | keywords (nested), library `Playwright` |
| actions, `expect()`, hooks, fixtures (dashboard reporter only) | keywords, see [the dashboard reporter](#keywords-without-teststep-the-dashboard-reporter) |
| `metadata` in the config + Playwright version | run metadata (metadata filter) |

Dots inside names are replaced with `_` because the dashboard uses `.` as the suite separator.

### Tests that did not run

When a `beforeAll` hook fails (a database that is down, a login that doesn't work), Playwright
fails the first test and reports the rest of the file as *skipped*. The same happens to the
remaining tests when the run is interrupted or a dependency project fails. Passed through as SKIP,
such a broken run looks like "lots of skipped" in the trends instead of red.

The converter therefore treats a skipped test **without** a `skip` or `fixme` annotation as one
that did not run, and makes it FAIL with tag `not-run` and the reason as message:
`Test did not run: Error: connect ECONNREFUSED 127.0.0.1:27017`. That is what Robot Framework does
with the tests of a suite whose setup failed. Tests skipped on purpose (`test.skip()`,
`test.fixme()`, also conditional ones) stay SKIP. `--not-run-as-skip` restores the old behaviour.

## Known limitations

1. **With the JSON reporter, only `test.step()` becomes a keyword.** It leaves out actions,
   `expect()`, hooks and fixtures, even inside a step. Use
   [the dashboard reporter](#keywords-without-teststep-the-dashboard-reporter) to get them.
2. **With the JSON reporter, step timings are approximate.** It reports how long each step took
   but not when it started, so steps are placed back to back from the test start. The dashboard
   reporter writes the real start times.
3. **Only the last attempt's steps are kept.** Earlier attempts keep their status and error message.
4. **No attachments, traces, screenshots or console output.**
5. **Robot Framework wording** stays in the UI ("keywords", "library", "Robot Framework Dashboard"
   as the default title — use `-t` to set your own title).

## Running the adapter's tests

```bash
python -m pytest adapters/playwright/tests
node --test adapters/playwright/tests/dashboard-reporter.test.js
```

The Python tests convert small hand-written reports and read the result back with the dashboard's
own parser, so they also catch changes on the dashboard side that would break the adapter. The
Node.js tests cover the reporter's function lookup and grouping; they need no packages (with
`typescript` 5 installed they exercise the TypeScript lookup, else the line scan).

## Where this could go

Ideas, from least to most change to robotframework-dashboard itself:

- ship the converter as a separate pip package with its own command (no dashboard change);
- let `dashboard-reporter.js` write the `output.xml` itself and upload it to the dashboard server,
  like the Robot Framework listener does, and publish it on npm;
- a `--inputformat playwright` option in robotdashboard that converts on the fly.
