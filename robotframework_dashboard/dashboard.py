from os.path import join, abspath, dirname, relpath
from pathlib import Path
from datetime import datetime
from json import dumps
from zlib import compress
from base64 import b64encode

from .dependencies import DependencyProcessor
from .version import __version__


class DashboardGenerator:
    """
    Class that handles the generation of the dashboard HTML
    """

    def generate_dashboard(
        self,
        name_dashboard: str,
        data: dict,
        generation_datetime: datetime,
        dashboard_title: str,
        server: bool,
        json_config: str,
        message_config: list,
        quantity: int,
        use_logs: bool,
        offline: bool,
        force_json_config: bool,
        no_autoupdate: bool,
    ):
        """
        Function that generates the dashboard by replacing all relevant placeholders.
        """
        dependency_processor = DependencyProcessor()

        # load template
        index_html = join(dirname(abspath(__file__)), "templates", "dashboard.html")
        with open(index_html, "r", encoding="utf-8") as file:
            dashboard_data = file.read()
            dashboard_data = dashboard_data.replace(
                "<!-- placeholder_javascript -->", dependency_processor.get_js_block()
            )
            dashboard_data = dashboard_data.replace(
                "<!-- placeholder_css -->", dependency_processor.get_css_block()
            )
            dashboard_data = dashboard_data.replace(
                "<!-- placeholder_dependencies -->",
                dependency_processor.get_dependencies_block(offline),
            )
            dashboard_data = dashboard_data.replace(
                '"placeholder_version"', __version__
            )
            if use_logs and not server:
                runs_data = self._make_paths_relative(data["runs"], name_dashboard)
            else:
                runs_data = data["runs"]
            dashboard_data = dashboard_data.replace(
                '"placeholder_runs"', f'"{self._compress_and_encode(runs_data)}"'
            )
            dashboard_data = dashboard_data.replace(
                '"placeholder_suites"', f'"{self._compress_and_encode(data["suites"])}"'
            )
            dashboard_data = dashboard_data.replace(
                '"placeholder_tests"', f'"{self._compress_and_encode(data["tests"])}"'
            )
            dashboard_data = dashboard_data.replace(
                '"placeholder_keywords"',
                f'"{self._compress_and_encode(data["keywords"])}"',
            )
            dashboard_data = dashboard_data.replace(
                '"placeholder_amount"', str(quantity)
            )
            dashboard_data = dashboard_data.replace(
                '"placeholder_server"', str(server).lower()
            )
            dashboard_data = dashboard_data.replace(
                '"placeholder_no_autoupdate"', str(no_autoupdate).lower()
            )
            dashboard_data = dashboard_data.replace(
                '"placeholder_force_json_config"', str(force_json_config).lower()
            )
            dashboard_data = dashboard_data.replace(
                '"placeholder_use_logs"', str(use_logs).lower()
            )
            if dashboard_title != "":
                dashboard_data = dashboard_data.replace(
                    '"placeholder_dashboard_title"', dashboard_title
                )
            else:
                dashboard_data = dashboard_data.replace(
                    '"placeholder_dashboard_title"',
                    f"Robot Framework Dashboard - {str(generation_datetime)[:-7]}",
                )
            if message_config:
                dashboard_data = dashboard_data.replace(
                    '"placeholder_message_config"',
                    str(message_config).replace("'", '"'),
                )
            if json_config:
                dashboard_data = dashboard_data.replace(
                    '"placeholder_json_config"',
                    json_config,
                )

        # handle possible subdirectories
        path = Path(name_dashboard)
        path.parent.mkdir(exist_ok=True, parents=True)

        # minify html
        dashboard_data = self._minify_text(dashboard_data)

        # write template
        with open(name_dashboard, "w", encoding="utf-8") as file:
            file.write(dashboard_data)

        # warn in case of empty database
        if len(data["runs"]) == 0:
            print("  WARNING: There are no runs so the dashboard will be empty!")

    def _make_paths_relative(self, runs, dashboard_name):
        dashboard_dir = dirname(abspath(dashboard_name))
        result = []
        for run in runs:
            if run.get("path"):
                try:
                    relative = relpath(run["path"], dashboard_dir).replace("\\", "/")
                    run = dict(run)
                    run["path"] = relative
                except ValueError:
                    pass  # different Windows drive — keep absolute path as-is
            result.append(run)
        return result

    def _compress_and_encode(self, obj):
        json_data = dumps(obj).encode("utf-8")
        compressed = compress(json_data)
        return b64encode(compressed).decode("utf-8")

    def _minify_text(self, text):
        cleaned_lines = []
        for line in text.splitlines():
            stripped = line.strip()
            if stripped:  # keep only non-empty lines
                cleaned_lines.append(stripped)
        return "\n".join(cleaned_lines)
