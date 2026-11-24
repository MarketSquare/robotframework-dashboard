---
outline: deep
---

# Large-data loading and usable recovery

| Field | Value |
| --- | --- |
| Status | Draft; phase 1 local implementation for review |
| Requested by | Dashboard user operating a multi-environment regression dashboard |
| Approver | Repository maintainer; approval pending |
| Updated | 2026-11-24 |
| Scope | Standalone HTML exports and the same reports hosted with `--server` |

## Problem and evidence

The generated report embeds five compressed JSON arrays: runs, suites, tests,
keywords, and exceptions. The browser unpacks every included environment before
applying filters. Server mode serves this generated file; viewing a filtered URL
does not perform a filtered database query.

The reported failure contained approximately 50 days of multi-environment
results: 1,164 runs, 722,642 test rows, and 1,451,649 keyword rows. The HTML was
approximately 133 MB; test and keyword JSON expanded to 514.8 and 520.3 MiB.
Chrome reported `Unexpected end of JSON input`, consistent with exceeding its
single-string limit. The downloaded payloads independently validated as complete
JSON. Startup rejected without an error handler and left the loading animation
running. This is a failing acceptance baseline, not a proposed maximum capacity.

## Requirements

1. Support larger histories without requiring deletion or shorter retention as
   the application's solution. Establish supported workload, browser, loading
   time, and peak-memory targets with the maintainer using representative data.
2. Help the user continue working when full history cannot be opened. Offer and,
   when possible, automatically open a smaller, clearly identified history.
   An error message by itself does not satisfy this requirement.
3. Show understandable loading stages and actionable recovery controls. Never
   present incomplete data as a complete history or leave a known failed load
   behind a running spinner. Report corrupt/unsupported data honestly.
4. Preserve accurate filters, chart values, and table values within the loaded
   scope. Make the loaded run count and reduced scope visible across pages.
5. Apply the shared recovery to both hosted and standalone reports while
   preserving the standalone file's portability.
6. Keep the existing stack and a reviewable implementation scope. Seek maintainer
   agreement on the design before a broad architectural change or upstream merge.

## Phase 1: recover into usable recent results

### Proposed local implementation

- Preserve the existing compressed payload format and all database contents.
- Load the run index first, then the other datasets one at a time to reduce
  simultaneous allocations and identify the current loading stage.
- Keep the native JSON path for a normal full load. If it fails, retry once with
  the latest 20 runs per project matching the URL's valid run-name and run-tag
  selections, using the existing Amount per project semantics.
- During this retry, read decompressed JSON as a stream of records. Parse one
  record at a time and retain only records belonging to the selected runs.
  Filtering after the existing whole-array JSON parse cannot recover the failure.
- Allow an explicit smaller initial load, so users can avoid repeating a failed
  full attempt. Keep retry controls on the loading/error screen, where the regular
  filter UI is not yet initialized.
- Use the existing Filters dialog after loading. Retain the full small run index
  so project, tag, version, metadata, custom-filter, and date choices include
  results outside the initial subset. Open missing details for the selected runs
  before rendering charts and tables, invalidate transformed-data caches when
  arrays change, and avoid binding chart/listener initialization twice.
- Use the existing Reset Filters action to recover from an empty combination.
- Match a selected suite path across the embedded suite history before applying
  the amount, collecting matching run IDs without retaining every suite object.
- Display a persistent recent-history notice with loaded/available counts and
  the recorded date range and a shortcut to Filters. Do not duplicate project and
  history controls in this notice. Other environments and older runs remain
  available through the existing filters and in the original report/database.
- Suppress the reduced-history notice when an explicit recent-run limit includes
  the entire report or all currently matching runs are shown; "18 of 18" does
  not indicate a reduced history. Use result counts, dates, and a Filters action
  rather than explaining the background loading mechanism in the notice.
- If recovery also fails, stop the animation, explain that this report could not
  be opened, and keep retry/smaller-history controls available. Put technical
  diagnostics behind a disclosure, using text rather than unescaped HTML.

### Boundaries and limitations

This phase still downloads the complete standalone HTML and scans its compressed
datasets during recovery. It reduces retained objects and avoids a giant decoded
JSON string; it does not claim unlimited capacity, eliminate generation costs,
or make every browser out-of-memory termination catchable. One unusually large
run can still be too expensive. Changing filters can require another scan of the
embedded data. The suite path navigator lists paths in the currently opened
details; changing the run/date filters first exposes paths unique to older runs.
Selecting All Runs can still exceed available memory. This is usable recovery,
not the final capacity solution.

Recovery is triggered by a failed data read/parse, not an elapsed-time timeout.
A slow read that has not failed is not automatically abandoned. A future deadline
needs a way to cancel or isolate the original work; racing a timer against the
same uncancellable parse can leave both loads consuming memory.

No backend API, React migration, database/schema change, new runtime dependency,
automatic deletion, production deployment, or change to retention belongs to this
phase. Existing generated reports receive the change only when regenerated.

### Validation

- Unit-test streamed framing across arbitrary text/UTF-8 chunk boundaries,
  escaped quotes and braces, nested arrays/objects, malformed/truncated input,
  reader failures, and record selection.
- Exercise real compressed fixtures, selected run/tag scope, full-load failure
  followed by successful recovery, explicit smaller loads, and failed recovery.
- Generate reports from source and run the project JavaScript/Python checks.
- Add Docker-only browser acceptance coverage for a reduced load, visible scope,
  changing history, and a corrupt payload that stops the spinner.
