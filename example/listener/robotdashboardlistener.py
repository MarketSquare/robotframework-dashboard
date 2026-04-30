from sys import exit
from os.path import exists
from gzip import compress
from requests import post, get, delete
from requests.exceptions import ConnectionError
from robot.libraries.BuiltIn import BuiltIn
from time import sleep
from pathlib import Path

# For usage with robot.toml, see robot.toml in this folder
#
# Robot Framework:
#   robot --listener robotdashboardlistener.py tests.robot
#   robot --listener robotdashboardlistener.py:tags=tag1,tag2:version=v1.2.3:uploadlog=true tests.robot
#
# Pabot:
#   pabot --listener robotdashboardlistener.py tests.robot
#   pabot --testlevelsplit --listener robotdashboardlistener.py tests.robot
#   pabot --testlevelsplit --listener robotdashboardlistener.py:output=custom_output.xml -o custom_output.xml tests.robot
#
# Parameters:
#   tags=tag1,tag2       - Comma-separated tags for the run
#   version=v1.2.3       - Version label (e.g., software version)
#   uploadlog=true       - Upload log file to server (default: false)
#   host=127.0.0.1       - Server hostname (default: 127.0.0.1)
#   port=8543            - Server port (default: 8543)
#   protocol=http        - Protocol to use: 'http' or 'https' (default: http)
#   sslverify=true       - Verify SSL certificates for HTTPS: 'true', 'false', or path to CA bundle (default: true)
#   limit=100            - Max runs in database; auto-delete oldest (default: 0 = unlimited)
#   output=custom.xml    - Custom output filename (required for pabot with custom -o)
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
            response = post(
                f"{self.protocol}://{self.host}:{self.port}/add-output-file",
                data=form_data,
                files=files,
                verify=self.ssl_verify,
            )
        except ConnectionError as e:
            self._print_listener(
                f"ERROR the server is not running or the url {self.protocol}://{self.host}:{self.port}/add-output-file is not correct!"
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
            response = post(
                f"{self.protocol}://{self.host}:{self.port}/add-log-file",
                files=files,
                verify=self.ssl_verify,
            )
        except ConnectionError:
            self._print_listener(
                f"ERROR the server is not running or the url {self.protocol}://{self.host}:{self.port}/add-log-file is not correct!"
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
            body = {"limit": int(self.limit)}
            response = delete(
                f"{self.protocol}://{self.host}:{self.port}/remove-outputs",
                json=body,
                verify=self.ssl_verify,
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
