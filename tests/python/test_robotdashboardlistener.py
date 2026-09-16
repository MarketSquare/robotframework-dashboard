"""Unit tests for robotdashboardlistener.py — the packaged Robot Framework listener.

The listener talks HTTP using only the standard library (urllib), so no real network call is
made in these tests: `urlopen` is monkeypatched at the module level to return small fake response
objects (status + raw bytes), and `BuiltIn` is monkeypatched so no Robot Framework execution
context is required. This mirrors the MagicMock-based approach used for ApiServer in
test_server.py.
"""
import io
import pytest
from base64 import b64encode
from json import dumps
from unittest.mock import MagicMock
from urllib.error import HTTPError, URLError

from robotframework_dashboard import robotdashboardlistener as listener_module
from robotframework_dashboard.robotdashboardlistener import robotdashboardlistener


def _make_listener(**kwargs) -> robotdashboardlistener:
    return robotdashboardlistener(**kwargs)


class _FakeResponse:
    """Stands in for the object urlopen() returns/yields as a context manager"""

    def __init__(self, status, body_bytes):
        self.status = status
        self._body = body_bytes

    def read(self):
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def _json_response(status, body_dict):
    return _FakeResponse(status, dumps(body_dict).encode("utf-8"))


def _http_error(status, body_dict):
    return HTTPError(
        url="http://x/y", code=status, msg="error", hdrs=None,
        fp=io.BytesIO(dumps(body_dict).encode("utf-8")),
    )


def _sent_request(mock_urlopen):
    """The urllib.request.Request object the listener passed to urlopen()"""
    return mock_urlopen.call_args.args[0]


# ---------------------------------------------------------------------------
# __init__ / argument parsing
# ---------------------------------------------------------------------------

def test_init_defaults():
    rd = _make_listener()
    assert rd.host == "127.0.0.1"
    assert rd.port == "8543"
    assert rd.protocol == "http"
    assert rd.ssl_verify is True
    assert rd.tags == [""]
    assert rd.limit == 0
    assert rd.version is None
    assert rd.uploadlog is False
    assert rd.output == "output.xml"
    assert rd.customfilters is None
    assert rd.auth is None


def test_init_tags_split():
    rd = _make_listener(tags="dev,ci")
    assert rd.tags == ["dev", "ci"]


def test_init_auth_requires_both_user_and_password():
    assert _make_listener(user="admin").auth is None
    assert _make_listener(password="secret").auth is None
    assert _make_listener(user="admin", password="secret").auth == ("admin", "secret")


def test_init_uploadlog_parses_string_bool():
    assert _make_listener(uploadlog="true").uploadlog is True
    assert _make_listener(uploadlog="True").uploadlog is True
    assert _make_listener(uploadlog="false").uploadlog is False
    assert _make_listener(uploadlog=False).uploadlog is False


def test_init_custom_output_name():
    rd = _make_listener(output="custom.xml")
    assert rd.output == "custom.xml"


# ---------------------------------------------------------------------------
# _parse_ssl_verify
# ---------------------------------------------------------------------------

def test_parse_ssl_verify_true():
    assert _make_listener(sslverify="true").ssl_verify is True


def test_parse_ssl_verify_false():
    assert _make_listener(sslverify="false").ssl_verify is False


def test_parse_ssl_verify_ca_bundle_path():
    rd = _make_listener(sslverify="/path/to/ca-bundle.pem")
    assert rd.ssl_verify == "/path/to/ca-bundle.pem"


# ---------------------------------------------------------------------------
# _base_url — #317: allow building a URL without a port
# ---------------------------------------------------------------------------

def test_base_url_default_includes_port():
    rd = _make_listener()
    assert rd._base_url() == "http://127.0.0.1:8543"


def test_base_url_custom_host_and_port():
    rd = _make_listener(host="10.0.0.5", port="9000", protocol="https")
    assert rd._base_url() == "https://10.0.0.5:9000"


