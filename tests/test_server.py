"""Unit tests for server.py — ApiServer and its FastAPI endpoints.

Uses FastAPI's TestClient (backed by httpx/starlette) so that all endpoint
logic (request parsing, response building, auth, error handling) is exercised
without spinning up a real network server.  The RobotDashboard instance that
ApiServer delegates to is replaced with a MagicMock throughout, keeping tests
fast and fully deterministic.
"""
import gzip
import io
import pytest
from pathlib import Path
from unittest.mock import MagicMock, patch, call
from fastapi.testclient import TestClient

from robotframework_dashboard.server import ApiServer, ResponseMessage

OUTPUTS_DIR = Path(__file__).parent.parent / "testdata" / "outputs"
SAMPLE_XML = OUTPUTS_DIR / "output-20250313-002134.xml"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_server(
    server_user: str = "",
    server_pass: str = "",
    no_autoupdate: bool = True,
) -> ApiServer:
    """Return an ApiServer with an attached MagicMock RobotDashboard."""
    server = ApiServer(
        server_host="127.0.0.1",
        server_port=8543,
        server_user=server_user,
        server_pass=server_pass,
        offline_dependencies=False,
        no_autoupdate=no_autoupdate,
    )
    mock_rd = MagicMock()
    mock_rd.get_runs.return_value = ([], [], [], [])
    mock_rd.get_run_paths.return_value = {}
    mock_rd.remove_outputs.return_value = "  removed output\n"
    mock_rd.process_outputs.return_value = "  processed\n"
    mock_rd.create_dashboard.return_value = "  dashboard created\n"
    mock_rd.update_output_path.return_value = "  path updated\n"
    server.set_robotdashboard(mock_rd)
    return server


def _client(server: ApiServer) -> TestClient:
    return TestClient(server.app, raise_server_exceptions=False)


# ---------------------------------------------------------------------------
# ApiServer initialisation
# ---------------------------------------------------------------------------

def test_init_sets_expected_attributes():
    server = _make_server(server_user="u", server_pass="p")
    assert server.server_host == "127.0.0.1"
    assert server.server_port == 8543
    assert server.server_user == "u"
    assert server.server_pass == "p"
    assert server.log_dir == "robot_logs"
    assert server.no_autoupdate is True
    assert server.latest_log_dir is None


def test_set_robotdashboard_stores_instance():
    server = ApiServer("127.0.0.1", 8543, "", "", False)
    mock_rd = MagicMock()
    server.set_robotdashboard(mock_rd)
    assert server.robotdashboard is mock_rd


# ---------------------------------------------------------------------------
# _get_admin_page
# ---------------------------------------------------------------------------

def test_get_admin_page_returns_html_string():
    server = _make_server()
    html = server._get_admin_page()
    assert isinstance(html, str)
    assert "<html" in html.lower()


def test_get_admin_page_no_autoupdate_true_hides_refresh_card():
    server = _make_server(no_autoupdate=True)
    html = server._get_admin_page()
    # When no_autoupdate=True the placeholder is replaced with "" (visible)
    assert "hidden" not in html or "placeholder_refresh_card_visibility" not in html


def test_get_admin_page_no_autoupdate_false_hides_refresh_card():
    server = _make_server(no_autoupdate=False)
    html = server._get_admin_page()
    assert "hidden" in html


# ---------------------------------------------------------------------------
# GET /admin
# ---------------------------------------------------------------------------

def test_admin_no_auth_required_returns_200():
    server = _make_server()
    client = _client(server)
    response = client.get("/admin")
    assert response.status_code == 200
    assert "<html" in response.text.lower()


def test_admin_with_auth_correct_credentials_returns_200():
    server = _make_server(server_user="admin", server_pass="secret")
    client = _client(server)
    response = client.get("/admin", auth=("admin", "secret"))
    assert response.status_code == 200


