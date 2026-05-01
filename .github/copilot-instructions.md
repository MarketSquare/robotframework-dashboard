# robotframework-dashboard — Copilot Instructions

This file gives AI agents and contributors the context needed to work effectively in this codebase.

## How to Use the Skills Files

Before starting work on any non-trivial task, read the relevant skill file from `.github/skills/`. Each file contains deep domain knowledge that avoids re-exploring the codebase from scratch. Use the table in the **Skills** section below to pick the right one(s). Read the skill file with a file-read tool before making any changes.

---

## Project Purpose

`robotframework-dashboard` is a Python CLI tool that reads Robot Framework `output.xml` execution results, stores them in a SQLite database, and generates a fully self-contained HTML dashboard with interactive charts, tables, and filters. No web server is required to view the output — a single `.html` file contains all data, JS, and CSS.

---

## Core Pipeline: Python CLI → HTML Template → JavaScript

The entire system is this three-stage pipeline:

```
1. PYTHON CLI
   output.xml files
       └─► OutputProcessor (robot.api ResultVisitor)
               └─► SQLite database (runs / suites / tests / keywords tables)

2. HTML TEMPLATE
   database.get_data()
       └─► DashboardGenerator
               ├─► DependencyProcessor: merges all JS modules (topological sort) → inline <script>
               ├─► DependencyProcessor: merges all CSS files → inline <style>
               ├─► CDN or offline dependency tags
               ├─► Data encoded as: JSON → zlib compress → base64 → string literal in HTML
               └─► templates/dashboard.html (string placeholder replacement) → robot_dashboard.html

3. JAVASCRIPT (runs in the browser)
   js/variables/data.js decodes the embedded base64 data back to JS arrays
       └─► Chart.js charts, DataTables, filters, layout — all from local data, zero server calls
```

The output is a **single `.html` file** that is entirely self-contained. All Robot Framework data is embedded as compressed strings; all JS and CSS is inlined.

---

## Entry Points

| File | Role |
|---|---|
| `robotframework_dashboard/main.py` | CLI entry point (`robotdashboard` command) |
| `robotframework_dashboard/robotdashboard.py` | `RobotDashboard` class — orchestrates all 5 pipeline steps |
| `robotframework_dashboard/arguments.py` | `ArgumentParser` wrapping `argparse` |
| `robotframework_dashboard/processors.py` | `OutputProcessor` + 4 `ResultVisitor` subclasses |
| `robotframework_dashboard/database.py` | Built-in SQLite implementation |
| `robotframework_dashboard/abstractdb.py` | `AbstractDatabaseProcessor` ABC (custom DB backends) |
| `robotframework_dashboard/queries.py` | All SQL strings as module-level constants |
| `robotframework_dashboard/dashboard.py` | `DashboardGenerator` — template rendering |
| `robotframework_dashboard/dependencies.py` | `DependencyProcessor` — JS/CSS inlining and CDN switching |
| `robotframework_dashboard/server.py` | Optional FastAPI server (`--server` flag) |

---

## JavaScript and CSS

All frontend source lives under `robotframework_dashboard/js/` and `robotframework_dashboard/css/`. **There is no Node.js bundler (no webpack, Vite, or Rollup) for the dashboard.** Bundling is done in Python by `DependencyProcessor` at HTML generation time.

Key JS directories:

| Path | Contents |
|---|---|
| `js/variables/` | Global state, data decoding, settings, graph registry |
| `js/graph_creation/` | Chart.js setup per tab (overview, run, suite, test, keyword, compare, tables) |
| `js/graph_data/` | Data transformation modules that feed Chart.js |
| `js/main.js` | Startup entry — imports and calls all setup functions |
| `js/admin_page/` | Separate JS bundle for the server's `/admin` page only |

See `.github/skills/js-bundling.md` for details on how JS modules are resolved, ordered, and embedded.

---

## HTML Templates

Templates live in `robotframework_dashboard/templates/`. They use simple string placeholder tokens (not Jinja2):

- `templates/dashboard.html` → generates `robot_dashboard.html`
- `templates/admin.html` → generates the server's `/admin` page

Key placeholders: `<!-- placeholder_javascript -->`, `<!-- placeholder_css -->`, `<!-- placeholder_dependencies -->`, `"placeholder_runs"`, `"placeholder_suites"`, `"placeholder_tests"`, `"placeholder_keywords"`.

---

## Database

- Built-in: SQLite via `database.py`. Tables: `runs`, `suites`, `tests`, `keywords`.
- Custom backends: implement `AbstractDatabaseProcessor` from `abstractdb.py`, point to it with `--databaseclass`.
- Run identity: `run_start` timestamp. Duplicate runs are silently skipped.
- Schema migrations are handled inline at DB open time via `ALTER TABLE ADD COLUMN`.

---

## Skills

The `.github/skills/` directory contains domain-specific knowledge files:

| Skill file | When to use |
|---|---|
| `project-architecture.md` | Understanding how components connect and navigating the codebase |
| `dashboard.md` | Dashboard pages, Chart.js graphs, chart types, graph data/creation modules |
| `js-bundling.md` | How JS/CSS is bundled and embedded into the HTML (no Node.js bundler) |
| `conventions-and-gotchas.md` | Edge cases, run identity, offline mode, custom DBs, server auth model |
| `coding-style.md` | Python/JS/CSS style conventions |
| `workflows.md` | CLI usage, running tests, server mode, docs site |
| `testing.md` | Test suite structure, pabot parallelism, how to add tests |
| `unit-tests.md` | Python unit tests (pytest, coverage, test layout, fixtures) |
| `js-unit-tests.md` | JavaScript unit tests (Vitest, mocking patterns, which modules are testable) |
| `server-api.md` | All REST endpoints, authentication, log linking, auto-update behavior |
| `filtering-and-settings.md` | Filter pipeline, settings object, localStorage persistence, layout/GridStack system, **filter profiles** (data structure, all profile functions, merge modal) |
| `documentation.md` | All documentation locations (docs/, README.md, CONTRIBUTING.md, setup.py), page map, and checklist for keeping docs in sync when features change |
| `js-patterns.md` | How JavaScript code is currently structured in this project: module layout, variable placement, naming patterns, GridStack/Chart.js usage |
| `js-coding-standards.md` | Rules for writing JavaScript: naming conventions, where to put variables, function patterns, scope, localStorage, DOM access |

---

## Key Rules for AI Agents

- **Never break the placeholder token names** in templates. Replacement is positional string substitution.
- **When adding a new JS module**, import it from an existing module so `DependencyProcessor` can discover it via the dependency graph. The topological sort handles ordering automatically.
- **Data always flows**: parse → DB → HTML. Do not bypass the pipeline.
- **`package.json` is for the VitePress docs site only.** It has nothing to do with bundling dashboard JS.
- **Offline mode** (`--offlinedependencies`) reads from `robotframework_dashboard/dependencies/`. Keep local copies in sync when upgrading library versions.
