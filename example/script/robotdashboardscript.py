from sys import exit
from os.path import exists
from gzip import compress
from argparse import ArgumentParser
from pathlib import Path
from requests import post, delete
from requests.exceptions import ConnectionError

# Push an existing output.xml (and optionally a log.html) to a running robotdashboard server
# without needing a Robot Framework test execution.
#
# Usage:
#   python robotdashboardscript.py --output path/to/output.xml
#   python robotdashboardscript.py --output path/to/output.xml --log path/to/log.html
#   python robotdashboardscript.py --output path/to/output.xml --tags tag1,tag2 --version v1.2.3
#   python robotdashboardscript.py --output path/to/output.xml --host 10.0.0.5 --port 8543
#   python robotdashboardscript.py --output path/to/output.xml --protocol https --sslverify false
#   python robotdashboardscript.py --output path/to/output.xml --protocol https --sslverify /path/to/ca-bundle.pem
#   python robotdashboardscript.py --output path/to/output.xml --limit 100
#
# Arguments (mirror those of robotdashboardlistener.py):
#   --output path/to/output.xml     Path to the output.xml file to push (required)
#   --log    path/to/log.html       Path to the log.html file to upload (optional)
#   --tags   tag1,tag2              Comma-separated tags for the run (default: none)
#   --version v1.2.3                Version label for the run (default: none)
#   --host   127.0.0.1              Server hostname (default: 127.0.0.1)
#   --port   8543                   Server port (default: 8543)
#   --protocol http                 Protocol: 'http' or 'https' (default: http)
#   --sslverify true                SSL verification: 'true', 'false', or path to CA bundle (default: true)
#   --limit  100                    Keep only the N most recent runs; auto-delete the rest (default: 0 = unlimited)


def _parse_args():
    parser = ArgumentParser(
        description="Push an output.xml to a running robotdashboard server."
    )
    parser.add_argument(
        "--output",
        required=True,
        help="Path to the output.xml file to push to the server.",
    )
    parser.add_argument(
        "--log",
        default=None,
        help="Path to the log.html file to upload to the server (optional).",
    )
    parser.add_argument(
        "--tags",
        default=None,
        help="Comma-separated tags to attach to this run (e.g. 'smoke,regression').",
    )
    parser.add_argument(
        "--version",
        default=None,
        help="Version label for the run (e.g. 'v1.2.3').",
    )
    parser.add_argument(
        "--host",
        default="127.0.0.1",
        help="Dashboard server hostname (default: 127.0.0.1).",
    )
    parser.add_argument(
        "--port",
        default="8543",
        help="Dashboard server port (default: 8543).",
    )
    parser.add_argument(
        "--protocol",
        default="http",
        choices=["http", "https"],
        help="Protocol to use when connecting to the server: 'http' or 'https' (default: http).",
    )
    parser.add_argument(
        "--sslverify",
        default="true",
        help="SSL certificate verification for HTTPS: 'true' (default), 'false' (skip verification), or a path to a CA bundle file.",
    )
    parser.add_argument(
        "--limit",
        default="0",
        help="Keep only the N most recent runs in the database; older runs are auto-deleted (default: 0 = unlimited).",
    )
    return parser.parse_args()


def _parse_ssl_verify(sslverify: str):
    """Parse the sslverify argument: 'true'/'false' as bool, anything else as a CA bundle path."""
    lower = str(sslverify).lower()
    if lower == "true":
        return True
    if lower == "false":
        return False
    return sslverify  # treat as path to CA bundle


def _print_pusher(value: str):
    print(f"robotdashboardscript: {value}")


def _print_console_message(response):
    message_lines = response.json()["console"].split("\n")
    for message_line in message_lines:
        if len(message_line) == 0:
            continue
        _print_pusher(f"{message_line}")


def _add_output_to_server(output_path: str, tags, version, host, port, protocol, ssl_verify):
    _print_pusher(f"starting processing output.xml '{output_path}'")
    tags_list = tags.split(",") if tags else []
    tags_str = ":".join(filter(None, tags_list)) if tags_list else ""
    form_data = {"tags": tags_str}
    if version:
        form_data["version"] = version
    try:
        with open(output_path, "rb") as output_file:
            compressed_output = compress(output_file.read())
        files = {
            "file": (
                f"{Path(output_path).name}.gz",
                compressed_output,
                "application/gzip",
            )
        }
        response = post(
            f"{protocol}://{host}:{port}/add-output-file",
            data=form_data,
            files=files,
            verify=ssl_verify,
        )
    except ConnectionError:
        _print_pusher(
            f"ERROR the server is not running or the url {protocol}://{host}:{port}/add-output-file is not correct!"
        )
        exit(1)
    except Exception as e:
        _print_pusher(
            f"ERROR something went wrong while compressing or sending '{output_path}': {e}"
        )
        exit(1)
    if response.status_code == 200:
        _print_console_message(response)
    else:
        _print_pusher(
            f"ERROR something went wrong while sending results to the server: {response.json()}"
        )
        exit(1)


def _upload_log_file(log_path: str, host, port, protocol, ssl_verify):
    if not exists(log_path):
        _print_pusher(f"WARNING log file '{log_path}' not found, skipping log upload")
        return
    try:
        with open(log_path, "rb") as log_file:
            compressed_log = compress(log_file.read())
        files = {
            "file": (
                f"{Path(log_path).name}.gz",
                compressed_log,
                "application/gzip",
            )
        }
        response = post(
            f"{protocol}://{host}:{port}/add-log-file",
            files=files,
            verify=ssl_verify,
        )
    except ConnectionError:
        _print_pusher(
            f"ERROR the server is not running or the url {protocol}://{host}:{port}/add-log-file is not correct!"
        )
        return
    except Exception as e:
        _print_pusher(
            f"ERROR something went wrong while compressing or sending log '{log_path}': {e}"
        )
        return
    if response.status_code == 200:
        _print_console_message(response)
    else:
        _print_pusher(
            f"ERROR something went wrong while sending the log file to the server: {response.json()}"
        )


def _remove_runs_over_limit(limit: int, host, port, protocol, ssl_verify):
    body = {"limit": limit}
    try:
        response = delete(
            f"{protocol}://{host}:{port}/remove-outputs",
            json=body,
            verify=ssl_verify,
        )
    except ConnectionError:
        _print_pusher(
            f"ERROR the server is not running or the url {protocol}://{host}:{port}/remove-outputs is not correct!"
        )
        return
    if response.status_code == 200:
        _print_console_message(response)
    else:
        _print_pusher(
            f"ERROR something went wrong while deleting the runs from the database: {response.json()}"
        )


def main():
    args = _parse_args()
    ssl_verify = _parse_ssl_verify(args.sslverify)
    limit = int(args.limit)

    if not exists(args.output):
        _print_pusher(f"ERROR output file '{args.output}' not found")
        exit(1)

    _add_output_to_server(
        output_path=args.output,
        tags=args.tags,
        version=args.version,
        host=args.host,
        port=args.port,
        protocol=args.protocol,
        ssl_verify=ssl_verify,
    )

    if args.log:
        _upload_log_file(
            log_path=args.log,
            host=args.host,
            port=args.port,
            protocol=args.protocol,
            ssl_verify=ssl_verify,
        )

    if limit > 0:
        _remove_runs_over_limit(
            limit=limit,
            host=args.host,
            port=args.port,
            protocol=args.protocol,
            ssl_verify=ssl_verify,
        )


if __name__ == "__main__":
    main()
