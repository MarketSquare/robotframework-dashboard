---
description: Use when working on project structure, understanding how components connect, or navigating the codebase.
---

# Project Architecture

## Big Picture
- CLI entry point is `robotdashboard` -> `robotframework_dashboard.main:main`, which orchestrates: init DB, process outputs, list runs, remove runs, generate HTML.
- Core workflow: output.xml -> `OutputProcessor` (Robot Result Visitor API) -> SQLite DB (`DatabaseProcessor`) -> HTML dashboard via `DashboardGenerator`.
- Dashboard HTML is a template with placeholders replaced at build time; data payloads are zlib-compressed and base64-encoded strings embedded in HTML.
- JS/CSS are merged and inlined by `DependencyProcessor` (topological import resolution for JS modules) and can be switched to CDN or fully offline assets.
- Optional server mode uses FastAPI to host admin + dashboard + API endpoints; the server uses the same `RobotDashboard` pipeline.

## Key Directories and Files
- CLI + orchestration: `robotframework_dashboard/main.py`, `robotframework_dashboard/robotdashboard.py`, `robotframework_dashboard/arguments.py`.
- Data extraction: `robotframework_dashboard/processors.py` (visitors for runs/suites/tests/keywords).
- Database: `robotframework_dashboard/database.py` + schema in `robotframework_dashboard/queries.py`.
- HTML templates: `robotframework_dashboard/templates/dashboard.html` and `robotframework_dashboard/templates/admin.html` (placeholders are replaced in `dashboard.py`).
- Dependency inlining and CDN/offline switching: `robotframework_dashboard/dependencies.py`.
- Server: `robotframework_dashboard/server.py` (FastAPI endpoints + admin UI).
- Dashboard JS entry: `robotframework_dashboard/js/main.js` (imports modular setup files).
