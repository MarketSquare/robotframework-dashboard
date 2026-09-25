from fastapi import Body, Depends, File, Form, UploadFile

from os.path import abspath, exists, join
from os import remove
from gzip import decompress
from pathlib import Path
from typing import List

from .server_models import (
    AddOutput,
    GetOutput,
    RemoveOutputs,
    ResponseMessage,
    model_examples,
)


def register_output_routes(server, authenticate):
    """Register every /…-output(s) endpoint on the server's FastAPI app"""
    app = server.app

    @app.get("/get-outputs")
    async def get_outputs() -> List[GetOutput]:
        """Get a list of dictionaries containting the runs (run_starts) and names of the runs
        currently available in the database"""
        runs, names, aliases, tags, custom_filters = server.robotdashboard.get_runs()
        outputs = []
        for run, name, alias, tag, cf in zip(runs, names, aliases, tags, custom_filters):
            outputs.append(
                {
                    "run_start": str(run),
                    "name": str(name),
                    "alias": str(alias),
                    "tags": str(tag),
                    "custom_filters": str(cf),
                }
            )
        return outputs

    @app.post("/add-outputs")
    async def add_output_to_database(
        add_output: AddOutput = Body(
            ...,
            openapi_examples=model_examples(AddOutput),
        ),
        username: str = Depends(authenticate),
    ) -> ResponseMessage:
        """Add output to database endpoint function
        The following combinations of parameters are valid:
        1. output_path: str valid path to output.xml (+ optional 'output_tags: List[str]' or optional 'output_version: str' version)
        2. output_data: str output.xml content (+ optional 'output_tags: List[str]', optional 'output_alias: str` or optional 'output_version: str' version)
        3. output_folder_path: str valid path to folder (subfolders are also searched) that contain *output*.xml (+ optional 'output_tags: List[str]' or optional 'output_version: str' version)
        'output_log_url' is optional on all 3 combinations and mirrors the CLI '--logurl' flag: it stores a link to an
        externally hosted log instead of the local output path. Use the '{run_alias}' placeholder when the request may
        process more than one output (e.g. via 'output_folder_path'), otherwise every run would be stored with the
        same URL.
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
            if (
                add_output.output_log_url
                and "{run_alias}" not in add_output.output_log_url
                and add_output.output_folder_path != None
            ):
                input = "your input"
                raise Exception(
                    "'output_log_url' was provided without a '{run_alias}' placeholder while processing an output_folder_path "
                    "(potentially multiple outputs). Either add '{run_alias}' to the URL template or provide a single output "
                    "via 'output_path' or 'output_data'."
                )
            output_tags = []
            if add_output.output_tags:
                output_tags = add_output.output_tags
            if add_output.output_version:
                server.robotdashboard.project_version = add_output.output_version
            else:
                server.robotdashboard.project_version = None
            server.robotdashboard.log_url = add_output.output_log_url or None
            server.robotdashboard.custom_filters = add_output.output_custom_filters
            if add_output.output_path != None:
                input = add_output.output_path
                outputs = [[add_output.output_path, output_tags]]
                console = server.robotdashboard.process_outputs(
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
                console = server.robotdashboard.process_outputs(
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
                console = server.robotdashboard.process_outputs(
                    output_file_info_list=outputs
                )
                remove(input)
            if not server.no_autoupdate:
                console += server.robotdashboard.create_dashboard()
            response = {
                "success": "1",
                "message": f"SUCCESS: processed {input}, see the browser console for more details!",
                "console": console,
            }
        except Exception as error:
            message = f"Something went wrong while processing {input}, ERROR: {error}, see the browser console for more details!"
            response = {"success": "0", "message": message, "console": console}
        return response

    @app.post("/add-output-file")
    async def add_output_file(
        file: UploadFile = File(...),
        tags: str = Form(default=""),
        version: str = Form(default=""),
        custom_filters: str = Form(default=""),
        log_url: str = Form(default=""),
        username: str = Depends(authenticate),
    ) -> ResponseMessage:
        """Add output file to database endpoint function
        The tags parameter should be provided as colon-separated values (e.g., 'tag1:tag2:tag3')
        The version parameter is an optional string to label the run (e.g., software version)
        The log_url parameter is optional and mirrors the CLI '--logurl' flag: it stores a link to an externally
        hosted log instead of the local output path. Since this endpoint always processes a single output file,
        the '{run_alias}' placeholder is optional here.
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
                server.robotdashboard.project_version = version
            else:
                server.robotdashboard.project_version = None

            server.robotdashboard.custom_filters = custom_filters
            server.robotdashboard.log_url = log_url or None

            outputs = [[output_path, output_tags]]
            console = server.robotdashboard.process_outputs(
                output_file_info_list=outputs
            )
            remove(output_path)

            if not server.no_autoupdate:
                console += server.robotdashboard.create_dashboard()
            response = {
                "success": "1",
                "message": f"SUCCESS: processed {file.filename}, see the browser console for more details!",
                "console": console,
            }
        except Exception as error:
            message = f"Something went wrong while processing {file.filename}, ERROR: {error}, see the browser console for more details!"
            response = {"success": "0", "message": message, "console": console}
        return response

    @app.delete("/remove-outputs")
    async def remove_outputs_from_database(
        remove_output: RemoveOutputs = Body(
            ...,
            openapi_examples=model_examples(RemoveOutputs),
        ),
        username: str = Depends(authenticate),
    ) -> ResponseMessage:
        """Remove outputs from database endpoint function
        Can be either indexes or run_starts that are known in the database
        """
        console = "no console output"
        try:
            # Because the argparser makes use of the format: [[outputtoremove1], [outputtoremove2]]
            # We have to create a list of lists with 1 item to match the handling of the API
            remove_runs = []
            if remove_output.all:
                runs, _, _, _, _ = server.robotdashboard.get_runs()
                if len(runs) > 0:
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
                # When tags are combined with limit, scope the limit to the
                # tagged runs (keep/remove only matching runs, leave others
                # alone) instead of removing all tagged runs outright.
                scope_tags = remove_output.tags != None and remove_output.limit != None
                tag_suffix = (
                    "".join(f";tag={tag}" for tag in remove_output.tags)
                    if scope_tags
                    else ""
                )
                if remove_output.tags != None and not scope_tags:
                    for run in remove_output.tags:
                        remove_runs.append(f"tag={run}")
                if remove_output.age != None:
                    remove_runs.append(f"age={remove_output.age}")
                if remove_output.limit != None:
                    remove_runs.append(f"limit={remove_output.limit}{tag_suffix}")
            paths_before = server.robotdashboard.get_run_paths()
            console = server.robotdashboard.remove_outputs(remove_runs)
            paths_after = server.robotdashboard.get_run_paths()
            removed_paths = [v for k, v in paths_before.items() if k not in paths_after and v]
            for path in removed_paths:
                log_filename = Path(path).name.replace("output", "log").replace(".xml", ".html")
                log_path = join(server.log_dir, log_filename)
                if exists(log_path):
                    remove(log_path)
                    console += f"  Removed log file: {log_filename}\n"
                else:
                    console += f"  No log file found for removed output (expected: {log_path}), skipping\n"
            if not server.no_autoupdate:
                console += server.robotdashboard.create_dashboard()
            response = {
                "success": "1",
                "message": f"SUCCESS: processed {remove_output}, see the browser console for more details!",
                "console": console,
            }
        except Exception as error:
            message = f"Something went wrong while processing {remove_output}, ERROR: {error}, see the browser console for more details!"
            response = {"success": "0", "message": message, "console": console}
        return response
