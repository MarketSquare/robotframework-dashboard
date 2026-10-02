# Adapters (experimental)

robotframework-dashboard reads Robot Framework `output.xml` files. An adapter converts the results
of another test framework into such a file, using Robot Framework's own result model, so the
dashboard, database, server and log linking work unchanged.

| Adapter | Reads | Folder |
|---|---|---|
| Playwright | Playwright Test JSON report (`--reporter=json`), or the report of the included `dashboard-reporter.js`, which adds every action, `expect()` and hook as keyword | [playwright/](playwright/README.md) |
| Cucumber | Cucumber JSON (`json:`) or Messages NDJSON (`message:`) report; Cucumber-JVM, cucumber-js, … | [cucumber/](cucumber/README.md) |

Each adapter is one self-contained Python file with a command line and an importable `convert()`
function, so it can be copied into a CI job on its own. Each folder also has a sample project, a
`demo.py` that runs the sample a few times and builds a dashboard, and unit tests:

```bash
python -m pytest adapters
```

Shared conventions, so results look alike in the dashboard whatever framework produced them:

- one test run is one dashboard run; the run start comes from the report, so converting the same
  report twice is recognised as a duplicate;
- retries become the `rebot --merge` attempt history; passing on a retry adds tag `flaky`;
- error messages are reduced to the part that is the same every run (no stack traces, code frames
  or session ids), because the dashboard groups failures on their message;
- tests that never ran because something before them broke are FAIL, like tests under a failed
  Robot Framework suite setup, not SKIP;
- dots in names become `_`, as the dashboard splits suite paths on `.`.
