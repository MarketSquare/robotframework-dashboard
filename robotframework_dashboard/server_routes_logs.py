from fastapi import Body, Depends, File, UploadFile

from os.path import abspath, exists, join
from os import listdir, mkdir, remove
from gzip import decompress
from pathlib import Path
from typing import List

from .server_models import AddLog, GetLog, RemoveLog, ResponseMessage, model_examples


def register_log_routes(server, authenticate):
    """Register every /…-log(s) endpoint on the server's FastAPI app"""
    app = server.app

    @app.get("/get-logs")
    async def get_logs() -> List[GetLog]:
        """Get a list containing the log file names currently available on the server"""
        logs = listdir(server.log_dir) if exists(server.log_dir) else []
        log_names = [
            {
                "log_name": str(log_name),
            }
            for log_name in logs
        ]
        return log_names

    @app.post("/add-log")
    async def add_log(
        add_log: AddLog = Body(
            ...,
            openapi_examples=model_examples(AddLog),
        ),
        username: str = Depends(authenticate),
    ) -> ResponseMessage:
        """Adds the log file to a folder and updates the database for the required output
        IMPORTANT! The log_name that is provided should be similar to the output.xml that has been uploaded
        If you added 'output-123.xml' then the log should be 'log-123.html', otherwise the database won't update correctly!
        """
        console = ""
        try:
            if not exists(server.log_dir):
                mkdir(server.log_dir)
            log_path = join(server.log_dir, add_log.log_name)
            console += server.robotdashboard.update_output_path(log_path)
            if "ERROR" in console:
                raise Exception(
                    "A problem occurred while adding the log file, check the console message!"
                )
            console += "======================================================================================\n"
            log_file = open(log_path, "w", encoding="utf-8")
            log_file.write(add_log.log_data)
            log_file.close()
            console += f"Added {add_log.log_name} to the folder {server.log_dir}\n"
            console += "======================================================================================\n"
            if not server.no_autoupdate:
                console += server.robotdashboard.create_dashboard()
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

    @app.post("/add-log-file")
    async def add_log_file(
        file: UploadFile = File(...),
        username: str = Depends(authenticate),
    ) -> ResponseMessage:
        """Add log file to server endpoint function
        The log file name should match the output.xml alias (e.g., 'log-alias.html' for 'output-alias.xml')

        Report files (filename containing 'report') are handled differently: reports are not tracked in the
        database, so no output-matching is attempted. The file is saved as-is and this endpoint only checks
        whether a corresponding 'log' file already exists next to it (so it can be reached via the link Robot
        Framework builds into log.html) and warns, rather than errors, if it does not.
        """
        console = ""
        try:
            if not exists(server.log_dir):
                mkdir(server.log_dir)
            file_bytes = await file.read()
            # Accept gzipped uploads (.gz/.gzip) to reduce bandwidth; decompress before saving
            if file.filename.endswith(".gzip") or file.filename.endswith(".gz"):
                log_filename = Path(file.filename).with_suffix("")
                if log_filename.suffix == "":
                    log_filename = log_filename.with_suffix(".html")
                log_path = abspath(join(server.log_dir, log_filename.name))
                with open(log_path, "wb") as buffer:
                    buffer.write(decompress(file_bytes))
            else:
                log_path = abspath(join(server.log_dir, file.filename))
                with open(log_path, "wb") as buffer:
                    buffer.write(file_bytes)

            log_name = Path(log_path).name
            is_report = "report" in log_name
            if is_report:
                expected_log_name = log_name.replace("report", "log")
                if exists(join(server.log_dir, expected_log_name)):
                    console += f"SUCCESS: matching log file '{expected_log_name}' found, the report is reachable from it.\n"
                else:
                    console += (
                        f"WARNING: no matching log file '{expected_log_name}' was found in '{server.log_dir}'. "
                        "The report has been saved but may not be reachable until a matching log is uploaded.\n"
                    )
            else:
                console += server.robotdashboard.update_output_path(log_path)
                if "ERROR" in console:
                    raise Exception(
                        "A problem occurred while adding the log file, check the console message!"
                    )
            console += "======================================================================================\n"
            console += f"Added {file.filename} to the folder {server.log_dir}\n"
            console += "======================================================================================\n"
            if not server.no_autoupdate:
                console += server.robotdashboard.create_dashboard()
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
            "message": (
                "SUCCESS: the report file has been placed"
                if is_report
                else "SUCCESS: the log file has been placed and the database was updated"
            ),
            "console": console,
        }
        return response

    @app.delete("/remove-log")
    async def remove_log(
        remove_log: RemoveLog = Body(
            ...,
            openapi_examples=model_examples(RemoveLog),
        ),
        username: str = Depends(authenticate),
    ) -> ResponseMessage:
        """Removes the log file from the folder on the server"""
        console = ""
        try:
            if remove_log.all:
                if not exists(server.log_dir):
                    console += f"SUCCESS: No logs to remove on the server\n"
                    response = {
                        "success": "1",
                        "message": f"SUCCESS: the log file(s) has been removed from the local folder",
                        "console": console,
                    }
                    return response
                for file in listdir(server.log_dir):
                    remove(join(server.log_dir, file))
                    console += f"Removed {file} from the folder {server.log_dir}\n"
            else:
                log_path = join(server.log_dir, remove_log.log_name)
                remove(log_path)
                console += f"Removed {remove_log.log_name} from the folder {server.log_dir}\n"
            console += "======================================================================================\n"
            if not server.no_autoupdate:
                console += server.robotdashboard.create_dashboard()
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
