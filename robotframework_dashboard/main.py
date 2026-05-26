from .arguments import ArgumentParser
from .robotdashboard import RobotDashboard
from .cli_output import console, print_banner
from .version import __version__
from sys import exit


def main():
    """Main function that runs robotdashboard. Everything is orchestrated from here!"""
    print_banner(__version__)
    arguments = ArgumentParser().get_arguments()
    robotdashboard = RobotDashboard(
        arguments.database_path,
        arguments.generate_dashboard,
        arguments.dashboard_name,
        arguments.generation_datetime,
        arguments.list_runs,
        arguments.dashboard_title,
        arguments.database_class,
        arguments.json_config,
        arguments.message_config,
        arguments.quantity,
        arguments.use_logs,
        arguments.offline_dependencies,
        arguments.force_json_config,
        arguments.project_version,
        arguments.no_vacuum,
        arguments.no_autoupdate,
        arguments.timezone,
        arguments.log_url,
        arguments.custom_filters,
    )
    # If arguments.start_server is provided override some required args
    if arguments.start_server:
        try:
            from robotframework_dashboard.server import ApiServer
            import python_multipart
        except ModuleNotFoundError:
            console.print(
                "  [bold red]\u2717[/bold red]  [red]The packages 'fastapi-offline', 'uvicorn' and 'python_multipart' are required to run the server![/red]"
            )
            console.print(
                "     Please install them using  [cyan]pip install robotframework-dashboard\\[server][/cyan]"
            )
            console.print(
                "     Or                         [cyan]pip install robotframework-dashboard\\[all][/cyan]"
            )
            exit(0)
        robotdashboard.dashboard_name = "robot_dashboard.html"
        robotdashboard.dashboard_title = (
            "Robot Framework Dashboard"
            if arguments.dashboard_title == ""
            else arguments.dashboard_title
        )
        robotdashboard.generate_dashboard = True
        robotdashboard.server = True
    # 1. Database preparation
    robotdashboard.initialize_database(suppress=False)
    # 2. Processing output XML(s)
    robotdashboard.process_outputs(
        output_file_info_list=arguments.outputs,
        output_folder_configs=arguments.output_folder_paths,
    )
    # 3. Listing all available runs in the database
    robotdashboard.print_runs()
    # 4. Removing runs from the database
    robotdashboard.remove_outputs(remove_runs=arguments.remove_runs)
    # 5. Creating dashboard HTML
    robotdashboard.create_dashboard()
    # If required start the server, this will happen after the first normal run
    if arguments.start_server:
        server = ApiServer(
            arguments.server_host,
            arguments.server_port,
            arguments.server_user,
            arguments.server_pass,
            arguments.offline_dependencies,
            arguments.no_autoupdate,
            arguments.ssl_certfile,
            arguments.ssl_keyfile,
        )
        server.set_robotdashboard(robotdashboard)
        server.run()


if __name__ == "__main__":  # pragma: no cover
    main()
