# robotframework-dashboard — Copilot Instructions

This file gives AI agents and contributors the context needed to work effectively in this codebase.

## How to Use the Skills Files

Before starting work on any non-trivial task, read the relevant skill file from `.github/skills/`. Each file contains deep domain knowledge that avoids re-exploring the codebase from scratch. Use the table in the **Skills** section below to pick the right one(s). Read the skill file with a file-read tool before making any changes.

---

## Commands

Use the project scripts — do NOT invoke the underlying tools directly (the scripts set coverage paths, artifact dirs, and parallelism). `.bat` for Windows, `.sh` for Linux/macOS.

| Task | Windows | Linux / macOS |
|---|---|---|
| JS unit tests | `scripts\javascript-tests.bat` | `bash scripts/javascript-tests.sh` |
| Python unit tests | `scripts\python-tests.bat` | `bash scripts/python-tests.sh` |
| Robot acceptance tests | `scripts\robot-tests.bat` | `bash scripts/robot-tests.sh` |
| Generate dashboard for testing | `python -m robotframework_dashboard.main -n robot_dashboard -f tests` | same |
| Docs build | `npm run docs:build` | `npm run docs:build` |
| Docs dev server | `npm run docs:dev` | `npm run docs:dev` |

**Generate dashboard for testing** runs the package directly (no install) against the `tests/` output.xml fixtures, producing `robot_dashboard.html`. Use this to validate any JS/CSS/template/Python pipeline change — open the HTML to confirm rendering, layout, and click handlers. A clean import/syntax check is not sufficient; bundled-output bugs only surface here.

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
| `.github/skills/project-architecture.md` | Understanding how components connect and navigating the codebase |
| `.github/skills/dashboard.md` | Dashboard pages, Chart.js graphs, chart types, graph data/creation modules |
| `.github/skills/js-bundling.md` | How JS/CSS is bundled and embedded into the HTML (no Node.js bundler) |
| `.github/skills/js-feature-patterns.md` | **End-to-end patterns for adding new JS features**: custom widget checklist, GridStack item lifecycle, undo/redo snapshot pattern, localStorage-only keys |
| `.github/skills/conventions-and-gotchas.md` | Edge cases, run identity, offline mode, custom DBs, server auth model |
| `.github/skills/coding-style.md` | Python/JS/CSS style conventions |
| `.github/skills/workflows.md` | CLI usage, running tests, server mode, docs site |
| `.github/skills/dev-workflow.md` | How to run the tool locally during development (no install required), dev loop for JS/CSS/template changes |
| `.github/skills/robotframework-tests.md` | Test suite structure, pabot parallelism, how to add tests |
| `.github/skills/fix-robot-tests.md` | **Step-by-step workflow for fixing failing robot tests** — parsing output.xml, updating stale screenshots, fixing tab-navigation timeouts, using Docker to regenerate references |
| `.github/skills/python-unit-tests.md` | Python unit tests (pytest, coverage, test layout, fixtures) |
| `.github/skills/javascript-unit-tests.md` | JavaScript unit tests (Vitest, mocking patterns, which modules are testable) |
| `.github/skills/server-api.md` | All REST endpoints, authentication, log linking, auto-update behavior |
| `.github/skills/filtering-and-settings.md` | Filter pipeline, settings object, localStorage persistence, layout/GridStack system, **filter profiles** (data structure, all profile functions, merge modal) |
| `.github/skills/listener-integration.md` | Listener script (`robotdashboardlistener.py`), all listener arguments, pabot/RobotCode usage, server endpoints called |
| `.github/skills/documentation.md` | All documentation locations (docs/, README.md, CONTRIBUTING.md, setup.py), page map, and checklist for keeping docs in sync when features change |
| `.github/skills/js-patterns.md` | How JavaScript code is currently structured in this project: module layout, variable placement, naming patterns, GridStack/Chart.js usage |
| `.github/skills/js-coding-standards.md` | Rules for writing JavaScript: naming conventions, where to put variables, function patterns, scope, localStorage, DOM access |
| `.github/skills/release-actions.md` | **Step-by-step release workflow** — bump version, update test fixtures, regenerate example dashboard/database, update changelog, produce Slack notes |

---

## Key Rules for AI Agents

- **Never break the placeholder token names** in templates. Replacement is positional string substitution.
- **When adding a new JS module**, import it from an existing module so `DependencyProcessor` can discover it via the dependency graph. The topological sort handles ordering automatically.
- **Data always flows**: parse → DB → HTML. Do not bypass the pipeline.
- **`package.json` is for the VitePress docs site only.** It has nothing to do with bundling dashboard JS.
- **Offline mode** (`--offlinedependencies`) reads from `robotframework_dashboard/dependencies/`. Keep local copies in sync when upgrading library versions.
- **Validate JS/CSS/template changes by regenerating and opening the HTML** — see `.github/skills/dev-workflow.md` ("Validating JS/CSS/Template Changes"). A clean `import`/syntax check is not sufficient; rendering, layout, and click-handler bugs only surface in the bundled output. The `tests/` folder has ready-made output.xml fixtures: `python -m robotframework_dashboard.main -f tests -n robot_dashboard.html`.
