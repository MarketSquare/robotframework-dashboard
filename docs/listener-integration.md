---
outline: deep
---

# Listener Integration

Robot Framework Dashboard provides a built-in listener integration that enables automatically sending `output.xml` files to the RobotDashboard server after each test run. This page explains where the listener is located, how it works internally, and how to use it with Robot Framework, Pabot, and RobotCode.

## Overview

The dashboard listener is a python script that hooks into Robot Framework's [Listener Interface](https://docs.robotframework.org/docs/extending_robot_framework/listeners_prerun_api/listeners). There are also details in the [User Guide](https://robotframework.org/robotframework/latest/RobotFrameworkUserGuide.html#listener-interface) regarding the usage of listeners.

Its responsibilities include:

- Detecting when an `output.xml` file is created  
- Sending the output file to the robotdashboard server (gzip-compressed via `/add-output-file`)
- Optionally uploading the log file to the server  
- Optionally adding tags to the run  
- Optionally labeling runs with a version string  
- The script is pabot compatible  
- Enforcing an optional database run limit (e.g., keep only latest 100 runs)  

The listener ships **inside the `robotframework-dashboard` package itself** — no separate download and no extra dependencies (it talks HTTP using only the Python standard library). This means it's available the moment you `pip install robotframework-dashboard`, which matters in closed-off/offline environments where fetching a script from GitHub isn't practical:

```bash
pip install robotframework-dashboard
robot --listener robotframework_dashboard.robotdashboardlistener tests.robot
```

