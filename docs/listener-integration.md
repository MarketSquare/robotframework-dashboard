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

The listener script can be found here: [robotdashboardlistener.py](https://github.com/marketsquare/robotframework-dashboard/blob/main/example/listener/robotdashboardlistener.py)

> Important: the name of the file and the class should match. In the example it is both **robotdashboardlistener**, but changing it is fine if both are equal. 

## Basic Usage

You can attach the listener directly when running Robot Framework.

> Important: make sure the server is running!

**Basic test run**

```bash
robot --listener robotdashboardlistener.py tests.robot  
```

**With tags**

```bash
robot --listener robotdashboardlistener.py:tags=smoke,regression tests.robot  
```

**With version label**

```bash
robot --listener robotdashboardlistener.py:version=v1.2.3 tests.robot  
```

**With log file upload**

```bash
robot --listener robotdashboardlistener.py:uploadlog=true tests.robot  
```

**With custom host/port and a path**

```bash
robot --listener path/to/listeners/robotdashboardlistener.py:host=10.0.0.5:port=8543 tests.robot  
```

## Full Listener Options

The listener supports the following arguments:

| Argument | Description |
|---|---|
| `tags` | Comma-separated list of tags attached to the test run in the Dashboard |
| `version` | Version label for the run (e.g., software version, release tag) |
| `uploadlog` | Set to `true` to upload the log file to the server (default: `false`) |
| `host` | Dashboard server hostname (default: `127.0.0.1`) |
| `port` | Dashboard server port (default: `8543`) |
| `limit` | Maximum number of runs stored in the database (older runs will be auto-deleted, based on the order in the database) |
| `output` | Required only when using Pabot **with a custom output.xml name** |

**Example with all options**

```bash
robot --listener robotdashboardlistener.py:tags=dev1,dev2:version=v2.0:host=127.0.0.2:port=8888:limit=100:uploadlog=true tests.robot  
```

## Using the Listener with Pabot

Pabot requires some special handling because multiple workers generate multiple temporary `output.xml` files.  
The listener automatically detects when the *final merged output* is ready.

**Basic Pabot usage**

```bash
pabot --listener robotdashboardlistener.py tests.robot  
```

**Pabot with test-level splitting**

```bash
pabot --testlevelsplit --listener robotdashboardlistener.py tests.robot  
```

**Pabot with custom output file name**

When using a custom `-o` output file, you **must** pass `output=<name>.xml` to the listener:

```bash
pabot --testlevelsplit --listener robotdashboardlistener.py:output=custom_output.xml -o custom_output.xml tests.robot  
```

The listener will wait for the final merged output and then send it to the Dashboard Server.

## Using the Listener with RobotCode (robot.toml)

RobotDashboard also supports a listener in the `robot.toml` of **RobotCode**. The example can be found here: [robot.toml](https://github.com/marketsquare/robotframework-dashboard/blob/main/example/listener/robot.toml)
Place both `robot.toml` and `robotdashboardlistener.py` in your project root (or adjust paths accordingly).

### Basic usage steps

1. Place `robot.toml` in project root  
2. Ensure `robotdashboardlistener.py` is in root or update the path in the file  
3. Install RobotCode runner  
   - ```bash
     pip install robotcode-runner  
     ```  
4. Start the dashboard server  
   - ```bash
     robotdashboard --server default  
     ```  
5. Choose one listener configuration in `robot.toml` (see examples below!)
6. Run your tests  
   - ```bash
     robotcode robot .  
     ```

## Example `robot.toml` configurations

**Basic usage**

```bash
[listeners]  
"robotdashboardlistener.py" = []  
```

**With tags**

```bash
[listeners]  
"robotdashboardlistener.py" = ["tags=dev1,dev2,dev3"]  
```

**Custom host + port**

```bash
[listeners]  
"robotdashboardlistener.py" = ["tags=dev1,dev2,dev3", "host=127.0.0.2", "port=8888"]  
```

**Automatic deletion when more than 100 runs exist**

```bash
[listeners]  
"robotdashboardlistener.py" = ["tags=dev1,dev2,dev3", "limit=100"]  
```

**Combined: tags, version, log upload, and limit**

```bash
[listeners]  
"robotdashboardlistener.py" = ["tags=dev1,dev2", "version=v2.0", "uploadlog=true", "limit=100"]  
```
