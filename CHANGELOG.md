# Changelog

All notable changes to this project are documented in this file.
From v1.3.0 onwards, detailed release notes are also available on [GitHub Releases](https://github.com/MarketSquare/robotframework-dashboard/releases).

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [2.0.0](https://github.com/MarketSquare/robotframework-dashboard/releases/tag/v2.0.0) - 2026-05-16

### Added
- Statistical widgets for runs, suites, tests, and keywords — summary cards shown across dashboard sections
- Information icon (SVG) added to dashboard labels for contextual hints
- Log URL support — log file links can now be passed and displayed alongside run results
- Standalone script to push existing `output.xml` files to a running dashboard server
- Custom filters in output data processing — pass arbitrary key=value filters at import time
- NOT tag filter — negate tag conditions in the filter dialog
- Undo/redo functionality for layout changes — revert or reapply GridStack layout modifications
- Statistical benchmarking support for performance tracking across runs

### Fixed
- Exit code changed to `1` in `robotdashboardlistener` on error, enabling correct CI failure detection
- Docker Python-test image now hardcodes Ubuntu tag for reproducible builds

### Changed
- Horizontal scrolling enabled for all data tables, improving usability on smaller screens
- Overview bars now ordered correctly across all project sections
- Additional acceptance tests added for the overview page

---

## [1.9.0](https://github.com/MarketSquare/robotframework-dashboard/releases/tag/v1.9.0) - 2026-04-15

### Added
- HTTPS support for the dashboard server — pass SSL certificate and key files to serve the dashboard securely
- Relative path support for run/log file links in the generated dashboard, making it more portable across environments
- Run name aliases — configure custom labels on chart axes instead of timestamps via Settings > Run Label Display
- Merge filter profiles — combine any saved filter profile into the current active filter
- Persistent graph view toggles — chart display preferences are now saved to localStorage

### Fixed
- Label positioning on timeline charts — bar labels are now centered correctly
- Missing y-axis labels in top-10 charts

### Changed
- Improved Docker-based test infrastructure with Linux and Windows containers covering all test types (Python, JavaScript, and robot tests)

---

## [1.8.2](https://github.com/MarketSquare/robotframework-dashboard/releases/tag/v1.8.2) - 2026-03-29

### Added
- No-autoupdate mode: manual "Refresh Dashboard" button shown in the dashboard when `--noautoupdate` is active
- Custom branding — title and logo configurable in Settings; custom logo syncs with the browser tab favicon
- Settings to toggle which suite is shown in the Test Section suite select and the Suite Section suite select
- Sorting for test names in the Test Statistics filter
- Sorting for run tags in the filter dialog
- Python and JavaScript unit tests added to the project

### Fixed
- Profile bug where `useAndOrTags` was written twice to the settings JSON

### Changed
- Improved suite selection settings and dropdown usability in the statistics tabs

---

## [1.8.1](https://github.com/MarketSquare/robotframework-dashboard/releases/tag/v1.8.1) - 2026-03-10

### Fixed
- Timezone handling bug that caused incorrect rendering in line graphs

---

## [1.8.0](https://github.com/MarketSquare/robotframework-dashboard/releases/tag/v1.8.0) - 2026-03-08

### Added
- Filter Profiles — save, name, and quickly apply filter configurations; stored in localStorage and pre-configurable via `--jsonconfig` / `--forcejsonconfig`
- Timezone support — timezone stored alongside each run's start time; `--timezone` CLI option; "Convert Timestamps to Local Timezone" toggle in Settings
- `--noautoupdate` server flag — disables dashboard regeneration on every upload
- Manual "Refresh Dashboard" and "Refresh Admin Data" buttons on the admin page (used in combination with `--noautoupdate`)
- When deleting an output via the server, any linked log file is now automatically cleaned up

### Fixed
- Section filter selections no longer reset when entering or exiting fullscreen mode

---

## [1.7.0](https://github.com/MarketSquare/robotframework-dashboard/releases/tag/v1.7.0) - 2026-02-28

### Added
- New Theme tab in Settings — customize Background, Card, Highlight, and Text colors for light and dark mode independently, with reset buttons
- Scatter/Line view for Test Statistics — plots test results as colored dots on a time-based axis
- Individual graph loading spinners and a full-page loading overlay for heavy operations
- Fullscreen mode can now be closed by pressing the Escape key
- New Log Linking documentation page

### Fixed
- Ignore Skips toggle in Most Flaky and Recent Most Flaky graphs now correctly applies

### Changed
- Tooltips across all major graphs now show richer information: run duration, pass/fail/skip counts, and failure messages
- CSS refactored into four modular files: `base.css`, `colors.css`, `components.css`, `dark.css`
- Major JS refactor: shared chart factory and config helpers remove ~3,120 lines of duplication

---

## [1.6.2](https://github.com/MarketSquare/robotframework-dashboard/releases/tag/v1.6.2) - 2026-02-11

### Changed
- Project transferred from [timdegroot1996/robotframework-dashboard](https://github.com/timdegroot1996/robotframework-dashboard) to [MarketSquare/robotframework-dashboard](https://github.com/MarketSquare/robotframework-dashboard) — all documentation and GitHub links updated

### Fixed
- Overview cards based on `project_` run tags now correctly show the project name without the `project_` prefix

---

## [1.6.1](https://github.com/MarketSquare/robotframework-dashboard/releases/tag/v1.6.1) - 2026-02-09

### Fixed
- Hidden overview sections now correctly expand the top visible section on reload
- `project_` prefix correctly removed from project names in the Total Statistics bar and Latest Runs bar

---

## [1.6.0](https://github.com/MarketSquare/robotframework-dashboard/releases/tag/v1.6.0) - 2026-02-08

### Added
- Database is now vacuumed on exit to reclaim disk space; disable with `--novacuum`
- `--removeruns` / `-r` accepts `limit=N` — removes all runs except the N most recent
- Server: admin and dashboard endpoints swapped (`/admin` for the admin page, `/` for the dashboard)
- Server: `/add-output-file` and `/add-log-file` endpoints now support `.gzip` / `.gz` compressed uploads
- Server: `/remove-outputs` accepts a `limit` parameter
- Listener: outputs and log files now uploaded as compressed `.gz` multipart files
- Overview page: customizable section ordering (saved to localStorage), test run names shown inside project bars, total statistics bar per project, duration formatting in overview cards

---

## [1.5.0](https://github.com/MarketSquare/robotframework-dashboard/releases/tag/v1.5.0) - 2025-12-29

### Added
- Server: `add-output-file` endpoint for multipart file upload (also accessible from the admin page)
- Server: `add-log-file` endpoint for multipart log file upload
- Server: `get-logs` endpoint to list all linked log files
- Server: `remove-outputs` supports `all=true` to remove all outputs at once
- Server: `remove-log` supports `all=true` to remove all log files at once
- Server: version tags can be provided to outputs via admin page and endpoints
- Overview page: orderable sections (order saved to localStorage)
- Overview page: sort projects by most recent / oldest / most fails / most skips / most passed

### Fixed
- Overview card color was incorrectly shown when a run contained only skipped tests

### Removed
- `admin_json_config` removed from the admin page; use `--jsonconfig` with `--forcejsonconfig` instead

---

## [1.4.0](https://github.com/MarketSquare/robotframework-dashboard/releases/tag/v1.4.0) - 2025-12-09

### Added
- Same-status filter in test statistics and compare test statistics (filter by passed / failed / skipped)
- Unified Dashboard Sections toggle — merges all dashboard sections into one (title configurable via `--dashboardtitle`)
- Version tag syntax for `--output` and `--folder` arguments: `output.xml:version_v1.0`
- `--forcejsonconfig` CLI option — forces the JSON config to apply on every load instead of only when no localStorage config exists

### Fixed
- First donut graph on the overview page displayed incorrect statistics

### Changed
- Styling improvements: clearer active graph indication and clickable icon feedback
- Improved popup list styling for consistency
- New loading icon

---

## [1.3.1](https://github.com/MarketSquare/robotframework-dashboard/releases/tag/v1.3.1) - 2025-12-03

### Added
- FastAPI-offline replaces FastAPI — enables offline usage of the `/docs` route and better integration with `--offlinedependencies`
- ReDoc documentation button on the admin page
- Dashboard HTML/JS/CSS fully modularized in the package (+10,150 / −9,379 lines) — enables a much cleaner development workflow

### Fixed
- `--dashboardtitle` now works correctly when the dashboard server is active

---

## [1.3.0](https://github.com/MarketSquare/robotframework-dashboard/releases/tag/v1.3.0) - 2025-11-28

First official [GitHub Release](https://github.com/MarketSquare/robotframework-dashboard/releases/tag/v1.3.0).

### Added
- Dedicated [documentation website](https://marketsquare.github.io/robotframework-dashboard/) built with VitePress
- Overview page: project bars show each project as a separate bar with all its runs
- Overview page: version tags on run level via `--projectversion` CLI option, with version filter in the dashboard
- New graphs: Most Time Consuming Suite, Most Time Consuming Test, Most Time Consuming Keyword, Most Used Keyword
- Offline mode: `--offlinedependencies` bundles all external JS/CSS into the HTML for fully offline use
- Slim package: server is now optional — install with `pip install robotframework-dashboard[server]` or `[all]`

### Changed
- Dashboard HTML size reduced ~30% by minifying whitespace
- Improved localStorage forward/backward compatibility between versions

---

## [1.2.2] - 2025-11-04

### Added
- Keyword library owner filter in Settings — ignore specific libraries in the keyword section; display keyword owner/library on graphs
- `CONTRIBUTING.md` added to the project

### Fixed
- First row of bar graphs was not displayed correctly when bar rounding was enabled

> **Note:** The keyword owner column is not backward compatible — you need to re-add existing outputs for this data to be populated.

---

## [1.2.1] - 2025-09-25

### Changed
- Duration unit auto-conversion (d/h/m/s) now also applied in the run statistics graph

---

## [1.2.0] - 2025-09-24

### Added
- Bar graph edge rounding configurable from 0 to 8 pixels in Settings
- Overview tab: toggle to show all runs for a project instead of only the latest
- Server admin page authentication: `--server default:username:password` or `--server host:port:user:pass`
- URL page parameter for direct tab linking: `?page=overview`, `?page=dashboard`, `?page=compare`, `?page=tables`
- Duration graphs now auto-convert units to d/h/m/s

### Fixed
- Run tags no longer overflow when many tags are present
- Python 3.8 support restored (incompatible syntax removed; uvicorn pinned to ≥0.33)

---

## [1.1.3] - 2025-07-22

### Fixed
- Scroll-into-view behavior when entering/exiting edit mode no longer causes disorienting jumps when many graphs are hidden
- Resizing graphs in edit mode now always triggers an immediate chart redraw
- Fullscreen mode page scrollbar no longer appears

### Changed
- Settings gear icon split into two tabs: Graphs and JSON
- Suite filter "All Suites" renamed to "All Suites Separate" and new "All Suites Combined" option added

---

## [1.1.2] - 2025-07-09

### Fixed
- Server crash when `admin_json_config` was empty caused the dashboard to get stuck on load

---

## [1.1.1] - 2025-07-09

Patch release.

---

## [1.1.0] - 2025-07-07

### Added
- Customizable layout completely reworked with an edit mode (powered by GridStack): show/hide sections and graphs directly on the page, drag-and-drop resize to any size
- `--jsonconfig` / `-j` CLI option for setting a default config (layout, settings, theme); applied only when no existing localStorage config is present
- Section filters remain visible in fullscreen mode
- Graph type buttons replaced with icons to save canvas space in the customized layout

### Fixed
- Use Suite Path toggles now apply correctly across all relevant graphs
- Donut Total Status graph sometimes mixed up passed/failed/skipped statuses

### Changed
- All settings unified into a single localStorage settings object accessible via the Settings icon (copy, edit, update)
- Information popups (tooltips) moved to graph type icons to reduce layout height

---

## [1.0.2] - 2025-06-27

### Added
- "Set Amount to All Runs" button in the run amount filter popup
- Setting to disable graph axis titles

### Fixed
- Suite folder drill-down was matching incorrectly — now resolved
- Very long suite names are shown with multiline tooltips instead of being truncated

### Changed
- Suite folder bars now have a hover effect to indicate drill-down is available
- Section filters on small screens no longer break to the next row

---

## [1.0.1] - 2025-06-21

### Fixed
- Log file links on the overview page were not opening correctly

---

## [1.0.0] - 2025-06-20

### Added
- **Overview Page** — new top-level page showing all projects; projects determined by root suite name or `project_` run tags
- **Compare Page** — three new comparison graphs; compare up to 4 runs side by side
- Icons throughout the UI: filters, customize view, graph settings, theme, database summary, version, bug report, GitHub/docs links
- Metadata filter — supports both run-level and suite-level metadata key/value pairs; treated as run-level when used in filters
- Complete menu overhaul for easier navigation

### Fixed
- Dashboard printing now renders at the correct scale (recommended: 75–90%, landscape mode)
- Log file opening from graphs and labels fixed in various edge cases

---

## [0.9.4] - 2025-06-05

### Added
- Graph animation enable/disable toggle in Settings
- Animation duration setting (default: 1500 ms)

### Changed
- General code cleanup

---

## [0.9.3] - 2025-06-04

### Added
- Heatmap graph in the Run section

### Fixed
- Clicking donut graphs didn't always trigger a redraw — now fixed

### Changed
- Duplicate run detection now runs before full output processing (significant performance improvement for large output files)
- `AbstractDatabaseProcessor` now requires a `run_start_exists(self, run_start: str) -> bool` method for early duplicate detection

---

## [0.9.2] - 2025-05-31

### Added
- `AbstractDatabaseProcessor` abstract base class for custom database implementations
- Maximum Graphs Per Row setting (1–4) in Settings
- Numerical run statistics block added to the Run section
- Top navigation menu for switching between and scrolling to sections

---

## [0.9.1] - 2025-05-28

### Fixed
- Donut charts not rendering correctly in Firefox

---

## [0.9.0] - 2025-05-27

### Added
- New donut graphs: Last Run Status and Total Run Status in the Run section; All Folder Statistics and Last Run Failed Folders (with drill-down) in the Suite section
- Most Failed Keywords graph in the Keyword section
- Fullscreen of Top 10 graphs now shows Top 50
- Tooltip icons on every graph describing what the graph shows
- Settings panel: theme (light/dark), toggle graph legends, run labels, aliases, and milliseconds display — deprecates the `--aliases` and `--excludemilliseconds` CLI options
- Dashboard HTML now encoded as base64 + gzip (~80% size reduction compared to previous versions)
- Graph animations

### Changed
- Major UI styling and theme makeover
- Label length capped at 40 characters
- Customize View renamed to Settings

---

## [0.8.6] - 2025-05-14

### Added
- Top 10 Recent Most Failed Tests graph
- Use Suite Paths toggle in the Suite and Test filter sections

### Fixed
- Reset Filters button now also resets the Run Amount to its initial value

### Changed
- "Show Only Test" switch removed — this behavior is now always enabled by default
- Timeline graph performance greatly improved (tested with 30,000+ tests across 200+ runs)

> **Note:** Customize view configuration will be reset when upgrading from a version before 0.8.6, because a new graph was added to the stored layout.

---

## [0.8.5] - 2025-05-13

### Added
- Log file deep linking — clicking a suite or test in any graph opens `log.html` at the correct suite/test location (requires re-adding outputs to populate the new ID columns)
- Clicking suite/test labels (including aliases) opens the corresponding log file
- Suite statistics graph tooltips now show the suite name
- Timeline graphs now always show all x-axis labels

### Fixed
- Log file opening now works correctly for server deployments, file hosting servers, and direct `file:///` usage

---

## [0.8.4] - 2025-05-13

Patch release (suite and test `id` columns added to the database).

---

## [0.8.3] - 2025-05-08

Patch release.

---

## [0.8.2] - 2025-05-08

Patch release.

---

## [0.8.1] - 2025-05-07

### Added
- `--uselogs true` flag (replaces `--userlogfolder`) — output path saved in the database and used to automatically locate `log.html`
- Server: `add-log` endpoint to upload log files
- Server: `remove-log` endpoint to delete log files

---

## [0.8.0] - 2025-05-05

### Added
- `-u` / `--userlogfolder` argument — links Robot Framework `log.html` files from within the dashboard
- Log linking works in server mode, file hosting mode, and direct file usage
- Log file naming convention: based on the run alias, replacing `output` with `log` and using `.html` extension

---

## [0.7.1] - 2025-05-01

### Added
- Sticky top navigation menu — always visible while scrolling
- Loading spinner shown while graphs are rendering
- Selected graph type saved to localStorage
- Run amount filter at the top of the page (default: 20 runs; configurable with `-q` / `--quantity`)
- Run count indicator in each section showing how many runs are currently displayed

---

## [0.7.0] - 2025-04-27

### Added
- Dashboard sections can now be rearranged (drag-and-drop) in addition to being hidden or shown; graphs stay grouped when moved
- Top 10 Recent Most Flaky Tests graph — ranks by most recent failure; supports the ignore-skips toggle
- `--messageconfig` / `-m` argument — path to a text file with message templates using `${variable}` placeholders to group similar failure messages in the Top 10 Fail Messages graph
- Improved version link in the dashboard: now links to documentation and the GitHub issue tracker

### Changed
- When a section is hidden, its graphs are disabled for performance
- Server admin config can set customization defaults for all users

---

## [0.6.8] - 2025-04-25

Patch release.

---

## [0.6.7] - 2025-04-04

### Added
- Dashboard customization — show/hide individual sections and graphs; configuration saved to localStorage and applied on every load
- Admin can pre-set customization defaults in server usage
- Dashboard version displayed in the top-right corner of the HTML

### Changed
- Run tag filter now supports AND / OR logic toggle (previously AND only)

---

## [0.6.6] - 2025-04-02

Patch release.

---

## [0.6.5] - 2025-04-02

Patch release.

---

## [0.6.4] - 2025-03-29

### Added
- Multiple run tag filtering — filter by more than one tag simultaneously (AND logic)
- `--removerun` / `-r` extended: delete runs by index, `run_start` timestamp, alias, or tag
- Server: `/get-outputs` now returns aliases and tags for each run
- Server: `/add-outputs` now supports setting an alias
- Server: `/remove-outputs` now has the same selection capabilities as the CLI

---

## [0.6.3] - 2025-03-28

Patch release (listener integration improvements).

---

## [0.6.2] - 2025-03-18

### Added
- "Ignore Skips" checkbox in the Most Flaky Test graph — excludes status flips caused by skips from the flakiness count

### Fixed
- Python 3.9.x compatibility issues (e.g., `str | None` type union syntax)

---

## [0.6.1] - 2025-03-18

Patch release.

---

## [0.6.0] - 2025-03-16

### Added
- Server mode: `robotdashboard --server default` or `robotdashboard --server yourhost:yourport`
  - GET / POST / DELETE endpoints for managing outputs in the database
  - FastAPI auto-generated documentation with examples
  - Admin page for manual interaction
  - Dashboard served at a URL and auto-updated after every upload
- Top 10 Most Flaky Tests graph — tests with the most pass/fail status flips across runs
- Duration Deviation (BoxPlot) graph — shows test duration distributions to identify outliers
- `--aliases true` / `-a true` — use output-filename-derived aliases instead of `run_start` timestamps across all graphs

---

## [0.5.0] - 2025-03-08

### Added
- "All" option in the suite selection dropdowns (Suite section and Tests section)
- Custom database class support via `--databaseclass ./path/to/db.py` — implement `AbstractDatabaseProcessor` to use any backend
- MySQL example implementation added to the GitHub repository

---

## [0.4.6] - 2025-03-07

Patch release.

---

## [0.4.5] - 2025-02-19

Patch release.

---

## [0.4.4] - 2025-02-09

Patch release.

---

## [0.4.3] - 2025-02-01

### Added
- Tag-based filter in the Test section

### Fixed
- Pathing issues on macOS
- Python 3.8 compatibility issues

> **Note:** The tests table is extended with a `tags` column. Databases from v0.4.2 and earlier are automatically migrated on first run.

---

## [0.4.2] - 2025-02-01

Patch release.

---

## [0.4.1] - 2024-11-15

Patch release.

---

## [0.4.0] - 2024-11-14

Patch release.

---

## [0.3.x] - 2024-10-30 to 2024-11-02

Early development releases (0.3.0–0.3.8). No detailed release notes.

---

## [0.2.x] - 2024-10-25 to 2024-10-30

Early development releases (0.2.0–0.2.6). No detailed release notes.

---

## [0.1.x] - 2024-10-21 to 2024-10-22

Initial releases (0.1.1–0.1.5). No detailed release notes.
