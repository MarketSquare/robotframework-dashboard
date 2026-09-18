---
outline: deep
---

# Reruns (`--rerunfailed`)

Robot Framework can re-execute only the tests that failed (`robot --rerunfailed`) and then combine the original run and the rerun(s) into one result with `rebot --merge`. robotdashboard understands such merged outputs: every re-executed test keeps its **attempt history**, so you can see which tests only passed after a retry, and which ones failed on every attempt.

## How it works

`rebot --merge` keeps a single result per test (the last attempt), but records the status and message of every earlier attempt in the test message. robotdashboard reads that history when the output is processed and stores it per test as `attempts` (first attempt to last), while the test itself keeps its final status and message.

Nothing changes for outputs that were not merged: a test that ran once has no attempt history.

::: tip Why merged outputs and not separate uploads?
A rerun output only contains the tests that failed, so uploading it as a run of its own would show up as a tiny run (e.g. 5 of 100 tests) in every graph and become the "latest run" on the overview. Merging with `rebot --merge` is the workflow Robot Framework itself recommends and gives the dashboard one complete run with all attempts attached. Upload **only the merged output**, not the original and the rerun next to it.
:::

## Producing a merged output

```bash
robot --output original.xml tests/
robot --rerunfailed original.xml --output rerun.xml tests/
rebot --merge --output output.xml original.xml rerun.xml
```

A second rerun is merged the same way (`rebot --merge --output output.xml original.xml rerun1.xml rerun2.xml`, or merge again on top of an already merged output): every attempt is kept in order.

Then add the merged `output.xml` like any other run:

```bash
robotdashboard --outputpath output.xml
```

With the [server](dashboard-server.md), upload the merged file after the `rebot --merge` step: the [standalone script](listener-integration.md#pushing-outputxml-without-a-test-run-robotdashboardscriptpy), a request to [`/add-outputs`](dashboard-server.md#server-features-endpoints) or the [admin page](dashboard-server.md#adding-outputs) all work. Only the [listener](listener-integration.md) does not fit: it uploads the output of the robot run it is attached to when that run ends, which is before `rebot --merge` has produced the merged file.

::: warning Run start of a merged output
robotdashboard uses the `generated` timestamp of the `output.xml` as the run identity. For a merged output that is the moment `rebot --merge` ran, i.e. shortly after the last rerun finished.
:::

## Where reruns show up

### Test Statistics graph

The Test section's filter bar (Dashboard → Test section) has a **Reruns** select that changes how the Test Statistics graph (timeline and line view) shows re-executed tests:

| Option | Shows |
|---|---|
| **Mark Reruns** (default) | The merged result, but every re-executed test gets a blue border so recovered tests (green with a blue border) and hard failures (red with a blue border) stand out. |
| **Final Result** | The merged result without any marking. Re-executed tests look like any other test. |
| **First Attempt** | The status of the first attempt instead of the final one, also with the blue border. Consistent first-attempt failures that pass on retry show up as red bars here. |

Hovering a re-executed test lists all attempts in the tooltip, for example:

```
Run: 2026-09-01 02:15:19
Status: PASS
Duration: 12.4s
Attempts: FAIL → PASS
  1. FAIL - Timeout 10000ms exceeded waiting for 'css=.cart-total' to be visible
  2. PASS
```

The setting is persisted like the other section filters and also drives the Most Flaky and Messages graphs below. The Compare page has its own **Reruns** select in its filter bar for the Tests graph.

::: tip Combining with Only Changes / Status
In the **Mark Reruns** and **First Attempt** views a re-executed test is a change in itself (its bar differs from a normal one), so *Only Changes* also lists tests that were green in every run but needed a retry once, and *Status* drops them.
:::

### Most Flaky / Recent Most Flaky

A status change inside the attempt history counts as a flip: a test that fails on the first attempt and passes on the rerun every night is flaky, even though every run ends green. The timeline view marks re-executed tests with the same blue border and lists the attempts in the tooltip. With the Reruns select on **Final Result** the attempt history is ignored, as before.

### Messages, Most Failed, Recent Most Failed

The timeline views mark re-executed tests with the blue border and list the attempts (with the message of every attempt) in the tooltip, so the error a test recovered from on rerun is still one hover away. The counts themselves are unchanged: only the final result of a test is counted.

### Stat widgets

The *Add Stat Widget* dialog of the Test section offers **Re-executed Tests**, **Recovered On Rerun** (failed at least once, passed in the end) and **Failed All Attempts**, counted over the filtered runs like the other test stats.

### Overview

Run cards on the Overview page get a **Rerun: N (fixed M)** line below Passed/Failed/Skipped when tests in that run were re-executed: N tests were retried, M of them passed on a rerun.

### Tables page

The Tests table has an `attempts` column with the status of every attempt (`FAIL → PASS`), empty for tests that ran once.

### Custom database classes

The `tests` rows returned by [`get_data()`](custom-database-class.md) may contain an `attempts` key with the JSON-encoded attempt list, e.g. `[{"status": "FAIL", "message": "..."}, {"status": "PASS", "message": ""}]`. Leave it empty (or out) for tests without rerun history.
