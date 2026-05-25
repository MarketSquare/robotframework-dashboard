# usage: python interact.py
#
# Update HOST, PORT, USER, and PASS to match your --server argument.
# When the server has no auth configured, the auth tuple is ignored by the server.

import requests
from pathlib import Path

HOST = "127.0.0.1"
PORT = 8543
USER = "user" # leave empty when no auth is configured on the server like this: USER = ""
PASS = "pass" # leave empty when no auth is configured on the server like this: PASS = ""

BASE_URL = f"http://{HOST}:{PORT}"
AUTH = (USER, PASS)  # passed to every mutation request; ignored by server when no auth is configured

SINGLE_OUTPUT_PATH = Path("D:/robotframework-dashboard/tests/robot/resources/outputs/output-20250313-002222.xml")
OUTPUT_FOLDER_PATH = Path("D:/robotframework-dashboard/tests/robot/resources/outputs/")

# --- read-only endpoints (no auth required) ---

# get the outputs currently in the database
response = requests.get(f"{BASE_URL}/get-outputs")
print("get-outputs:", response.json())
print()

# get the log files currently on the server
response = requests.get(f"{BASE_URL}/get-logs")
print("get-logs:", response.json())
print()


# --- mutation endpoints (auth required when server credentials are set) ---

# add an output by absolute path with tags, version, alias, and custom filters
body = {
    "output_path": str(SINGLE_OUTPUT_PATH),
    "output_tags": ["tag1", "cool-tag2", "production_tag"],
    "output_alias": "nightly_run",
    "output_version": "v1.2.3",
    "output_custom_filters": "env=prod:team=backend",
}
response = requests.post(f"{BASE_URL}/add-outputs", json=body, auth=AUTH)
print("add-outputs (by path):", response.json())
print()

# add an output by folder path — all *output*.xml files are picked up recursively
body = {
    "output_folder_path": str(OUTPUT_FOLDER_PATH),
    "output_tags": ["production-run"],
    "output_version": "v1.2.3",
}
response = requests.post(f"{BASE_URL}/add-outputs", json=body, auth=AUTH)
print("add-outputs (by folder):", response.json())
print()

# upload an output.xml file directly (gzip-compressed to reduce bandwidth)
output_path = SINGLE_OUTPUT_PATH
with open(output_path, "rb") as f:
    from gzip import compress
    compressed = compress(f.read())
files = {"file": (f"{output_path.name}.gz", compressed, "application/gzip")}
form = {"tags": "tag1:tag2", "version": "v1.2.3", "custom_filters": "env=prod"}
response = requests.post(f"{BASE_URL}/add-output-file", files=files, data=form, auth=AUTH)
print("add-output-file:", response.json())
print()

# remove outputs by index, run_start, alias, and tag in one call
body = {
    "indexes": ["0", "-1"],
    "run_starts": ["2025-03-13 00:22:22.304104"],
    "aliases": ["nightly_run"],
    "tags": ["old-tag"],
}
response = requests.delete(f"{BASE_URL}/remove-outputs", json=body, auth=AUTH)
print("remove-outputs (mixed selectors):", response.json())
print()

# keep only the 100 most recent runs, auto-delete the rest
response = requests.delete(f"{BASE_URL}/remove-outputs", json={"limit": 100}, auth=AUTH)
print("remove-outputs (limit):", response.json())
print()

# add a log file by HTML content and associate it with the matching run
body = {
    "log_name": "log-20250219-172527.html",
    "log_data": "<!DOCTYPE html><html lang='en'><head><title>Log</title></head><body>...</body></html>",
}
response = requests.post(f"{BASE_URL}/add-log", json=body, auth=AUTH)
print("add-log:", response.json())
print()

# remove a specific log file from the server
response = requests.delete(f"{BASE_URL}/remove-log", json={"log_name": "log-20250219-172527.html"}, auth=AUTH)
print("remove-log (by name):", response.json())
print()

# manually trigger a dashboard HTML regeneration (useful when --noautoupdate is active)
response = requests.post(f"{BASE_URL}/refresh-dashboard", auth=AUTH)
print("refresh-dashboard:", response.json())