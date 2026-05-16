---
description: Use when the user says "Do the release actions" or asks to prepare a new release. Covers all steps to bump the version, update tests, regenerate the example, update the changelog, produce Slack notes, and create a skill.
---

# Release Actions

Follow these steps in order when doing a release. Ask the user for the **new version number** and **changelog content** (list of PRs/changes from GitHub) before starting if they haven't been provided.

---

## Step 0 — Collect inputs

Ask the user (if not already provided):
1. **New version number** (e.g. `2.1.0`)
2. **Previous version number** (e.g. `2.0.0`) — used for the GitHub compare URL
3. **Release date** in `YYYY-MM-DD` format (default: today)
4. **Raw changelog** — the GitHub "What's Changed" PR list for this release

---

## Step 1 — Update version numbers

Files to update:

| File | What to change |
|---|---|
| `robotframework_dashboard/version.py` | `__version__ = "Robotdashboard X.Y.Z"` |
| `setup.py` | `version="X.Y.Z"` |

Both must use the exact same new version number.

---

## Step 2 — Update the CLI test expected output

File: `tests/robot/resources/cli_output/version.txt`

The last line of this file is the version string that the robot test compares against the CLI `--version` output. Update it to:
```
Robotdashboard X.Y.Z
```

Do not change the ASCII art banner lines above it.

---

## Step 3 — Regenerate the example dashboard and database

The example dashboard and database live in `example/robot_dashboard.html` and `example/robot_results.db`.

Run these commands from the repo root:

```bat
:: Windows
if exist robot_results.db del robot_results.db
if exist robot_dashboard.html del robot_dashboard.html
scripts\example.bat
copy robot_results.db example\robot_results.db
copy robot_dashboard.html example\robot_dashboard.html
```

```bash
# Linux / macOS
rm -f robot_results.db robot_dashboard.html
bash scripts/example.sh
cp robot_results.db example/robot_results.db
cp robot_dashboard.html example/robot_dashboard.html
```

The `scripts/example.bat` (or `.sh`) script imports all test `output.xml` files with various tags and options to create a rich example dashboard.

---

## Step 4 — Update CHANGELOG.md

Insert a new section **at the top** of the changelog (after the header block, before the previous latest version). Match the existing style exactly.

**Template:**
```markdown
## [X.Y.Z](https://github.com/MarketSquare/robotframework-dashboard/releases/tag/vX.Y.Z) - YYYY-MM-DD

### Added
- <feature description>

### Fixed
- <fix description>

### Changed
- <change description>

---
```

Rules:
- Only include `### Added`, `### Fixed`, `### Changed` sections that are non-empty.
- Write human-readable bullet points — do not paste the raw PR titles verbatim. Rewrite them as clear, user-facing descriptions.
- Omit contributor attribution and PR URLs (those belong on GitHub Releases, not the changelog).
- Use backticks for CLI flags, file names, and code references.

---

## Step 5 — Generate Slack release notes

Produce a ready-to-paste Slack message. Be **verbose** — explain how each feature works with a short example where helpful, and link to the relevant documentation page.

Documentation base URL: `https://marketsquare.github.io/robotframework-dashboard/`

Key doc pages and their slugs:
- `filtering.html` — filters, tag modes (AND/OR/NOT), custom filters, versions
- `log-linking.html` — log URL support, `--uselogs` flag
- `basic-command-line-interface-cli.html` — CLI flags, `--customfilters`, output import
- `listener-integration.html` — listener, standalone push script
- `customization.html` — layout, undo/redo, GridStack
- `performance.html` — benchmarking, scale data
- `graphs-tables.html` — charts, data tables, horizontal scrolling
- `settings.html` — settings modal, themes, widget toggles

**Shout out external contributors** — scan all PR entries for authors who are *not* `@timdegroot1996` and call them out by name with a :pray: in the relevant bullet or in a dedicated thanks line.

Format:

```
:robot: *Robot Framework Dashboard vX.Y.Z is out!* :tada:

<one-line summary of the release theme>

---

*:new: Added*

• *<Feature name>* — <2–3 sentences explaining what it does and why it's useful. Include a short code example if applicable.> → <docs link>

*:wrench: Fixed*

• <fix description>. Thanks *@contributor* for the fix! :pray:

*:arrows_counterclockwise: Changed*

• <change description>

---

*:bookmark: Resources*
Full changelog: <compare URL>
PyPI: <pypi URL>
Docs: https://marketsquare.github.io/robotframework-dashboard/
Example dashboard: https://marketsquare.github.io/robotframework-dashboard/example/robot_dashboard.html
```

---

## Step 6 — Update the copilot instructions (optional)

If a **new skill file** was created as part of this release, add it to the skills table in `.github/copilot-instructions.md`.

---

## Quick checklist

- [ ] `robotframework_dashboard/version.py` — version updated
- [ ] `setup.py` — version updated
- [ ] `tests/robot/resources/cli_output/version.txt` — version string updated
- [ ] `example/robot_dashboard.html` — regenerated
- [ ] `example/robot_results.db` — regenerated
- [ ] `CHANGELOG.md` — new section added at the top
- [ ] Slack release notes produced
