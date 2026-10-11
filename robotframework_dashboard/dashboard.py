from os.path import join, abspath, dirname, relpath
from pathlib import Path
from datetime import datetime
from json import dumps
from zlib import compress
from base64 import b64encode
import re

from .dependencies import DependencyProcessor
from .version import __version__


# replaced by an editor host with a fresh nonce for its Content-Security-Policy (--embed)
NONCE_PLACEHOLDER = "__ROBOTDASHBOARD_NONCE__"
DATA_KEYS = ("runs", "suites", "tests", "keywords", "exceptions")


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
        embed: bool = False,
    ):
        """
        Function that generates the dashboard by replacing all relevant placeholders.
        With embed the data is left out: the page asks its host for it (see get_embed_data).
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
            if not embed:
                encoded = self.encode_data(data, name_dashboard, use_logs, server)
                for key in DATA_KEYS:
                    dashboard_data = dashboard_data.replace(f'"placeholder_{key}"', f'"{encoded[key]}"')
            dashboard_data = dashboard_data.replace(
                '"placeholder_embed"', str(embed).lower()
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
                # the placeholder sits inside a single-quoted JS string literal that is
                # JSON.parse'd at runtime, so escape backslashes and single quotes
                dashboard_data = dashboard_data.replace(
                    '"placeholder_message_config"',
                    dumps(message_config).replace("\\", "\\\\").replace("'", "\\'"),
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

        if embed:
            # every script tag may run under a host's Content-Security-Policy with this nonce; after minifying
            # tags start a line, "<script" inside library code (sanitizers, regexes) does not
            dashboard_data = re.sub(
                r"(?m)^<script(?=[\s>])", f'<script nonce="{NONCE_PLACEHOLDER}"', dashboard_data
            )

        # write template
        with open(name_dashboard, "w", encoding="utf-8") as file:
            file.write(dashboard_data)

        # warn in case of empty database
        if len(data["runs"]) == 0:
            print("  WARNING: There are no runs so the dashboard will be empty!")

    def encode_data(self, data, name_dashboard, use_logs, server):
        """The dashboard data as the page reads it: per key zlib compressed JSON in base64"""
        runs = data["runs"]
        if use_logs and not server:
            runs = self._make_paths_relative(runs, name_dashboard)
        return {key: self._compress_and_encode(runs if key == "runs" else data.get(key, [])) for key in DATA_KEYS}

    def _make_paths_relative(self, runs, dashboard_name):
        dashboard_dir = dirname(abspath(dashboard_name))
        result = []
        for run in runs:
            if run.get("path") and not run["path"].startswith(("http://", "https://")):
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
