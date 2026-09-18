# Fixture generator

Source of the `output-*.xml` / `log-*.html` files in `tests/robot/resources/outputs/`.
Those fixtures feed the robot acceptance tests, the python unit tests and the example
dashboard (`scripts/example.py`). **They are generated, never edited by hand.**

Nothing here is part of the test suite: `scripts/robot-tests.sh` only runs
`tests/robot/testsuites/*.robot`, and pytest/vitest have their own folders. Do not
add these suites to any runner.

## Regenerate

```bash
python tests/robot/resources/generator/generate.py           # all 18 runs, ~8 minutes
python tests/robot/resources/generator/generate.py --only 10 # one SCHEDULE entry, for a quick look
python tests/robot/resources/generator/generate.py --outdir /tmp/fixtures --keep
```

The suites import the fake libraries by bare name (`Library    ApiSim`); `generate.py`
passes `--pythonpath libraries`, and `robot.toml` in the repo root gives RobotCode the same
path so the editor resolves the keywords.

Requires only `robotframework` (the version in your environment is the version that
ends up in the `generator` attribute of the fixtures). Output goes to
`tests/robot/resources/outputs/`; existing fixtures there are deleted first unless
`--keep` is given.

After regenerating, everything derived from the fixtures must be refreshed:
robot reference screenshots / `cli_output` / `database_output` (in Docker, see the
`testing` skill) and `example/robot_dashboard.html` + `example/robot_results.db`
(`scripts/example.py`, see the `release` skill).

## What is simulated

Two projects, no external system involved. All "browser" and "HTTP" keywords are
fakes (`libraries/BrowserSim.py`, `libraries/ApiSim.py`) that sleep for a scaled
duration and fail when the plan for the test says so.

| Project | Suite files | Tests | Style |
|---|---|---|---|
| `WebshopUI` | `login*`, `catalog_*`, `cart*`, `checkout*`, `account_*` | ~113 | page-object resources on top of BrowserSim |
| `WebshopAPI` | `auth_tokens`, `products*`, `orders*` | 50 | request helpers on top of ApiSim |

Each project is one flat folder of `.robot` files (prefixed by area) plus a `resources/`
folder, so the suite hierarchy in the fixtures is `<project>.<file suite>`.

`generate.py` runs each project several times (`SCHEDULE`), each run with its own
`RUN_INDEX`, start time and `Environment` metadata. Suite files listed in
`ADDED_FILES` / `REMOVED_FILES` appear or disappear at a given run index so the
test set evolves over time.

## Where behaviour is declared

`libraries/profiles.py` is the only file to touch to change *what* the data shows:

| Setting | Drives |
|---|---|
| `PROFILES` (per test name) | `always-fail`, `flaky:<rate>`, `broken-since:<run>`, `fixed-since:<run>`, `slow-outlier:<rate>`, `slower-every-run:<step>`, `faster-every-run:<step>` |
| `FEATURE_FLAGS` | tests calling `Require Feature <flag>` are skipped when the flag is off for that run |
| `CLEAN_RUNS` | runs that must be all green (no failures, flags forced on) or yellow (no failures, skips kept) |
| `BAD_RUNS` | runs with an outage: extra failures with shared messages, more exceptions |
| `EXCEPTION_RATES` / `EXCEPTION_MESSAGES` | keywords inside `TRY` blocks raise caught exceptions (Keyword Exceptions graph / exceptions table) |
| `RERUNS` (in `generate.py`) | runs whose failed tests are re-executed with `robot --rerunfailed` (1 or 2 times) and merged with `rebot --merge`, giving tests an attempt history (Reruns select, blue borders, `attempts` column) |
| `FAILURE_MESSAGES` / `OUTAGE_MESSAGES` | message pools per leaf keyword; placeholders come from keyword arguments |
| `STEP_WEIGHTS` | which keywords a planned failure prefers to surface in (Keyword Most Failed) |

Tests not listed in `PROFILES` always pass. Everything is seeded from `SEED`,
`RUN_INDEX` and the test name, so regenerating gives the same statuses and messages;
only durations carry a little real-time noise.

## How a run is produced

1. **Calibrate** – the project runs once in `SIM_MODE:count` (no sleeps, no failures)
   to record how many leaf steps each test has (setup vs body). Plans use this to place
   failures inside the test body.
2. **Run** – `robot --name <project> --variable RUN_INDEX:n …` on a temporary copy of the
   project with the files for that run index. Leaf keywords sleep `target / SIM_SCALE`.
3. **Shift** – every `start`/`time` attribute is moved so the run starts at the
   scheduled time and every `elapsed` is multiplied by `SIM_SCALE`, giving realistic
   multi-minute runs from a ~25 s execution.
4. **Rerun** – for runs in `RERUNS`, `robot --rerunfailed` re-executes the failed tests
   (different `SEED`, so flaky/outage failures can recover) starting two minutes after
   the previous attempt ended, and `rebot --merge` combines the attempts into the final
   output. The merged file keeps the scheduled start as `generated` so the run identity
   is stable.
5. **Log** – `rebot` renders `log-<stamp>.html` from the shifted output so `--uselogs`
   / `-l` linking works.

## Adding tests or keywords

* Add test cases to the `.robot` files as in any Robot project; give interesting ones
  an entry in `PROFILES`.
* New leaf keywords go in `BrowserSim.py` / `ApiSim.py`: one line `SIM.step("<Name>",
  <target seconds>, **args)`; add a message pool for it in `FAILURE_MESSAGES` if it
  should be able to fail with a specific message.
* Exceptions only come from keywords inside a `TRY` whose `EXCEPT` lists the class-name
  globs used in `EXCEPTION_MESSAGES` for that project.
