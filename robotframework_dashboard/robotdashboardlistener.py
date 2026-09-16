from sys import exit
from os.path import exists
from gzip import compress
from json import dumps, loads
from ssl import create_default_context, CERT_NONE
from base64 import b64encode
from uuid import uuid4
from types import SimpleNamespace
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from robot.libraries.BuiltIn import BuiltIn
from time import sleep
from pathlib import Path

# Ships inside the robotframework-dashboard package so it can be referenced without fetching
# anything from GitHub, which matters in closed-off environments. No extra dependencies beyond
# Robot Framework itself are required (HTTP is done with the standard library):
#   pip install robotframework-dashboard
#   robot --listener robotframework_dashboard.robotdashboardlistener tests.robot
#
# A standalone copy also lives at example/listener/robotdashboardlistener.py for users who prefer
# to point --listener at a local file path instead of the installed module.
#
# Full docs: https://marketsquare.github.io/robotframework-dashboard/listener-integration.html
#
# Robot Framework:
#   robot --listener robotframework_dashboard.robotdashboardlistener tests.robot
#   robot --listener robotframework_dashboard.robotdashboardlistener:tags=tag1,tag2:version=v1.2.3:uploadlog=true tests.robot
#
# Pabot:
#   pabot --listener robotframework_dashboard.robotdashboardlistener tests.robot
#   pabot --testlevelsplit --listener robotframework_dashboard.robotdashboardlistener tests.robot
#   pabot --testlevelsplit --listener robotframework_dashboard.robotdashboardlistener:output=custom_output.xml -o custom_output.xml tests.robot
#
# Parameters:
#   tags=tag1,tag2                         - Comma-separated tags for the run
#   version=v1.2.3                         - Version label (e.g., software version)
#   uploadlog=true                         - Upload log file to server (default: false)
#   host=127.0.0.1                         - Server hostname (default: 127.0.0.1)
#   port=8543                              - Server port (default: 8543). Leave empty (port=) to
#                                             omit the port from the URL entirely, for servers
#                                             reachable on the protocol's default port (80/443)
#                                             or behind a reverse proxy that doesn't expose one.
#   protocol=http                          - Protocol to use: 'http' or 'https' (default: http)
#   sslverify=true                         - Verify SSL certificates for HTTPS: 'true', 'false', or path to CA bundle (default: true)
#   limit=100                              - Max runs in database; auto-delete oldest (default: 0 = unlimited)
#   output=custom.xml                      - Custom output filename (required for pabot with custom -o)
#   customfilters=key=val:key=val          - Custom filter key=value pairs (colon-separated)
#   user=admin                             - Username for basic authentication (default: none)
#   password=secret                        - Password for basic authentication (default: none)
#
# Features:
#   - Output files are gzip-compressed and sent to /add-output-file
#   - Log files are gzip-compressed and sent to /add-log-file (when uploadlog=true)
#   - HTTPS is supported via protocol=https (combine with --ssl-certfile/--ssl-keyfile on the server)


