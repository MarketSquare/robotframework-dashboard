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
# Generate a dashboard from a single output.xml into robot_dashboard.html (default output)
python -m robotframework_dashboard.main -o results\output-20251225-172034.xml

# Generate from multiple output.xml files
python -m robotframework_dashboard.main -o results\output-20251225-172034.xml results\output-20251225-172037.xml

# Generate from a folder of output.xml files
python -m robotframework_dashboard.main -f results

# Use a custom output HTML path
python -m robotframework_dashboard.main -o results\output-20251225-172034.xml -g my_dashboard.html

# Offline mode (no CDN, all dependencies embedded)
python -m robotframework_dashboard.main -o results\output-20251225-172034.xml --offlinedependencies
```

## Generated Output

- Default output file: `robot_dashboard.html` in the current working directory.
- The file is fully self-contained: all JS, CSS, and data are embedded — open it directly in a browser with no server needed.
- Re-running does **not** overwrite an existing database by default. To reset, delete the `.db` file (default: `robot_database.db`) before re-running, or specify a different `-d DATABASEPATH`.

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
Remove-Item robot_database.db -ErrorAction SilentlyContinue
python -m robotframework_dashboard.main -o results\output-20251225-172034.xml
# 3. Open robot_dashboard.html in a browser
```
