import argparse
from datetime import datetime
from sys import exit
from re import split
from os import getcwd
from os.path import join, exists
from .version import __version__


class dotdict(dict):
    """dot.notation access to dictionary attributes"""

    __getattr__ = dict.get
    __setattr__ = dict.__setitem__
    __delattr__ = dict.__delitem__


class ArgumentParser:
    """Parse the input arguments that can be provided to robotdashboard
    Only get_arguments is called, all other functions are helper functions"""

    def get_arguments(self):
        """The function that handles the complete parsing process"""
        try:
            arguments = self._parse_arguments()
            arguments = self._process_arguments(arguments)
        except Exception as error:
            print(
                f"  ERROR: There was an issue during the parsing of the provided arguments"
            )
            print(f"  {error}")
            exit(0)
        return arguments

    def _normalize_bool(self, value, arg_name):
        """
        Checks the boolean value and returns the correct boolean or exits with error
        """
        v = str(value).lower()
        if v == "true":
            return True
        elif v == "false":
            return False
        else:
            print(
                f"  ERROR: The provided value: '{value}' for --{arg_name} is invalid\n"
                f"   Please provide True, False, or leave empty for the reverse boolean of the default\n"
                f"   See the --h / --help for more information and usage examples"
            )
            exit(0)

    def _check_project_version_usage(self, tags, arguments):
        version_tags = [tag for tag in tags if tag.startswith("version_")]
        version_tag_count = len(version_tags)
        if version_tag_count > 1:
            print(
                "  ERROR: Found multiple version_ tags for one output, not supported."
            )
            exit(1)
        if version_tag_count == 1 and arguments.project_version:
            print("  ERROR: Mixing --projectversion and version_ tags not supported")
            exit(2)

    def _check_argument_warnings(self, arguments, outputs, outputfolderpaths, use_logs, generate_dashboard, no_autoupdate, offline_dependencies):
        """Checks for argument combinations that are valid but likely unintended and prints warnings"""
        no_outputs = not outputs and not outputfolderpaths
        if arguments.logurl and no_outputs:
            print(
                "  WARNING: '--logurl' was provided but no output files are being processed.\n"
                "   The URL will not be stored. Add '-o' or '-f' to process output files."
            )
        if arguments.logurl and not use_logs:
            print(
                "  WARNING: '--logurl' was provided without '--uselogs'.\n"
                "   The URL will be stored in the database but graph elements will not be clickable.\n"
                "   Add '--uselogs' to enable log linking in the dashboard."
            )
        if no_autoupdate and not arguments.server:
            print(
                "  WARNING: '--noautoupdate' was provided without '--server'.\n"
                "   This flag only has effect in server mode and will be ignored."
            )
        if arguments.project_version and no_outputs:
            print(
                "  WARNING: '--projectversion' was provided but no output files are being processed.\n"
                "   The version will not be stored. Add '-o' or '-f' to process output files."
            )
        if arguments.timezone and no_outputs:
            print(
                "  WARNING: '--timezone' was provided but no output files are being processed.\n"
                "   The timezone will not be applied. Add '-o' or '-f' to process output files."
            )
        if arguments.messageconfig and no_outputs:
            print(
                "  WARNING: '--messageconfig' was provided but no output files are being processed.\n"
                "   The message config will have no effect. Add '-o' or '-f' to process output files."
            )
        if not generate_dashboard:
            if offline_dependencies:
                print(
                    "  WARNING: '--offlinedependencies' was provided but dashboard generation is disabled.\n"
                    "   This flag will have no effect. Remove '--generatedashboard false' to generate a dashboard."
                )
            if arguments.dashboardtitle:
                print(
                    "  WARNING: '--dashboardtitle' was provided but dashboard generation is disabled.\n"
                    "   The title will have no effect. Remove '--generatedashboard false' to generate a dashboard."
                )
            if arguments.quantity:
                print(
                    "  WARNING: '--quantity' was provided but dashboard generation is disabled.\n"
                    "   This flag will have no effect. Remove '--generatedashboard false' to generate a dashboard."
                )

    def _check_argument_errors(self, arguments, outputs, outputfolderpaths, force_json_config, database_class):
        """Checks for invalid argument combinations and exits with an error message if found"""
        if arguments.logurl and "{run_alias}" not in arguments.logurl:
            is_multiple = outputfolderpaths or (outputs and len(outputs) > 1)
            if is_multiple:
                print(
                    "  ERROR: '--logurl' was provided without a '{run_alias}' placeholder while processing multiple outputs.\n"
                    "   Either add '{run_alias}' to the URL template or provide a single output file with '-o'."
                )
                exit(0)
        if force_json_config and not arguments.jsonconfig:
            print(
                "  ERROR: The --forcejsonconfig argument was provided without a valid --jsonconfig path"
            )
            exit(0)
        if database_class and not exists(database_class):
            print(
                f"  ERROR: the provided database class did not exist in the expected path: {database_class}"
            )
            exit(0)
        if arguments.ssl_certfile and not arguments.ssl_keyfile:
            print(
                "  ERROR: --ssl-certfile was provided without --ssl-keyfile\n"
                "   Both --ssl-certfile and --ssl-keyfile must be provided together"
            )
            exit(0)
        if arguments.ssl_keyfile and not arguments.ssl_certfile:
            print(
                "  ERROR: --ssl-keyfile was provided without --ssl-certfile\n"
                "   Both --ssl-certfile and --ssl-keyfile must be provided together"
            )
            exit(0)
        if arguments.ssl_certfile and not exists(arguments.ssl_certfile):
            print(f"  ERROR: --ssl-certfile path does not exist: {arguments.ssl_certfile}")
            exit(0)
        if arguments.ssl_keyfile and not exists(arguments.ssl_keyfile):
            print(f"  ERROR: --ssl-keyfile path does not exist: {arguments.ssl_keyfile}")
            exit(0)

    def _parse_arguments(self):
        """Parses the actual arguments"""
        parser = argparse.ArgumentParser(
            add_help=False,
            formatter_class=argparse.RawTextHelpFormatter,
            description="Generate an interactive HTML dashboard from Robot Framework output.xml results.",
            epilog="Boolean flags: omit the value to toggle the default (e.g. '--uselogs'); or pass 'true'/'false' explicitly.\nFor full documentation, visit: https://marketsquare.github.io/robotframework-dashboard/",
        )
        parser.add_argument(
            "-v",
            "--version",
            action="store_true",
            dest="version",
            help="Display application version information.\n",
        )
        parser.add_argument(
            "-h",
            "--help",
            help="Provide additional information.\n",
            action="help",
            default=argparse.SUPPRESS,
        )

        input_group = parser.add_argument_group("output files")
        input_group.add_argument(
            "-o",
            "--outputpath",
            metavar="PATH",
            help=(
                "Path to one or more output.xml files.\n"
                "  • Repeat '-o' for multiple files\n"
                "  • Append ':tag1:tag2' to add tags\n"
                "Examples:\n"
                "  • '-o path/to/output1.xml'\n"
                "  • '-o output2.xml:dev:nightly -o output3.xml:prod'\n"
            ),
            action="append",
            nargs="*",
            default=None,
        )
        input_group.add_argument(
            "-f",
            "--outputfolderpath",
            metavar="PATH",
            help=(
                "Directory scanned recursively for *output*.xml files.\n"
                "  • All matching files in subfolders are included\n"
                "  • Append ':tag1:tag2' to add tags\n"
                "Examples:\n"
                "  • '-f results/'\n"
                "  • '-f results/ -f path/to/more_results/:prod:regression'\n"
            ),
            action="append",
            nargs="*",
            default=None,
        )
        input_group.add_argument(
            "--projectversion",
            help=(
                "Project version associated with the processed runs.\n"
                "  • Cannot be mixed with version_ output tags\n"
                "Examples:\n"
                "  • '--projectversion=1.1'\n"
            ),
            dest="project_version",
            metavar="VERSION",
            type=str,
            default=None,
        )
        input_group.add_argument(
            "-z",
            "--timezone",
            metavar="OFFSET",
            help=(
                "UTC offset of the output.xml timestamps (default: auto-detected).\n"
                "  • Format: +HH:MM or -HH:MM\n"
                "  • Use '--timezone=' form for negative offsets\n"
                "Examples:\n"
                "  • '-z +02:00'  '--timezone=-05:00'  '-z +00:00'\n"
            ),
            default=None,
        )

        db_group = parser.add_argument_group("database")
        db_group.add_argument(
            "-d",
            "--databasepath",
            metavar="PATH",
            help=(
                "Path to the database file (default: robot_results.db).\n"
                "Examples:\n"
                "  • '-d path/to/myresults.db'\n"
            ),
            default="robot_results.db",
        )
        db_group.add_argument(
            "-r",
            "--removeruns",
            metavar="QUERY",
            help=(
                "Remove runs by index, run_start, alias, tag, or limit.\n"
                "  • Separate multiple values with commas; ranges use ':', lists use ';'\n"
                "Examples:\n"
                "  • '-r index=0,index=1:4;9,index=10'\n"
                "  • '-r alias=some_alias,tag=prod'\n"
                "  • '-r limit=10' -> keep only the 10 most recent runs\n"
            ),
            action="append",
            nargs="*",
            default=None,
        )
        db_group.add_argument(
            "-c",
            "--databaseclass",
            metavar="PATH",
            help=(
                "Path to a custom database class (.py) to override the built-in SQLite engine.\n"
                "  • See docs for implementation details\n"
                "Examples:\n"
                "  • '-c customdb.py'\n"
            ),
            default=None,
        )
        db_group.add_argument(
            "--novacuum",
            metavar="BOOL",
            help="`boolean` [default: False] Disable automatic database vacuuming.\n",
            nargs="?",
            const=True,
            default=False,
        )

        dashboard_group = parser.add_argument_group("dashboard")
        dashboard_group.add_argument(
            "-g",
            "--generatedashboard",
            metavar="BOOL",
            help="`boolean` [default: True] Generate the HTML dashboard file.\n",
            nargs="?",
            const=False,
            default=True,
        )
        dashboard_group.add_argument(
            "-l",
            "--listruns",
            metavar="BOOL",
            help="`boolean` [default: True] List runs in the console output.\n",
            nargs="?",
            const=False,
            default=True,
        )
        dashboard_group.add_argument(
            "-n",
            "--namedashboard",
            metavar="NAME",
            help=(
                "Custom HTML dashboard file name (default: robot_dashboard_yyyymmdd-hhssmm.html).\n"
                "Examples:\n"
                "  • '-n dashboard.html'\n"
            ),
            default="",
        )
        dashboard_group.add_argument(
            "-t",
            "--dashboardtitle",
            metavar="TITLE",
            help=(
                "Custom HTML title (default: Robot Framework Dashboard - yyyy-mm-dd hh:mm:ss).\n"
                "Examples:\n"
                "  • '-t My_Test_Dashboard'\n"
            ),
            default="",
        )
        dashboard_group.add_argument(
            "-q",
            "--quantity",
            metavar="INT",
            help=(
                "Number of runs shown on initial dashboard load (default: 20).\n"
                "  • Higher values slow initial load\n"
                "Examples:\n"
                "  • '-q 25'\n"
            ),
            default=None,
        )
        dashboard_group.add_argument(
            "--offlinedependencies",
            metavar="BOOL",
            help="`boolean` [default: False] Embed JS/CSS locally instead of loading from CDN.\n",
            nargs="?",
            const=True,
            default=False,
        )

        log_group = parser.add_argument_group("log linking")
        log_group.add_argument(
            "-u",
            "--uselogs",
            metavar="BOOL",
            help="`boolean` [default: False] Enable clickable graphs that open the corresponding log.html.\n",
            nargs="?",
            const=True,
            default=False,
        )
        log_group.add_argument(
            "--logurl",
            metavar="URL",
            help=(
                "URL to the log file for the processed run(s), stored in the database.\n"
                "  • Overrides the path derived from the output.xml location\n"
                "  • Use '{run_alias}' placeholder for multi-file processing\n"
                "Examples:\n"
                "  • '--logurl https://ci.example.com/build42/log.html'\n"
                "  • '--logurl https://ci.example.com/build42/log_{run_alias}.html'\n"
            ),
            default=None,
        )

        config_group = parser.add_argument_group("dashboard configuration")
        config_group.add_argument(
            "-j",
            "--jsonconfig",
            metavar="PATH",
            help=(
                "Path to a JSON configuration file applied on first dashboard load.\n"
                "Examples:\n"
                "  • '-j settings.json'\n"
            ),
            default=None,
        )
        config_group.add_argument(
            "--forcejsonconfig",
            metavar="BOOL",
            help="`boolean` [default: False] Force --jsonconfig to override existing localstorage settings.\n",
            nargs="?",
            const=True,
            default=False,
        )
        config_group.add_argument(
            "-m",
            "--messageconfig",
            metavar="PATH",
            help=(
                "Path to a file containing test message templates with ${placeholder} syntax.\n"
                "Examples:\n"
                "  • 'The test failed on: ${date}' -> example line\n"
                "  • '-m messages.txt'\n"
            ),
            default=None,
        )

        server_group = parser.add_argument_group("server")
        server_group.add_argument(
            "-s",
            "--server",
            metavar="HOST:PORT:USERNAME:PASSWORD",
            nargs="?",  # Makes the argument optional
            const="default",  # Value to use if the flag is given without an argument
            help=(
                "Start the dashboard webserver.\n"
                "  • Format: 'default' or 'host:port', optionally ':username:password'\n"
                "Examples:\n"
                "  • '--server'  '--server default'\n"
                "  • '--server 0.0.0.0:8080'\n"
                "  • '--server 0.0.0.0:8080:admin:secret'\n"
            ),
        )
        server_group.add_argument(
            "--noautoupdate",
            metavar="BOOL",
            help=(
                "`boolean` [default: False] Disable automatic dashboard regeneration on upload/delete.\n"
                "  • When enabled, use the 'Refresh' buttons to refresh the dashboard\n"
            ),
            nargs="?",
            const=True,
            default=False,
        )
        server_group.add_argument(
            "--ssl-certfile",
            metavar="PATH",
            help=(
                "Path to SSL certificate file to enable HTTPS (requires --ssl-keyfile).\n"
                "Examples:\n"
                "  • '--ssl-certfile cert.pem --ssl-keyfile key.pem'\n"
            ),
            dest="ssl_certfile",
            default=None,
        )
        server_group.add_argument(
            "--ssl-keyfile",
            metavar="PATH",
            help=(
                "Path to SSL private key file to enable HTTPS (requires --ssl-certfile).\n"
                "Examples:\n"
                "  • '--ssl-certfile cert.pem --ssl-keyfile key.pem'\n"
            ),
            dest="ssl_keyfile",
            default=None,
        )
        return parser.parse_args()

    def _process_arguments(self, arguments):
        """handles the version execution"""
        if arguments.version:
            print(__version__)
            exit(0)

        # handles possible tags on all provided --outputpath
        outputs = None
        if arguments.outputpath:
            outputs = []
            for output in arguments.outputpath:
                splitted = split(r":(?!(\/|\\))", output[0])
                while None in splitted:
                    splitted.remove(
                        None
                    )  # None values are found by re.split because of the 2 conditions
                path = splitted[0]
                tags = splitted[1:]
                self._check_project_version_usage(tags, arguments)
                outputs.append([path, tags])

        # handles possible tags on all provided --outputfolderpath
        outputfolderpaths = None
        if arguments.outputfolderpath:
            outputfolderpaths = []
            for folder in arguments.outputfolderpath:
                splitted = split(r":(?!(\/|\\))", folder[0])
                while None in splitted:
                    splitted.remove(
                        None
                    )  # None values are found by re.split because of the 2 conditions
                path = splitted[0]
                tags = splitted[1:]
                self._check_project_version_usage(tags, arguments)
                outputfolderpaths.append([path, tags])

        # handles the processing of --removeruns
        remove_runs = None
        if arguments.removeruns:
            remove_runs = []
            for runs in arguments.removeruns:
                parts = str(runs[0]).split(",")
                for part in parts:
                    remove_runs.append(part)

        # handles the boolean handling of relevant arguments
        generate_dashboard = self._normalize_bool(
            arguments.generatedashboard, "generatedashboard"
        )
        list_runs = self._normalize_bool(arguments.listruns, "listruns")
        offline_dependencies = self._normalize_bool(
            arguments.offlinedependencies, "offlinedependencies"
        )
        use_logs = self._normalize_bool(arguments.uselogs, "uselogs")
        force_json_config = self._normalize_bool(
            arguments.forcejsonconfig, "forcejsonconfig"
        )
        no_vacuum = self._normalize_bool(arguments.novacuum, "novacuum")
        no_autoupdate = self._normalize_bool(arguments.noautoupdate, "noautoupdate")

        # generates the datetime used in the file dashboard name and the html title
        generation_datetime = datetime.now()

        # handles the custom test message handling
        message_config = []
        if arguments.messageconfig:
            with open(arguments.messageconfig) as file:
                for line in file:
                    message_config.append(line.strip())

        # handles the json config
        json_config = []
        if arguments.jsonconfig:
            with open(arguments.jsonconfig) as file:
                json_config = file.read()

        # handles the custom dashboard name
        if arguments.namedashboard == "":
            dashboard_name = (
                f"robot_dashboard_{generation_datetime.strftime('%Y%m%d-%H%M%S')}.html"
            )
        elif not arguments.namedashboard.endswith(".html"):
            dashboard_name = f"{arguments.namedashboard}.html"
        else:
            dashboard_name = arguments.namedashboard

        # handles the databaseclass implementation and provides the complete path to the module
        database_class = None
        if arguments.databaseclass:
            database_class = join(getcwd(), arguments.databaseclass).replace(
                "\\.\\", "\\"
            )

        # handles the server argument
        server_host = "127.0.0.1"
        server_port = 8543
        server_user = ""
        server_pass = ""
        if arguments.server:
            start_server = True
            parts = arguments.server.split(":")

            if parts[0] == "default":
                # e.g. default[:username:password]
                if len(parts) == 3:
                    server_user = parts[1]
                    server_pass = parts[2]
            else:
                # e.g. host:port or host:port:username:password
                server_host = parts[0]
                server_port = int(parts[1])
                if len(parts) == 4:
                    server_user = parts[2]
                    server_pass = parts[3]
        else:
            start_server = False

        # handles the quantity argument
        quantity = arguments.quantity
        if quantity == None:
            quantity = 20
        else:
            int(quantity)

        # handles the timezone argument
        timezone = arguments.timezone
        if timezone is None:
            # Auto-detect from the machine's local timezone
            from datetime import timezone as tz
            local_offset = generation_datetime.astimezone().utcoffset()
            total_seconds = int(local_offset.total_seconds())
            sign = "+" if total_seconds >= 0 else "-"
            hours, remainder = divmod(abs(total_seconds), 3600)
            minutes = remainder // 60
            timezone = f"{sign}{hours:02d}:{minutes:02d}"

        ssl_certfile = arguments.ssl_certfile
        ssl_keyfile = arguments.ssl_keyfile

        # validates argument combinations
        self._check_argument_errors(arguments, outputs, outputfolderpaths, force_json_config, database_class)
        self._check_argument_warnings(arguments, outputs, outputfolderpaths, use_logs, generate_dashboard, no_autoupdate, offline_dependencies)

        # return all provided arguments
        provided_args = {
            "outputs": outputs,
            "output_folder_paths": outputfolderpaths,
            "database_path": arguments.databasepath,
            "generate_dashboard": generate_dashboard,
            "dashboard_name": dashboard_name,
            "generation_datetime": generation_datetime,
            "list_runs": list_runs,
            "remove_runs": remove_runs,
            "dashboard_title": arguments.dashboardtitle,
            "database_class": database_class,
            "start_server": start_server,
            "server_host": server_host,
            "server_port": server_port,
            "server_user": server_user,
            "server_pass": server_pass,
            "json_config": json_config,
            "message_config": message_config,
            "quantity": quantity,
            "use_logs": use_logs,
            "offline_dependencies": offline_dependencies,
            "force_json_config": force_json_config,
            "project_version": arguments.project_version,
            "no_vacuum": no_vacuum,
            "timezone": timezone,
            "no_autoupdate": no_autoupdate,
            "ssl_certfile": ssl_certfile,
            "ssl_keyfile": ssl_keyfile,
            "log_url": arguments.logurl,
        }
        return dotdict(provided_args)
