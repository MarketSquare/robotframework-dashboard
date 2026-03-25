from fastapi_offline import FastAPIOffline
from fastapi import Body, Depends, HTTPException, status, File, UploadFile, Form
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from pydantic import BaseModel
from uvicorn import run

from os.path import join, abspath, dirname, exists
from os import remove, mkdir, listdir
from gzip import decompress
from pathlib import Path
from typing import List, Optional
from secrets import compare_digest

from .robotdashboard import RobotDashboard
from .dependencies import DependencyProcessor
from .version import __version__

response_message_model_config = {
    "json_schema_extra": {
        "examples": [
            {
                "success": "1",
                "message": "SUCCESS: processed C:\\docs\\output.xml, see the browser console for more details!",
                "console": """2. Processing output XML(s)
  Processing output XML 'output.xml'
  Processed output XML 'output' in 0.0 seconds
======================================================================================
 5. Creating dashboard HTML
  created dashboard 'C:\\docs\\robot_dashboard.html' in 0.02 seconds""",
            }
        ]
    }
}
get_output_model_config = {
    "json_schema_extra": {
        "examples": [
            {
                "run_start": "2024-10-14 22:32:59.580309",
                "name": "RobotFramework-Dashboard",
                "alias": "cool_run_alias",
                "tags": "prod,tag1,nightly",
            }
        ]
    }
}
add_output_model_config = {
    "json_schema_extra": {
        "examples": [
            {
                "output_path": "C:\\users\\docs\\output.xml",
                "output_tags": ["tag1", "cool-tag2", "production_tag"],
            },
            {
                "output_data": """<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<robot generator=\"Robot 7.2.2 (Python 3.12.9 on win32)\" generated=\"2025-02-19T17:25:58.443716\" rpa=\"false\" schemaversion=\"5\">\n<suite id=\"s1\" name=\"Scripts\" source=\"C:\\docs\">\n<suite id=\"s1-s1\" name=\"Google\" source=\"C:\\docs\\google.robot\">\n<test id=\"s1-s1-t1\" name=\"Test 01\" line=\"6\">... etc""",
                "output_alias": "some_cool_alias",
            },
            {
                "output_folder_path": "C:\\users\\docs\\prod-outputs",
                "output_tags": ["production-run"],
            },
        ],
        "openapi_examples": {
            "single_output_path": {
                "summary": "Add a single output.xml by path",
                "description": "Provide an absolute path to a Robot Framework output.xml and optional tags to label the run.",
                "value": {
                    "output_path": "C:\\users\\docs\\output.xml",
                    "output_tags": ["tag1", "cool-tag2", "production_tag"],
                },
            },
            "raw_output_data": {
                "summary": "Add output.xml via raw XML data",
                "description": "Send the raw XML content of output.xml directly; optionally give an alias to name the run.",
                "value": {
                    "output_data": """<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<robot generator=\"Robot 7.2.2 (Python 3.12.9 on win32)\" generated=\"2025-02-19T17:25:58.443716\" rpa=\"false\" schemaversion=\"5\">\n<suite id=\"s1\" name=\"Scripts\" source=\"C:\\docs\">\n<suite id=\"s1-s1\" name=\"Google\" source=\"C:\\docs\\google.robot\">\n<test id=\"s1-s1-t1\" name=\"Test 01\" line=\"6\">... etc""",
                    "output_alias": "some_cool_alias",
                },
            },
            "folder_with_outputs": {
                "summary": "Add all outputs from a folder",
                "description": "Provide a folder path (recursively scanned) where output.xml files are located. Optional tags apply to all added runs.",
                "value": {
                    "output_folder_path": "C:\\users\\docs\\prod-outputs",
                    "output_tags": ["production-run"],
                },
            },
            "output_with_version": {
                "summary": "Add an output with a version label",
                "description": "Provide an output.xml path along with a version string to label the run accordingly. (e.g., software version)",
                "value": {
                    "output_path": "C:\\users\\docs\\output.xml",
                    "output_tags": ["production-run"],
                    "output_version": "v1.2",
                },
            },
        },
    }
}
remove_outputs_model_config = {
    "json_schema_extra": {
        "examples": [
            {"indexes": ["0", "-1", "5", "10"]},
            {
                "run_starts": [
                    "2024-10-14 12:32:59.123456",
                    "2024-10-14 22:32:59.580309",
                ]
            },
            {
                "aliases": ["alias1", "alias2"],
                "indexes": ["0", "-1"],
                "tags": ["tag1", "tag2", "tag3"],
            },
            {"limit": 10},
            {"all": True},
        ],
        "openapi_examples": {
            "by_indexes": {
                "summary": "Remove by index or index range",
                "description": "Use explicit indexes (including negative for last) or ranges like 'start:stop' to delete runs.",
                "value": {"indexes": ["0", "-1", "5", "10"]},
            },
            "by_run_starts": {
                "summary": "Remove by run_start timestamps",
                "description": "Provide one or more run_start datetime strings that match rows in the database.",
                "value": {
                    "run_starts": [
                        "2024-10-14 12:32:59.123456",
                        "2024-10-14 22:32:59.580309",
                    ]
                },
            },
            "by_aliases_and_tags": {
                "summary": "Remove by aliases and tags",
                "description": "Delete runs using the stored alias names and/or test tags.",
                "value": {
                    "aliases": ["alias1", "alias2"],
                    "indexes": ["0", "-1"],
                    "tags": ["tag1", "tag2", "tag3"],
                },
            },
            "limit": {
                "summary": "Remove all but the N most recent runs",
                "description": "Keep only the specified number of most recent runs, deleting the rest.",
                "value": {"limit": 10},
            },
            "all": {
                "summary": "Remove all outputs",
                "description": "Delete all runs currently stored in the database. This is irreversible.",
                "value": {"all": True},
            },
        },
    }
}
get_log_model_config = {
    "json_schema_extra": {
        "examples": [
            {
                "log_name": "log-20250219-172527.html",
            }
        ]
    }
}
add_log_model_config = {
    "json_schema_extra": {
        "examples": [
            {
                "log_name": "log-20250219-172527.html",
                "log_data": '<!DOCTYPE html><html lang="en"><head>...etc',
            }
        ],
        "openapi_examples": {
            "single_log": {
                "summary": "Add a single log HTML",
                "description": "Provide the log file name (matching the output.xml alias) and the HTML content to store.",
                "value": {
                    "log_name": "log-20250219-172527.html",
                    "log_data": '<!DOCTYPE html><html lang="en"><head>...etc',
                },
            }
        },
    }
}
remove_log_model_config = {
    "json_schema_extra": {
        "examples": [
            {"log_name": "log-20250219-172527.html"},
            {"all": True},
        ],
        "openapi_examples": {
            "single_log": {
                "summary": "Remove a single log",
                "description": "Provide the log file name to delete it from the server log folder.",
                "value": {"log_name": "log-20250219-172527.html"},
            },
            "all": {
                "summary": "Remove all logs",
                "description": "Delete all log files from the server log folder. This is irreversible.",
                "value": {"all": True},
            },
        },
    }
}


