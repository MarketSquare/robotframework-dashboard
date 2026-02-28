from .arguments import ArgumentParser
from .robotdashboard import RobotDashboard
from sys import exit


def main():
    """Main function that runs robotdashboard. Everything is orchestrated from here!"""
    print(
        "======================================================================================"
    )
    print(
        """ ____   ___  ____   ___ _____ ____    _    ____  _   _ ____   ___    _    ____  ____  
|  _ \\ / _ \\| __ ) / _ |_   _|  _ \\  / \\  / ___|| | | | __ ) / _ \\  / \\  |  _ \\|  _ \\ 
| |_) | | | |  _ \\| | | || | | | | |/ _ \\ \\___ \\| |_| |  _ \\| | | |/ _ \\ | |_) | | | |
|  _ <| |_| | |_) | |_| || | | |_| / ___ \\ ___) |  _  | |_) | |_| / ___ \\|  _ <| |_| |
|_| \\_\\\\___/|____/ \\___/ |_| |____/_/   \\_|____/|_| |_|____/ \\___/_/   \\_|_| \\_|____/ 
"""
    )
    print(
        "======================================================================================"
    )
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
        arguments.timezone,
    )
    # If arguments.start_server is provided override some required args
    if arguments.start_server:
        try:
            from robotframework_dashboard.server import ApiServer
            import python_multipart
        except ModuleNotFoundError:
            print(
                "  ERROR: The packages 'fastapi-offline', 'uvicorn' and 'python_multipart' are required to run the server!"
            )
            print(
                "         Please install them using  'pip install robotframework-dashboard[server]'"
            )
            print(
                "         Or                         'pip install robotframework-dashboard[all]'"
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
            arguments.offline_dependencies
        )
        server.set_robotdashboard(robotdashboard)
        server.run()


if __name__ == "__main__":
    main()
