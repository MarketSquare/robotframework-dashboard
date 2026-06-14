---
description: Use when you need to run the tool locally during development to generate a dashboard HTML file, or when testing changes to the Python CLI, template, JS, or CSS.
---

# Development Workflow

## Running the Tool (without installation)

The `robotdashboard` CLI command is only available after `pip install`. In a development environment where the package is **not installed**, use the module runner directly:

```powershell
# Windows (PowerShell)
python -m robotframework_dashboard.main -o results\output-20251225-172034.xml

# Linux / macOS
python -m robotframework_dashboard.main -o results/output-20251225-172034.xml
```

This invokes `robotframework_dashboard/main.py:main()` directly and supports all the same CLI flags.

## Common Dev Invocations

```powershell
# Generate a dashboard from a single output.xml (default output: robot_dashboard_<timestamp>.html)
python -m robotframework_dashboard.main -o results\output-20251225-172034.xml

# Generate from multiple output.xml files
python -m robotframework_dashboard.main -o results\output-20251225-172034.xml results\output-20251225-172037.xml

# Generate from a folder of output.xml files
python -m robotframework_dashboard.main -f results

# Use a custom output HTML path (-n / --namedashboard, NOT -g)
python -m robotframework_dashboard.main -o results\output-20251225-172034.xml -n my_dashboard.html

# Offline mode (no CDN, all dependencies embedded)
python -m robotframework_dashboard.main -o results\output-20251225-172034.xml --offlinedependencies
```

`-g` / `--generatedashboard` is a **boolean** flag (default `True`) — it does not take a filename. Use `-n` / `--namedashboard` for a custom output path.

## Generated Output

- Default output file: `robot_dashboard_<yyyymmdd-hhmmss>.html` in the current working directory, unless `-n` is given.
- The file is fully self-contained: all JS, CSS, and data are embedded — open it directly in a browser with no server needed.
- Default database file: `robot_results.db`. Re-running does **not** overwrite an existing database. To reset, delete the `.db` file before re-running, or specify a different `-d DATABASEPATH`.

## Inspecting JS/CSS Changes

Since `DependencyProcessor` bundles JS/CSS into the HTML at generation time, you must re-run the generator after every JS or CSS change to see it reflected in the dashboard. There is no hot-reload.

Steps:
1. Edit JS/CSS in `robotframework_dashboard/js/` or `robotframework_dashboard/css/`.
2. Re-run: `python -m robotframework_dashboard.main -o <output.xml>`.
3. Open `robot_dashboard.html` in a browser (or hard-refresh if already open).

## Inspecting Template Changes

Template changes in `robotframework_dashboard/templates/dashboard.html` also require re-running the generator.

## Typical Dev Loop

```powershell
# 1. Make changes to js/, css/, or templates/
# 2. Regenerate (delete old db if you want a clean state)
Remove-Item robot_results.db -ErrorAction SilentlyContinue
python -m robotframework_dashboard.main -o results\output-20251225-172034.xml -n robot_dashboard.html
# 3. Open robot_dashboard.html in a browser
```

## Validating JS/CSS/Template Changes

After any change to `robotframework_dashboard/js/`, `css/`, or `templates/dashboard.html`, **regenerate the HTML** to confirm the bundler/template still produce valid output — importing a module and checking it doesn't throw is not enough, since most bugs (rendering, layout, icon sizing, click handlers) only show up in the bundled, rendered output.

The repo ships with output.xml fixtures under `tests/` that work as a ready-made dataset:

```bash
# From the repo root (Git Bash / Linux / macOS)
python -m robotframework_dashboard.main -f tests -n robot_dashboard.html
```

```powershell
# Windows PowerShell
python -m robotframework_dashboard.main -f tests -n robot_dashboard.html
```

**Do not install or drive a browser (Playwright, Selenium, etc.) as part of this validation.** Regenerating the dashboard without errors, plus a careful read of the diff, is the AI agent's verification step. Actually opening `robot_dashboard.html` and exercising the feature in a browser (e.g. enabling "Customize Layout" to check edit-mode controls) is a manual step left to the developer — describe what to click and what to expect instead of trying to automate it.

Clean up the generated `robot_dashboard.html` and `robot_results.db` once done if they aren't meant to be committed.

### Gotcha: trailing backslashes in paths (Git Bash)

In Git Bash on Windows, a Windows-style path with a trailing backslash (e.g. `-f .\tests\`) gets the backslash interpreted as escaping the following space — this silently merges the *next* argument (and its value) into the path, so e.g. `-f .\tests\ -n robot_dashboard.html` is parsed as a single `-f` value and `-n`/`robot_dashboard.html` are swallowed, silently falling back to defaults. Use a forward-slash path with no trailing slash instead: `-f tests`.
