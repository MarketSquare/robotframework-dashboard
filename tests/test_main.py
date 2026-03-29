import pytest
from datetime import datetime
from unittest.mock import patch, MagicMock

from robotframework_dashboard.arguments import dotdict
from robotframework_dashboard.main import main


def _make_mock_args(**kwargs):
    """Build a dotdict that mimics the output of ArgumentParser().get_arguments()."""
    defaults = dict(
        outputs=None,
        output_folder_paths=None,
        database_path="test.db",
        generate_dashboard=False,
        dashboard_name="test_dashboard.html",
        generation_datetime=datetime(2025, 1, 1),
        list_runs=False,
        remove_runs=None,
        dashboard_title="",
        database_class=None,
        start_server=False,
        server_host="127.0.0.1",
        server_port=8543,
        server_user="",
        server_pass="",
        json_config="",
        message_config=[],
        quantity=20,
        use_logs=False,
        offline_dependencies=False,
        force_json_config=False,
        project_version=None,
        no_vacuum=True,
        timezone="+00:00",
        no_autoupdate=False,
    )
    defaults.update(kwargs)
    return dotdict(defaults)


def test_main_normal_run_calls_all_steps():
    """main() without server should call all pipeline steps on RobotDashboard."""
    mock_args = _make_mock_args()

    with patch("robotframework_dashboard.main.ArgumentParser") as MockParser:
        MockParser.return_value.get_arguments.return_value = mock_args
        with patch("robotframework_dashboard.main.RobotDashboard") as MockDashboard:
            mock_rd = MagicMock()
            MockDashboard.return_value = mock_rd

            main()
    mock_rd.process_outputs.assert_called_once_with(
        output_file_info_list=None,
        output_folder_configs=None,
    )
    mock_rd.print_runs.assert_called_once()
    mock_rd.remove_outputs.assert_called_once_with(remove_runs=None)
    mock_rd.create_dashboard.assert_called_once()


def test_main_with_server_starts_api_server():
    """main() with start_server=True should create and run the ApiServer."""
    mock_args = _make_mock_args(start_server=True)

    with patch("robotframework_dashboard.main.ArgumentParser") as MockParser:
        MockParser.return_value.get_arguments.return_value = mock_args
        with patch("robotframework_dashboard.main.RobotDashboard") as MockDashboard:
            mock_rd = MagicMock()
            MockDashboard.return_value = mock_rd

            import robotframework_dashboard.server as server_module
            with patch.object(server_module, "ApiServer") as MockApiServer:
                mock_server = MagicMock()
                MockApiServer.return_value = mock_server

                main()

    mock_server.set_robotdashboard.assert_called_once_with(mock_rd)
    mock_server.run.assert_called_once()


def test_main_with_server_missing_deps_exits(capsys):
    """main() with start_server=True but missing server deps prints error and exits."""
    mock_args = _make_mock_args(start_server=True)
    import builtins
    original_import = builtins.__import__

    def failing_import(name, *args, **kwargs):
        if name == "python_multipart":
            raise ModuleNotFoundError(f"No module named '{name}'")
        return original_import(name, *args, **kwargs)

    with patch("robotframework_dashboard.main.ArgumentParser") as MockParser:
        MockParser.return_value.get_arguments.return_value = mock_args
        with patch("robotframework_dashboard.main.RobotDashboard"):
            with patch("builtins.__import__", side_effect=failing_import):
                with pytest.raises(SystemExit):
                    main()
    captured = capsys.readouterr()
    assert "ERROR" in captured.out
