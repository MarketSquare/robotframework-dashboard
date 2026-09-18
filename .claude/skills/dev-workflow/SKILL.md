---
name: dev-workflow
description: Run the robotdashboard CLI from source without installing, regenerate and validate the dashboard HTML after JS/CSS/template/Python changes, start the FastAPI server, or build/preview the VitePress docs site. Use for any "try it locally", "generate a dashboard", "check my change renders", or "start the server/docs" task.
---

# Development Workflow

## Running the CLI from source (no install)

The `robotdashboard` command only exists after `pip install`, and an installed copy is **stale** relative to your working tree. Always use the module runner during development:

```bash
python -m robotframework_dashboard.main -f tests -n robot_dashboard.html
```

This invokes `robotframework_dashboard/main.py:main()` and accepts every CLI flag. `tests/` contains 15 ready-made `output.xml` fixtures, so the command above is the standard "give me a dashboard to look at".

Common variants:

```bash
python -m robotframework_dashboard.main -o path/to/output.xml                 # one file
python -m robotframework_dashboard.main -o a.xml b.xml                         # several files
python -m robotframework_dashboard.main -f results                             # a folder
python -m robotframework_dashboard.main -f tests -n my_dashboard.html          # custom output name
python -m robotframework_dashboard.main -f tests --offlinedependencies         # no CDN, everything embedded
```

- `-g` / `--generatedashboard` is a **boolean** (default `True`) — it does not take a filename. Use `-n` / `--namedashboard`.
- Default output: `robot_dashboard_<yyyymmdd-hhmmss>.html`; default DB: `robot_results.db`. Re-running does **not** reset the DB — delete it (or pass another `-d`) for a clean state.
- Git Bash gotcha: a trailing backslash (`-f .\tests\`) escapes the following space and swallows the next argument. Use `-f tests`.
- All CLI flags are documented in `docs/basic-command-line-interface-cli.md`.

## Validating JS / CSS / template / Python pipeline changes

`DependencyProcessor` bundles JS and CSS into the HTML at generation time — there is no hot reload. After every change under `robotframework_dashboard/js/`, `css/`, or `templates/`:

```bash
rm -f robot_results.db robot_dashboard.html
python -m robotframework_dashboard.main -f tests -n robot_dashboard.html
```

Regenerating without errors plus a careful read of the diff is the agent's verification step. A clean `import`/syntax check is **not** sufficient — rendering, layout, and click-handler bugs only surface in the bundled output. Describe to the developer what to open and click to confirm visually; do not install or drive a browser for this (that is what the robot tests are for — see the `testing` skill).

Clean up `robot_dashboard.html` and `robot_results.db` afterwards; both are gitignored but easy to leave around.

## Server mode

```bash
python -m robotframework_dashboard.main --server                 # defaults
python -m robotframework_dashboard.main -s host:port:user:pass
```

Endpoints, auth model, and admin page: `server-api` skill and `docs/dashboard-server.md`.

## Documentation site (VitePress)

```bash
npm run docs:dev       # local dev server
npm run docs:build     # production build (single version, current checkout)
npm run docs:preview   # preview the build
npm run docs:build:versions -- --only latest,dev,v1.3.0   # versioned site as CI builds it (omit --only for all tags)
npm run docs:preview:versions                             # serve dist under /robotframework-dashboard/ like Pages
npm run docs:build:versions -- --cache-dir .docs-dist-cache   # skip versions whose build is already cached (CI does this)
```

`package.json` exists **only** for the docs site — it has nothing to do with bundling dashboard JS.

The deployed site is versioned: `/` = latest tag, `/dev/` = `main`, `/vX.Y.Z/` = each tag, plus every untagged pre-1.3.0 PyPI release as a README-only page (`scripts/docs/legacy-docs-versions.json`, `--only legacy`). `scripts/docs/build-versioned-docs.mjs` checks each ref out into a git worktree, overlays the current `docs/.vitepress/` + `scripts/docs/copy-static.mjs`, and runs VitePress per version into `docs/.vitepress/dist/<prefix>`. `docs/.vitepress/config.mts` reads `DOCS_BASE` / `DOCS_VERSION` / `DOCS_LATEST` from the environment; without them it behaves as a plain single-version build. The switcher (`theme/VersionSwitcher.vue`) and banner (`theme/VersionBanner.vue`) fetch `/versions.json` at runtime via `theme/versions.ts`, so the built HTML of a version does not depend on which other versions exist — that is what makes the build cache valid across releases. Old tags that break the build get a text replacement in the script's `PATCHES` table. Use `docs:preview:versions` to click through the version switcher.
