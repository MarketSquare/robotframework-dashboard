from .processors import OutputProcessor
from .database import DatabaseProcessor
from .dashboard import DashboardGenerator
from os.path import basename, exists, join, abspath
from os import walk, getcwd
from time import time
from pathlib import Path
from datetime import datetime


class RobotDashboard:
    """Class that provides all functionality that robotdashboard has to offer
    Is used in the 'normal' mode when just using the cli directly and in the 'server' mode continuously
    """

    def __init__(
        self,
        database_path: Path,
        generate_dashboard: bool,
        dashboard_name: Path,
        generation_datetime: datetime,
        list_runs: bool,
        dashboard_title: str,
        database_class: Path,
        json_config: str,
        message_config: list,
        quantity: int,
        use_logs: bool,
        offline_dependencies: bool,
        force_json_config: bool,
        project_version: str,
        no_vacuum: bool,
        timezone: str = "",
    ):
        """Sets the parameters provided in the command line"""
        self.database_path = database_path
        self.generate_dashboard = generate_dashboard
        self.dashboard_name = dashboard_name
        self.generation_datetime = generation_datetime
        self.list_runs = list_runs
        self.dashboard_title = dashboard_title
        self.database_class = database_class
        self.json_config = json_config
        self.message_config = message_config
        self.quantity = quantity
        self.use_logs = use_logs
        self.offline_dependencies = offline_dependencies
        self.force_json_config = force_json_config
        self.server = False
        self.database = None
        self.project_version = project_version
        self.no_vacuum = no_vacuum
        self.timezone = timezone

    def initialize_database(self, suppress=True):
        """Function that initializes the database if it does not exist
        Also makes a connection that is used internally in the RobotDashboard class functions
        """
        console = ""
        if not suppress:
            console += self._print_console(f" 1. Database preparation")
        if not self.database_class:
            self.database = DatabaseProcessor(self.database_path)
        else:
            if not suppress:
                console += self._print_console(
                    f"  using provided databaseclass: {self.database_class}"
                )
            import importlib.util

            spec = importlib.util.spec_from_file_location(
                "DatabaseProcessor", self.database_class
            )
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            self.database = module.DatabaseProcessor(self.database_path)
        if not suppress:
            console += self._print_console(
                f"  created database: '{self.database_path}'"
            )
        if not suppress:
            console += self._print_console(
                "======================================================================================"
            )
        return console

    def process_outputs(self, output_file_info_list=None, output_folder_configs=None):
        """Function that processes output XML files and inserts the data into the database.

        Parameters:
            output_file_info_list (list of tuples): Each tuple contains (file_path, tags).
            output_folder_config (tuple): (folder_path, tags)
        """
        self.database.open_database()
        console = self._print_console(" 2. Processing output XML(s)")

        if not output_file_info_list and not output_folder_configs:
            console += self._print_console("  skipping step")
            console += self._print_console("=" * 86)
            self.database.close_database()
            return console

        if output_file_info_list:
            for file_path, tags in output_file_info_list:
                try:
                    full_path = join(getcwd(), file_path)
                    run_alias = (
                        basename(full_path).replace("output_", "").replace(".xml", "")
                    )
                    console += self._process_single_output(full_path, tags, run_alias)
                except Exception as e:
                    console += self._print_console(
                        f"  ERROR: Could not process output XML '{file_path}', error: {e}"
                    )

        if output_folder_configs:
            for output_folder_config in output_folder_configs:
                folder_path, tags = output_folder_config
                if not exists(folder_path):
                    console += self._print_console(
                        f"  ERROR: Could not process output folder '{folder_path}', path does not exist!"
                    )
                else:
                    for subdir, _, files in walk(folder_path):
                        files.sort()
                        for file in files:
                            if "output" in file and file.endswith(".xml"):
                                try:
                                    full_path = join(getcwd(), subdir, file)
                                    run_alias = file.replace("output_", "").replace(
                                        ".xml", ""
                                    )
                                    console += self._process_single_output(
                                        full_path, tags, run_alias
                                    )
                                except Exception as e:
                                    console += self._print_console(
                                        f"  ERROR: Could not process found output file '{file}', error: {e}"
                                    )

        console += self._print_console("=" * 86)
        self.database.close_database()
        return console

    def _process_single_output(self, output_path, tags, run_alias=None):
        """Function that processes a single XML output file and inserts it into the database."""
        output_basename = basename(output_path)
        start = time()
        console = self._print_console(f"  Processing output XML '{output_basename}'")

        outputProcessor = OutputProcessor(output_path)
        run_start = outputProcessor.get_run_start()
        project_version = next(
            (tag.removeprefix("version_") for tag in tags if tag.startswith("version_")),
                self.project_version
            )
        if not self.database.run_start_exists(run_start):
            output_data = outputProcessor.get_output_data()
            self.database.insert_output_data(output_data, tags, run_alias, output_path, project_version, self.timezone)

            end = time()
            console += self._print_console(
                f"  Processed output XML '{output_basename}' in {round(end - start, 2)} seconds"
            )
            return console
        else:
            console += self._print_console(
                f"   ERROR: you are trying to add the same output again, run_start: {run_start}, output: {output_basename}"
            )
            return console

    def print_runs(self):
        """Function that prints the runs currently in the database to the console"""
        console = ""
        if self.list_runs:
            console += self._print_console(
                f" 3. Listing all available runs in the database"
            )
            self.database.open_database()
            self.database.list_runs()
            self.database.close_database()
        else:
            console += self._print_console(
                f" 3. Listing all available runs in the database\n  skipping step"
            )
        console += self._print_console(
            "======================================================================================"
        )
        return console

    def get_runs(self):
        """Function that gets the runs and corresponding names from the database"""
        self.database.open_database()
        runs, names, aliases, tags = self.database._get_runs()
        self.database.close_database()
        return runs, names, aliases, tags

    def remove_outputs(self, remove_runs=None):
        """Function that removes the remove_runs that were set when instantiating the RobotDashboard class"""
        console = ""
        if remove_runs != None:
            console += self._print_console(f" 4. Removing runs from the database")
            self.database.open_database()
            console += self.database.remove_runs(remove_runs)
            if not self.no_vacuum:
                console += self.database.vacuum_database()
            self.database.close_database()
        else:
            console += self._print_console(
                f" 4. Removing runs from the database\n  skipping step"
            )
        console += self._print_console(
            "======================================================================================"
        )
        return console

    def create_dashboard(self):
        """Function that creates the dashboard HTML"""
        console = ""
        if self.generate_dashboard:
            start = time()
            console += self._print_console(f" 5. Creating dashboard HTML")
            self.database.open_database()
            dashboard_data = self.database.get_data()
            self.database.close_database()
            DashboardGenerator().generate_dashboard(
                self.dashboard_name,
                dashboard_data,
                self.generation_datetime,
                self.dashboard_title,
                self.server,
                self.json_config,
                self.message_config,
                self.quantity,
                self.use_logs,
                self.offline_dependencies,
                self.force_json_config,
            )
            end = time()
            console += self._print_console(
                f"  created dashboard '{abspath(self.dashboard_name)}' in {round(end-start, 2)} seconds"
            )
        else:
            console += self._print_console(
                " 5. Creating dashboard HTML\n  skipping step"
            )
        return console

    def update_output_path(self, log_path):
        """Function to update the output_path using the log path that the server has used"""
        self.database.open_database()
        console = self.database.update_output_path(log_path)
        self.database.close_database()
        return console

    def _print_console(self, message):
        print(message)
        return message + "\n"
