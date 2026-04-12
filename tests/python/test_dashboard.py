import json
import zlib
import base64
import pytest
from robotframework_dashboard.dashboard import DashboardGenerator


# --- _compress_and_encode ---

def test_compress_and_encode_returns_string():
    result = DashboardGenerator()._compress_and_encode({"key": "value"})
    assert isinstance(result, str)


def test_compress_and_encode_round_trip_list():
    obj = [{"run_start": "2025-01-01", "name": "Test", "total": 10}]
    encoded = DashboardGenerator()._compress_and_encode(obj)
    decoded = json.loads(zlib.decompress(base64.b64decode(encoded)))
    assert decoded == obj


def test_compress_and_encode_round_trip_dict():
    obj = {"runs": [1, 2, 3], "tests": [{"name": "a"}]}
    encoded = DashboardGenerator()._compress_and_encode(obj)
    decoded = json.loads(zlib.decompress(base64.b64decode(encoded)))
    assert decoded == obj


def test_compress_and_encode_empty_list():
    encoded = DashboardGenerator()._compress_and_encode([])
    decoded = json.loads(zlib.decompress(base64.b64decode(encoded)))
    assert decoded == []


def test_compress_and_encode_empty_dict():
    encoded = DashboardGenerator()._compress_and_encode({})
    decoded = json.loads(zlib.decompress(base64.b64decode(encoded)))
    assert decoded == {}


def test_compress_and_encode_is_deterministic():
    obj = {"key": "value", "number": 42}
    gen = DashboardGenerator()
    assert gen._compress_and_encode(obj) == gen._compress_and_encode(obj)


def test_compress_and_encode_unicode():
    obj = {"name": "Ünïcödé tëst"}
    encoded = DashboardGenerator()._compress_and_encode(obj)
    decoded = json.loads(zlib.decompress(base64.b64decode(encoded)))
    assert decoded == obj


# --- _minify_text ---

def test_minify_text_removes_blank_lines():
    text = "line1\n\nline2\n\nline3\n"
    result = DashboardGenerator()._minify_text(text)
    assert result == "line1\nline2\nline3"


def test_minify_text_removes_whitespace_only_lines():
    text = "line1\n   \nline2"
    result = DashboardGenerator()._minify_text(text)
    assert result == "line1\nline2"


def test_minify_text_strips_indentation():
    text = "  indented\n  line"
    result = DashboardGenerator()._minify_text(text)
    assert result == "indented\nline"


def test_minify_text_empty_input():
    result = DashboardGenerator()._minify_text("")
    assert result == ""


def test_minify_text_all_blank_lines():
    result = DashboardGenerator()._minify_text("\n\n\n")
    assert result == ""


def test_minify_text_single_line_unchanged():
    result = DashboardGenerator()._minify_text("hello")
    assert result == "hello"


def test_minify_text_no_trailing_newline():
    result = DashboardGenerator()._minify_text("a\nb\n")
    assert not result.endswith("\n")


# --- generate_dashboard ---

from datetime import datetime
from pathlib import Path

_EMPTY_DATA = {"runs": [], "suites": [], "tests": [], "keywords": []}


def _call_generate(tmp_path, **kwargs):
    """Helper that calls generate_dashboard with sensible defaults."""
    output = tmp_path / "dashboard.html"
    defaults = dict(
        name_dashboard=str(output),
        data=_EMPTY_DATA,
        generation_datetime=datetime(2025, 1, 1, 12, 0, 0),
        dashboard_title="",
        server=False,
        json_config=None,
        message_config=[],
        quantity=20,
        use_logs=False,
        offline=False,
        force_json_config=False,
        no_autoupdate=False,
    )
    defaults.update(kwargs)
    DashboardGenerator().generate_dashboard(**defaults)
    return output


def test_generate_dashboard_creates_file(tmp_path):
    output = _call_generate(tmp_path)
    assert output.exists()
    assert output.stat().st_size > 0


