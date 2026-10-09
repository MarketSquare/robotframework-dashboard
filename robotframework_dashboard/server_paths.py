from os import name as os_name
from pathlib import Path

# a ':' on Windows makes 'C:name' drive-relative, so it is only a separator there
_FORBIDDEN_CHARACTERS = "/\\\x00" + (":" if os_name == "nt" else "")

# what a Robot Framework log can embed or link to: screenshots, videos and the report
_LOG_RESOURCE_SUFFIXES = {
    ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp", ".svg", ".ico",
    ".mp4", ".webm", ".ogg", ".html", ".htm",
}


def safe_file_name(name: str) -> str:
    """Return name if it is a plain file name, raise ValueError for anything that could leave the target folder"""
    if not name:
        raise ValueError("no file name was provided")
    if name in (".", "..") or any(character in name for character in _FORBIDDEN_CHARACTERS):
        raise ValueError(f"'{name}' is not a plain file name, folders are not allowed")
    return name


def is_within(path: Path, folder: Path) -> bool:
    """Check whether the resolved path is inside the resolved folder"""
    try:
        path.resolve().relative_to(folder.resolve())
        return True
    except (ValueError, OSError):
        return False


def is_log_resource(path: Path) -> bool:
    """Only file types a log can embed are served next to it, so a data file or secret in that folder is not"""
    return path.suffix.lower() in _LOG_RESOURCE_SUFFIXES


def log_path_from_run_path(run_path: str) -> Path:
    """Mirror transform_file_path in js/common.js: the log of output-XYZ.xml is log-XYZ.html in the same folder"""
    path = Path(run_path)
    return path.with_name(log_name_from_output_name(path.name))


def log_name_from_output_name(name: str) -> str:
    """output-XYZ.xml -> log-XYZ.html, a name that already is a log stays the same"""
    name = name.replace("output", "log")
    if name.lower().endswith(".xml"):
        name = name[:-4] + ".html"
    return name