@pytest.mark.parametrize("port_value", ["", "none", "None", None])
def test_base_url_omits_port_when_not_provided(port_value):
    rd = _make_listener(host="dashboard.example.com", port=port_value)
    assert rd._base_url() == "http://dashboard.example.com"


# ---------------------------------------------------------------------------
# _ssl_context — no 'requests' dependency, built on stdlib ssl
# ---------------------------------------------------------------------------

def test_ssl_context_http_returns_none():
    rd = _make_listener(protocol="http")
    assert rd._ssl_context() is None


def test_ssl_context_https_verify_true_uses_default_context(monkeypatch):
    sentinel = object()
    mock_create = MagicMock(return_value=sentinel)
    monkeypatch.setattr(listener_module, "create_default_context", mock_create)
    rd = _make_listener(protocol="https", sslverify="true")
    assert rd._ssl_context() is sentinel
    mock_create.assert_called_once_with()


def test_ssl_context_https_verify_false_disables_verification():
    rd = _make_listener(protocol="https", sslverify="false")
    context = rd._ssl_context()
    assert context.check_hostname is False
    assert context.verify_mode == listener_module.CERT_NONE


def test_ssl_context_https_ca_bundle_path(monkeypatch):
    mock_create = MagicMock(return_value=MagicMock())
    monkeypatch.setattr(listener_module, "create_default_context", mock_create)
    rd = _make_listener(protocol="https", sslverify="/path/to/ca-bundle.pem")
    rd._ssl_context()
    mock_create.assert_called_once_with(cafile="/path/to/ca-bundle.pem")


# ---------------------------------------------------------------------------
# _headers
# ---------------------------------------------------------------------------

def test_headers_no_auth_no_content_type():
    assert _make_listener()._headers() == {}


def test_headers_with_content_type():
    assert _make_listener()._headers("application/json") == {"Content-Type": "application/json"}


def test_headers_with_auth():
    headers = _make_listener(user="admin", password="secret")._headers()
    assert headers["Authorization"] == "Basic " + b64encode(b"admin:secret").decode("ascii")


# ---------------------------------------------------------------------------
# _build_multipart
# ---------------------------------------------------------------------------

def test_build_multipart_contains_fields_and_file():
    body, content_type = robotdashboardlistener._build_multipart(
        {"tags": "dev:ci"}, {"file": ("output.xml.gz", b"binarydata", "application/gzip")}
    )
    assert content_type.startswith("multipart/form-data; boundary=")
    assert b'name="tags"' in body
    assert b"dev:ci" in body
    assert b'name="file"; filename="output.xml.gz"' in body
    assert b"Content-Type: application/gzip" in body
    assert b"binarydata" in body


def test_build_multipart_no_fields_only_file():
    body, _ = robotdashboardlistener._build_multipart(
        {}, {"file": ("log.html.gz", b"logbytes", "application/gzip")}
    )
    assert b'name="file"; filename="log.html.gz"' in body
    assert b"logbytes" in body


# ---------------------------------------------------------------------------
# _request
# ---------------------------------------------------------------------------

def test_request_success_returns_status_and_json(monkeypatch):
    monkeypatch.setattr(
        listener_module, "urlopen", MagicMock(return_value=_json_response(200, {"console": "ok"}))
    )
    response = _make_listener()._request("http://x/y", "POST")
    assert response.status_code == 200
    assert response.json() == {"console": "ok"}


def test_request_http_error_returns_status_and_json(monkeypatch):
    monkeypatch.setattr(
        listener_module, "urlopen", MagicMock(side_effect=_http_error(500, {"detail": "boom"}))
    )
    response = _make_listener()._request("http://x/y", "POST")
    assert response.status_code == 500
    assert response.json() == {"detail": "boom"}


def test_request_url_error_propagates(monkeypatch):
    monkeypatch.setattr(listener_module, "urlopen", MagicMock(side_effect=URLError("refused")))
    with pytest.raises(URLError):
        _make_listener()._request("http://x/y", "POST")


