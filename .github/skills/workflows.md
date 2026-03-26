---
description: Use when running the CLI, starting the server, or building/previewing the documentation site.
---

# Common Workflows

## CLI
- Usage and flags: see `docs/basic-command-line-interface-cli.md` (output import, tags, remove runs, dashboard generation).

## Running Tests

All tests are Robot Framework acceptance tests run with **pabot** (parallel executor). There are no pytest/unittest files.

```bash
# Windows
pabot --pabotlib --testlevelsplit --artifacts png,jpg --artifactsinsubfolders --processes 2 -d results .\tests\e2e\testsuites\*.robot

# Linux / macOS
pabot --pabotlib --testlevelsplit --artifacts png,jpg --artifactsinsubfolders --processes 2 -d results tests/e2e/testsuites/*.robot
```

Convenience scripts: `scripts/tests.bat` and `scripts/tests.sh`.

Key flags: `--pabotlib` starts the shared lock server; `--testlevelsplit` runs each test case in parallel (not suite-level); `-d results` captures output in `results/`.

See `.github/skills/testing.md` for full details on the three test tiers and how to add tests.

## Server Mode
- Start with `robotdashboard --server` or `-s host:port:user:pass`.
- See `docs/dashboard-server.md` and `.github/skills/server-api.md` for endpoints and admin UI behavior.

## Documentation Site
- Run `npm run docs:dev` for local dev, `npm run docs:build` to build, `npm run docs:preview` to preview.
- Docs use VitePress and live in `docs/`.
