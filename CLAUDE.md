# robotframework-dashboard

Context for AI agents working in this repository.

## Skills

Project skills live in `.claude/skills/<name>/SKILL.md` and are auto-discovered. Read the matching skill **before** starting any non-trivial task — each one captures knowledge that otherwise has to be re-derived from the code.

`gh-issue` issue end to end · `testing` all test tiers, robot **must** run in Docker · `dev-workflow` run from source, validate HTML, server, docs site · `coding-standards` style + where things live in `js/` · `filtering-and-settings` filters, settings, layout editor · `dashboard-graphs` pages, Chart.js, adding a graph · `add-cli-argument` new `--flag` · `js-features` new widget/feature/modal · `js-bundling` JS/CSS inlining, CDN vs offline · `server-api` FastAPI endpoints, auth · `listener-integration` listener + push script · `documentation` docs to update · `release` release procedure (`/release` only)

---

## Commands

Use the project scripts — do **not** call `pytest`, `vitest`, `robot`, or `pabot` directly (scripts set coverage paths, artifact dirs, parallelism). `.bat` for cmd.exe, `.sh` for bash (incl. Git Bash on Windows).

| Task | Command |
|---|---|
| Robot acceptance tests — **Docker only** | `bash scripts/docker/run-in-robot-container.sh bash scripts/robot-tests.sh` (one suite: `… robot --outputdir results tests/robot/testsuites/<suite>.robot`) |
| Build the robot Docker image (once) | `bash scripts/docker/create-test-image.sh robot` |
| Python unit tests | `bash scripts/python-tests.sh` / `scripts\python-tests.bat` |
| JS unit tests | `bash scripts/javascript-tests.sh` / `scripts\javascript-tests.bat` |
| Generate a dashboard from source | `python -m robotframework_dashboard.main -f tests -n robot_dashboard.html` |
| Build the example dashboard (tags, versions, filters, logs) | `python scripts/example.py` / `scripts\example.bat`; add `--test` to build only in the repo root and leave `example/` untouched |
| Regenerate the `output.xml` fixtures | `python tests/robot/resources/generator/generate.py` (then refresh screenshots/CLI/DB references in Docker) |
| Docs site | `npm run docs:dev` / `npm run docs:build` |

Robot tests are Docker-only because the suites call the `pip install`-ed CLI, not your working tree (details: `testing` skill).

The `tests/` `output.xml` fixtures are generated, never hand-edited. Validate any JS/CSS/template/Python change by generating a dashboard from source; an import or syntax check is not enough.

---

## What this project is

`robotframework-dashboard` is a Python CLI (`robotdashboard`) that reads Robot Framework `output.xml` files, stores them in SQLite, and generates a **single self-contained HTML dashboard** — all data, JS, and CSS inlined, no web server needed to view it.

## Pipeline

```
output.xml ─► OutputProcessor (robot.api ResultVisitor) ─► SQLite ─► database.get_data() ─► DashboardGenerator
DashboardGenerator: DependencyProcessor inlines js/ (import graph, topo sort) + css/, CDN or offline dependencies/, data JSON → zlib → base64; placeholders in templates/dashboard.html replaced → robot_dashboard.html
Browser: js/variables/data.js decodes the payload ─► Chart.js, GridStack, DataTables — zero server calls
```

Optional `--server` mode hosts the same pipeline behind FastAPI (upload endpoints, `/admin`, auto-regeneration).

## Entry points

| File | Role |
|---|---|
| `robotframework_dashboard/main.py` | CLI entry (`robotdashboard`) |
| `robotframework_dashboard/robotdashboard.py` | `RobotDashboard` — orchestrates init DB, process outputs, list/remove runs, generate HTML |
| `robotframework_dashboard/arguments.py` | `ArgumentParser` wrapping argparse |
| `robotframework_dashboard/processors.py` | `OutputProcessor` + `ResultVisitor` subclasses for runs/suites/tests/keywords |
| `robotframework_dashboard/database.py` / `queries.py` | Built-in SQLite backend; all SQL as constants |
| `robotframework_dashboard/abstractdb.py` | `AbstractDatabaseProcessor` for custom backends (`--databaseclass`) |
| `robotframework_dashboard/dashboard.py` | `DashboardGenerator` — template rendering |
| `robotframework_dashboard/dependencies.py` | `DependencyProcessor` — JS/CSS inlining, CDN/offline switching |
| `robotframework_dashboard/server.py`, `server_models.py`, `server_routes_outputs.py` / `server_routes_logs.py` | `ApiServer` (app setup, auth, HTML routes `/`, `/admin`, `/log`); Pydantic models + OpenAPI examples; the `/…-output(s)` and `/…-log(s)` endpoints registered by `_setup_routes` |
| `robotframework_dashboard/robotdashboardlistener.py` | Robot listener that uploads results to the server |
| `robotframework_dashboard/js/main.js` | Browser startup entry; everything is reached via its import graph |
| `robotframework_dashboard/templates/dashboard.html`, `admin.html` | Templates with string placeholders (not Jinja) |

Frontend source: `robotframework_dashboard/js/` and `css/`. **There is no Node bundler** for the dashboard — Python does the bundling. `package.json` exists only for the VitePress docs site.

The two largest front-end concerns live in directories, not single files: `js/filter/` (pipeline, modal option lists, suite path, option availability, controls, profiles) and `js/eventlisteners/` (one module per modal or listener group). `css/components/` is numbered because path order is cascade order. The `coding-standards` skill has the per-file map.

---

## Hard rules

- **Never rename placeholder tokens** in templates (`<!-- placeholder_javascript -->`, `<!-- placeholder_css -->`, `<!-- placeholder_dependencies -->`, `"placeholder_runs"`, `"placeholder_suites"`, `"placeholder_tests"`, `"placeholder_keywords"`, `"placeholder_exceptions"`, `placeholder_json_config`). Replacement is string substitution.
- **New JS module** → `import` it from an existing module. `DependencyProcessor` discovers files only through the import graph from `main.js`; there is no manual registry.
- **Data always flows** parse → DB → HTML through `RobotDashboard` methods. Don't bypass it.
- **Offline mode** reads `robotframework_dashboard/dependencies/`. When upgrading a library version in `dependencies.py`, update the local copy too.
- **Validate frontend changes by regenerating the HTML** (`dev-workflow` skill); robot tests for anything behavioural (`testing` skill).
- **Commit only when asked.** Branch off `main` for any change; never commit to `main` directly.

## Gotchas

- Run identity is `run_start` from `output.xml`; duplicate runs are silently skipped. `run_alias` defaults to the file name and is auto-adjusted on collision.
- Log linking needs log names mirroring output names (`output-XYZ.xml` ↔ `log-XYZ.html`); the server's `/add-log` enforces this.
- `--projectversion` and `version_*` tags are mutually exclusive; version tags are parsed in `RobotDashboard._process_single_output`.
- Custom DB backends: module must expose a `DatabaseProcessor` class compatible with `AbstractDatabaseProcessor`. Schema migrations are inline `ALTER TABLE ADD COLUMN` at DB open.
- Server auth: HTTP Basic only on `/admin`; every other endpoint is unauthenticated by design. Any mutation regenerates the dashboard unless `--no-autoupdate`; `POST /refresh-dashboard` does it manually.
- Run-tag checkbox ids are `runTagCheckBox<tag>`; the raw tag is in `value`. Overview card ids are `overviewLatest<project>Card0`. Match on the right attribute.
- Git Bash on Windows: a trailing backslash in a path argument (`-f .\tests\`) swallows the next argument. Use forward slashes.
- CHANGELOG.md is written at release time by the `release` skill, not per PR.