def test_request_non_json_body_returns_empty_dict(monkeypatch):
    monkeypatch.setattr(
        listener_module, "urlopen", MagicMock(return_value=_FakeResponse(200, b"not json"))
    )
    response = _make_listener()._request("http://x/y", "POST")
    assert response.json() == {}


def test_request_builds_expected_request_object(monkeypatch):
    mock_urlopen = MagicMock(return_value=_json_response(200, {}))
    monkeypatch.setattr(listener_module, "urlopen", mock_urlopen)
    rd = _make_listener(user="admin", password="secret")
    rd._request("http://x/add-output-file", "POST", data=b"body", content_type="multipart/form-data; boundary=x")
    req = _sent_request(mock_urlopen)
    assert req.full_url == "http://x/add-output-file"
    assert req.get_method() == "POST"
    assert req.data == b"body"
    assert req.get_header("Content-type") == "multipart/form-data; boundary=x"
    assert req.get_header("Authorization") == "Basic " + b64encode(b"admin:secret").decode("ascii")


# ---------------------------------------------------------------------------
# end_suite
# ---------------------------------------------------------------------------

def test_end_suite_reads_pabot_variable(monkeypatch):
    mock_builtin_instance = MagicMock()
    mock_builtin_instance.get_variable_value.return_value = "1"
    monkeypatch.setattr(listener_module, "BuiltIn", MagicMock(return_value=mock_builtin_instance))
    rd = _make_listener()
    rd.end_suite(data=None, result=None)
    assert rd.last_execution == "1"
    mock_builtin_instance.get_variable_value.assert_called_once_with(
        "${PABOTISLASTEXECUTIONINPOOL}"
    )


# ---------------------------------------------------------------------------
# output_file / log_file
# ---------------------------------------------------------------------------

def test_output_file_and_log_file_setters():
    rd = _make_listener()
    rd.output_file("/tmp/output.xml")
    rd.log_file("/tmp/log.html")
    assert rd.path == "/tmp/output.xml"
    assert rd.log_path == "/tmp/log.html"


# ---------------------------------------------------------------------------
# close() — normal (non-pabot) usage
# ---------------------------------------------------------------------------

def test_close_normal_usage_processes_output(tmp_path):
    output_path = tmp_path / "output.xml"
    output_path.write_text("<robot/>")
    rd = _make_listener()
    rd.last_execution = None
    rd.path = str(output_path)
    rd._add_output_to_database = MagicMock()
    rd._upload_log_file = MagicMock()
    rd._remove_runs_over_limit = MagicMock()
    rd.close()
    rd._add_output_to_database.assert_called_once_with(path=str(output_path))
    rd._upload_log_file.assert_called_once()
    rd._remove_runs_over_limit.assert_called_once()


def test_close_normal_usage_missing_output_skips_processing(capsys):
    rd = _make_listener()
    rd.last_execution = None
    rd.path = "does-not-exist.xml"
    rd._add_output_to_database = MagicMock()
    rd.close()
    rd._add_output_to_database.assert_not_called()
    assert "ERROR could not find output.xml" in capsys.readouterr().out


def test_close_pabot_not_last_execution_warns(capsys):
    rd = _make_listener()
    rd.last_execution = "0"
    rd._add_output_to_database = MagicMock()
    rd.close()
    rd._add_output_to_database.assert_not_called()
    assert "WARNING the listener was called but did not run" in capsys.readouterr().out


def test_close_pabot_last_execution_processes_merged_output(tmp_path):
    # Path(worker_output).parent.parent.parent must land back on tmp_path (see the
    # cross-platform pabot path-navigation comment in close()): the worker's own
    # output.xml is 2 directories deep, its parent chain of 3 strips the filename
    # plus those 2 directories.
    merged_output = tmp_path / "output.xml"
    merged_output.write_text("<robot/>")
    worker_output = tmp_path / "sub1" / "sub2" / "output.xml"
    rd = _make_listener()
    rd.last_execution = "1"
    rd.path = str(worker_output)
    rd._add_output_to_database = MagicMock()
    rd._upload_log_file = MagicMock()
    rd._remove_runs_over_limit = MagicMock()
    rd.close()
    rd._add_output_to_database.assert_called_once_with(path=str(merged_output))