def test_admin_with_auth_wrong_credentials_returns_401():
    server = _make_server(server_user="admin", server_pass="secret")
    client = _client(server)
    response = client.get("/admin", auth=("admin", "wrong"))
    assert response.status_code == 401


def test_admin_with_auth_no_credentials_returns_401():
    server = _make_server(server_user="admin", server_pass="secret")
    client = _client(server)
    response = client.get("/admin")
    assert response.status_code == 401


# ---------------------------------------------------------------------------
# GET /
# ---------------------------------------------------------------------------

def test_dashboard_page_serves_html(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    (tmp_path / "robot_dashboard.html").write_text("<html><body>dash</body></html>")
    server = _make_server()
    client = _client(server)
    response = client.get("/")
    assert response.status_code == 200
    assert "dash" in response.text


# ---------------------------------------------------------------------------
# POST /refresh-dashboard
# ---------------------------------------------------------------------------

def test_refresh_dashboard_calls_create_dashboard():
    server = _make_server()
    client = _client(server)
    response = client.post("/refresh-dashboard")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] == "1"
    server.robotdashboard.create_dashboard.assert_called()


def test_refresh_dashboard_returns_error_on_exception():
    server = _make_server()
    server.robotdashboard.create_dashboard.side_effect = RuntimeError("oops")
    client = _client(server)
    response = client.post("/refresh-dashboard")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] == "0"
    assert "oops" in data["message"]


# ---------------------------------------------------------------------------
# GET /get-outputs
# ---------------------------------------------------------------------------

def test_get_outputs_empty_database():
    server = _make_server()
    client = _client(server)
    response = client.get("/get-outputs")
    assert response.status_code == 200
    assert response.json() == []


def test_get_outputs_with_data():
    server = _make_server()
    server.robotdashboard.get_runs.return_value = (
        ["2025-01-01 12:00:00.000000+01:00"],
        ["MySuite"],
        ["alias1"],
        ["dev,prod"],
    )
    client = _client(server)
    response = client.get("/get-outputs")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["run_start"] == "2025-01-01 12:00:00.000000+01:00"
    assert data[0]["name"] == "MySuite"
    assert data[0]["alias"] == "alias1"
    assert data[0]["tags"] == "dev,prod"


# ---------------------------------------------------------------------------
# POST /add-outputs — by output_path
# ---------------------------------------------------------------------------

def test_add_outputs_by_path_success(tmp_path):
    server = _make_server()
    client = _client(server)
    payload = {"output_path": str(SAMPLE_XML)}
    response = client.post("/add-outputs", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] == "1"
    server.robotdashboard.process_outputs.assert_called_once()


def test_add_outputs_by_path_with_tags(tmp_path):
    server = _make_server()
    client = _client(server)
    payload = {"output_path": str(SAMPLE_XML), "output_tags": ["dev", "ci"]}
    response = client.post("/add-outputs", json=payload)
    assert response.status_code == 200
    assert response.json()["success"] == "1"


def test_add_outputs_by_path_with_version():
    server = _make_server()
    client = _client(server)
    payload = {"output_path": str(SAMPLE_XML), "output_version": "1.2.3"}
    response = client.post("/add-outputs", json=payload)
    assert response.status_code == 200
    assert server.robotdashboard.project_version == "1.2.3"


def test_add_outputs_no_version_clears_project_version():
    server = _make_server()
    server.robotdashboard.project_version = "old_version"
    client = _client(server)
    payload = {"output_path": str(SAMPLE_XML)}
    client.post("/add-outputs", json=payload)
    assert server.robotdashboard.project_version is None


# ---------------------------------------------------------------------------
# POST /add-outputs — by output_folder_path
# ---------------------------------------------------------------------------

def test_add_outputs_by_folder():
    server = _make_server()
    client = _client(server)
    payload = {"output_folder_path": str(OUTPUTS_DIR)}
    response = client.post("/add-outputs", json=payload)
    assert response.status_code == 200
    assert response.json()["success"] == "1"
    server.robotdashboard.process_outputs.assert_called_once()


