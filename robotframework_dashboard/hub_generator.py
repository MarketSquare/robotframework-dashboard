from os.path import join, abspath, dirname
from datetime import datetime
from json import dumps
from zlib import compress
from base64 import b64encode
import sqlite3

from .dependencies import DependencyProcessor
from .version import __version__


class HubGenerator:
    """
    Class that handles the generation of the hub HTML.

    Sources are a list of dicts, each with:
      - label: str
      - source: str (db path or URL)
      - source_type: "db" | "url"
    """

    def generate_hub(
        self,
        hub_name: str,
        projects_data: list,
        generation_datetime: datetime,
        offline: bool,
        hub_title: str,
        is_server: bool = False,
    ):
        """
        Generate the hub HTML file by replacing all placeholders in hub.html.
        """
        dependency_processor = DependencyProcessor(hub_page=True)

        hub_template = join(dirname(abspath(__file__)), "templates", "hub.html")
        with open(hub_template, "r", encoding="utf-8") as fh:
            hub_html = fh.read()

        hub_html = hub_html.replace(
            "<!-- placeholder_javascript -->", dependency_processor.get_js_block()
        )
        hub_html = hub_html.replace(
            "<!-- placeholder_css -->", dependency_processor.get_css_block()
        )
        hub_html = hub_html.replace(
            "<!-- placeholder_dependencies -->",
            dependency_processor.get_dependencies_block(offline),
        )
        hub_html = hub_html.replace(
            '"placeholder_version"', f'"{__version__}"'
        )
        hub_html = hub_html.replace(
            '"placeholder_hub_title"', f'"{hub_title}"'
        )
        hub_html = hub_html.replace(
            '"placeholder_hub_data"', f'"{self._compress_and_encode(projects_data)}"'
        )
        hub_html = hub_html.replace(
            "placeholder_hub_is_server", "true" if is_server else "false"
        )

        with open(hub_name, "w", encoding="utf-8") as fh:
            fh.write(hub_html)

        return hub_name

    # ------------------------------------------------------------------
    # Data collection helpers
    # ------------------------------------------------------------------

    def get_projects_data(self, sources: list) -> list:
        """
        Build the projects list from a list of source dicts.
        Each dict has keys: label, source, source_type.
        """
        projects = []
        for src in sources:
            label = src.get("label") or src["source"]
            source_type = src.get("source_type", "db")
            if source_type == "db":
                runs = self._read_db(src["source"])
                projects.append({
                    "label": label,
                    "source": src["source"],
                    "source_type": "db",
                    "url": None,
                    "runs": runs,
                })
            elif source_type == "url":
                runs, base_url = self._fetch_url(src["source"])
                projects.append({
                    "label": label,
                    "source": src["source"],
                    "source_type": "url",
                    "url": base_url,
                    "runs": runs,
                })
        return projects

    def _read_db(self, db_path: str) -> list:
        """Read run stats from a SQLite database file."""
        try:
            conn = sqlite3.connect(db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute(
                "SELECT run_start, name, total, passed, failed, skipped, elapsed_s, start_time "
                "FROM runs ORDER BY start_time ASC"
            )
            rows = [dict(row) for row in cursor.fetchall()]
            conn.close()
            return rows
        except Exception as exc:
            print(f"  WARNING: could not read database '{db_path}': {exc}")
            return []

    def _fetch_url(self, base_url: str):
        """Fetch run stats from a running dashboard server's /hub-data endpoint."""
        try:
            import urllib.request
            import json as _json
            url = base_url.rstrip("/") + "/hub-data"
            with urllib.request.urlopen(url, timeout=10) as resp:
                data = _json.loads(resp.read().decode("utf-8"))
            return data, base_url.rstrip("/")
        except Exception as exc:
            print(f"  WARNING: could not fetch hub data from '{base_url}': {exc}")
            return [], base_url.rstrip("/")

    # ------------------------------------------------------------------
    # Encoding helpers
    # ------------------------------------------------------------------

    def _compress_and_encode(self, data) -> str:
        """JSON-serialise, zlib-compress, and base64-encode data for HTML embedding."""
        json_bytes = dumps(data).encode("utf-8")
        compressed = compress(json_bytes)
        return b64encode(compressed).decode("utf-8")
