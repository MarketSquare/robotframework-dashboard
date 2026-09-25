from pydantic import BaseModel, Field
from typing import List, Optional


def model_examples(model_cls: BaseModel):
    """Pull the openapi_examples out of a model's config so a route can pass them to Body()"""
    cfg = getattr(model_cls, "model_config", None)
    extra = cfg.get("json_schema_extra")
    openapi_examples = extra.get("openapi_examples")
    return openapi_examples


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
            "output_with_log_url": {
                "summary": "Add an output with an externally hosted log URL",
                "description": "Provide an output.xml path along with 'output_log_url' to store a link to a log already hosted elsewhere (e.g., a CI artifact or cloud storage URL) instead of a local log file. Use the '{run_alias}' placeholder when processing multiple outputs (e.g. via 'output_folder_path') so each run gets its own URL.",
                "value": {
                    "output_path": "C:\\users\\docs\\output.xml",
                    "output_log_url": "https://ci.example.com/build42/log.html",
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
            {"limit": 10, "tags": ["nightly"]},
            {"age": "10d"},
            {"age": "-10d"},
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
            "age": {
                "summary": "Remove runs based on age threshold",
                "description": "Remove runs older than a threshold (e.g., '10d') or younger than a threshold (e.g., '-10d'). Supports (y)ear/(d)ay/(h)our/(m)inute/(s)econd.",
                "value": {"age": "10d"},
            },
            "limit": {
                "summary": "Remove all but the N most recent runs per project",
                "description": "Keep only the specified number of most recent runs per project, deleting the rest. A project is a run name and every 'project_' run tag, so a project that runs less often keeps its history.",
                "value": {"limit": 10},
            },
            "limit_by_tag": {
                "summary": "Keep N most recent runs per project within a tag",
                "description": "When 'tags' is combined with 'limit', the limit is scoped to runs matching any given tag: the N newest matching runs per project are kept, older matching runs are removed, and runs without those tags are left untouched.",
                "value": {"limit": 10, "tags": ["nightly"]},
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
    custom_filters: str
    model_config = get_output_model_config


class AddOutput(BaseModel):
    """The model that has to be provided when trying to add outputs to the database"""

    output_path: Optional[str] = None
    output_data: Optional[str] = None
    output_folder_path: Optional[str] = None
    output_tags: Optional[List[str]] = None
    output_alias: Optional[str] = None
    output_version: Optional[str] = None
    output_custom_filters: Optional[str] = None
    output_log_url: Optional[str] = None
    model_config = add_output_model_config


class RemoveOutputs(BaseModel):
    """The model that has to be provided when trying to delete outputs from the database"""

    run_starts: Optional[List[str]] = None
    indexes: Optional[List[str]] = None
    aliases: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    all: Optional[bool] = False
    limit: Optional[int] = Field(default=None, ge=1)
    age: Optional[str] = None
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