# ---------------------------------------------------------------------------
# POST /add-outputs — by output_data
# ---------------------------------------------------------------------------

def test_add_outputs_by_data_no_alias(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    server = _make_server()
    client = _client(server)
    xml_content = SAMPLE_XML.read_text(encoding="utf-8")
    payload = {"output_data": xml_content}
    response = client.post("/add-outputs", json=payload)
    assert response.status_code == 200
    assert response.json()["success"] == "1"


def test_add_outputs_by_data_with_alias(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    server = _make_server()
    client = _client(server)
    xml_content = SAMPLE_XML.read_text(encoding="utf-8")
    payload = {"output_data": xml_content, "output_alias": "my_run"}
    response = client.post("/add-outputs", json=payload)
    assert response.status_code == 200
    assert response.json()["success"] == "1"


# ---------------------------------------------------------------------------
# POST /add-outputs — mutual exclusion errors
# ---------------------------------------------------------------------------

def test_add_outputs_path_and_folder_rejected():
    server = _make_server()
    client = _client(server)
    payload = {
        "output_path": str(SAMPLE_XML),
        "output_folder_path": str(OUTPUTS_DIR),
    }
    response = client.post("/add-outputs", json=payload)
    assert response.status_code == 200
    assert response.json()["success"] == "0"


def test_add_outputs_path_and_data_rejected(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    server = _make_server()
    client = _client(server)
    payload = {
        "output_path": str(SAMPLE_XML),
        "output_data": "<robot/>",
    }
    response = client.post("/add-outputs", json=payload)
    assert response.status_code == 200
    assert response.json()["success"] == "0"


# ---------------------------------------------------------------------------
# POST /add-outputs — autoupdate triggers create_dashboard
# ---------------------------------------------------------------------------

def test_add_outputs_autoupdate_calls_create_dashboard():
    server = _make_server(no_autoupdate=False)
    client = _client(server)
    payload = {"output_path": str(SAMPLE_XML)}
    client.post("/add-outputs", json=payload)
    server.robotdashboard.create_dashboard.assert_called()


def test_add_outputs_no_autoupdate_skips_create_dashboard():
    server = _make_server(no_autoupdate=True)
    client = _client(server)
    payload = {"output_path": str(SAMPLE_XML)}
    client.post("/add-outputs", json=payload)
    server.robotdashboard.create_dashboard.assert_not_called()


# ---------------------------------------------------------------------------
# POST /add-output-file — multipart upload
# ---------------------------------------------------------------------------

def test_add_output_file_plain_xml(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    server = _make_server()
    client = _client(server)
    xml_bytes = SAMPLE_XML.read_bytes()
    response = client.post(
        "/add-output-file",
        files={"file": ("output-test.xml", xml_bytes, "application/xml")},
    )
    assert response.status_code == 200
    assert response.json()["success"] == "1"


def test_add_output_file_gzipped(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    server = _make_server()
    client = _client(server)
    xml_bytes = SAMPLE_XML.read_bytes()
    gz_data = gzip.compress(xml_bytes)
    response = client.post(
        "/add-output-file",
        files={"file": ("output-test.xml.gz", gz_data, "application/gzip")},
    )
    assert response.status_code == 200
    assert response.json()["success"] == "1"


def test_add_output_file_with_tags(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    server = _make_server()
    client = _client(server)
    xml_bytes = SAMPLE_XML.read_bytes()
    response = client.post(
        "/add-output-file",
        files={"file": ("output-test.xml", xml_bytes, "application/xml")},
        data={"tags": "dev:ci", "version": "2.0"},
    )
    assert response.status_code == 200
    assert response.json()["success"] == "1"
    assert server.robotdashboard.project_version == "2.0"


# ---------------------------------------------------------------------------
# DELETE /remove-outputs
# ---------------------------------------------------------------------------

def test_remove_outputs_by_index():
    server = _make_server()
    server.robotdashboard.get_runs.return_value = (
        ["2025-01-01 12:00:00+00:00"], ["Suite"], ["alias"], [""]
    )
    client = _client(server)
    response = client.request("DELETE", "/remove-outputs", json={"indexes": ["0"]})
    assert response.status_code == 200
    assert response.json()["success"] == "1"


def test_remove_outputs_by_run_start():
    server = _make_server()
    client = _client(server)
    ts = "2025-01-01 12:00:00.000000+00:00"
    response = client.request("DELETE", "/remove-outputs", json={"run_starts": [ts]})
    assert response.status_code == 200
    assert response.json()["success"] == "1"


def test_remove_outputs_by_alias():
    server = _make_server()
    client = _client(server)
    response = client.request("DELETE", "/remove-outputs", json={"aliases": ["my_alias"]})
    assert response.status_code == 200
    assert response.json()["success"] == "1"


def test_remove_outputs_by_tag():
    server = _make_server()
    client = _client(server)
    response = client.request("DELETE", "/remove-outputs", json={"tags": ["dev"]})
    assert response.status_code == 200
    assert response.json()["success"] == "1"


def test_remove_outputs_by_limit():
    server = _make_server()
    client = _client(server)
    response = client.request("DELETE", "/remove-outputs", json={"limit": 5})
    assert response.status_code == 200
    assert response.json()["success"] == "1"


def test_remove_outputs_all_flag():
    server = _make_server()
    server.robotdashboard.get_runs.return_value = (
        ["2025-01-01 12:00:00+00:00", "2025-02-01 12:00:00+00:00"],
        ["Suite1", "Suite2"],
        ["a1", "a2"],
        ["", ""],
    )
    client = _client(server)
    response = client.request("DELETE", "/remove-outputs", json={"all": True})
    assert response.status_code == 200
    assert response.json()["success"] == "1"
    # Should have built an index range remove call (passed as first positional arg)
    args = server.robotdashboard.remove_outputs.call_args[0][0]
    assert any("index=0:1" in r for r in args)


def test_remove_outputs_all_empty_database():
    """When all=True and database is empty, remove_outputs should not be called."""
    server = _make_server()
    server.robotdashboard.get_runs.return_value = ([], [], [], [])
    client = _client(server)
    response = client.request("DELETE", "/remove-outputs", json={"all": True})
    assert response.status_code == 200
    assert response.json()["success"] == "1"
    server.robotdashboard.remove_outputs.assert_called_once_with([])


def test_remove_outputs_autoupdate(tmp_path):
    server = _make_server(no_autoupdate=False)
    client = _client(server)
    response = client.request("DELETE", "/remove-outputs", json={"indexes": ["0"]})
    assert response.status_code == 200
    server.robotdashboard.create_dashboard.assert_called()


def test_remove_outputs_removes_associated_log_file(tmp_path, monkeypatch):
    """When a run is removed, the corresponding log file should be deleted."""
    monkeypatch.chdir(tmp_path)
    log_dir = tmp_path / "robot_logs"
    log_dir.mkdir()
    log_file = log_dir / "log-20250313-002134.html"
    log_file.write_text("<html>log</html>")

    run_start = "2025-03-13 00:21:34.707148+01:00"
    output_path = str(OUTPUTS_DIR / "output-20250313-002134.xml")

    server = _make_server()
    server.log_dir = str(log_dir)
    server.robotdashboard.get_runs.return_value = ([run_start], ["Suite"], ["alias"], [""])
    server.robotdashboard.get_run_paths.side_effect = [
        {run_start: output_path},  # paths_before
        {},  # paths_after (run was removed)
    ]
    client = _client(server)
    response = client.request("DELETE", "/remove-outputs", json={"indexes": ["0"]})
    assert response.status_code == 200
    assert not log_file.exists()


# ---------------------------------------------------------------------------
# GET /get-logs
# ---------------------------------------------------------------------------

def test_get_logs_no_log_dir_returns_empty(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    server = _make_server()
    server.log_dir = str(tmp_path / "nonexistent_logs")
    client = _client(server)
    response = client.get("/get-logs")
    assert response.status_code == 200
    assert response.json() == []


def test_get_logs_with_files(tmp_path):
    log_dir = tmp_path / "robot_logs"
    log_dir.mkdir()
    (log_dir / "log-abc.html").write_text("log content")
    server = _make_server()
    server.log_dir = str(log_dir)
    client = _client(server)
    response = client.get("/get-logs")
    assert response.status_code == 200
    names = [item["log_name"] for item in response.json()]
    assert "log-abc.html" in names


# ---------------------------------------------------------------------------
# POST /add-log
# ---------------------------------------------------------------------------

def test_add_log_success(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    server = _make_server()
    server.log_dir = str(tmp_path / "robot_logs")
    client = _client(server)
    payload = {"log_name": "log-test.html", "log_data": "<html>log</html>"}
    response = client.post("/add-log", json=payload)
    assert response.status_code == 200
    assert response.json()["success"] == "1"
    assert (tmp_path / "robot_logs" / "log-test.html").exists()


def test_add_log_update_path_error_returns_failure(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    server = _make_server()
    server.log_dir = str(tmp_path / "robot_logs")
    server.robotdashboard.update_output_path.return_value = "ERROR: no matching output\n"
    client = _client(server)
    payload = {"log_name": "log-missing.html", "log_data": "<html>log</html>"}
    response = client.post("/add-log", json=payload)
    assert response.status_code == 200
    assert response.json()["success"] == "0"


def test_add_log_autoupdate(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    server = _make_server(no_autoupdate=False)
    server.log_dir = str(tmp_path / "robot_logs")
    client = _client(server)
    payload = {"log_name": "log-test.html", "log_data": "<html>log</html>"}
    client.post("/add-log", json=payload)
    server.robotdashboard.create_dashboard.assert_called()


# ---------------------------------------------------------------------------
# POST /add-log-file — multipart upload
# ---------------------------------------------------------------------------

def test_add_log_file_plain(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    server = _make_server()
    server.log_dir = str(tmp_path / "robot_logs")
    client = _client(server)
    log_bytes = b"<html>log content</html>"
    response = client.post(
        "/add-log-file",
        files={"file": ("log-abc.html", log_bytes, "text/html")},
    )
    assert response.status_code == 200
    assert response.json()["success"] == "1"


def test_add_log_file_gzipped(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    server = _make_server()
    server.log_dir = str(tmp_path / "robot_logs")
    client = _client(server)
    gz_data = gzip.compress(b"<html>log content</html>")
    response = client.post(
        "/add-log-file",
        files={"file": ("log-abc.html.gz", gz_data, "application/gzip")},
    )
    assert response.status_code == 200
    assert response.json()["success"] == "1"


def test_add_log_file_update_path_error(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    server = _make_server()
    server.log_dir = str(tmp_path / "robot_logs")
    server.robotdashboard.update_output_path.return_value = "ERROR: no match\n"
    client = _client(server)
    response = client.post(
        "/add-log-file",
        files={"file": ("log-missing.html", b"<html/>", "text/html")},
    )
    assert response.status_code == 200
    assert response.json()["success"] == "0"


# ---------------------------------------------------------------------------
# DELETE /remove-log
# ---------------------------------------------------------------------------

def test_remove_log_specific_file(tmp_path):
    log_dir = tmp_path / "robot_logs"
    log_dir.mkdir()
    (log_dir / "log-abc.html").write_text("content")
    server = _make_server()
    server.log_dir = str(log_dir)
    client = _client(server)
    response = client.request(
        "DELETE", "/remove-log", json={"log_name": "log-abc.html"}
    )
    assert response.status_code == 200
    assert response.json()["success"] == "1"
    assert not (log_dir / "log-abc.html").exists()


def test_remove_log_all(tmp_path):
    log_dir = tmp_path / "robot_logs"
    log_dir.mkdir()
    (log_dir / "log-1.html").write_text("a")
    (log_dir / "log-2.html").write_text("b")
    server = _make_server()
    server.log_dir = str(log_dir)
    client = _client(server)
    response = client.request("DELETE", "/remove-log", json={"all": True})
    assert response.status_code == 200
    assert response.json()["success"] == "1"
    assert list(log_dir.iterdir()) == []


def test_remove_log_all_no_dir(tmp_path):
    """Removing all logs when log_dir doesn't exist should succeed gracefully."""
    server = _make_server()
    server.log_dir = str(tmp_path / "nonexistent_logs")
    client = _client(server)
    response = client.request("DELETE", "/remove-log", json={"all": True})
    assert response.status_code == 200
    assert response.json()["success"] == "1"


def test_remove_log_missing_file_returns_error(tmp_path):
    log_dir = tmp_path / "robot_logs"
    log_dir.mkdir()
    server = _make_server()
    server.log_dir = str(log_dir)
    client = _client(server)
    response = client.request(
        "DELETE", "/remove-log", json={"log_name": "nonexistent.html"}
    )
    assert response.status_code == 200
    assert response.json()["success"] == "0"


# ---------------------------------------------------------------------------
# GET /log
# ---------------------------------------------------------------------------

def test_log_page_serves_existing_file(tmp_path):
    log_file = tmp_path / "log-abc.html"
    log_file.write_text("<html>log</html>")
    server = _make_server()
    client = _client(server)
    response = client.get(f"/log?path={log_file}")
    assert response.status_code == 200
    assert "log" in response.text
    assert server.latest_log_dir == tmp_path


def test_log_page_missing_file_returns_404_html():
    server = _make_server()
    client = _client(server)
    response = client.get("/log?path=/nonexistent/path/log.html")
    assert response.status_code == 200  # returns HTML error page, not HTTP 404
    assert "404" in response.text or "not found" in response.text.lower()


# ---------------------------------------------------------------------------
# GET /{full_path} — catch-all resource route
# ---------------------------------------------------------------------------

def test_catch_all_no_log_opened_returns_404(tmp_path):
    server = _make_server()
    client = _client(server)
    response = client.get("/some/resource.png")
    assert response.status_code == 404


def test_catch_all_serves_resource_within_log_dir(tmp_path):
    log_dir = tmp_path / "logs"
    log_dir.mkdir()
    resource = log_dir / "screenshot.png"
    resource.write_bytes(b"\x89PNG")
    server = _make_server()
    server.latest_log_dir = log_dir
    client = _client(server)
    response = client.get("/screenshot.png")
    assert response.status_code == 200
    assert response.content == b"\x89PNG"


def test_catch_all_path_traversal_rejected(tmp_path):
    log_dir = tmp_path / "logs"
    log_dir.mkdir()
    server = _make_server()
    server.latest_log_dir = log_dir
    client = _client(server)
    # Attempt path traversal to escape log_dir
    response = client.get("/../../../etc/passwd")
    assert response.status_code in (400, 403, 404, 422)


def test_catch_all_missing_resource_returns_404(tmp_path):
    log_dir = tmp_path / "logs"
    log_dir.mkdir()
    server = _make_server()
    server.latest_log_dir = log_dir
    client = _client(server)
    response = client.get("/nonexistent_resource.txt")
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# Additional coverage: autoupdate and exception branches
# ---------------------------------------------------------------------------

def test_add_output_file_autoupdate_calls_create_dashboard(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    server = _make_server(no_autoupdate=False)
    client = _client(server)
    xml_bytes = SAMPLE_XML.read_bytes()
    client.post(
        "/add-output-file",
        files={"file": ("output-test.xml", xml_bytes, "application/xml")},
    )
    server.robotdashboard.create_dashboard.assert_called()


def test_add_output_file_no_version_clears_project_version(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    server = _make_server()
    server.robotdashboard.project_version = "old"
    client = _client(server)
    xml_bytes = SAMPLE_XML.read_bytes()
    client.post(
        "/add-output-file",
        files={"file": ("output-test.xml", xml_bytes, "application/xml")},
        data={"version": ""},
    )
    assert server.robotdashboard.project_version is None


def test_add_output_file_gzip_no_xml_suffix(tmp_path, monkeypatch):
    """A .gzip file whose stem has no extension gets .xml appended."""
    monkeypatch.chdir(tmp_path)
    server = _make_server()
    client = _client(server)
    xml_bytes = SAMPLE_XML.read_bytes()
    gz_data = gzip.compress(xml_bytes)
    response = client.post(
        "/add-output-file",
        files={"file": ("output_run.gzip", gz_data, "application/gzip")},
    )
    assert response.status_code == 200
    assert response.json()["success"] == "1"


def test_add_outputs_exception_returns_error():
    """When process_outputs raises, /add-outputs returns success=0."""
    server = _make_server()
    server.robotdashboard.process_outputs.side_effect = RuntimeError("db error")
    client = _client(server)
    payload = {"output_path": str(SAMPLE_XML)}
    response = client.post("/add-outputs", json=payload)
    assert response.status_code == 200
    assert response.json()["success"] == "0"


def test_add_output_file_exception_returns_error(tmp_path, monkeypatch):
    """When process_outputs raises during file upload, returns success=0."""
    monkeypatch.chdir(tmp_path)
    server = _make_server()
    server.robotdashboard.process_outputs.side_effect = RuntimeError("parse error")
    client = _client(server)
    xml_bytes = SAMPLE_XML.read_bytes()
    response = client.post(
        "/add-output-file",
        files={"file": ("output-test.xml", xml_bytes, "application/xml")},
    )
    assert response.status_code == 200
    assert response.json()["success"] == "0"


def test_remove_outputs_exception_returns_error():
    """When remove_outputs raises, /remove-outputs returns success=0."""
    server = _make_server()
    server.robotdashboard.remove_outputs.side_effect = RuntimeError("db error")
    client = _client(server)
    response = client.request("DELETE", "/remove-outputs", json={"indexes": ["0"]})
    assert response.status_code == 200
    assert response.json()["success"] == "0"


def test_remove_outputs_no_log_file_found_logs_message(tmp_path, monkeypatch):
    """When a run is removed but no log file exists, console notes the skip."""
    monkeypatch.chdir(tmp_path)
    run_start = "2025-03-13 00:21:34+01:00"
    output_path = str(OUTPUTS_DIR / "output-20250313-002134.xml")
    server = _make_server(no_autoupdate=True)
    server.log_dir = str(tmp_path / "robot_logs")
    server.robotdashboard.get_runs.return_value = ([run_start], ["Suite"], ["alias"], [""])
    server.robotdashboard.get_run_paths.side_effect = [
        {run_start: output_path},
        {},
    ]
    client = _client(server)
    response = client.request("DELETE", "/remove-outputs", json={"indexes": ["0"]})
    assert response.status_code == 200
    data = response.json()
    assert data["success"] == "1"
    assert "No log file found" in data["console"]


def test_add_log_file_autoupdate(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    server = _make_server(no_autoupdate=False)
    server.log_dir = str(tmp_path / "robot_logs")
    client = _client(server)
    response = client.post(
        "/add-log-file",
        files={"file": ("log-abc.html", b"<html/>", "text/html")},
    )
    assert response.status_code == 200
    server.robotdashboard.create_dashboard.assert_called()


def test_add_log_autoupdate_error_returns_failure(tmp_path, monkeypatch):
    """When create_dashboard raises after add-log, returns success=0."""
    monkeypatch.chdir(tmp_path)
    server = _make_server(no_autoupdate=False)
    server.log_dir = str(tmp_path / "robot_logs")
    server.robotdashboard.create_dashboard.side_effect = RuntimeError("dash error")
    client = _client(server)
    payload = {"log_name": "log-test.html", "log_data": "<html>log</html>"}
    response = client.post("/add-log", json=payload)
    assert response.status_code == 200
    assert response.json()["success"] == "0"


def test_add_log_autoupdate_returns_error_string_fails(tmp_path, monkeypatch):
    """When create_dashboard returns an ERROR string, add-log returns success=0."""
    monkeypatch.chdir(tmp_path)
    server = _make_server(no_autoupdate=False)
    server.log_dir = str(tmp_path / "robot_logs")
    server.robotdashboard.create_dashboard.return_value = "ERROR: dashboard failed\n"
    client = _client(server)
    payload = {"log_name": "log-test.html", "log_data": "<html>log</html>"}
    response = client.post("/add-log", json=payload)
    assert response.status_code == 200
    assert response.json()["success"] == "0"


def test_remove_log_autoupdate(tmp_path):
    log_dir = tmp_path / "robot_logs"
    log_dir.mkdir()
    (log_dir / "log-abc.html").write_text("content")
    server = _make_server(no_autoupdate=False)
    server.log_dir = str(log_dir)
    client = _client(server)
    response = client.request(
        "DELETE", "/remove-log", json={"log_name": "log-abc.html"}
    )
    assert response.status_code == 200
    assert response.json()["success"] == "1"
    server.robotdashboard.create_dashboard.assert_called()


def test_add_log_file_gzip_no_html_suffix(tmp_path, monkeypatch):
    """A .gz file whose stem has no extension gets .html appended."""
    monkeypatch.chdir(tmp_path)
    server = _make_server()
    server.log_dir = str(tmp_path / "robot_logs")
    client = _client(server)
    gz_data = gzip.compress(b"<html>log content</html>")
    response = client.post(
        "/add-log-file",
        files={"file": ("logfile.gzip", gz_data, "application/gzip")},
    )
    assert response.status_code == 200
    assert response.json()["success"] == "1"


def test_add_log_file_autoupdate_returns_error_string_fails(tmp_path, monkeypatch):
    """When create_dashboard returns an ERROR string, add-log-file returns success=0."""
    monkeypatch.chdir(tmp_path)
    server = _make_server(no_autoupdate=False)
    server.log_dir = str(tmp_path / "robot_logs")
    server.robotdashboard.create_dashboard.return_value = "ERROR: dashboard failed\n"
    client = _client(server)
    response = client.post(
        "/add-log-file",
        files={"file": ("log-abc.html", b"<html/>", "text/html")},
    )
    assert response.status_code == 200
    assert response.json()["success"] == "0"


def test_catch_all_path_escapes_log_dir_returns_403(tmp_path):
    """catch_all returns 403 when the resolved resource path escapes latest_log_dir."""
    log_dir = tmp_path / "logs"
    log_dir.mkdir()
    # Place the target file outside log_dir
    outside_file = tmp_path / "outside.txt"
    outside_file.write_text("secret")
    server = _make_server()
    server.latest_log_dir = log_dir
    client = _client(server)
    # Request the absolute path of the outside file — the catch_all route gets the
    # full_path string; when joined with log_dir and resolved it stays outside.
    # We achieve this by mocking the Path resolution so the resolved path is outside.
    from unittest.mock import patch as _patch
    import pathlib
    original_resolve = pathlib.Path.resolve

    def mock_resolve(self_path):
        if "outside.txt" in str(self_path):
            return outside_file
        return original_resolve(self_path)

    with _patch.object(pathlib.Path, "resolve", mock_resolve):
        response = client.get("/outside.txt")
    assert response.status_code == 403