- Measure the original failing workload locally when available; record elapsed
  loading time, peak memory if available, and retained run/record counts. Never
  commit internal regression data as a fixture.

### Local validation recorded on 2026-11-24

The original failing report was read locally without changing the deployment or
database. A direct recent load selected 20 of the 55 matching regression runs,
with 2,578 suites, 30,103 tests, 46,822 keyword rows, and 598 exceptions. Every
dependent record belonged to the loaded run set.

| Local Node.js 24 observation | Data-loading time | Peak process RSS |
| --- | --- | --- |
| Stream the latest 20 matching runs directly | 6.8 seconds | 696 MiB |
| Attempt full history, encounter the native string limit, then recover automatically | 9.3 seconds | 2,059 MiB |

These are single local observations, not browser performance targets. RSS
includes reading the benchmark input and runtime overhead. In particular, the
failed full attempt has a substantially higher peak; opening a smaller scope
directly avoids that attempt. Browser process termination from memory exhaustion
remains a limitation to address in the next design stage.

Before the filter integration, validation passed: 589 JavaScript unit tests,
524 Python tests, and 12 targeted Docker browser acceptance tests. Browser coverage includes normal chart
statistics, result-data escaping, hosted recovery without database deletion,
automatic recovery, scope changes/full-history restoration, clearing an empty
scope, avoiding a misleading notice when all runs fit, and corrupt-data handling.
The six loading cases passed again after the notice adjustment. The original report was exercised by the local
data-loader benchmark; browser acceptance used the repository's generated data.

A separate local manual demo used 60 generated sample runs and deliberately
rejected the full-history JSON read after four seconds. Chrome showed the initial
loading stage, logged the simulated full-read failure, and automatically rendered
recent results with the recovery notice. The integrated Amount per project default
opens up to 20 runs from each project. Refreshing replays the same flow. This
fault injection exists only in the local demo wrapper, outside shipped code.

After integrating recovery with the existing Filters dialog, validation passed:
594 JavaScript tests, 524 Python tests, eight loading/recovery browser tests, and
nine browser regression tests for normal chart statistics, URL filters, amount
semantics, and hosted recovery without deletion. Browser tests verified switching
projects, opening older dates outside the initial subset, suite matching before
the amount limit, resetting an empty selection, and restoring all matching runs.
Manual Chrome verification opened all 30 runs of one demo project through Filters
after recovery had opened only its latest 20. Both local preview servers were
refreshed with the updated frontend.

With the final notice wording, validation passed: 600 JavaScript tests, 524 Python
tests, and the full 158-test Robot suite in Docker. The runner retried one existing
CLI test after a SQLite disk I/O error; the merged result was 158 passed. The nine
loading cases cover the notice text, hiding it for complete matching selections,
and the recovery/filter behavior above. A separate browser recording checks a
60-run sample report, an injected full-read failure, and opening all 30 runs of
one project through Filters. Demo media contains generated sample data only.

The current loader was also exercised against the original large report again.
Its native full read raised `ERR_STRING_TOO_LONG`, then recovery returned the
same 20-run selection and detail counts shown above. This confirms the actual
string-limit path in a local Node process; it is not a browser timing guarantee.

## Phase 2: choose the scalable shared design

Compare bounded embedded chunks with a manifest and on-demand loading against
other maintainable approaches. Loading every chunk immediately is insufficient:
it avoids a string limit but still retains the entire history. Consider keeping
small overview summaries separate from detailed results and fetching/unpacking
details only for the selected scope. Preserve standalone portability and existing
filter semantics. Define measurable capacity and compatibility targets before
selecting the implementation.

## Phase 3: evaluate a dedicated server data path

If shared improvements cannot meet the agreed goals, propose filtered API reads,
server-calculated chart summaries, and paginated detail tables. Keep this an
explicit maintainer decision; a server-only solution does not solve standalone
exports. Evaluate ingestion/regeneration costs and custom database compatibility.

## Alternatives and review

| Alternative | Benefit | Cost or reason to defer |
| --- | --- | --- |
| Error message only | Small change | Does not let users open their data |
| Prune older database rows | Immediate operational relief | Removes active history and does not meet the application requirement |
| Embed a second recent-results snapshot | Simple native decoding | Duplicates data in each file and fixes the available recovery scope at generation |
| Stream a selected subset from existing payloads | Shared recovery without a new file format | Still scans and downloads the full report; framing and failure behavior need focused tests |
| Full streamed load | Avoids a single giant JSON string | Retains all objects, so memory can still fail |
| New API-driven server frontend | Bounds network and browser work | Larger change; standalone support still needs a separate solution |

Review sequence: agree on the recovery UX and compatibility boundaries; review
phase 1 as a focused change; use measurements to decide phase 2/3. Do not treat
this draft or a local implementation as maintainer approval.

## Delivery checklist

- [x] Record the requirements, evidence, phased options, and approval boundary.
- [x] Implement and validate phase 1 recovery and loading UX locally.
- [ ] Review phase 1 with the user and repository maintainer.
- [ ] Agree on capacity/performance targets and representative benchmark cases.
- [ ] Select and approve the scalable design before broad implementation.

## Decision log

| Date | Decision | Status |
| --- | --- | --- |
| 2026-11-24 | A smaller usable view, with explicit scope, is required; error-only handling is insufficient | User requirement |
| 2026-11-24 | Investigate a shared recovery path before committing to a server-only refactor | Proposed; maintainer review pending |
| 2026-11-24 | Use the existing Filters dialog for both selection and opening matching details; remove duplicate loaded-history controls | User UX feedback; implemented locally |
