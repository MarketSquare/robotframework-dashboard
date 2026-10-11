---
outline: deep
---

# Live View and Editor Integration

The **Live** page shows a Robot Framework run while it happens, keyword by keyword: which test runs, which
steps passed or failed, their arguments, log messages and screenshots. Finished runs can be replayed on the
same page, moving back and forth through the run with a slider.

The Live page is fed by [robotframework-events](https://github.com/timdegroot1996/robotframework-events), a
listener that writes every suite, test, keyword, control structure and log message of a run as JSON Lines.

The Live page is only available when the dashboard is shown inside an editor (RobotCode in VS Code, later
PyCharm), just like the Admin page is only available with `--server`. A dashboard opened in a browser has
no **Live** menu item.

## Requirements

- Robot Framework 7.0 or newer
- `robotframework-events` 0.2.0 or newer in the environment that runs the tests

```bash
pip install robotframework-events
```

## Recording events

Add the listener to your runs:

```bash
robot --listener robotframework_events.Listener tests/
```

The listener writes its events next to the output file, named like it with `output` replaced by `events`,
the same way [Log Linking](/log-linking.md) finds `log.html`:

| Output file | Events file |
|---|---|
| `results/output.xml` | `results/events.jsonl` |
| `results/output-20261010.xml` | `results/events-20261010.jsonl` |

Gzipped events files (`events.jsonl.gz`) are found as well.

## Watching a run live in an editor

In **VS Code**, RobotCode shows the dashboard in an editor tab and feeds its Live page while you run tests
from the Test Explorer:

1. Turn on the `robotcode.dashboard.enabled` setting (or answer **Enable** in the message RobotCode shows once).
   RobotCode offers to install `robotframework-events` and `robotframework-dashboard` in the project's Python
   environment; projects managed by uv, Poetry, PDM, Pixi, Hatch or conda get the command to run instead.
2. Run tests. The Live page opens and follows the running step. When the run ends it is added to the history.

The same switch in `robot.toml` works for every RobotCode run, also outside VS Code:

```toml
[tool.robotcode-dashboard]
enabled = true
```

An explicit editor setting takes precedence over `robot.toml`. When the dashboard is turned off, RobotCode adds
no listener to your runs at all.

From the command line, `rfevents tail -f results/events.jsonl` (part of robotframework-events) shows a run in
the terminal while it happens.

## The Live page

- **Header**: tests done, passed, failed and skipped, the elapsed time and the expected time **remaining**:
  the usual duration (median of earlier runs) of every test that still has to run, plus what remains of the
  running test. It follows the tests you actually selected (a single test, `--include`, ...). Tests without
  history count with the average of the others; when fewer than half of the remaining tests have history,
  no estimate is shown. Needs `robotframework-events` 0.4.0 or newer.
- **Test list**: every test with its status and duration. The running test opens into its step tree and the
  list follows the running step; scrolling or clicking stops following until **Resume live view**. A test that
  takes clearly longer than in earlier runs (over 1.5 times its median, and at least a second longer) gets a
  **slower than usual** badge.
- **Step tree**: keywords and control structures with their arguments. Long loops show their first, last,
  running and failed iterations; long step lists show their first 100 steps and reveal more on request.
- **Details**: the selected test or step with the tabs **Call** (arguments, location), **Log** (messages),
  **Error** and **Screenshots** (images that the step or the steps below it logged, for example Browser or
  SeleniumLibrary screenshots).

## Replaying a run

A finished run opens at its end; the slider moves to any moment of the run, and **Close replay** goes back
to the live view.

- **Open events file** loads an `events.jsonl` or `events.jsonl.gz` file, for example one from a CI job.
- **Replay a run...** (in an editor) lists the runs in the history and replays the one you pick from its
  archived events file.

## Embedding the dashboard in an editor

Editors show the dashboard with `--embed`: a page without data that asks its host for it. See
[Generate a dashboard for an editor host](/basic-command-line-interface-cli.md#generate-a-dashboard-for-an-editor-host)
for the flag and the messages between page and host.
