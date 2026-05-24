from .arguments import ArgumentParser
from .robotdashboard import RobotDashboard
from sys import exit
from time import time


_SEP = "======================================================================================"
_BANNER = """ ____   ___  ____   ___ _____ ____    _    ____  _   _ ____   ___    _    ____  ____  
|  _ \\ / _ \\| __ ) / _ |_   _|  _ \\  / \\  / ___|| | | | __ ) / _ \\  / \\  |  _ \\|  _ \\ 
| |_) | | | |  _ \\| | | || | | | | |/ _ \\ \\___ \\| |_| |  _ \\| | | |/ _ \\ | |_) | | | |
|  _ <| |_| | |_) | |_| || | | |_| / ___ \\ ___) |  _  | |_) | |_| / ___ \\|  _ <| |_| |
|_| \\_\\\\___/|____/ \\___/ |_| |____/_/   \\_|____/|_| |_|____/ \\___/_/   \\_|_| \\_|____/ 
"""


def _print_hub_sources(sources):
    if sources:
        for i, src in enumerate(sources):
            src_type = "[url]" if src["source_type"] == "url" else "[db] "
            print(f"  Source {i + 1}: {src_type} {src['label']} | {src['source']}")
    else:
        print("  (no sources configured — add paths with --offlinehub or --hub)")


def _run_offline_hub(arguments):
    """Step-by-step flow for --offlinehub (static hub generation)."""
    from robotframework_dashboard.hub_generator import HubGenerator
    from robotframework_dashboard.hub_sources import merge_cli_sources_into_file

    generator = HubGenerator()

    # Merge CLI-supplied sources into the persistent JSON config so they are
    # remembered for future runs, then use the full merged list.
    sources = merge_cli_sources_into_file(arguments.offline_hub_sources)

    print(" 1. Hub sources")
    _print_hub_sources(sources)
    print(_SEP)

    print(" 2. Collecting run data")
    projects_data = generator.get_projects_data(sources)
    if projects_data:
        for project in projects_data:
            n = len(project["runs"])
            print(f"  {project['label']}: {n} run{'s' if n != 1 else ''}")
    else:
        print("  (no data collected)")
    print(_SEP)

    print(" 3. Generating hub HTML")
    t0 = time()
    hub_file = generator.generate_hub(
        hub_name=arguments.hub_name,
        projects_data=projects_data,
        generation_datetime=arguments.generation_datetime,
        offline=arguments.offline_dependencies,
        hub_title=arguments.hub_title,
    )
    elapsed = round(time() - t0, 1)
    print(f"  Created hub '{hub_file}' in {elapsed} seconds")
    print(_SEP)


def _run_hub_server(arguments):
    """Start the hub server (--hub)."""
    try:
        from robotframework_dashboard.hub_server import HubServer
        import python_multipart
    except ModuleNotFoundError:
        print(
            "  ERROR: The packages 'fastapi-offline', 'uvicorn' and 'python_multipart' are required to run the hub server!"
        )
        print(
            "         Please install them using  'pip install robotframework-dashboard[server]'"
        )
        print(
            "         Or                         'pip install robotframework-dashboard[all]'"
        )
        exit(0)

    sources = arguments.hub_sources
    print(" 1. Hub sources")
    _print_hub_sources(sources)
    print(_SEP)

    hub_server = HubServer(
        hub_host=arguments.hub_host,
        hub_port=arguments.hub_port,
        hub_user=arguments.hub_user,
        hub_pass=arguments.hub_pass,
        sources=sources,
        offline_dependencies=arguments.offline_dependencies,
        hub_title=arguments.hub_title,
        ssl_certfile=arguments.ssl_certfile,
        ssl_keyfile=arguments.ssl_keyfile,
    )
    hub_server.start()


def main():
    """Main function that runs robotdashboard. Everything is orchestrated from here!"""
    print(_SEP)
    print(_BANNER)
    print(_SEP)
    arguments = ArgumentParser().get_arguments()

    # Hub modes bypass the regular dashboard pipeline entirely
    if arguments.offline_hub:
        _run_offline_hub(arguments)
        return

    if arguments.start_hub:
        _run_hub_server(arguments)
        return

    # --- Regular dashboard pipeline ---
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
            arguments.offline_dependencies,
            arguments.no_autoupdate,
            arguments.ssl_certfile,
            arguments.ssl_keyfile,
        )
        server.set_robotdashboard(robotdashboard)
        server.run()


if __name__ == "__main__":  # pragma: no cover
    main()