class robotdashboardlistener:

    def __init__(
        self,
        tags: str = None,
        host: str = "127.0.0.1",
        port: str = "8543",
        protocol: str = "http",
        sslverify: str = "true",
        limit: str = "0",
        version: str = None,
        uploadlog: bool = False,
        output: str = None,  # this option is only required when using pabot and a custom output.xml name!
        customfilters: str = None,  # custom filter key=value pairs (colon-separated, e.g. key=val:key=val)
        user: str = None,
        password: str = None,
    ):
        self.host = host
        self.port = port
        self.protocol = protocol
        self.ssl_verify = self._parse_ssl_verify(sslverify)
        self.tags = tags.split(",") if tags != None else [""]
        self.limit = int(limit)
        self.version = version
        self.uploadlog = str(uploadlog).lower() == "true"
        self.output = output if output != None else "output.xml"
        self.customfilters = customfilters
        self.auth = (user, password) if user and password else None
        self.path: str
        self.log_path: str
        self.last_execution: str

    def _parse_ssl_verify(self, sslverify: str):
        """Parse the sslverify parameter: 'true'/'false' as bool, anything else as a CA bundle path"""
        lower = str(sslverify).lower()
        if lower == "true":
            return True
        if lower == "false":
            return False
        return sslverify  # treat as path to CA bundle

    def _base_url(self):
        """Build the server base URL, omitting the port when none was provided
        (e.g. servers reachable on the protocol's default port or behind a reverse proxy)"""
        if self.port in (None, "", "none", "None"):
            return f"{self.protocol}://{self.host}"
        return f"{self.protocol}://{self.host}:{self.port}"

    def _ssl_context(self):
        """Build the SSL context used for HTTPS requests, honoring the sslverify parameter"""
        if self.protocol != "https":
            return None
        if self.ssl_verify is False:
            context = create_default_context()
            context.check_hostname = False
            context.verify_mode = CERT_NONE
            return context
        if self.ssl_verify is True:
            return create_default_context()
        return create_default_context(cafile=self.ssl_verify)  # path to CA bundle

    def _headers(self, content_type: str = None):
        headers = {}
        if content_type:
            headers["Content-Type"] = content_type
        if self.auth:
            user, password = self.auth
            token = b64encode(f"{user}:{password}".encode("utf-8")).decode("ascii")
            headers["Authorization"] = f"Basic {token}"
        return headers

    @staticmethod
    def _build_multipart(fields: dict, files: dict):
        """Build a multipart/form-data request body without depending on 'requests'"""
        boundary = uuid4().hex
        parts = []
        for name, value in fields.items():
            parts.append(f"--{boundary}".encode())
            parts.append(f'Content-Disposition: form-data; name="{name}"'.encode())
            parts.append(b"")
            parts.append(str(value).encode("utf-8"))
        for name, (filename, content, content_type) in files.items():
            parts.append(f"--{boundary}".encode())
            parts.append(
                f'Content-Disposition: form-data; name="{name}"; filename="{filename}"'.encode()
            )
            parts.append(f"Content-Type: {content_type}".encode())
            parts.append(b"")
            parts.append(content)
        parts.append(f"--{boundary}--".encode())
        parts.append(b"")
        body = b"\r\n".join(parts)
        return body, f"multipart/form-data; boundary={boundary}"

    def _request(self, url: str, method: str, data: bytes = None, content_type: str = None):
        """Perform an HTTP request with urllib and return a requests.Response-like object
        (status_code + .json()) so the calling code stays framework-agnostic"""
        req = Request(url, data=data, headers=self._headers(content_type), method=method)
        try:
            with urlopen(req, context=self._ssl_context(), timeout=60) as response:
                status_code = response.status
                body_bytes = response.read()
        except HTTPError as error:
            status_code = error.code
            body_bytes = error.read()
        try:
            body = loads(body_bytes.decode("utf-8")) if body_bytes else {}
        except ValueError:
            body = {}
        return SimpleNamespace(status_code=status_code, json=lambda: body)

    def end_suite(self, data, result):
        self.last_execution = BuiltIn().get_variable_value(
            "${PABOTISLASTEXECUTIONINPOOL}"
        )

    def output_file(self, path):
        self.path = str(path)

    def log_file(self, path):
        self.log_path = str(path)

    def close(self):
        if (
            self.last_execution and self.last_execution == "1"
        ):  # pabot usage and it's the very last execution
            # Original code caused issues on Linux due to hardcoded Windows-style path resulting in invalid escape sequences error for linux users:
            ## self.path = self.path.rsplit("\\", 1)[0] + f"\..\..\{self.output}"

            # The revised code below uses pathlib for cross-platform path handling written by siddharthsinghchaudhari.
            # It navigates three levels up from the current path and appends the output file name.
            # This approach works correctly on both Windows and Linux systems.
            self.path = str(Path(self.path).parent.parent.parent / self.output)
            # added to make sure the output file is created, make this longer if the output generation is longer!
            timeout = 0
            while timeout < 10:
                if exists(self.path):
                    break
                sleep(1)
                timeout += 1
            if not exists(self.path):
                self._print_listener(
                    f"ERROR could not find output.xml '{self.path}', skipped automatic processing"
                )
                exit(1)
            self._add_output_to_database(path=str(self.path))
            self._upload_log_file()
            self._remove_runs_over_limit()
        elif self.last_execution == None:  # normal robot usage
            if exists(self.path):
                self._add_output_to_database(path=str(self.path))
                self._upload_log_file()
                self._remove_runs_over_limit()
            else:
                self._print_listener(
                    f"ERROR could not find output.xml '{self.path}', skipped automatic processing"
                )
        else:
            self._print_listener(
                "WARNING the listener was called but did not run! This was probably because of pabot usage and this is not the last test/suite!"
            )

    def _add_output_to_database(self, path: str):
        self._print_listener(f"starting processing output.xml '{path}'")
        tags = ":".join(filter(None, self.tags)) if self.tags else ""
        form_data = {"tags": tags}
        if self.version:
            form_data["version"] = self.version
        if self.customfilters:
            form_data["custom_filters"] = self.customfilters
        try:
            with open(path, "rb") as output_file:
                compressed_output = compress(output_file.read())
            files = {
                "file": (
                    f"{Path(path).name}.gz",
                    compressed_output,
                    "application/gzip",
                )
            }
            body, content_type = self._build_multipart(form_data, files)
            response = self._request(
                f"{self._base_url()}/add-output-file", "POST", data=body, content_type=content_type
            )
        except URLError as e:
            self._print_listener(
                f"ERROR the server is not running or the url {self._base_url()}/add-output-file is not correct!"
            )
            exit(1)
        except Exception as e:
            self._print_listener(
                f"ERROR something went wrong while compressing or sending '{path}': {e}"
            )
            exit(1)
        if response.status_code == 200:
            self._print_console_message(response)
        else:
            self._print_listener(
                f"ERROR something went wrong while sending results to the server: {response.json()}"
            )

    def _upload_log_file(self):
        if not self.uploadlog:
            return
        if not self.log_path:
            self._print_listener(
                "WARNING uploadlog enabled but no log file was provided by Robot Framework"
            )
            return
        if not exists(self.log_path):
            self._print_listener(
                f"WARNING uploadlog enabled but log file '{self.log_path}' not found"
            )
            return
        try:
            with open(self.log_path, "rb") as log_file:
                compressed_log = compress(log_file.read())
            files = {
                "file": (
                    f"{Path(self.log_path).name}.gz",
                    compressed_log,
                    "application/gzip",
                )
            }
            body, content_type = self._build_multipart({}, files)
            response = self._request(
                f"{self._base_url()}/add-log-file", "POST", data=body, content_type=content_type
            )
        except URLError:
            self._print_listener(
                f"ERROR the server is not running or the url {self._base_url()}/add-log-file is not correct!"
            )
            return
        except Exception as e:
            self._print_listener(
                f"ERROR something went wrong while compressing or sending log '{self.log_path}': {e}"
            )
            return
        if response.status_code == 200:
            self._print_console_message(response)
        else:
            self._print_listener(
                f"ERROR something went wrong while sending the log file to the server: {response.json()}"
            )

    def _remove_runs_over_limit(self):
        if self.limit > 0:
            body = dumps({"limit": int(self.limit)}).encode("utf-8")
            response = self._request(
                f"{self._base_url()}/remove-outputs",
                "DELETE",
                data=body,
                content_type="application/json",
            )
            if response.status_code == 200:
                self._print_console_message(response)
            else:
                self._print_listener(
                    f"ERROR something went wrong while deleting the runs from the database: {response.json()}"
                )

    def _print_listener(self, value: str):
        print(f"robotdashboardlistener: {value}")

    def _print_console_message(self, response):
        message_lines = response.json()["console"].split("\n")
        for message_line in message_lines:
            if len(message_line) == 0:
                continue
            self._print_listener(f"{message_line}")
