---
name: gh-issue
description: Work a GitHub issue end to end with the gh CLI — fetch the issue, branch, find the root cause, fix it, add a regression test, run the tests, self-review, then stop and report before committing. Use when the user says "work on gh issue N", "fix issue N", "look at issue N", "/gh-issue N", or pastes a GitHub issue URL.
argument-hint: <issue number or URL>
---

# Work on a GitHub issue

Issue: `$ARGUMENTS` (number or URL; strip the URL down to the number).

Repo: `MarketSquare/robotframework-dashboard` (`origin`). The user has push rights, so branches go straight to `origin` — no fork.

**Do not commit, push, or open a PR until the user explicitly says so.** Everything up to the report is autonomous; the commit is a manual gate.

---

## 1. Fetch and restate

```bash
gh issue view <N> --json title,body,labels,author,comments \
  -q '"# " + .title, "by " + .author.login, .body, (.comments[] | "--- " + .author.login + ":", .body)'
```

Restate the problem in one or two lines: expected vs. actual, and where in the product it shows (page, filter, CLI flag, server endpoint, listener). Note any attachment the reporter linked (zip of a dashboard, screenshots) — they tell you the reproduction path. If the issue is a feature request rather than a bug, say so and treat step 3 as "locate the extension point".

If the issue is genuinely ambiguous (two materially different readings), ask **one** question now; otherwise pick the most likely reading, state it, and continue.

## 2. Branch

```bash
git checkout main && git pull
git checkout -b fix/<N>-<short-slug>     # feat/<N>-… for feature requests
```

## 3. Load context and find the root cause

Pick the domain skill(s) that match the symptom and read them before touching code:

| Symptom area | Skill |
|---|---|
| Filters, overview→dashboard navigation, settings, layout persistence | `filtering-and-settings` |
| A graph, chart type, page section | `dashboard-graphs` |
| New widget / persisted feature | `js-features` |
| Missing JS/CSS in output, library versions, offline mode | `js-bundling` |
| Server endpoints, admin page, uploads | `server-api` |
| Listener / auto-upload | `listener-integration` |
| CLI flags, output.xml parsing, database | CLAUDE.md pipeline section + `dev-workflow` |

Then locate the defect. Useful moves:

- `grep` for the DOM id / CLI flag / function named in the report.
- For regressions: `git log -S'<snippet>' --oneline -- <path>` and `git log -L<start>,<end>:<file>` to find the commit that changed the behaviour — knowing *why* it changed prevents fixing it the wrong way.
- Reproduce with a generated dashboard when it's a UI bug: `python -m robotframework_dashboard.main -f tests -n robot_dashboard.html` (`dev-workflow` skill).

State the root cause in one sentence before writing the fix.

## 4. Fix

Smallest change that addresses the root cause; match surrounding style (`coding-standards` skill). Leave a short comment only where the code would otherwise mislead again (e.g. an id/value mismatch).

## 5. Regression test

Add a test in the tier that can actually observe the bug (`testing` skill → "Adding a test — which tier?"). For dashboard behaviour that is a robot test:

- Reuse or add readable keywords in `tests/robot/resources/keywords/dashboard-keywords.resource`; keep the test case itself to a handful of high-level lines like its neighbours.
- Prefer DOM/state assertions over screenshots unless rendering is the thing under test.
- Run it **in Docker** (`bash scripts/docker/run-in-robot-container.sh robot --outputdir results -t "<name>" tests/robot/testsuites/<suite>.robot`).
- Prove it: `git stash push -- <fixed source file>` → run → must FAIL; `git stash pop` → run → must PASS.

Then run the full suite of that tier (still Docker for robot) so shared keywords you touched are exercised everywhere.

## 6. Self-review

- `git diff` — read every hunk; drop anything not needed for the fix.
- Run `/code-review` on the diff and act on real findings.
- Check whether user-facing behaviour changed → `documentation` skill checklist. CHANGELOG.md is written at release time (`release` skill), not per fix.
- Remove generated artefacts (`results/`, `robot_dashboard.html`, `robot_results.db`).

## 7. Report and stop

Post, in this order:

1. **Bug** — one line, plus root cause with `file:line` links and the introducing commit if it was a regression.
2. **Fix** — what changed and why that is the right layer.
3. **Tests** — what was added, evidence it fails without the fix and passes with it, full-suite result line (`N tests, N passed, 0 failed`).
4. **Diff** — `git diff --stat` and anything the user should look at closely.
5. **Not done** — docs/changelog decisions left to the user, anything out of scope you noticed.

Then wait. Do not commit.

## 8. After the user confirms

Only on an explicit "commit", "push", or "make a PR":

```bash
git add <files>
git commit -F - <<'EOF'
fix: <what> (#<N>)

<why: root cause and the reasoning behind the fix, wrapped at 72 columns>

Co-Authored-By: <attribution line from the session, if any>
EOF
git push -u origin <branch>
gh pr create --base main --title "fix: <what> (#<N>)" --body-file - <<'EOF'
Fixes #<N>

## Problem
## Root cause
## Fix
## Tests

<generated-with attribution line from the session, if any>
EOF
```

Use `feat:` / `docs:` / `chore:` prefixes as appropriate. Report the PR URL.
