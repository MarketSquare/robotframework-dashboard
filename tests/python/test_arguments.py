import argparse
import pytest
from robotframework_dashboard.arguments import dotdict, ArgumentParser


# --- dotdict ---

def test_dotdict_attribute_access():
    d = dotdict({"key": "value"})
    assert d.key == "value"


def test_dotdict_missing_key_returns_none():
    d = dotdict()
    assert d.missing_key is None


def test_dotdict_set_via_attribute():
    d = dotdict()
    d.key = "value"
    assert d["key"] == "value"


def test_dotdict_delete_via_attribute():
    d = dotdict({"key": "value"})
    del d.key
    assert "key" not in d


def test_dotdict_nested():
    d = dotdict({"outer": dotdict({"inner": 42})})
    assert d.outer.inner == 42


# --- _normalize_bool ---

def test_normalize_bool_lowercase_true():
    assert ArgumentParser()._normalize_bool("true", "test") is True


def test_normalize_bool_uppercase_true():
    assert ArgumentParser()._normalize_bool("True", "test") is True


def test_normalize_bool_lowercase_false():
    assert ArgumentParser()._normalize_bool("false", "test") is False


def test_normalize_bool_uppercase_false():
    assert ArgumentParser()._normalize_bool("False", "test") is False


def test_normalize_bool_python_true():
    assert ArgumentParser()._normalize_bool(True, "test") is True


def test_normalize_bool_python_false():
    assert ArgumentParser()._normalize_bool(False, "test") is False


def test_normalize_bool_invalid_exits():
    with pytest.raises(SystemExit):
        ArgumentParser()._normalize_bool("maybe", "test")


def test_normalize_bool_empty_string_exits():
    with pytest.raises(SystemExit):
        ArgumentParser()._normalize_bool("", "test")


def test_normalize_bool_numeric_exits():
    with pytest.raises(SystemExit):
        ArgumentParser()._normalize_bool("1", "test")


# --- _check_project_version_usage ---

def test_check_project_version_no_tags_ok():
    args = argparse.Namespace(project_version=None)
    # must not raise or exit
    ArgumentParser()._check_project_version_usage(["dev", "prod"], args)


def test_check_project_version_one_version_tag_ok():
    args = argparse.Namespace(project_version=None)
    ArgumentParser()._check_project_version_usage(["version_1.0", "dev"], args)


def test_check_project_version_two_version_tags_exits():
    args = argparse.Namespace(project_version=None)
    with pytest.raises(SystemExit) as exc_info:
        ArgumentParser()._check_project_version_usage(["version_1.0", "version_2.0"], args)
    assert exc_info.value.code == 1


def test_check_project_version_mixed_tag_and_arg_exits():
    args = argparse.Namespace(project_version="1.0")
    with pytest.raises(SystemExit) as exc_info:
        ArgumentParser()._check_project_version_usage(["version_1.0", "dev"], args)
    assert exc_info.value.code == 2


def test_check_project_version_empty_tags_ok():
    args = argparse.Namespace(project_version=None)
    ArgumentParser()._check_project_version_usage([], args)


def test_check_project_version_project_version_without_tag_ok():
    args = argparse.Namespace(project_version="2.0")
    ArgumentParser()._check_project_version_usage(["dev", "prod"], args)


# --- _process_arguments ---

def _make_namespace(**kwargs):
    """Create an argparse.Namespace with sane defaults for _process_arguments tests."""
    defaults = {
        "version": False,
        "outputpath": None,
        "outputfolderpath": None,
        "project_version": None,
        "timezone": None,
        "removeruns": None,
        "generatedashboard": True,
        "listruns": True,
        "offlinedependencies": False,
        "uselogs": False,
        "forcejsonconfig": False,
        "novacuum": False,
        "noautoupdate": False,
        "messageconfig": None,
        "jsonconfig": None,
        "namedashboard": "",
        "databaseclass": None,
        "server": None,
        "quantity": None,
        "databasepath": "robot_results.db",
        "dashboardtitle": "",
        "ssl_certfile": None,
        "ssl_keyfile": None,
    }
    defaults.update(kwargs)
    return argparse.Namespace(**defaults)


def test_process_arguments_version_flag_exits():
    args = _make_namespace(version=True)
    with pytest.raises(SystemExit):
        ArgumentParser()._process_arguments(args)


def test_process_arguments_defaults_returns_dotdict():
    args = _make_namespace()
    result = ArgumentParser()._process_arguments(args)
    assert isinstance(result, dotdict)
    assert result.database_path == "robot_results.db"
    assert result.outputs is None
    assert result.start_server is False
    assert result.generate_dashboard is True
    assert result.list_runs is True


def test_process_arguments_with_outputpath():
    args = _make_namespace(outputpath=[["path/to/output.xml"]])
    result = ArgumentParser()._process_arguments(args)
    assert result.outputs is not None
    assert len(result.outputs) == 1
    assert result.outputs[0][0] == "path/to/output.xml"
    assert result.outputs[0][1] == []


def test_process_arguments_with_outputpath_and_tags():
    args = _make_namespace(outputpath=[["path/to/output.xml:dev:prod"]])
    result = ArgumentParser()._process_arguments(args)
    assert result.outputs[0][1] == ["dev", "prod"]