class ResponseMessage(BaseModel):
    """The response message model for Adding or Removing runs from the database"""

    success: str
    message: str
    console: str
    model_config = response_message_model_config


class GetOutput(BaseModel):
    """The response model that is returned when getting outputs"""

    run_start: str
    name: str
    alias: str
    tags: str
    model_config = get_output_model_config


class AddOutput(BaseModel):
    """The model that has to be provided when trying to add outputs to the database"""

    output_path: Optional[str] = None
    output_data: Optional[str] = None
    output_folder_path: Optional[str] = None
    output_tags: Optional[List[str]] = None
    output_alias: Optional[str] = None
    output_version: Optional[str] = None
    model_config = add_output_model_config


class RemoveOutputs(BaseModel):
    """The model that has to be provided when trying to delete outputs from the database"""

    run_starts: Optional[List[str]] = None
    indexes: Optional[List[str]] = None
    aliases: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    all: Optional[bool] = False
    limit: Optional[int] = None
    model_config = remove_outputs_model_config


class GetLog(BaseModel):
    """The response model that is returned when getting logs"""

    log_name: str
    model_config = get_log_model_config


class AddLog(BaseModel):
    """The model to add log files to the server"""

    log_data: str
    log_name: str
    model_config = add_log_model_config


class RemoveLog(BaseModel):
    """The model to remove log files from the server"""

    log_name: Optional[str] = None
    all: Optional[bool] = False
    model_config = remove_log_model_config


