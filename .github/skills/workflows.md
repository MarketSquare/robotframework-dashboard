---
description: Use when running the CLI, starting the server, or building/previewing the documentation site.
---

# Common Workflows

## CLI
- Usage and flags: see `docs/basic-command-line-interface-cli.md` (output import, tags, remove runs, dashboard generation).

## Server Mode
- Start with `robotdashboard --server` or `-s host:port:user:pass`.
- See `docs/dashboard-server.md` for endpoints and admin UI behavior.

## Documentation Site
- Run `npm run docs:dev` for local dev, `npm run docs:build` to build, `npm run docs:preview` to preview.
- Docs use VitePress and live in `docs/`.