def test_close_pabot_last_execution_missing_merged_output_exits(tmp_path, monkeypatch):
    monkeypatch.setattr(listener_module, "sleep", lambda _: None)
    rd = _make_listener()
    rd.last_execution = "1"
    rd.path = str(tmp_path / "sub1" / "sub2" / "output.xml")
    with pytest.raises(SystemExit):
        rd.close()


# ---------------------------------------------------------------------------
# _add_output_to_database
# ---------------------------------------------------------------------------

def test_add_output_to_database_success(tmp_path, monkeypatch, capsys):
    output_path = tmp_path / "output.xml"
    output_path.write_text("<robot/>")
    mock_urlopen = MagicMock(return_value=_json_response(200, {"console": "  processed output\n"}))
    monkeypatch.setattr(listener_module, "urlopen", mock_urlopen)
    rd = _make_listener(tags="dev,ci", version="1.2.3", customfilters="env=prod")
    rd._add_output_to_database(path=str(output_path))
    req = _sent_request(mock_urlopen)
    assert req.full_url == "http://127.0.0.1:8543/add-output-file"
    assert req.get_method() == "POST"
    assert b'name="tags"' in req.data and b"dev:ci" in req.data
    assert b'name="version"' in req.data and b"1.2.3" in req.data
    assert b'name="custom_filters"' in req.data and b"env=prod" in req.data
    assert "processed output" in capsys.readouterr().out


def test_add_output_to_database_omits_port_in_url(tmp_path, monkeypatch):
    output_path = tmp_path / "output.xml"
    output_path.write_text("<robot/>")
    mock_urlopen = MagicMock(return_value=_json_response(200, {"console": ""}))
    monkeypatch.setattr(listener_module, "urlopen", mock_urlopen)
    rd = _make_listener(host="dashboard.example.com", port="")
    rd._add_output_to_database(path=str(output_path))
    assert _sent_request(mock_urlopen).full_url == "http://dashboard.example.com/add-output-file"


def test_add_output_to_database_connection_error_exits(tmp_path, monkeypatch, capsys):
    output_path = tmp_path / "output.xml"
    output_path.write_text("<robot/>")
    monkeypatch.setattr(listener_module, "urlopen", MagicMock(side_effect=URLError("refused")))
    rd = _make_listener()
    with pytest.raises(SystemExit):
        rd._add_output_to_database(path=str(output_path))
    assert "ERROR the server is not running" in capsys.readouterr().out


def test_add_output_to_database_non_200_prints_error(tmp_path, monkeypatch, capsys):
    output_path = tmp_path / "output.xml"
    output_path.write_text("<robot/>")
    monkeypatch.setattr(
        listener_module, "urlopen", MagicMock(side_effect=_http_error(500, {"detail": "boom"}))
    )
    rd = _make_listener()
    rd._add_output_to_database(path=str(output_path))
    assert "ERROR something went wrong while sending results" in capsys.readouterr().out


def test_add_output_to_database_generic_exception_exits(tmp_path, monkeypatch, capsys):
    output_path = tmp_path / "output.xml"
    output_path.write_text("<robot/>")
    monkeypatch.setattr(listener_module, "compress", MagicMock(side_effect=ValueError("boom")))
    rd = _make_listener()
    with pytest.raises(SystemExit):
        rd._add_output_to_database(path=str(output_path))
    assert "ERROR something went wrong while compressing or sending" in capsys.readouterr().out


# ---------------------------------------------------------------------------
# _upload_log_file
# ---------------------------------------------------------------------------

def test_upload_log_file_disabled_is_noop(monkeypatch):
    mock_urlopen = MagicMock()
    monkeypatch.setattr(listener_module, "urlopen", mock_urlopen)
    rd = _make_listener(uploadlog=False)
    rd._upload_log_file()
    mock_urlopen.assert_not_called()


