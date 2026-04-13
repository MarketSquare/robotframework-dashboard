---
description: Use when adding, updating, or reviewing documentation — new features, CLI options, filters, settings, graphs, server, or any user-facing behaviour change. Covers docs/, README.md, CONTRIBUTING.md, and setup.py long_description.
---

# Documentation

## Files to Check on Every Documentation Change

Whenever a user-facing feature is added or changed, check **all four** of these locations and update each one as needed:

| File | What it contains |
|---|---|
| `docs/<page>.md` | Full VitePress documentation site — the primary place for detailed docs |
| `README.md` | PyPI / GitHub landing page: overview, key features list, quick-start examples, quick-links table |
| `setup.py` → `long_description` | PyPI package description (plain markdown embedded in `setup()`); mirrors the README overview and getting-started sections |
| `CONTRIBUTING.md` | Developer guide: how to run locally, test levels, Docker usage — update when build/test commands or workflow changes |

> `setup.py`'s `long_description` is a copy of the README's Overview and Getting Started sections. Keep them in sync when those sections change.

---

## docs/ — VitePress Site

Served at `https://marketsquare.github.io/robotframework-dashboard/`. Source is in `docs/`. Built with VitePress (`package.json` at root — this is the **only** purpose of `package.json`). The `docs/index.md` is the home page (hero + feature cards).

### Page Map

| File | Title | Contents |
|---|---|---|
| `docs/index.md` | Home | Hero section, feature cards, links to all pages |
| `docs/getting-started.md` | Getting Started | Installation steps, first run, verifying output |
| `docs/installation-version-info.md` | Installation & Version Info | pip install variants (base / server / all), Python & RF requirements, version changelog |
| `docs/basic-command-line-interface-cli.md` | Basic CLI | All CLI flags (`-o`, `-d`, `-n`, `-r`, `--server`, etc.), flag descriptions, basic usage examples |
| `docs/advanced-cli-examples.md` | Advanced CLI & Examples | Combined commands, project tagging, aliases, batch imports, message config, performance tips |
| `docs/tabs-pages.md` | Tabs / Pages | Overview, Dashboard, Compare, and sub-pages (Run/Suite/Test/Keyword); what each tab shows |
| `docs/graphs-tables.md` | Graphs & Tables | Chart types per section, DataTables, how to read each graph |
| `docs/filtering.md` | Filtering | All global filter types (Runs, Run Tags, Versions, From/To Date+Time, Amount, Metadata), Filter Profiles (create, apply, update, delete, **merge**), section-specific filters |
| `docs/customization.md` | Customization | Layout editor (GridStack), section show/hide, graph show/hide, drag-and-drop ordering |
| `docs/settings.md` | Settings | Settings modal options: themes, aliases, display toggles, JSON config (`--jsonconfig` / `--forcejsonconfig`) |
| `docs/dashboard-server.md` | Dashboard Server | `--server` flag, REST API overview, authentication, auto-update, log linking via server |
| `docs/log-linking.md` | Log Linking | How to configure log paths so the dashboard links back to Robot Framework HTML logs |
| `docs/listener-integration.md` | Listener Integration | Using `robotdashboardlistener.py` to auto-update the dashboard after every test run |
| `docs/custom-database-class.md` | Custom Database Class | Implementing `AbstractDatabaseProcessor`, `--databaseclass` flag, example MySQL class |
| `docs/contributions.md` | Contributions | How to contribute, issue/PR guidelines |

### docs/index.md — Feature Cards and Quick Links

`docs/index.md` has two sections that need updating when features are added:
1. **Hero feature cards** (`features:` YAML) — one card per major topic
2. `README.md` has a matching **Quick Links** section — keep both in sync

### VitePress Conventions

- All pages start with YAML frontmatter (`---`).  
- Pages that have deep headings use `outline: deep` in frontmatter.  
- Internal links use relative `.md` paths (e.g. `[Advanced CLI](advanced-cli-examples.md)`).  
- Images live in `docs/public/`.

---

## README.md

Sections to keep up to date:

| Section | Update when |
|---|---|
| **Key Features** (emoji bullet list) | A significant user-facing feature is added or removed |
| **Quick Links** table | A new docs page is added, or a page is renamed/removed |
| **Basic Usage** examples | Default CLI behaviour changes |

---

## CONTRIBUTING.md

Update when:
- Test commands or script names change (`scripts/*.sh` / `scripts/*.bat`)
- A new test level is added
- Docker / CI workflow changes
- New development dependencies are introduced

---

## Typical Update Checklist

When adding a new user-facing feature:

- [ ] Add or update the relevant `docs/<page>.md` section
- [ ] If it is a major feature, add a bullet to **Key Features** in `README.md`
- [ ] Add or update the matching Quick Link in `README.md` if a new page was created
- [ ] If a new docs page was added, add a feature card to `docs/index.md`
- [ ] If the Overview/Getting Started sections are affected, mirror changes into `setup.py` `long_description`
- [ ] If build/test workflow changed, update `CONTRIBUTING.md`
