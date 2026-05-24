"""Manages the hub_sources.json configuration file.

The JSON file stores persistent data sources for the hub.  It survives
server restarts so sources do not need to be re-supplied on every start.

File format::

    {
        "sources": [
            {"source": "path/to/db.db", "label": "My Project", "source_type": "db"},
            {"source": "http://host:8543",  "label": "Project B",  "source_type": "url"}
        ]
    }
"""

import json
import os

DEFAULT_FILE = "hub_sources.json"


def load_sources(path: str = DEFAULT_FILE) -> list:
    """Return the sources list from *path*, creating an empty file if needed."""
    if not os.path.exists(path):
        _write([], path)
    with open(path, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    return data.get("sources", [])


def save_sources(sources: list, path: str = DEFAULT_FILE) -> None:
    """Overwrite *path* with the given sources list."""
    _write(sources, path)


def add_source(source: str, label: str, source_type: str, path: str = DEFAULT_FILE) -> list:
    """Append a source to *path*.  No-op if a source with the same *source* value already exists."""
    sources = load_sources(path)
    for s in sources:
        if s.get("source") == source:
            return sources  # already present
    sources.append({
        "source": source,
        "label": label or source,
        "source_type": source_type,
    })
    _write(sources, path)
    return sources


def remove_source(source: str, path: str = DEFAULT_FILE) -> list:
    """Remove the entry with *source* from *path*.  No-op if not found."""
    sources = load_sources(path)
    sources = [s for s in sources if s.get("source") != source]
    _write(sources, path)
    return sources


def merge_cli_sources_into_file(cli_sources: list, path: str = DEFAULT_FILE) -> list:
    """Add CLI-supplied sources to *path* that are not already present.

    Returns the full (merged) list so callers can use it directly.
    """
    for src in cli_sources:
        add_source(
            src["source"],
            src.get("label", src["source"]),
            src.get("source_type", "db"),
            path,
        )
    return load_sources(path)


# ---------------------------------------------------------------------------
# Internal helper
# ---------------------------------------------------------------------------

def _write(sources: list, path: str) -> None:
    with open(path, "w", encoding="utf-8") as fh:
        json.dump({"sources": sources}, fh, indent=2)