def test_generate_dashboard_custom_title(tmp_path):
    output = _call_generate(tmp_path, dashboard_title="My Custom Dashboard")
    content = output.read_text(encoding="utf-8")
    assert "My Custom Dashboard" in content


def test_generate_dashboard_default_title_uses_datetime(tmp_path):
    output = _call_generate(tmp_path, dashboard_title="")
    content = output.read_text(encoding="utf-8")
    assert "2025-01-01" in content


def test_generate_dashboard_server_mode(tmp_path):
    output = _call_generate(tmp_path, server=True)
    content = output.read_text(encoding="utf-8")
    assert "true" in content


def test_generate_dashboard_no_server_mode(tmp_path):
    output = _call_generate(tmp_path, server=False)
    content = output.read_text(encoding="utf-8")
    assert "false" in content


def test_generate_dashboard_with_message_config(tmp_path):
    output = _call_generate(tmp_path, message_config=["Template: ${name}", "Alert: ${value}"])
    content = output.read_text(encoding="utf-8")
    assert "Template" in content


def test_generate_dashboard_with_json_config(tmp_path):
    output = _call_generate(tmp_path, json_config='{"theme": "dark"}')
    content = output.read_text(encoding="utf-8")
    assert "dark" in content


def test_generate_dashboard_use_logs_true(tmp_path):
    output = _call_generate(tmp_path, use_logs=True)
    content = output.read_text(encoding="utf-8")
    assert "true" in content


def test_generate_dashboard_empty_runs_prints_warning(tmp_path, capsys):
    _call_generate(tmp_path, data=_EMPTY_DATA)
    captured = capsys.readouterr()
    assert "WARNING" in captured.out


def test_generate_dashboard_subdirectory_created(tmp_path):
    subdir_output = tmp_path / "sub" / "deeper" / "dashboard.html"
    DashboardGenerator().generate_dashboard(
        name_dashboard=str(subdir_output),
        data=_EMPTY_DATA,
        generation_datetime=datetime.now(),
        dashboard_title="",
        server=False,
        json_config=None,
        message_config=[],
        quantity=20,
        use_logs=False,
        offline=False,
        force_json_config=False,
        no_autoupdate=False,
    )
    assert subdir_output.exists()


# --- _make_paths_relative ---

import os


def _make_rel(dashboard_path, runs):
    return DashboardGenerator()._make_paths_relative(runs, str(dashboard_path))


def test_make_paths_relative_same_dir(tmp_path):
    output_xml = tmp_path / "output.xml"
    dashboard = tmp_path / "dashboard.html"
    runs = [{"run_start": "2025-01-01", "path": str(output_xml)}]
    result = _make_rel(dashboard, runs)
    assert result[0]["path"] == "output.xml"


def test_make_paths_relative_subdirectory(tmp_path):
    reports = tmp_path / "reports"
    reports.mkdir()
    output_xml = reports / "output.xml"
    dashboard = tmp_path / "dashboard.html"
    runs = [{"run_start": "2025-01-01", "path": str(output_xml)}]
    result = _make_rel(dashboard, runs)
    assert result[0]["path"] == "reports/output.xml"


def test_make_paths_relative_parent_directory(tmp_path):
    subdir = tmp_path / "dash"
    subdir.mkdir()
    output_xml = tmp_path / "output.xml"
    dashboard = subdir / "dashboard.html"
    runs = [{"run_start": "2025-01-01", "path": str(output_xml)}]
    result = _make_rel(dashboard, runs)
    assert result[0]["path"] == "../output.xml"


def test_make_paths_relative_empty_path_unchanged(tmp_path):
    dashboard = tmp_path / "dashboard.html"
    runs = [{"run_start": "2025-01-01", "path": ""}]
    result = _make_rel(dashboard, runs)
    assert result[0]["path"] == ""