def test_process_arguments_with_outputfolderpath():
    args = _make_namespace(outputfolderpath=[["results/"]])
    result = ArgumentParser()._process_arguments(args)
    assert result.output_folder_paths is not None
    assert result.output_folder_paths[0][0] == "results/"
    assert result.output_folder_paths[0][1] == []


def test_process_arguments_with_outputfolderpath_and_tags():
    args = _make_namespace(outputfolderpath=[["results/:prod:nightly"]])
    result = ArgumentParser()._process_arguments(args)
    assert result.output_folder_paths[0][1] == ["prod", "nightly"]


def test_process_arguments_with_removeruns():
    args = _make_namespace(removeruns=[["index=0,index=1"]])
    result = ArgumentParser()._process_arguments(args)
    assert result.remove_runs == ["index=0", "index=1"]


def test_process_arguments_with_messageconfig(tmp_path):
    msg_file = tmp_path / "messages.txt"
    msg_file.write_text("Template: ${name}\nLine 2\n")
    args = _make_namespace(messageconfig=str(msg_file))
    result = ArgumentParser()._process_arguments(args)
    assert len(result.message_config) == 2
    assert "Template: ${name}" in result.message_config[0]


def test_process_arguments_with_jsonconfig(tmp_path):
    config_file = tmp_path / "config.json"
    config_file.write_text('{"color": "red"}')
    args = _make_namespace(jsonconfig=str(config_file))
    result = ArgumentParser()._process_arguments(args)
    assert '{"color": "red"}' in result.json_config


def test_process_arguments_forcejsonconfig_without_jsonconfig_exits():
    args = _make_namespace(forcejsonconfig=True, jsonconfig=None)
    with pytest.raises(SystemExit):
        ArgumentParser()._process_arguments(args)


def test_process_arguments_dashboard_name_empty_generates_timestamped():
    args = _make_namespace(namedashboard="")
    result = ArgumentParser()._process_arguments(args)
    assert result.dashboard_name.startswith("robot_dashboard_")
    assert result.dashboard_name.endswith(".html")


def test_process_arguments_dashboard_name_no_extension():
    args = _make_namespace(namedashboard="my_dashboard")
    result = ArgumentParser()._process_arguments(args)
    assert result.dashboard_name == "my_dashboard.html"


def test_process_arguments_dashboard_name_with_html_extension():
    args = _make_namespace(namedashboard="my_dashboard.html")
    result = ArgumentParser()._process_arguments(args)
    assert result.dashboard_name == "my_dashboard.html"


def test_process_arguments_server_none():
    args = _make_namespace(server=None)
    result = ArgumentParser()._process_arguments(args)
    assert result.start_server is False


def test_process_arguments_server_default():
    args = _make_namespace(server="default")
    result = ArgumentParser()._process_arguments(args)
    assert result.start_server is True
    assert result.server_host == "127.0.0.1"
    assert result.server_port == 8543
    assert result.server_user == ""
    assert result.server_pass == ""


def test_process_arguments_server_default_with_credentials():
    args = _make_namespace(server="default:admin:secret")
    result = ArgumentParser()._process_arguments(args)
    assert result.start_server is True
    assert result.server_user == "admin"
    assert result.server_pass == "secret"


def test_process_arguments_server_custom_host_port():
    args = _make_namespace(server="0.0.0.0:8080")
    result = ArgumentParser()._process_arguments(args)
    assert result.start_server is True
    assert result.server_host == "0.0.0.0"
    assert result.server_port == 8080


def test_process_arguments_server_custom_all():
    args = _make_namespace(server="0.0.0.0:8080:admin:secret")
    result = ArgumentParser()._process_arguments(args)
    assert result.start_server is True
    assert result.server_host == "0.0.0.0"
    assert result.server_port == 8080
    assert result.server_user == "admin"
    assert result.server_pass == "secret"


def test_process_arguments_quantity_default():
    args = _make_namespace(quantity=None)
    result = ArgumentParser()._process_arguments(args)
    assert result.quantity == 20


def test_process_arguments_quantity_custom():
    args = _make_namespace(quantity="50")
    result = ArgumentParser()._process_arguments(args)
    assert int(result.quantity) == 50


def test_process_arguments_timezone_provided():
    args = _make_namespace(timezone="+02:00")
    result = ArgumentParser()._process_arguments(args)
    assert result.timezone == "+02:00"


def test_process_arguments_timezone_auto_detected():
    import re
    args = _make_namespace(timezone=None)
    result = ArgumentParser()._process_arguments(args)
    assert re.match(r"^[+-]\d{2}:\d{2}$", result.timezone)


def test_process_arguments_databaseclass_none():
    args = _make_namespace(databaseclass=None)
    result = ArgumentParser()._process_arguments(args)
    assert result.database_class is None


def test_process_arguments_databaseclass_not_exists_raises(tmp_path):
    nonexistent = tmp_path / "nonexistent" / "db.py"
    args = _make_namespace(databaseclass=str(nonexistent))
    with pytest.raises(Exception, match="ERROR"):
        ArgumentParser()._process_arguments(args)