class ApiServer:
    """Robot Dashboard server implementation, this class handles the admin page and all functions related to the server"""

    def __init__(
        self,
        server_host: str,
        server_port: int,
        server_user: str,
        server_pass: str,
        offline_dependencies: bool,
        no_autoupdate: bool = False,
    ):
        """Init function that starts up the fastapi app and initializes all the vars and endpoints"""
        self.app = FastAPIOffline(
            title="Robot Framework Dashboard Server", version=__version__
        )
        self.security = HTTPBasic()
        self.robotdashboard: RobotDashboard
        self.server_host = server_host
        self.server_port = server_port
        self.server_user = server_user
        self.server_pass = server_pass
        self.offline = offline_dependencies
        self.no_autoupdate = no_autoupdate
        self.log_dir = "robot_logs"
        self.latest_log_dir = None

        self._setup_routes()
        self._setup_catch_all_route()

    def _get_admin_page(self):
        admin_file = join(dirname(abspath(__file__)), "./templates", "admin.html")
        admin_html = open(admin_file, "r").read()
        admin_html = admin_html.replace(
            "<!-- placeholder_refresh_card_visibility -->",
            "" if self.no_autoupdate else "hidden",
        )
        admin_html = admin_html.replace(
            "<!-- placeholder_noautoupdate -->",
            "true" if self.no_autoupdate else "false",
        )
        dependency_processor = DependencyProcessor(admin_page=True)
        admin_html = admin_html.replace(
            "<!-- placeholder_javascript -->", dependency_processor.get_js_block()
        )
        admin_html = admin_html.replace(
            "<!-- placeholder_css -->", dependency_processor.get_css_block()
        )
        admin_html = admin_html.replace(
            "<!-- placeholder_dependencies -->",
            dependency_processor.get_dependencies_block(self.offline),
        )
        admin_html = admin_html.replace('"placeholder_version"', __version__)
        return admin_html

    def _setup_routes(self):
        def model_examples(model_cls: BaseModel):
            cfg = getattr(model_cls, "model_config", None)
            extra = cfg.get("json_schema_extra")
            openapi_examples = extra.get("openapi_examples")
            return openapi_examples

        def authenticate(credentials: HTTPBasicCredentials = Depends(self.security)):
            if not self.server_user or not self.server_pass:
                return "anonymous"
            correct_username = compare_digest(credentials.username, self.server_user)
            correct_password = compare_digest(credentials.password, self.server_pass)
            if not (correct_username and correct_password):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid authentication credentials",
                    headers={"WWW-Authenticate": "Basic"},
                )
            return credentials.username

        if not self.server_user or not self.server_pass:

            @self.app.get("/admin", response_class=HTMLResponse, include_in_schema=False)
            async def admin_page():
                """Admin page endpoint function"""
                return self._get_admin_page()

        else:

            @self.app.get("/admin", response_class=HTMLResponse, include_in_schema=False)
            async def admin_page(username: str = Depends(authenticate)):
                """Admin page endpoint function"""
                return self._get_admin_page()

        @self.app.get(
            "/", response_class=HTMLResponse, include_in_schema=False
        )
        async def dashboard_page():
            """Serve robotdashboard HTML endpoint function"""
            robot_dashboard_html = open("robot_dashboard.html", "r", encoding="utf-8").read()
            return robot_dashboard_html

        @self.app.post("/refresh-dashboard")
        async def refresh_dashboard() -> ResponseMessage:
            """Manually trigger regeneration of the dashboard HTML"""
            console = "no console output"
            try:
                console = self.robotdashboard.create_dashboard()
                response = {
                    "success": "1",
                    "message": "SUCCESS: Dashboard refreshed successfully!",
                    "console": console,
                }
            except Exception as error:
                message = f"Something went wrong while refreshing the dashboard, ERROR: {error}"
                response = {"success": "0", "message": message, "console": console}
            return response

        @self.app.get("/log", response_class=HTMLResponse, include_in_schema=False)
        async def log_page(path: str):
            """Serve log HTML and store the log directory for resources."""
            try:
                log_path = Path(path).resolve()
                log_html = log_path.read_text(encoding="utf-8")
                self.latest_log_dir = log_path.parent

            except Exception:
                log_html = f"""<!DOCTYPE html>
                    <html lang="en">
                        <head><meta charset="UTF-8"><title>404 - File Not Found</title></head>
                        <body>
                            <h1>404 - File Not Found</h1>
                            <p>The file you are looking for ({path}) could not be found on the server!</p>
                        </body>
                    </html>
                """
            return HTMLResponse(content=log_html)

        @self.app.get("/get-outputs")
        async def get_outputs() -> List[GetOutput]:
            """Get a list of dictionaries containting the runs (run_starts) and names of the runs
            currently available in the database"""
            runs, names, aliases, tags = self.robotdashboard.get_runs()
            outputs = []
            for run, name, alias, tag in zip(runs, names, aliases, tags):
                outputs.append(
                    {
                        "run_start": str(run),
                        "name": str(name),
                        "alias": str(alias),
                        "tags": str(tag),
                    }
                )
            return outputs

        @self.app.post("/add-outputs")
        async def add_output_to_database(
            add_output: AddOutput = Body(
                ...,
                openapi_examples=model_examples(AddOutput),
            ),
        ) -> ResponseMessage:
            """Add output to database endpoint function
            The following combinations of parameters are valid:
            1. output_path: str valid path to output.xml (+ optional 'output_tags: List[str]' or optional 'output_version: str' version)
            2. output_data: str output.xml content (+ optional 'output_tags: List[str]', optional 'output_alias: str` or optional 'output_version: str' version)
            3. output_folder_path: str valid path to folder (subfolders are also searched) that contain *output*.xml (+ optional 'output_tags: List[str]' or optional 'output_version: str' version)
            """
            input = "provided input, overwritten on runtime"
            console = "no console output"
            try:
                if (
                    (
                        add_output.output_path != None
                        and add_output.output_folder_path != None
                    )
                    or (
                        add_output.output_path != None
                        and add_output.output_data != None
                    )
                    or (
                        add_output.output_data != None
                        and add_output.output_folder_path != None
                    )
                ):
                    input = "your input"
                    raise Exception(
                        "Please only provide output_path, output_data or output_folder_path, not more than 1 type at the same time!"
                    )
                output_tags = []
                if add_output.output_tags:
                    output_tags = add_output.output_tags
                if add_output.output_version:
                    self.robotdashboard.project_version = add_output.output_version
                else:
                    self.robotdashboard.project_version = None
                if add_output.output_path != None:
                    input = add_output.output_path
                    outputs = [[add_output.output_path, output_tags]]
                    console = self.robotdashboard.process_outputs(
                        output_file_info_list=outputs
                    )
                if add_output.output_folder_path != None:
                    input = add_output.output_folder_path
                    output_folder_paths = [
                        [
                            add_output.output_folder_path,
                            output_tags,
                        ]
                    ]
                    console = self.robotdashboard.process_outputs(
                        output_folder_configs=output_folder_paths
                    )
                if add_output.output_data != None:
                    input = ""
                    if add_output.output_alias != None:
                        input = f"{add_output.output_alias}.xml"
                        file = open(input, "w", encoding="utf-8")
                        output_path = abspath(input)
                    else:
                        input = "temp_output.xml"
                        file = open(input, "w", encoding="utf-8")
                        output_path = abspath(input)
                    file.write(add_output.output_data)
                    file.close()
                    outputs = [[output_path, output_tags]]
                    console = self.robotdashboard.process_outputs(
                        output_file_info_list=outputs
                    )
                    remove(input)
                if not self.no_autoupdate:
                    console += self.robotdashboard.create_dashboard()
                response = {
                    "success": "1",
                    "message": f"SUCCESS: processed {input}, see the browser console for more details!",
                    "console": console,
                }
            except Exception as error:
                message = f"Something went wrong while processing {input}, ERROR: {error}, see the browser console for more details!"
                response = {"success": "0", "message": message, "console": console}
            return response

        @self.app.post("/add-output-file")
        async def add_output_file(
            file: UploadFile = File(...),
            tags: str = Form(default=""),
            version: str = Form(default=""),
        ) -> ResponseMessage:
            """Add output file to database endpoint function
            The tags parameter should be provided as colon-separated values (e.g., 'tag1:tag2:tag3')
            The version parameter is an optional string to label the run (e.g., software version)
            """
            console = "no console output"
            try:
                file_bytes = await file.read()
                # Accept gzipped uploads to reduce bandwidth; decompress before processing
                if file.filename.endswith(".gzip") or file.filename.endswith(".gz"):
                    output_filename = Path(file.filename).with_suffix("")
                    if output_filename.suffix == "":
                        output_filename = output_filename.with_suffix(".xml")
                    output_path = abspath(output_filename)
                    with open(output_path, "wb") as buffer:
                        buffer.write(decompress(file_bytes))
                else:
                    output_path = abspath(file.filename)
                    with open(output_path, "wb") as buffer:
                        buffer.write(file_bytes)

                output_tags = []
                if tags:
                    output_tags = tags.split(":")

                if version:
                    self.robotdashboard.project_version = version
                else:
                    self.robotdashboard.project_version = None

                outputs = [[output_path, output_tags]]
                console = self.robotdashboard.process_outputs(
                    output_file_info_list=outputs
                )
                remove(output_path)

                if not self.no_autoupdate:
                    console += self.robotdashboard.create_dashboard()
                response = {
                    "success": "1",
                    "message": f"SUCCESS: processed {file.filename}, see the browser console for more details!",
                    "console": console,
                }
            except Exception as error:
                message = f"Something went wrong while processing {file.filename}, ERROR: {error}, see the browser console for more details!"
                response = {"success": "0", "message": message, "console": console}
            return response

        @self.app.delete("/remove-outputs")
        async def remove_outputs_from_database(
            remove_output: RemoveOutputs = Body(
                ...,
                openapi_examples=model_examples(RemoveOutputs),
            ),
        ) -> ResponseMessage:
            """Remove outputs from database endpoint function
            Can be either indexes or run_starts that are known in the database
            """
            console = "no console output"
            try:
                # Because the argparser makes use of the format: [[outputtoremove1], [outputtoremove2]]
                # We have to create a list of lists with 1 item to match the handling of the API
                remove_runs = []
                # Handle 'all' flag: when True, delete all outputs; when False, do nothing special
                if remove_output.all:
                    runs, _, _, _ = self.robotdashboard.get_runs()
                    if len(runs) > 0:
                        # Use index range to remove all runs efficiently
                        remove_runs = [f"index=0:{len(runs) - 1}"]
                else:
                    if remove_output.run_starts != None:
                        for run in remove_output.run_starts:
                            remove_runs.append(f"run_start={run}")
                    if remove_output.indexes != None:
                        for run in remove_output.indexes:
                            remove_runs.append(f"index={run}")
                    if remove_output.aliases != None:
                        for run in remove_output.aliases:
                            remove_runs.append(f"alias={run}")
                    if remove_output.tags != None:
                        for run in remove_output.tags:
                            remove_runs.append(f"tag={run}")
                    if remove_output.limit != None:
                        remove_runs.append(f"limit={remove_output.limit}")
                paths_before = self.robotdashboard.get_run_paths()
                console = self.robotdashboard.remove_outputs(remove_runs)
                paths_after = self.robotdashboard.get_run_paths()
                removed_paths = [v for k, v in paths_before.items() if k not in paths_after and v]
                for path in removed_paths:
                    log_filename = Path(path).name.replace("output", "log").replace(".xml", ".html")
                    log_path = join(self.log_dir, log_filename)
                    if exists(log_path):
                        remove(log_path)
                        console += f"  Removed log file: {log_filename}\n"
                    else:
                        console += f"  No log file found for removed output (expected: {log_path}), skipping\n"
                if not self.no_autoupdate:
                    console += self.robotdashboard.create_dashboard()
                response = {
                    "success": "1",
                    "message": f"SUCCESS: processed {remove_output}, see the browser console for more details!",
                    "console": console,
                }
            except Exception as error:
                message = f"Something went wrong while processing {remove_output}, ERROR: {error}, see the browser console for more details!"
                response = {"success": "0", "message": message, "console": console}
            return response

        @self.app.get("/get-logs")
        async def get_logs() -> List[GetLog]:
            """Get a list containing the log file names currently available on the server"""
            logs = listdir(self.log_dir) if exists(self.log_dir) else []
            log_names = [
                {
                    "log_name": str(log_name),
                }
                for log_name in logs
            ]
            return log_names

        @self.app.post("/add-log")
        async def add_log(
            add_log: AddLog = Body(
                ...,
                openapi_examples=model_examples(AddLog),
            ),
        ) -> ResponseMessage:
            """Adds the log file to a folder and updates the database for the required output
            IMPORTANT! The log_name that is provided should be similar to the output.xml that has been uploaded
            If you added 'output-123.xml' then the log should be 'log-123.html', otherwise the database won't update correctly!
            """
            console = ""
            try:
                if not exists(self.log_dir):
                    mkdir(self.log_dir)
                log_path = join(self.log_dir, add_log.log_name)
                console += self.robotdashboard.update_output_path(log_path)
                if "ERROR" in console:
                    raise Exception(
                        "A problem occurred while adding the log file, check the console message!"
                    )
                console += "======================================================================================\n"
                log_file = open(log_path, "w", encoding="utf-8")
                log_file.write(add_log.log_data)
                log_file.close()
                console += f"Added {add_log.log_name} to the folder {self.log_dir}\n"
                console += "======================================================================================\n"
                if not self.no_autoupdate:
                    console += self.robotdashboard.create_dashboard()
                if "ERROR" in console:
                    raise Exception(
                        "A problem occurred while adding the log file, check the console message!"
                    )
            except Exception as error:
                response = {
                    "success": "0",
                    "message": f"ERROR: something went wrong while adding the log file or updating the database: {error}",
                    "console": console,
                }
                return response
            response = {
                "success": "1",
                "message": f"SUCCESS: the log file has been placed and the database was updated",
                "console": console,
            }
            return response
        
        @self.app.post("/add-log-file")
        async def add_log_file(
            file: UploadFile = File(...),
        ) -> ResponseMessage:
            """Add log file to server endpoint function
            The log file name should match the output.xml alias (e.g., 'log-alias.html' for 'output-alias.xml')
            """
            console = ""
            try:
                if not exists(self.log_dir):
                    mkdir(self.log_dir)
                file_bytes = await file.read()
                # Accept gzipped uploads (.gz/.gzip) to reduce bandwidth; decompress before saving
                if file.filename.endswith(".gzip") or file.filename.endswith(".gz"):
                    log_filename = Path(file.filename).with_suffix("")
                    if log_filename.suffix == "":
                        log_filename = log_filename.with_suffix(".html")
                    log_path = abspath(join(self.log_dir, log_filename.name))
                    with open(log_path, "wb") as buffer:
                        buffer.write(decompress(file_bytes))
                else:
                    log_path = abspath(join(self.log_dir, file.filename))
                    with open(log_path, "wb") as buffer:
                        buffer.write(file_bytes)

                console += self.robotdashboard.update_output_path(log_path)
                if "ERROR" in console:
                    raise Exception(
                        "A problem occurred while adding the log file, check the console message!"
                    )
                console += "======================================================================================\n"
                console += f"Added {file.filename} to the folder {self.log_dir}\n"
                console += "======================================================================================\n"
                if not self.no_autoupdate:
                    console += self.robotdashboard.create_dashboard()
                if "ERROR" in console:
                    raise Exception(
                        "A problem occurred while adding the log file, check the console message!"
                    )
            except Exception as error:
                response = {
                    "success": "0",
                    "message": f"ERROR: something went wrong while adding the log file or updating the database: {error}",
                    "console": console,
                }
                return response
            response = {
                "success": "1",
                "message": f"SUCCESS: the log file has been placed and the database was updated",
                "console": console,
            }
            return response

        @self.app.delete("/remove-log")
        async def remove_log(
            remove_log: RemoveLog = Body(
                ...,
                openapi_examples=model_examples(RemoveLog),
            )
        ) -> ResponseMessage:
            """Removes the log file from the folder on the server"""
            console = ""
            try:
                if remove_log.all:
                    if not exists(self.log_dir):
                        console += f"SUCCESS: No logs to remove on the server\n"
                        response = {
                            "success": "1",
                            "message": f"SUCCESS: the log file(s) has been removed from the local folder",
                            "console": console,
                        }
                        return response
                    for file in listdir(self.log_dir):
                        remove(join(self.log_dir, file))
                        console += f"Removed {file} from the folder {self.log_dir}\n"
                else:
                    log_path = join(self.log_dir, remove_log.log_name)
                    remove(log_path)
                    console += f"Removed {remove_log.log_name} from the folder {self.log_dir}\n"
                console += "======================================================================================\n"
                if not self.no_autoupdate:
                    console += self.robotdashboard.create_dashboard()
            except Exception as error:
                response = {
                    "success": "0",
                    "message": f"ERROR: something went wrong while removing the log file: {error}",
                    "console": console,
                }
                return response
            response = {
                "success": "1",
                "message": f"SUCCESS: the log file(s) has been removed from the local folder",
                "console": console,
            }
            return response

    def _setup_catch_all_route(self):
        """Catch-all route for any resource after all other routes
        This will try to resolve based on screenshots that are relative to the log files
        If it doesn't find any matching file nothing will happen"""

        @self.app.get("/{full_path:path}", include_in_schema=False)
        async def catch_all(full_path: str):
            if self.latest_log_dir is None:
                raise HTTPException(404, "No log file opened yet")

            resource_path = (self.latest_log_dir / full_path).resolve()
            if not str(resource_path).startswith(str(self.latest_log_dir)):
                raise HTTPException(403, "Access denied")

            if not resource_path.exists():
                raise HTTPException(404, f"Resource {full_path} not found")

            return FileResponse(resource_path)

    def set_robotdashboard(self, robotdashboard: RobotDashboard):
        """Function to initialize the RobotDashboard class"""
        self.robotdashboard = robotdashboard

    def run(self):
        """Function to start up the FastAPI server through uvicorn"""
        run(self.app, host=self.server_host, port=self.server_port)