def test_upload_log_file_enabled_but_no_log_path_warns(capsys):
    rd = _make_listener(uploadlog=True)
    rd.log_path = None
    rd._upload_log_file()
    assert "WARNING uploadlog enabled but no log file was provided" in capsys.readouterr().out


def test_upload_log_file_missing_file_warns(capsys):
    rd = _make_listener(uploadlog=True)
    rd.log_path = "does-not-exist.html"
    rd._upload_log_file()
    assert "not found" in capsys.readouterr().out


def test_upload_log_file_success(tmp_path, monkeypatch, capsys):
    log_path = tmp_path / "log.html"
    log_path.write_text("<html/>")
    mock_urlopen = MagicMock(return_value=_json_response(200, {"console": "  log added\n"}))
    monkeypatch.setattr(listener_module, "urlopen", mock_urlopen)
    rd = _make_listener(uploadlog=True)
    rd.log_path = str(log_path)
    rd._upload_log_file()
    assert _sent_request(mock_urlopen).full_url == "http://127.0.0.1:8543/add-log-file"
    assert "log added" in capsys.readouterr().out


def test_upload_log_file_connection_error_does_not_raise(tmp_path, monkeypatch, capsys):
    log_path = tmp_path / "log.html"
    log_path.write_text("<html/>")
    monkeypatch.setattr(listener_module, "urlopen", MagicMock(side_effect=URLError("refused")))
    rd = _make_listener(uploadlog=True)
    rd.log_path = str(log_path)
    rd._upload_log_file()  # should not raise
    assert "ERROR the server is not running" in capsys.readouterr().out


def test_upload_log_file_generic_exception_does_not_raise(tmp_path, monkeypatch, capsys):
    log_path = tmp_path / "log.html"
    log_path.write_text("<html/>")
    monkeypatch.setattr(listener_module, "compress", MagicMock(side_effect=ValueError("boom")))
    rd = _make_listener(uploadlog=True)
    rd.log_path = str(log_path)
    rd._upload_log_file()  # should not raise
    assert "ERROR something went wrong while compressing or sending log" in capsys.readouterr().out


def test_upload_log_file_non_200_prints_error(tmp_path, monkeypatch, capsys):
    log_path = tmp_path / "log.html"
    log_path.write_text("<html/>")
    monkeypatch.setattr(
        listener_module, "urlopen", MagicMock(side_effect=_http_error(500, {"detail": "boom"}))
    )
    rd = _make_listener(uploadlog=True)
    rd.log_path = str(log_path)
    rd._upload_log_file()
    assert "ERROR something went wrong while sending the log file" in capsys.readouterr().out


# ---------------------------------------------------------------------------
# _remove_runs_over_limit
# ---------------------------------------------------------------------------

def test_remove_runs_over_limit_zero_is_noop(monkeypatch):
    mock_urlopen = MagicMock()
    monkeypatch.setattr(listener_module, "urlopen", mock_urlopen)
    rd = _make_listener(limit="0")
    rd._remove_runs_over_limit()
    mock_urlopen.assert_not_called()


def test_remove_runs_over_limit_calls_delete(monkeypatch, capsys):
    mock_urlopen = MagicMock(return_value=_json_response(200, {"console": "  removed 3 runs\n"}))
    monkeypatch.setattr(listener_module, "urlopen", mock_urlopen)
    rd = _make_listener(limit="10")
    rd._remove_runs_over_limit()
    req = _sent_request(mock_urlopen)
    assert req.full_url == "http://127.0.0.1:8543/remove-outputs"
    assert req.get_method() == "DELETE"
    assert req.data == dumps({"limit": 10}).encode("utf-8")
    assert "removed 3 runs" in capsys.readouterr().out


def test_remove_runs_over_limit_non_200_prints_error(monkeypatch, capsys):
    monkeypatch.setattr(
        listener_module, "urlopen", MagicMock(side_effect=_http_error(500, {"detail": "boom"}))
    )
    rd = _make_listener(limit="10")
    rd._remove_runs_over_limit()
    assert "ERROR something went wrong while deleting" in capsys.readouterr().out
