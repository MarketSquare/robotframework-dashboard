#!/usr/bin/env python3
"""Benchmark script for robotframework-dashboard.

Generates synthetic Robot Framework output.xml files at different scales and
measures XML processing time, dashboard generation time, and file sizes.

Usage:
    python scripts/benchmark.py
    python scripts/benchmark.py --scenarios small medium large
    python scripts/benchmark.py --scenarios stress

Scenarios
---------
  small   10 runs x  30 tests x  ~25 keywords/test  (quick smoke check)
  medium  50 runs x 150 tests x  ~65 keywords/test  (typical CI project)
  large  100 runs x 400 tests x ~140 keywords/test  (heavy CI project)
  stress  50 runs x 100 tests x ~400 keywords/test  (deeply nested + many FOR loops)

Requirements:
    pip install robotframework-dashboard
    (or run from the project root after: pip install -e .)
"""

import argparse
import os
import shutil
import sys
import tempfile
from datetime import datetime, timedelta
from pathlib import Path
from time import perf_counter

sys.path.insert(0, str(Path(__file__).parent.parent))

from robotframework_dashboard.dashboard import DashboardGenerator
from robotframework_dashboard.database import DatabaseProcessor
from robotframework_dashboard.processors import OutputProcessor

# ---------------------------------------------------------------------------
# Scenario definitions
# ---------------------------------------------------------------------------

SCENARIOS = {
    "small": {
        "label": "Small",
        "runs": 10,
        "tests_per_run": 30,
        "suites_per_run": 3,
        "flat_kw": 5,
        "nested_helpers": 1,   # each helper wraps 2 inner keywords (depth-2)
        "for_loops": 1,
        "for_iterations": 8,
        "for_kw": 2,           # keywords inside each FOR iteration (flat)
    },
    "medium": {
        "label": "Medium",
        "runs": 50,
        "tests_per_run": 150,
        "suites_per_run": 5,
        "flat_kw": 12,
        "nested_helpers": 2,
        "for_loops": 1,
        "for_iterations": 15,
        "for_kw": 3,
    },
    "large": {
        "label": "Large",
        "runs": 100,
        "tests_per_run": 400,
        "suites_per_run": 10,
        "flat_kw": 18,
        "nested_helpers": 3,
        "for_loops": 2,
        "for_iterations": 20,
        "for_kw": 4,
    },
    "stress": {
        "label": "Stress (deep nesting + many FOR loops)",
        "runs": 50,
        "tests_per_run": 100,
        "suites_per_run": 5,
        "flat_kw": 20,
        "nested_helpers": 5,   # helpers with 3-level depth
        "for_loops": 4,
        "for_iterations": 30,
        "for_kw": 5,
    },
}

# ---------------------------------------------------------------------------
# XML generation helpers
# ---------------------------------------------------------------------------

_BASE_TS = datetime(2024, 1, 15, 8, 0, 0)
_ELAPSED = 0.000200  # synthetic elapsed per keyword (seconds)