The implementation — and the full up-to-date list of arguments in code, if you want to read it straight from the source — lives at [`robotframework_dashboard/robotdashboardlistener.py`](https://github.com/marketsquare/robotframework-dashboard/blob/main/robotframework_dashboard/robotdashboardlistener.py).

A standalone copy also lives at [`example/listener/robotdashboardlistener.py`](https://github.com/marketsquare/robotframework-dashboard/blob/main/example/listener/robotdashboardlistener.py) for anyone who prefers pointing `--listener` at a local file path instead of the installed module — it's just a one-line re-export of the file above, kept for that use case.

> Important: the name of the file (or, for the packaged module, the last part of the dotted path) and the class inside it must match. Both are **robotdashboardlistener**.

## Basic Usage

You can attach the listener directly when running Robot Framework.

> Important: make sure the server is running!

**Basic test run**

```bash
robot --listener robotframework_dashboard.robotdashboardlistener tests.robot  
```

**With tags**

```bash
robot --listener robotframework_dashboard.robotdashboardlistener:tags=smoke,regression tests.robot  
```

**With version label**

```bash
robot --listener robotframework_dashboard.robotdashboardlistener:version=v1.2.3 tests.robot  
```

**With log file upload**

```bash
robot --listener robotframework_dashboard.robotdashboardlistener:uploadlog=true tests.robot  
```

**With custom host/port**

```bash
robot --listener robotframework_dashboard.robotdashboardlistener:host=10.0.0.5:port=8543 tests.robot  
```

**With no port** — for a server reachable on the protocol's default port (80/443), or behind a reverse proxy that doesn't expose one, leave `port` empty to omit it from the URL entirely:

```bash
robot --listener robotframework_dashboard.robotdashboardlistener:host=dashboard.internal.company.com:port= tests.robot  
```

**With HTTPS**

```bash
robot --listener robotframework_dashboard.robotdashboardlistener:protocol=https:port=8543 tests.robot  
```

**With HTTPS and SSL verification disabled (for self-signed certificates)**

```bash
robot --listener robotframework_dashboard.robotdashboardlistener:protocol=https:sslverify=false tests.robot  
```

**With HTTPS and a custom CA bundle**

```bash
robot --listener robotframework_dashboard.robotdashboardlistener:protocol=https:sslverify=/path/to/ca-bundle.pem tests.robot  
```

**With basic authentication**

```bash
robot --listener robotframework_dashboard.robotdashboardlistener:user=admin:password=secret tests.robot  
```

**Using the standalone file copy instead** (same arguments, just point at a path):

```bash
robot --listener path/to/example/listener/robotdashboardlistener.py:host=10.0.0.5:port=8543 tests.robot  
```

## Full Listener Options

The listener supports the following arguments:

| Argument | Description |
|---|---|
| `tags` | Comma-separated list of tags attached to the test run in the Dashboard |
| `version` | Version label for the run (e.g., software version, release tag) |
| `uploadlog` | Set to `true` to upload the log file to the server (default: `false`) |
| `host` | Dashboard server hostname (default: `127.0.0.1`) |
| `port` | Dashboard server port (default: `8543`). Leave empty (`port=`) to omit the port from the URL entirely — for a server reachable on the protocol's default port (80/443) or behind a reverse proxy that doesn't expose one |
| `protocol` | Protocol to use when connecting to the server: `http` or `https` (default: `http`) |
| `sslverify` | SSL certificate verification for HTTPS: `true` (default), `false` (skip verification for self-signed certs), or a path to a CA bundle file |
| `limit` | Maximum number of runs stored in the database (older runs will be auto-deleted, based on the order in the database) |
| `output` | Required only when using Pabot **with a custom output.xml name** |
| `customfilters` | Custom filter key=value pairs (colon-separated, e.g. `key=val:key2=val2`) — creates filterable dropdowns in the dashboard per key |
| `user` | Username for basic authentication (optional) |
| `password` | Password for basic authentication (optional) |

**Example with all options**

```bash
robot --listener robotframework_dashboard.robotdashboardlistener:tags=dev1,dev2:version=v2.0:host=127.0.0.2:port=8888:protocol=https:sslverify=false:limit=100:uploadlog=true:customfilters=Environment=staging:ComponentA=2.0:user=admin:password=secret tests.robot  
```

## Using the Listener with Pabot

Pabot requires some special handling because multiple workers generate multiple temporary `output.xml` files.  
The listener automatically detects when the *final merged output* is ready.

**Basic Pabot usage**

```bash
pabot --listener robotframework_dashboard.robotdashboardlistener tests.robot  
```

**Pabot with test-level splitting**

```bash
pabot --testlevelsplit --listener robotframework_dashboard.robotdashboardlistener tests.robot  
```

**Pabot with custom output file name**

When using a custom `-o` output file, you **must** pass `output=<name>.xml` to the listener:

```bash
pabot --testlevelsplit --listener robotframework_dashboard.robotdashboardlistener:output=custom_output.xml -o custom_output.xml tests.robot  
```

The listener will wait for the final merged output and then send it to the Dashboard Server.

## Using the Listener with RobotCode (robot.toml)

RobotDashboard also supports a listener in the `robot.toml` of **RobotCode**. The example can be found here: [robot.toml](https://github.com/marketsquare/robotframework-dashboard/blob/main/example/listener/robot.toml)
Since the listener ships inside the package, `robot.toml` can reference it by its dotted module path directly — no file to place in your project at all.

### Basic usage steps

1. Place `robot.toml` in project root  
2. Install RobotCode runner  
   - ```bash
     pip install robotcode-runner  
     ```  
3. Start the dashboard server  
   - ```bash
     robotdashboard --server default  
     ```  
4. Choose one listener configuration in `robot.toml` (see examples below!)
5. Run your tests  
   - ```bash
     robotcode robot .  
     ```

## Example `robot.toml` configurations

**Basic usage**

```bash
[listeners]  
"robotframework_dashboard.robotdashboardlistener" = []  
```

**With tags**

```bash
[listeners]  
"robotframework_dashboard.robotdashboardlistener" = ["tags=dev1,dev2,dev3"]  
```

**Custom host + port**

```bash
[listeners]  
"robotframework_dashboard.robotdashboardlistener" = ["tags=dev1,dev2,dev3", "host=127.0.0.2", "port=8888"]  
```

**No port** (server reachable on the protocol's default port, or behind a reverse proxy)

```bash
[listeners]  
"robotframework_dashboard.robotdashboardlistener" = ["host=dashboard.internal.company.com", "port="]  
```

**Automatic deletion when more than 100 runs exist**

```bash
[listeners]  
"robotframework_dashboard.robotdashboardlistener" = ["tags=dev1,dev2,dev3", "limit=100"]  
```

**Combined: tags, version, log upload, and limit**

```bash
[listeners]  
"robotframework_dashboard.robotdashboardlistener" = ["tags=dev1,dev2", "version=v2.0", "uploadlog=true", "limit=100"]  
```

> If you'd rather use the standalone file copy instead of the dotted module path, place both `robot.toml` and `robotdashboardlistener.py` (from [example/listener/](https://github.com/marketsquare/robotframework-dashboard/tree/main/example/listener)) in your project root, and reference it as `"robotdashboardlistener.py"` instead.

## Pushing output.xml Without a Test Run (robotdashboardscript.py)

For situations where you already have an `output.xml` on disk and want to push it to a running dashboard server — without executing a Robot Framework test run — use the standalone script.

The script can be found here: [robotdashboardscript.py](https://github.com/marketsquare/robotframework-dashboard/blob/main/example/script/robotdashboardscript.py)

> Important: make sure the server is running before executing the script!

### Basic Usage

**Push a single output.xml**

```bash
python robotdashboardscript.py --output path/to/output.xml
```

**With tags and a version label**

```bash
python robotdashboardscript.py --output path/to/output.xml --tags smoke,regression --version v1.2.3
```

**With a log file**

```bash
python robotdashboardscript.py --output path/to/output.xml --log path/to/log.html
```

**With custom host/port**

```bash
python robotdashboardscript.py --output path/to/output.xml --host 10.0.0.5 --port 8543
```

**With no port** — for a server reachable on the protocol's default port (80/443), or behind a reverse proxy that doesn't expose one, pass an empty string to omit it from the URL entirely:

```bash
python robotdashboardscript.py --output path/to/output.xml --host dashboard.internal.company.com --port ""
```

**With HTTPS and SSL verification disabled (for self-signed certificates)**

```bash
python robotdashboardscript.py --output path/to/output.xml --protocol https --sslverify false
```

**With HTTPS and a custom CA bundle**

```bash
python robotdashboardscript.py --output path/to/output.xml --protocol https --sslverify /path/to/ca-bundle.pem
```

**Keep only the 100 most recent runs**

```bash
python robotdashboardscript.py --output path/to/output.xml --limit 100
```

### Full Pusher Options

The arguments mirror those of `robotdashboardlistener.py`:

| Argument | Description |
|---|---|
| `--output` | **(Required)** Path to the `output.xml` file to push to the server |
| `--log` | Path to a `log.html` file to upload to the server (optional) |
| `--tags` | Comma-separated list of tags attached to the run in the Dashboard |
| `--version` | Version label for the run (e.g., software version, release tag) |
| `--host` | Dashboard server hostname (default: `127.0.0.1`) |
| `--port` | Dashboard server port (default: `8543`). Pass an empty string (`""`) to omit the port from the URL entirely |
| `--protocol` | Protocol to use when connecting to the server: `http` or `https` (default: `http`) |
| `--sslverify` | SSL certificate verification for HTTPS: `true` (default), `false` (skip verification for self-signed certs), or a path to a CA bundle file |
| `--limit` | Maximum number of runs stored in the database (older runs will be auto-deleted) |
| `--customfilters` | Custom filter key=value pairs (colon-separated, e.g. `key=val:key2=val2`) — creates filterable dropdowns in the dashboard per key |
| `--user` | Username for basic authentication (optional) |
| `--password` | Password for basic authentication (optional) |

**Example with all options**

```bash
python robotdashboardscript.py --output path/to/output.xml --log path/to/log.html --tags dev1,dev2 --version v2.0 --host 127.0.0.2 --port 8888 --protocol https --sslverify false --limit 100 --customfilters "Environment=staging:ComponentA=2.0" --user admin --password secret
```
