"""Rich-based CLI output helpers for robotdashboard.

All terminal output goes through this module so styling is centralised.
The ``display()`` function is the main entry point for the pipeline messages
produced by RobotDashboard._print_console(); it detects the message type and
routes it to the appropriate styled print function.
"""

import re

from rich.console import Console
from rich.rule import Rule
from rich.table import Table
from rich.text import Text

# Single console instance shared by the whole process.
console = Console(highlight=False)

# ---------------------------------------------------------------------------
# Banner
# ---------------------------------------------------------------------------

_BANNER_ART = (
    " ____   ___  ____   ___ _____ ____    _    ____  _   _ ____   ___    _    ____  ____ \n"
    "|  _ \\ / _ \\| __ ) / _ |_   _|  _ \\  / \\  / ___|| | | | __ ) / _ \\  / \\  |  _ \\|  _ \\ \n"
    "| |_) | | | |  _ \\| | | || | | | | |/ _ \\ \\___ \\| |_| |  _ \\| | | |/ _ \\ | |_) | | | |\n"
    "|  _ <| |_| | |_) | |_| || | | |_| / ___ \\ ___) |  _  | |_) | |_| / ___ \\|  _ <| |_| |\n"
    "|_| \\_\\\\___/|____/ \\___/ |_| |____/_/   \\_|____/|_| |_|____/ \\___/_/   \\_|_| \\_|____/ "
)


def print_banner(version):
    # type: (str) -> None
    """Print the robotdashboard ASCII banner framed by cyan rules."""
    console.print(Rule(style="bold cyan"))
    art = Text(_BANNER_ART, style="bold cyan", no_wrap=True, overflow="ignore")
    console.print(art)
    console.print(Text("  " + version, style="dim cyan"))
    console.print(Rule(style="bold cyan"))


# ---------------------------------------------------------------------------
# Step rules
# ---------------------------------------------------------------------------


def step_rule(number, title):
    # type: (int, str) -> None
    """Print a rich horizontal rule as a numbered step section header."""
    console.rule("[bold cyan] " + str(number) + ". " + title + " [/]", style="dim cyan")


# ---------------------------------------------------------------------------
# Message helpers
# ---------------------------------------------------------------------------


def print_success(message):
    # type: (str) -> None
    console.print("  [bold green]\u2713[/bold green]  " + message)


def print_info(message):
    # type: (str) -> None
    console.print("  " + message)


def print_skip():
    # type: () -> None
    console.print("  [dim]skipping step[/dim]")


def print_warning(message):
    # type: (str) -> None
    console.print("  [bold yellow]\u26a0[/bold yellow]  [yellow]" + message + "[/yellow]")


def print_error(message):
    # type: (str) -> None
    console.print("  [bold red]\u2717[/bold red]  [red]" + message + "[/red]")


# ---------------------------------------------------------------------------
# Run table (used by database.list_runs)
# ---------------------------------------------------------------------------


def print_runs_table(run_starts, run_names):
    # type: (list, list) -> None
    """Print all runs as a styled Rich table."""
    if not run_starts:
        print_warning("There are no runs so the dashboard will be empty!")
        return
    table = Table(
        show_header=True,
        header_style="bold cyan",
        show_lines=False,
        box=None,
        padding=(0, 2),
    )
    table.add_column("Index", style="dim", justify="right")
    table.add_column("Run start")
    table.add_column("Name", style="default")
    for index, run_start in enumerate(run_starts):
        table.add_row(str(index), run_start, run_names[index])
    console.print(table)


# ---------------------------------------------------------------------------
# Routing dispatcher (used by _print_console)
# ---------------------------------------------------------------------------

_STEP_RE = re.compile(r"^ (\d+)\.\s+(.+)", re.DOTALL)
_SEP_RE = re.compile(r"^=+$")
_SECONDS_RE = re.compile(r"\bin \d+\.?\d* seconds?\b")


def display(message):
    # type: (str) -> None
    """Route a plain-text pipeline message to the appropriate rich function.

    Rules (in order):
    * Pure ``=`` separator lines are suppressed — step rules replace them.
    * Lines starting with `` N. Title`` become step rules.
    * Lines containing ``ERROR:`` → red error.
    * Lines containing ``WARNING:`` → yellow warning.
    * Lines matching ``in X seconds`` → green success tick.
    * ``skipping step`` → dim italic.
    * Everything else → plain info.
    """
    stripped = message.strip()

    # Suppress bare separator lines
    if _SEP_RE.match(stripped):
        return

    # Step header, e.g. " 1. Database preparation" (optionally multi-line)
    step_match = _STEP_RE.match(message)
    if step_match:
        step_num = int(step_match.group(1))
        first_line = step_match.group(2).split("\n")[0].strip()
        step_rule(step_num, first_line)
        for line in message.split("\n")[1:]:
            rest = line.strip()
            if rest == "skipping step":
                print_skip()
            elif rest:
                print_info(rest)
        return

    if "ERROR:" in stripped:
        print_error(stripped.lstrip())
        return

    if "WARNING:" in stripped:
        print_warning(stripped.lstrip())
        return

    if _SECONDS_RE.search(stripped):
        print_success(stripped)
        return

    if stripped == "skipping step":
        print_skip()
        return

    print_info(stripped)