def _ts(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%S.%f")


def _status(status: str, start: datetime, elapsed: float, msg: str = "") -> str:
    tail = f">{msg}</status>" if msg else "/>"
    return f'<status status="{status}" start="{_ts(start)}" elapsed="{elapsed:.6f}"{tail}\n'


def _flat_kw(name: str, owner: str, n: int, start: datetime) -> str:
    """One flat keyword with a single message and arg."""
    return (
        f'<kw name="{name}" owner="{owner}">\n'
        f'<msg time="{_ts(start)}" level="INFO">Result {n}</msg>\n'
        f'<arg>arg_{n}</arg>\n'
        + _status("PASS", start, _ELAPSED)
        + "</kw>\n"
    )


def _inner_kw(name: str, owner: str, n: int, start: datetime) -> str:
    """Innermost keyword (leaf) — used inside nested helpers."""
    return (
        f'<kw name="{name}" owner="{owner}">\n'
        f'<msg time="{_ts(start)}" level="INFO">Inner result {n}</msg>\n'
        + _status("PASS", start, _ELAPSED)
        + "</kw>\n"
    )


def _nested_helper(helper_idx: int, n: int, start: datetime, depth: int = 2) -> str:
    """A helper keyword that wraps `depth` inner keywords (simulates call stack)."""
    inner = ""
    for d in range(depth):
        inner += _inner_kw(
            f"Inner Keyword {chr(65 + d)}",
            "BenchmarkLibrary",
            n * 10 + d,
            start,
        )
    return (
        f'<kw name="Helper Keyword {helper_idx}" owner="BenchmarkLibrary">\n'
        + inner
        + _status("PASS", start, _ELAPSED * (depth + 1))
        + "</kw>\n"
    )


def _for_loop(loop_idx: int, n_iterations: int, n_kw: int, start: datetime) -> str:
    """A FOR loop with `n_iterations` iterations, each containing `n_kw` flat keywords."""
    iterations = ""
    for i in range(n_iterations):
        inner = ""
        for k in range(n_kw):
            inner += _flat_kw(
                f"Loop Body Keyword {k + 1}",
                "BenchmarkLibrary",
                i * n_kw + k,
                start,
            )
        # Each iteration also contains a nested 2-level helper to simulate realistic depth
        inner += _inner_kw("Validate Result", "BenchmarkLibrary", i, start)
        iterations += (
            f'<kw name="${{item}} = {i}" type="ITERATION">\n'
            + inner
            + _status("PASS", start, _ELAPSED * (n_kw + 2))
            + "</kw>\n"
        )
    return (
        f'<kw name="FOR" type="FOR">\n'
        f'<var>${{item}}</var>\n'
        + iterations
        + _status("PASS", start, _ELAPSED * n_iterations * (n_kw + 2))
        + "</kw>\n"
    )


def _test(
    test_id: str,
    test_name: str,
    line: int,
    flat_kw: int,
    nested_helpers: int,
    for_loops: int,
    for_iterations: int,
    for_kw: int,
    start: datetime,
    helper_depth: int = 2,
) -> str:
    """Generate one <test> element with the configured keyword structure."""
    body = ""

    # Flat keywords
    for k in range(flat_kw):
        body += _flat_kw(f"Keyword {k + 1}", "BenchmarkLibrary", k, start)

    # Nested helper keywords (simulate real keyword abstraction layers)
    for h in range(nested_helpers):
        body += _nested_helper(h + 1, h, start, depth=helper_depth)

    # FOR loops with iterations
    for lp in range(for_loops):
        body += _for_loop(lp + 1, for_iterations, for_kw, start)

    # Test tags
    tags = f'<tag>benchmark</tag>\n<tag>test-{(line // 10) % 10}</tag>\n'

    # Total elapsed = rough sum of all keywords
    n_kw_total = flat_kw + nested_helpers * (helper_depth + 1) + for_loops * for_iterations * (for_kw + 2)
    elapsed = _ELAPSED * n_kw_total

    return (
        f'<test id="{test_id}" name="{test_name}" line="{line}">\n'
        + body
        + tags
        + _status("PASS", start, elapsed)
        + "</test>\n"
    )


def generate_output_xml(
    run_index: int,
    cfg: dict,
    base_time: datetime,
) -> str:
    """Generate a complete output.xml string for one run."""
    run_ts = base_time + timedelta(seconds=run_index * 3600)
    n_tests = cfg["tests_per_run"]
    n_suites = cfg["suites_per_run"]
    tests_per_suite = max(1, n_tests // n_suites)

    pass_count = n_tests
    suite_xml = ""
    test_global = 0

    for s in range(n_suites):
        suite_id = f"s1-s{s + 1}"
        suite_name = f"Suite {s + 1:02d}"
        tests_in_suite = tests_per_suite if s < n_suites - 1 else n_tests - test_global
        suite_tests = ""

        for t in range(tests_in_suite):
            test_global += 1
            test_id = f"{suite_id}-t{t + 1}"
            test_name = f"Test {test_global:04d}"
            line = t * 6 + 7
            test_start = run_ts + timedelta(milliseconds=test_global * 200)
            depth = 3 if cfg.get("label", "").startswith("Stress") else 2
            suite_tests += _test(
                test_id, test_name, line,
                cfg["flat_kw"],
                cfg["nested_helpers"],
                cfg["for_loops"],
                cfg["for_iterations"],
                cfg["for_kw"],
                test_start,
                helper_depth=depth,
            )

        suite_elapsed = tests_in_suite * 0.2
        suite_xml += (
            f'<suite id="{suite_id}" name="{suite_name}" source="/benchmark/{suite_name.lower().replace(" ", "-")}.robot">\n'
            + suite_tests
            + _status("PASS", run_ts, suite_elapsed)
            + "</suite>\n"
        )

    root_elapsed = n_tests * 0.2
    stats = (
        f"<statistics>\n"
        f"<total>\n"
        f'<stat pass="{pass_count}" fail="0" skip="0">All Tests</stat>\n'
        f"</total>\n"
        f"<tag>\n"
        f'<stat pass="{pass_count}" fail="0" skip="0">benchmark</stat>\n'
        f"</tag>\n"
        f"<suite>\n"
        f'<stat pass="{pass_count}" fail="0" skip="0" id="s1" name="Benchmark Suite">Benchmark Suite</stat>\n'
        f"</suite>\n"
        f"</statistics>\n"
    )

    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<robot generator="Robot 7.4 (Python 3.12 on linux)" '
        f'generated="{_ts(run_ts)}" rpa="false" schemaversion="5">\n'
        f'<suite id="s1" name="Benchmark Suite" source="/benchmark">\n'
        + suite_xml
        + _status("PASS", run_ts, root_elapsed)
        + "</suite>\n"
        + stats
        + "<errors/>\n"
        + "</robot>\n"
    )


# ---------------------------------------------------------------------------
# Benchmark runner
# ---------------------------------------------------------------------------

def _fmt_size(n_bytes: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if n_bytes < 1024:
            return f"{n_bytes:.1f} {unit}"
        n_bytes /= 1024
    return f"{n_bytes:.1f} TB"


def run_scenario(name: str, cfg: dict) -> dict:
    label = cfg["label"]
    n_runs = cfg["runs"]
    n_tests = cfg["tests_per_run"]
    print(f"\n{'=' * 70}")
    print(f"  Scenario: {label}")
    print(f"  {n_runs} runs × {n_tests} tests × ~{_approx_kw(cfg)} keywords/test")
    print(f"{'=' * 70}")

    tmp_dir = Path(tempfile.mkdtemp(prefix="rfdashboard_bench_"))
    db_path = tmp_dir / "bench.db"
    html_path = tmp_dir / "bench.html"

    try:
        # 1. Generate XML files
        print("  [1/3] Generating XML files...", end=" ", flush=True)
        t0 = perf_counter()
        xml_paths = []
        total_xml_bytes = 0
        for i in range(n_runs):
            xml_content = generate_output_xml(i, cfg, _BASE_TS)
            xml_path = tmp_dir / f"output_{i:04d}.xml"
            xml_path.write_text(xml_content, encoding="utf-8")
            xml_paths.append(xml_path)
            total_xml_bytes += len(xml_content.encode("utf-8"))
        xml_gen_time = perf_counter() - t0
        avg_xml = total_xml_bytes // n_runs
        print(
            f"done in {xml_gen_time:.2f}s  "
            f"(avg {_fmt_size(avg_xml)}/file, total {_fmt_size(total_xml_bytes)})"
        )

        # 2. Process XMLs into database
        print("  [2/3] Processing XMLs into database...", end=" ", flush=True)
        db = DatabaseProcessor(db_path)
        db.open_database()
        t0 = perf_counter()
        for xml_path in xml_paths:
            proc = OutputProcessor(xml_path)
            run_start = proc.get_run_start()
            if not db.run_start_exists(run_start):
                output_data = proc.get_output_data()
                db.insert_output_data(output_data, [], str(xml_path.stem), str(xml_path), "", "")
        process_time = perf_counter() - t0
        db.close_database()
        db_bytes = db_path.stat().st_size
        print(
            f"done in {process_time:.2f}s  "
            f"({process_time / n_runs:.3f}s/run, DB size {_fmt_size(db_bytes)})"
        )

        # 3. Generate dashboard HTML
        print("  [3/3] Generating dashboard HTML...", end=" ", flush=True)
        db.open_database()
        dashboard_data = db.get_data()
        db.close_database()
        t0 = perf_counter()
        DashboardGenerator().generate_dashboard(
            html_path,
            dashboard_data,
            datetime.now(),
            "Benchmark Dashboard",
            False,   # server
            "",      # json_config
            [],      # message_config
            0,       # quantity
            False,   # use_logs
            False,   # offline_dependencies
            False,   # force_json_config
            False,   # no_autoupdate
        )
        html_time = perf_counter() - t0
        html_bytes = html_path.stat().st_size
        print(f"done in {html_time:.2f}s  (HTML size {_fmt_size(html_bytes)})")

    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)

    result = {
        "label": label,
        "runs": n_runs,
        "tests_per_run": n_tests,
        "approx_kw": _approx_kw(cfg),
        "xml_gen_time": xml_gen_time,
        "avg_xml_size": avg_xml,
        "total_xml_size": total_xml_bytes,
        "process_time": process_time,
        "process_per_run": process_time / n_runs,
        "db_size": db_bytes,
        "html_time": html_time,
        "html_size": html_bytes,
    }
    return result


def _approx_kw(cfg: dict) -> int:
    """Approximate number of XML keyword elements per test."""
    depth = 3 if cfg.get("label", "").startswith("Stress") else 2
    flat = cfg["flat_kw"]
    nested = cfg["nested_helpers"] * (depth + 1)
    loops = cfg["for_loops"] * cfg["for_iterations"] * (cfg["for_kw"] + 2)
    return flat + nested + loops


def print_summary(results: list) -> None:
    print(f"\n{'=' * 70}")
    print("  SUMMARY")
    print(f"{'=' * 70}")
    header = f"{'Scenario':<36} {'XML/run':>8} {'Process':>9} {'s/run':>7} {'DB':>8} {'HTML':>8} {'HTML gen':>9}"
    print(header)
    print("-" * 70)
    for r in results:
        label = f"{r['label']} ({r['runs']}×{r['tests_per_run']} tests)"
        print(
            f"{label:<36} "
            f"{_fmt_size(r['avg_xml_size']):>8} "
            f"{r['process_time']:>7.2f}s "
            f"{r['process_per_run']:>6.3f}s "
            f"{_fmt_size(r['db_size']):>8} "
            f"{_fmt_size(r['html_size']):>8} "
            f"{r['html_time']:>7.2f}s"
        )
    print(f"{'=' * 70}")
    print()


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument(
        "--scenarios",
        nargs="+",
        choices=list(SCENARIOS.keys()),
        default=["small", "medium", "large", "stress"],
        metavar="SCENARIO",
        help=f"Scenarios to run. Choices: {', '.join(SCENARIOS)}. Default: all.",
    )
    args = parser.parse_args()

    print("robotframework-dashboard benchmark")
    print(f"Python {sys.version.split()[0]}, pid {os.getpid()}")
    print(f"Running scenarios: {', '.join(args.scenarios)}")

    results = []
    for name in args.scenarios:
        result = run_scenario(name, SCENARIOS[name])
        results.append(result)

    print_summary(results)


if __name__ == "__main__":
    main()
