"""Unit tests for server.py — ApiServer and its FastAPI endpoints.

Uses FastAPI's TestClient (backed by httpx/starlette) so that all endpoint
logic (request parsing, response building, auth, error handling) is exercised
without spinning up a real network server.  The RobotDashboard instance that
ApiServer delegates to is replaced with a MagicMock throughout, keeping tests
fast and fully deterministic.
"""
import gzip
from pathlib import Path
from unittest.mock import MagicMock
from fastapi.testclient import TestClient

from robotframework_dashboard.server import ApiServer, ResponseMessage
from robotframework_dashboard.server_paths import is_within, log_path_from_run_path, safe_file_name

OUTPUTS_DIR = Path(__file__).parent.parent / "robot" / "resources" / "outputs"
SAMPLE_XML = sorted(OUTPUTS_DIR.glob("output-*.xml"))[0]
SAMPLE_LOG_NAME = SAMPLE_XML.name.replace("output-", "log-").replace(".xml", ".html")


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
    mock_rd.get_runs.return_value = ([], [], [], [], [])
    mock_rd.get_run_paths.return_value = {}
    mock_rd.remove_outputs.return_value = "  removed output\n"
    mock_rd.process_outputs.return_value = "  processed\n"
    mock_rd.create_dashboard.return_value = "  dashboard created\n"
    mock_rd.update_output_path.return_value = "  path updated\n"
    server.set_robotdashboard(mock_rd)
    return server


def _client(server: ApiServer) -> TestClient:
    return TestClient(server.app, raise_server_exceptions=False)


def test_init_sets_expected_attributes():
    server = _make_server(server_user="u", server_pass="p")
    assert server.server_host == "127.0.0.1"
    assert server.server_port == 8543
    assert server.server_user == "u"
    assert server.server_pass == "p"
    assert server.log_dir == "robot_logs"
    assert server.no_autoupdate is True
    assert server.latest_log_dir is None
    assert server.ssl_certfile is None
    assert server.ssl_keyfile is None


def test_init_stores_ssl_certfile_and_keyfile():
    server = ApiServer("127.0.0.1", 8543, "", "", False, ssl_certfile="cert.pem", ssl_keyfile="key.pem")
    assert server.ssl_certfile == "cert.pem"
    assert server.ssl_keyfile == "key.pem"


def test_set_robotdashboard_stores_instance():
    server = ApiServer("127.0.0.1", 8543, "", "", False)
    mock_rd = MagicMock()
    server.set_robotdashboard(mock_rd)
    assert server.robotdashboard is mock_rd


def test_get_admin_page_returns_html_string():
    server = _make_server()
    html = server._get_admin_page()
    assert isinstance(html, str)
    assert "<html" in html.lower()


def test_get_admin_page_no_autoupdate_true_shows_refresh_card():
    server = _make_server(no_autoupdate=True)
    html = server._get_admin_page()
    # When no_autoupdate=True the placeholder is replaced with "" (card is visible, not hidden)
    assert "placeholder_refresh_card_visibility" not in html


def test_get_admin_page_no_autoupdate_false_hides_refresh_card():
    server = _make_server(no_autoupdate=False)
    html = server._get_admin_page()
    assert "hidden" in html


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


