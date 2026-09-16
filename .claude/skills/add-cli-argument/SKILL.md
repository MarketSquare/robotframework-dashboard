---
name: add-cli-argument
description: Checklist for adding or changing a robotdashboard CLI flag — argparse definition and groups in arguments.py, _process_arguments/_check_argument_* validation, wiring through main.py and RobotDashboard, server/listener parity, the argument unit tests, the 00_cli.robot short+long tests and cli_output fixtures (help.txt changes!), and every docs page that lists flags. Use for any "add a --flag", "new CLI option", or "rename/deprecate an argument" task.
---

# Adding a CLI argument

Reference diffs: `--customfilters` (`759b798`, #286), `--logurl` (`040bfc2`, #262), `--logremoved` (`965c87b`, #295). `git show --stat <sha>` shows the full footprint.

## 1. Define it (`robotframework_dashboard/arguments.py` → `_parse_arguments`)

Pick the right `argparse` group (`input_group`, `db_group`, `dashboard_group`, `log_group`, `config_group`, `server_group`) and follow the house style:

```python
input_group.add_argument(
    "-x",                      # short form only if one is free and the flag is common
    "--myflag",
    help=(
        "One-line purpose.\n"
        "  • Constraint or interaction with other flags\n"
        "Examples:\n"
        "  • '--myflag=value'\n"
    ),
    dest="myflag",
    metavar="VALUE",
    type=str,
    default=None,
)
```

- Booleans use the project's `nargs="?"` + `const` pattern and are normalised in `_process_arguments` via `self._normalize_bool(arguments.myflag, "myflag")` so `--myflag`, `--myflag true`, `--myflag=false` all work (see `uselogs`).
- Help text is printed verbatim by `RawTextHelpFormatter` — keep the bullet/Examples layout, it is what the docs and `help.txt` fixture mirror.

## 2. Process and validate (`_process_arguments`)

- Add the value to the `provided_args` dict at the bottom (snake_case key, e.g. `"my_flag": my_flag`). Everything downstream reads `arguments.my_flag` from the returned `dotdict`.
- Mutually exclusive or dependent flags → `_check_argument_errors` (hard stop) or `_check_argument_warnings` (print and continue). `_check_project_version_usage` is the model for "flag vs. tag" conflicts.

## 3. Wire it through

| Consumer | Change |
|---|---|
| `main.py` | Pass `arguments.my_flag` into `RobotDashboard(...)` — **positional**, so append at the end and mirror the order in `RobotDashboard.__init__` |
| `robotdashboard.py` | New `__init__` parameter with a default; store on `self`; use it in the relevant step (`process_outputs`, `create_dashboard`, `remove_outputs`, …). If it ends up in the DB, follow `custom_filters` (commit `759b798`) through `queries.py`, the migration chain in `database.py`, `abstractdb.py`, and `tables.js` |
| `dashboard.py` | If it changes the generated HTML, add a `placeholder_*` token in `templates/dashboard.html` and the replacement in `generate_dashboard` — never rename existing tokens |
| `server.py` | Flags that affect uploads or generation usually need a server-side equivalent: request-model field on `AddOutput`/`GetOutput`, a form field on `/add-output-file`, and the admin page (`templates/admin.html`, `js/admin_page/admin_api.js`) |
| `robotdashboardlistener.py` | Per-run inputs (tags, version, custom filters, log URL…) should be settable from the listener too — keep the argument table in `docs/listener-integration.md` in sync |

## 4. Tests

- `tests/python/test_arguments.py`: add the new dest to `_make_namespace()` defaults, then a test for each branch (`_process_arguments` output key, any warning/error path, boolean normalisation).
- `tests/python/test_main.py` / `test_robotdashboard.py`: update the positional call expectations and helper defaults (`_make_rd`).
- `tests/python/test_server.py` if the server learned the flag.
- `tests/robot/testsuites/00_cli.robot`: **two** cases, short and long form, named `Validate RobotDashboard <x>` / `Validate RobotDashboard <myflag>`, using `Validate CLI    command=robotdashboard -d <name>.db --myflag …    expected=<myflag>`.
- `tests/robot/resources/cli_output/<myflag>.txt`: expected stdout (glob-matched via `Should Match`, so `*` wildcards are allowed for timestamps/paths).
- `tests/robot/resources/cli_output/help.txt`: **always** changes — the `-h` test diffs the full help text. Regenerate it by running `robotdashboard -h` in Docker (or from source: `python -m robotframework_dashboard.main -h`) and paste the output; keep the ASCII banner lines.
- Run `00_cli.robot` in Docker (`testing` skill).

## 5. Docs (`documentation` skill)

- `docs/basic-command-line-interface-cli.md` — flag reference in the matching section (Output Files / Database / Dashboard / Logs / Config / Server).
- `docs/advanced-cli-examples.md` — a combined example if the flag interacts with others.
- Feature page that owns the behaviour (`filtering.md`, `log-linking.md`, `dashboard-server.md`, …).
- `docs/listener-integration.md` argument tables if the listener/push script gained it.
- `README.md` only when it is headline usage.

## Verify

```bash
python -m robotframework_dashboard.main -h | grep -A6 -- --myflag
python -m robotframework_dashboard.main -f tests -n robot_dashboard.html --myflag value
bash scripts/python-tests.sh
bash scripts/docker/run-in-robot-container.sh robot --outputdir results tests/robot/testsuites/00_cli.robot
```