def test_make_paths_relative_missing_path_key_unchanged(tmp_path):
    dashboard = tmp_path / "dashboard.html"
    runs = [{"run_start": "2025-01-01"}]
    result = _make_rel(dashboard, runs)
    assert result[0] == {"run_start": "2025-01-01"}


def test_make_paths_relative_does_not_mutate_originals(tmp_path):
    output_xml = tmp_path / "output.xml"
    dashboard = tmp_path / "dashboard.html"
    original_path = str(output_xml)
    runs = [{"run_start": "2025-01-01", "path": original_path}]
    _make_rel(dashboard, runs)
    assert runs[0]["path"] == original_path


def test_make_paths_relative_uses_forward_slashes(tmp_path):
    reports = tmp_path / "a" / "b"
    reports.mkdir(parents=True)
    output_xml = reports / "output.xml"
    dashboard = tmp_path / "dashboard.html"
    runs = [{"run_start": "2025-01-01", "path": str(output_xml)}]
    result = _make_rel(dashboard, runs)
    assert "\\" not in result[0]["path"]


def test_make_paths_relative_multiple_runs(tmp_path):
    reports = tmp_path / "reports"
    reports.mkdir()
    dashboard = tmp_path / "dashboard.html"
    runs = [
        {"run_start": "2025-01-01", "path": str(tmp_path / "output1.xml")},
        {"run_start": "2025-01-02", "path": str(reports / "output2.xml")},
        {"run_start": "2025-01-03", "path": ""},
    ]
    result = _make_rel(dashboard, runs)
    assert result[0]["path"] == "output1.xml"
    assert result[1]["path"] == "reports/output2.xml"
    assert result[2]["path"] == ""


def test_generate_dashboard_uselogs_embeds_relative_paths(tmp_path):
    import json, zlib, base64, re
    output_xml = tmp_path / "output.xml"
    dashboard = tmp_path / "dashboard.html"
    data = {"runs": [{"run_start": "2025-01-01", "path": str(output_xml)}],
            "suites": [], "tests": [], "keywords": []}
    DashboardGenerator().generate_dashboard(
        name_dashboard=str(dashboard),
        data=data,
        generation_datetime=datetime(2025, 1, 1),
        dashboard_title="",
        server=False,
        json_config=None,
        message_config=[],
        quantity=20,
        use_logs=True,
        offline=False,
        force_json_config=False,
        no_autoupdate=False,
    )
    content = dashboard.read_text(encoding="utf-8")
    # Extract the base64 payload for runs
    match = re.search(r'const runs = decode_and_decompress\("([^"]+)"\)', content)
    assert match, "runs payload not found in dashboard"
    decoded = json.loads(zlib.decompress(base64.b64decode(match.group(1))))
    assert decoded[0]["path"] == "output.xml"
    assert str(tmp_path).replace("\\", "/") not in decoded[0]["path"]


def test_generate_dashboard_server_mode_keeps_absolute_paths(tmp_path):
    import json, zlib, base64, re
    output_xml = tmp_path / "output.xml"
    dashboard = tmp_path / "dashboard.html"
    abs_path = str(output_xml)
    data = {"runs": [{"run_start": "2025-01-01", "path": abs_path}],
            "suites": [], "tests": [], "keywords": []}
    DashboardGenerator().generate_dashboard(
        name_dashboard=str(dashboard),
        data=data,
        generation_datetime=datetime(2025, 1, 1),
        dashboard_title="",
        server=True,
        json_config=None,
        message_config=[],
        quantity=20,
        use_logs=True,
        offline=False,
        force_json_config=False,
        no_autoupdate=False,
    )
    content = dashboard.read_text(encoding="utf-8")
    match = re.search(r'const runs = decode_and_decompress\("([^"]+)"\)', content)
    assert match, "runs payload not found in dashboard"
    decoded = json.loads(zlib.decompress(base64.b64decode(match.group(1))))
    assert decoded[0]["path"] == abs_path
