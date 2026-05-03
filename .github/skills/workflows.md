---
description: Use when running the CLI, starting the server, or building/previewing the documentation site.
---

# Common Workflows

## CLI
- Usage and flags: see `docs/basic-command-line-interface-cli.md` (output import, tags, remove runs, dashboard generation).

## Running Tests

There are three test tiers: Robot Framework acceptance tests, Python unit tests, and JavaScript unit tests.

### Robot Framework acceptance tests (pabot)
```bash
# Windows
pabot --pabotlib --testlevelsplit --artifacts png,jpg --artifactsinsubfolders --processes 2 -d results .\tests\robot\testsuites\*.robot

# Linux / macOS
pabot --pabotlib --testlevelsplit --artifacts png,jpg --artifactsinsubfolders --processes 2 -d results tests/robot/testsuites/*.robot
```

Convenience scripts: `scripts/robot-tests.bat` and `scripts/robot-tests.sh`.

Key flags: `--pabotlib` starts the shared lock server; `--testlevelsplit` runs each test case in parallel (not suite-level); `-d results` captures output in `results/`.

See `.github/skills/robotframework-tests.md` for full details on the acceptance test suite and how to add tests.

### Python unit tests (pytest)
```bash
scripts\unittests.bat   # Windows
bash scripts/unittests.sh   # Linux / macOS
```

See `.github/skills/python-unit-tests.md` for test layout, fixtures, and failure analysis.

### JavaScript unit tests (Vitest)
```bash
scripts\jstests.bat   # Windows
bash scripts/jstests.sh   # Linux / macOS
```

See `.github/skills/javascript-unit-tests.md` for test layout, mocking patterns, and which modules are testable.

## Server Mode
- Start with `robotdashboard --server` or `-s host:port:user:pass`.
- See `docs/dashboard-server.md` and `.github/skills/server-api.md` for endpoints and admin UI behavior.

## Documentation Site
- Run `npm run docs:dev` for local dev, `npm run docs:build` to build, `npm run docs:preview` to preview.
- Docs use VitePress and live in `docs/`.