def test_dashboard_page_serves_html(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    (tmp_path / "robot_dashboard.html").write_text("<html><body>dash</body></html>")
    server = _make_server()
    client = _client(server)
    response = client.get("/")
    assert response.status_code == 200
    assert "dash" in response.text


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
        ["ComponentA=1.0"],
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
    assert data[0]["custom_filters"] == "ComponentA=1.0"


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


def test_add_outputs_by_path_with_log_url():
    server = _make_server()
    client = _client(server)
    payload = {"output_path": str(SAMPLE_XML), "output_log_url": "https://ci.example.com/log.html"}
    response = client.post("/add-outputs", json=payload)
    assert response.status_code == 200
    assert response.json()["success"] == "1"
    assert server.robotdashboard.log_url == "https://ci.example.com/log.html"


def test_add_outputs_no_log_url_clears_log_url():
    server = _make_server()
    server.robotdashboard.log_url = "https://old.example.com/log.html"
    client = _client(server)
    payload = {"output_path": str(SAMPLE_XML)}
    client.post("/add-outputs", json=payload)
    assert server.robotdashboard.log_url is None


def test_add_outputs_by_folder():
    server = _make_server()
    client = _client(server)
    payload = {"output_folder_path": str(OUTPUTS_DIR)}
    response = client.post("/add-outputs", json=payload)
    assert response.status_code == 200
    assert response.json()["success"] == "1"
    server.robotdashboard.process_outputs.assert_called_once()


def test_add_outputs_by_folder_with_log_url_placeholder():
    server = _make_server()
    client = _client(server)
    payload = {
        "output_folder_path": str(OUTPUTS_DIR),
        "output_log_url": "https://ci.example.com/{run_alias}/log.html",
    }
    response = client.post("/add-outputs", json=payload)
    assert response.status_code == 200
    assert response.json()["success"] == "1"


def test_add_outputs_by_folder_with_log_url_without_placeholder_rejected():
    server = _make_server()
    client = _client(server)
    payload = {
        "output_folder_path": str(OUTPUTS_DIR),
        "output_log_url": "https://ci.example.com/log.html",
    }
    response = client.post("/add-outputs", json=payload)
    assert response.status_code == 200
    assert response.json()["success"] == "0"
    server.robotdashboard.process_outputs.assert_not_called()


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


def test_add_output_file_with_log_url(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    server = _make_server()
    client = _client(server)
    xml_bytes = SAMPLE_XML.read_bytes()
    response = client.post(
        "/add-output-file",
        files={"file": ("output-test.xml", xml_bytes, "application/xml")},
        data={"log_url": "https://ci.example.com/log.html"},
    )
    assert response.status_code == 200
    assert response.json()["success"] == "1"
    assert server.robotdashboard.log_url == "https://ci.example.com/log.html"


def test_add_output_file_no_log_url_clears_log_url(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    server = _make_server()
    server.robotdashboard.log_url = "https://old.example.com/log.html"
    client = _client(server)
    xml_bytes = SAMPLE_XML.read_bytes()
    response = client.post(
        "/add-output-file",
        files={"file": ("output-test.xml", xml_bytes, "application/xml")},
    )
    assert response.status_code == 200
    assert server.robotdashboard.log_url is None


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


def test_remove_outputs_by_limit_below_one_is_rejected():
    """Issue #333: a limit < 1 must be refused before it reaches the database."""
    server = _make_server()
    client = _client(server)
    for limit in (0, -1):
        response = client.request("DELETE", "/remove-outputs", json={"limit": limit})
        assert response.status_code == 422
        server.robotdashboard.remove_outputs.assert_not_called()


def test_remove_outputs_by_limit_and_tags_builds_scoped_query():
    """limit + tags -> single scoped 'limit=N;tag=...' query, no standalone tag removals."""
    server = _make_server()
    client = _client(server)
    response = client.request(
        "DELETE",
        "/remove-outputs",
        json={"limit": 5, "tags": ["nightly", "prod"]},
    )
    assert response.status_code == 200
    args = server.robotdashboard.remove_outputs.call_args[0][0]
    assert args == ["limit=5;tag=nightly;tag=prod"]
    # tags must not be removed independently when scoped to the limit
    assert not any(r == "tag=nightly" for r in args)


def test_remove_outputs_by_age_and_tags_stay_independent():
    """age + tags run as two independent operations; only 'limit' is scoped by tags."""
    server = _make_server()
    client = _client(server)
    response = client.request(
        "DELETE",
        "/remove-outputs",
        json={"age": "10d", "tags": ["nightly", "prod"]},
    )
    assert response.status_code == 200
    args = server.robotdashboard.remove_outputs.call_args[0][0]
    assert args == ["tag=nightly", "tag=prod", "age=10d"]


def test_remove_outputs_all_flag():
    server = _make_server()
    server.robotdashboard.get_runs.return_value = (
        ["2025-01-01 12:00:00+00:00", "2025-02-01 12:00:00+00:00"],
        ["Suite1", "Suite2"],
        ["a1", "a2"],
        ["", ""],
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
    """When all=True and database is empty, remove_outputs is called with an empty list."""
    server = _make_server()
    server.robotdashboard.get_runs.return_value = ([], [], [], [], [])
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
    log_file = log_dir / SAMPLE_LOG_NAME
    log_file.write_text("<html>log</html>")

    run_start = "2025-03-13 00:21:34.707148+01:00"
    output_path = str(SAMPLE_XML)

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


# POST /add-log-file — report files (#308: saved without DB matching, warn
# instead of error when no matching log is found)

def test_add_log_file_report_without_matching_log_warns_but_succeeds(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    server = _make_server()
    server.log_dir = str(tmp_path / "robot_logs")
    client = _client(server)
    response = client.post(
        "/add-log-file",
        files={"file": ("report-abc.html", b"<html>report</html>", "text/html")},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] == "1"
    assert "WARNING" in data["console"]
    assert (tmp_path / "robot_logs" / "report-abc.html").exists()
    server.robotdashboard.update_output_path.assert_not_called()


def test_add_log_file_report_with_matching_log_succeeds_without_warning(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    server = _make_server()
    log_dir = tmp_path / "robot_logs"
    log_dir.mkdir()
    (log_dir / "report-abc.html".replace("report", "log")).write_text("<html>log</html>")
    server.log_dir = str(log_dir)
    client = _client(server)
    response = client.post(
        "/add-log-file",
        files={"file": ("report-abc.html", b"<html>report</html>", "text/html")},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] == "1"
    assert "WARNING" not in data["console"]
    server.robotdashboard.update_output_path.assert_not_called()


def test_add_log_file_report_gzipped(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    server = _make_server()
    server.log_dir = str(tmp_path / "robot_logs")
    client = _client(server)
    gz_data = gzip.compress(b"<html>report content</html>")
    response = client.post(
        "/add-log-file",
        files={"file": ("report-abc.html.gz", gz_data, "application/gzip")},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] == "1"
    assert (tmp_path / "robot_logs" / "report-abc.html").exists()
    server.robotdashboard.update_output_path.assert_not_called()


def test_add_log_file_log_with_report_in_its_name_is_linked(tmp_path, monkeypatch):
    # only the "report" prefix marks a report, a log of e.g. a reporting suite is still a log
    monkeypatch.chdir(tmp_path)
    server = _make_server()
    server.log_dir = str(tmp_path / "robot_logs")
    client = _client(server)
    response = client.post(
        "/add-log-file",
        files={"file": ("log-reporting-api.html", b"<html>log</html>", "text/html")},
    )
    assert response.json()["success"] == "1"
    server.robotdashboard.update_output_path.assert_called_once()


def test_add_log_file_report_only_replaces_the_prefix(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    server = _make_server()
    log_dir = tmp_path / "robot_logs"
    log_dir.mkdir()
    (log_dir / "log-report_api.html").write_text("<html>log</html>")
    server.log_dir = str(log_dir)
    client = _client(server)
    response = client.post(
        "/add-log-file",
        files={"file": ("report-report_api.html", b"<html>report</html>", "text/html")},
    )
    data = response.json()
    assert data["success"] == "1"
    assert "WARNING" not in data["console"]
    assert "log-report_api.html" in data["console"]


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


def test_log_page_serves_existing_file(tmp_path):
    log_file = tmp_path / "log-abc.html"
    log_file.write_text("<html>log</html>")
    server = _make_server()
    server.log_dir = str(tmp_path)
    client = _client(server)
    response = client.get(f"/log?path={log_file}")
    assert response.status_code == 200
    assert "log" in response.text
    assert server.latest_log_dir == tmp_path


def test_log_page_missing_file_returns_404_html():
    server = _make_server()
    client = _client(server)
    response = client.get("/log?path=/nonexistent/path/log.html")
    assert response.status_code == 404
    assert "not found" in response.text.lower()


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
    response = client.get("/nonexistent_resource.png")
    assert response.status_code == 404


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
    output_path = str(SAMPLE_XML)
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


# --- path restrictions (#374) ---


def test_safe_file_name_accepts_plain_names():
    assert safe_file_name("log-abc.html") == "log-abc.html"
    assert safe_file_name("output 1.xml.gz") == "output 1.xml.gz"


def test_safe_file_name_rejects_paths():
    for name in ["", ".", "..", "../log.html", "sub/log.html", "..\\log.html", "C:\\x\\log.html", "/etc/passwd"]:
        try:
            safe_file_name(name)
        except ValueError:
            continue
        raise AssertionError(f"{name!r} was accepted")


def test_is_within_rejects_sibling_folder_with_same_prefix(tmp_path):
    assert is_within(tmp_path / "logs" / "a.png", tmp_path / "logs")
    assert not is_within(tmp_path / "logs-secret" / "a.png", tmp_path / "logs")
    assert not is_within(tmp_path / "logs" / ".." / "a.png", tmp_path / "logs")


def test_log_path_from_run_path_mirrors_the_dashboard():
    assert log_path_from_run_path("/runs/output-123.xml") == Path("/runs/log-123.html")
    assert log_path_from_run_path("/runs/log-123.html") == Path("/runs/log-123.html")


def test_log_page_rejects_file_outside_known_logs(tmp_path):
    secret = tmp_path / "secret.txt"
    secret.write_text("top secret")
    server = _make_server()
    server.log_dir = str(tmp_path / "robot_logs")
    client = _client(server)
    response = client.get("/log", params={"path": str(secret)})
    assert response.status_code == 404
    assert "top secret" not in response.text
    assert server.latest_log_dir is None


def test_log_page_rejects_relative_traversal(tmp_path, monkeypatch):
    (tmp_path / "secret.html").write_text("top secret")
    (tmp_path / "robot_logs").mkdir()
    monkeypatch.chdir(tmp_path)
    server = _make_server()
    client = _client(server)
    response = client.get("/log", params={"path": "robot_logs/../secret.html"})
    assert response.status_code == 404
    assert "top secret" not in response.text


def test_log_page_serves_relative_path_in_log_dir(tmp_path, monkeypatch):
    (tmp_path / "robot_logs").mkdir()
    (tmp_path / "robot_logs" / "log-abc.html").write_text("<html>uploaded</html>")
    monkeypatch.chdir(tmp_path)
    server = _make_server()
    client = _client(server)
    response = client.get("/log", params={"path": "robot_logs/log-abc.html"})
    assert response.status_code == 200
    assert "uploaded" in response.text


def test_log_page_serves_log_next_to_stored_output(tmp_path):
    (tmp_path / "log-abc.html").write_text("<html>cli log</html>")
    (tmp_path / "other.html").write_text("other")
    server = _make_server()
    server.robotdashboard.get_run_paths.return_value = {"2025-01-01": str(tmp_path / "output-abc.xml")}
    client = _client(server)
    response = client.get("/log", params={"path": str(tmp_path / "log-abc.html")})
    assert response.status_code == 200
    assert "cli log" in response.text
    assert server.latest_log_dir == tmp_path
    # another file in that folder is not a known log
    assert client.get("/log", params={"path": str(tmp_path / "other.html")}).status_code == 404


def test_log_page_escapes_path_in_not_found_page():
    server = _make_server()
    client = _client(server)
    response = client.get("/log", params={"path": "<script>alert(1)</script>"})
    assert response.status_code == 404
    assert "<script>" not in response.text
    assert "&lt;script&gt;" in response.text


def test_add_log_rejects_traversal_name(tmp_path, monkeypatch):
    work_dir = tmp_path / "work"
    work_dir.mkdir()
    monkeypatch.chdir(work_dir)
    server = _make_server()
    server.log_dir = str(work_dir / "robot_logs")
    client = _client(server)
    payload = {"log_name": "../../evil.html", "log_data": "<html>evil</html>"}
    response = client.post("/add-log", json=payload)
    assert response.json()["success"] == "0"
    assert not (tmp_path / "evil.html").exists()
    server.robotdashboard.update_output_path.assert_not_called()


def test_add_log_file_rejects_traversal_name(tmp_path, monkeypatch):
    work_dir = tmp_path / "work"
    work_dir.mkdir()
    monkeypatch.chdir(work_dir)
    server = _make_server()
    server.log_dir = str(work_dir / "robot_logs")
    client = _client(server)
    response = client.post(
        "/add-log-file",
        files={"file": ("../../evil.html", b"<html>evil</html>", "text/html")},
    )
    assert response.json()["success"] == "0"
    assert not (tmp_path / "evil.html").exists()


def test_remove_log_rejects_traversal_name(tmp_path):
    log_dir = tmp_path / "robot_logs"
    log_dir.mkdir()
    victim = tmp_path / "victim.txt"
    victim.write_text("keep me")
    server = _make_server()
    server.log_dir = str(log_dir)
    client = _client(server)
    response = client.request("DELETE", "/remove-log", json={"log_name": "../victim.txt"})
    assert response.json()["success"] == "0"
    assert victim.exists()


def test_add_output_file_rejects_traversal_name(tmp_path, monkeypatch):
    work_dir = tmp_path / "work"
    work_dir.mkdir()
    victim = tmp_path / "victim.xml"
    victim.write_text("keep me")
    monkeypatch.chdir(work_dir)
    server = _make_server()
    client = _client(server)
    for name in ["../victim.xml", "../victim.xml.gz"]:
        payload = gzip.compress(b"evil") if name.endswith(".gz") else b"evil"
        response = client.post("/add-output-file", files={"file": (name, payload, "application/xml")})
        assert response.json()["success"] == "0"
        assert victim.read_text() == "keep me"
    server.robotdashboard.process_outputs.assert_not_called()


def test_add_output_file_leaves_working_directory_untouched(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    existing = tmp_path / "robot_results.db"
    existing.write_bytes(b"database")
    server = _make_server()
    client = _client(server)
    response = client.post(
        "/add-output-file",
        files={"file": ("robot_results.db", b"not a database", "application/xml")},
    )
    assert response.json()["success"] == "1"
    assert existing.read_bytes() == b"database"
    assert [p.name for p in tmp_path.iterdir()] == ["robot_results.db"]


def test_add_outputs_by_data_rejects_traversal_alias(tmp_path, monkeypatch):
    work_dir = tmp_path / "work"
    work_dir.mkdir()
    monkeypatch.chdir(work_dir)
    server = _make_server()
    client = _client(server)
    payload = {"output_data": "<robot/>", "output_alias": "../evil"}
    response = client.post("/add-outputs", json=payload)
    assert response.json()["success"] == "0"
    assert not (tmp_path / "evil.xml").exists()


def test_add_outputs_by_data_leaves_working_directory_untouched(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    server = _make_server()
    client = _client(server)
    payload = {"output_data": SAMPLE_XML.read_text(encoding="utf-8"), "output_alias": "my_run"}
    response = client.post("/add-outputs", json=payload)
    assert response.json()["success"] == "1"
    assert list(tmp_path.iterdir()) == []


def test_log_page_malformed_path_returns_404():
    server = _make_server()
    client = _client(server)
    response = client.get("/log", params={"path": "log\x00.html"})
    assert response.status_code == 404


def test_catch_all_only_serves_log_resources(tmp_path):
    log_dir = tmp_path / "logs"
    log_dir.mkdir()
    (log_dir / "robot_results.db").write_bytes(b"database")
    (log_dir / ".env").write_text("SECRET=1")
    (log_dir / "report-abc.html").write_text("<html>report</html>")
    server = _make_server()
    server.latest_log_dir = log_dir
    client = _client(server)
    assert client.get("/robot_results.db").status_code == 403
    assert client.get("/.env").status_code == 403
    assert client.get("/report-abc.html").status_code == 200


def test_safe_file_name_rejects_null_byte():
    try:
        safe_file_name("log\x00.html")
    except ValueError:
        return
    raise AssertionError("a null byte was accepted")