def test_process_arguments_databaseclass_valid(tmp_path):
    db_class = tmp_path / "mydb.py"
    db_class.write_text("# placeholder")
    args = _make_namespace(databaseclass=str(db_class))
    result = ArgumentParser()._process_arguments(args)
    assert result.database_class is not None


def test_process_arguments_returns_all_keys():
    args = _make_namespace()
    result = ArgumentParser()._process_arguments(args)
    expected_keys = {
        "outputs", "output_folder_paths", "database_path", "generate_dashboard",
        "dashboard_name", "generation_datetime", "list_runs", "remove_runs",
        "dashboard_title", "database_class", "start_server", "server_host",
        "server_port", "server_user", "server_pass", "json_config",
        "message_config", "quantity", "use_logs", "offline_dependencies",
        "force_json_config", "project_version", "no_vacuum", "timezone",
        "no_autoupdate", "ssl_certfile", "ssl_keyfile",
    }
    for key in expected_keys:
        assert key in result, f"Missing key: {key}"


def test_process_arguments_ssl_defaults_none():
    args = _make_namespace()
    result = ArgumentParser()._process_arguments(args)
    assert result.ssl_certfile is None
    assert result.ssl_keyfile is None


def test_process_arguments_ssl_certfile_without_keyfile_exits(capsys):
    args = _make_namespace(ssl_certfile="cert.pem", ssl_keyfile=None)
    with pytest.raises(SystemExit):
        ArgumentParser()._process_arguments(args)
    captured = capsys.readouterr()
    assert "ssl-certfile" in captured.out.lower() or "ssl_certfile" in captured.out.lower()


def test_process_arguments_ssl_keyfile_without_certfile_exits(capsys):
    args = _make_namespace(ssl_certfile=None, ssl_keyfile="key.pem")
    with pytest.raises(SystemExit):
        ArgumentParser()._process_arguments(args)
    captured = capsys.readouterr()
    assert "ssl-keyfile" in captured.out.lower() or "ssl_keyfile" in captured.out.lower()


def test_process_arguments_ssl_certfile_not_exists_exits(tmp_path, capsys):
    args = _make_namespace(ssl_certfile=str(tmp_path / "missing.pem"), ssl_keyfile="key.pem")
    with pytest.raises(SystemExit):
        ArgumentParser()._process_arguments(args)
    captured = capsys.readouterr()
    assert "ssl-certfile" in captured.out.lower() or "ssl_certfile" in captured.out.lower()


def test_process_arguments_ssl_keyfile_not_exists_exits(tmp_path, capsys):
    cert_file = tmp_path / "cert.pem"
    cert_file.write_text("cert")
    args = _make_namespace(ssl_certfile=str(cert_file), ssl_keyfile=str(tmp_path / "missing.pem"))
    with pytest.raises(SystemExit):
        ArgumentParser()._process_arguments(args)
    captured = capsys.readouterr()
    assert "ssl-keyfile" in captured.out.lower() or "ssl_keyfile" in captured.out.lower()


def test_process_arguments_ssl_certfile_and_keyfile_valid(tmp_path):
    cert_file = tmp_path / "cert.pem"
    key_file = tmp_path / "key.pem"
    cert_file.write_text("cert")
    key_file.write_text("key")
    args = _make_namespace(ssl_certfile=str(cert_file), ssl_keyfile=str(key_file))
    result = ArgumentParser()._process_arguments(args)
    assert result.ssl_certfile == str(cert_file)
    assert result.ssl_keyfile == str(key_file)


# --- get_arguments (full pipeline via mocked sys.argv) ---

def test_get_arguments_minimal_argv():
    """Exercises _parse_arguments() to cover all parser.add_argument() setup."""
    from unittest.mock import patch
    with patch("sys.argv", ["robotdashboard"]):
        result = ArgumentParser().get_arguments()
    assert result.database_path == "robot_results.db"
    assert result.outputs is None
    assert result.start_server is False


def test_get_arguments_with_output_flag():
    from unittest.mock import patch
    with patch("sys.argv", ["robotdashboard", "-o", "results/output.xml"]):
        result = ArgumentParser().get_arguments()
    assert result.outputs is not None
    assert len(result.outputs) == 1


def test_get_arguments_exception_calls_exit():
    """Ensure get_arguments handles exceptions from _process_arguments gracefully."""
    from unittest.mock import patch
    # --forcejsonconfig without --jsonconfig triggers exit via _process_arguments
    with patch("sys.argv", ["robotdashboard", "--forcejsonconfig", "true"]):
        with pytest.raises(SystemExit):
            ArgumentParser().get_arguments()


def test_get_arguments_parse_exception_prints_error(capsys):
    """When _parse_arguments raises Exception the except block prints error and exits."""
    from unittest.mock import patch
    parser = ArgumentParser()
    with patch.object(parser, "_parse_arguments", side_effect=Exception("bad parse")):
        with pytest.raises(SystemExit):
            parser.get_arguments()
    captured = capsys.readouterr()
    assert "ERROR" in captured.out
    assert "bad parse" in captured.out
