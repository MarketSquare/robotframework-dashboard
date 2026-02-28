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

    def _parse_arguments(self):
        """Parses the actual arguments"""
        parser = argparse.ArgumentParser(
            add_help=False,
            formatter_class=argparse.RawTextHelpFormatter,
            epilog="For full documentation, visit: https://marketsquare.github.io/robotframework-dashboard/",
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
        parser.add_argument(
            "-o",
            "--outputpath",
            help=(
                "`path` Specifies one or more paths to output.xml.\n"
                "Usage behavior:\n"
                "  • Multiple XML files: repeat '-o' for each file\n"
                "  • Accepts files or paths to files\n"
                "  • Optional tags can be provided by appending ':tag1:tag2' to the path\n"
                "Examples:\n"
                "  • '-o path/to/output1.xml' -> add one output\n"
                "  • '-o output2.xml:dev:nightly -o output3.xml:prod' -> add two outputs with tags\n"
            ),
            action="append",
            nargs="*",
            default=None,
        )
        parser.add_argument(
            "-f",
            "--outputfolderpath",
            help=(
                "`path` Specifies a directory path scanned recursively for *output*.xml files.\n"
                "Usage behavior:\n"
                "  • Provide a folder path\n"
                "  • All matching *output*.xml files in all subfolders will be included\n"
                "  • Optional tags can be provided by appending ':tag1:tag2' to the path\n"
                "Examples:\n"
                "  • '-f results/' -> scan folder for output files\n"
                "  • '-f results/' -f path/to/more_results/:prod:regression -> multiple folders with tags\n"
            ),
            action="append",
            nargs="*",
            default=None,
        )
        parser.add_argument(
            "--projectversion",
            help=(
                "`string` specifies project version associated with runs\n"
                "Usage behaviour:\n"
                "  • Provide text to set a project version for the supplied runs\n"
                "  • Cannot be mixed with version_ tags\n"
                "Examples:\n"
                "  . '--projectversion=1.1'\n"
            ),
            dest="project_version",
            type=str,
            default=None,
        )
        parser.add_argument(
            "-z",
            "--timezone",
            help=(
                "`string` Specifies the timezone offset of the output.xml timestamps.\n"
                "Usage behavior:\n"
                "  • Default value: auto-detected from the machine's local timezone\n"
                "  • Provide a UTC offset string like '+02:00' or '-05:00'\n"
                "  • Used to store timezone info with run_start for timezone conversion in the dashboard\n"
                "Examples:\n"
                "  • '-z +02:00' -> timestamps are from UTC+2\n"
                "  • '--timezone=-05:00' -> timestamps are from UTC-5 (use --timezone= for negative offsets)\n"
                "  • '-z +00:00' -> timestamps are UTC\n"
            ),
            default=None,
        )
        parser.add_argument(
            "-r",
            "--removeruns",
            help=(
                "`string` Specifies indexes, run_starts, aliases, tags or limit to remove from the database.\n"
                "Usage behavior:\n"
                "  • Multiple values separated by commas (,)\n"
                "  • Must specify data types: index, run_start, alias, tag or limit\n"
                "  • Ranges supported using ':' and lists using ';'\n"
                "Examples:\n"
                "  • '-r index=0,index=1:4;9,index=10' -> remove index 0, 1, 2, 3, 9, 10\n"
                "  • '-r run_start=2024-07-30 15:27:20.184407,index=20' -> remove specified run and index 20\n"
                "  • '-r alias=some_alias,tag=prod,tag=dev' -> remove all runs with alias some_alias or tag prod or dev\n"
                "  • '-r limit=10' -> remove all runs, leaving only the 10 most recent additions\n"
            ),
            action="append",
            nargs="*",
            default=None,
        )
        parser.add_argument(
            "-d",
            "--databasepath",
            help=(
                "`path` Specifies the path to the database file.\n"
                "Usage behavior:\n"
                "  • Default value: robot_results.db\n"
                "  • Provide a custom .db file to use instead of the default\n"
                "Examples:\n"
                "  • '-d path/to/myresults.db'\n"
            ),
            default="robot_results.db",
        )
        parser.add_argument(
            "-n",
            "--namedashboard",
            help=(
                "`string` Specifies a custom HTML dashboard file name.\n"
                "Usage behavior:\n"
                "  • Default value: robot_dashboard_yyyymmdd-hhssmm.html\n"
                "  • Provide a filename to override\n"
                "Examples:\n"
                "  • '-n dashboard.html'\n"
            ),
            default="",
        )
        parser.add_argument(
            "-j",
            "--jsonconfig",
            help=(
                "`path` Specifies a path to a dashboard JSON configuration.\n"
                "Usage behavior:\n"
                "  • Default value: None\n"
                "  • File is used as the initial configuration if no config exists yet in user localstorage\n"
                "Examples:\n"
                "  • '-j settings.json'\n"
            ),
            default=None,
        )
        parser.add_argument(
            "--forcejsonconfig",
            help=(
                "`boolean` Forces the provided --jsonconfig to override localstorage settings.\n"
                "Usage behavior:\n"
                "  • Default value: False\n"
                "  • Using '--forcejsonconfig' with no value -> True (reverse default)\n"
                "  • Using '--forcejsonconfig true'  -> True\n"
                "  • Using '--forcejsonconfig false' -> False\n"
            ),
            nargs="?",
            const=True,
            default=False,
        )
        parser.add_argument(
            "-t",
            "--dashboardtitle",
            help=(
                "`string` Specifies the dashboard HTML title.\n"
                "Usage behavior:\n"
                "  • Default value: Robot Framework Dashboard - yyyy-mm-dd hh:mm:ss\n"
                "  • Provide text to set a custom title\n"
                "Examples:\n"
                "  • '-t My_Test_Dashboard'\n"
            ),
            default="",
        )
        parser.add_argument(
            "-m",
            "--messageconfig",
            help=(
                "`path` Specifies a config file containing message templates.\n"
                "Usage behavior:\n"
                "  • Default value: None\n"
                "  • File should contain lines with placeholders like ${value}\n"
                "Examples:\n"
                "  • 'The test has failed on date: ${date}' -> example line in messages.txt\n"
                "  • 'Expected ${x} but received: ${y}' -> example line in messages.txt\n"
                "  • '-m messages.txt'\n"
            ),
            default=None,
        )
        parser.add_argument(
            "-q",
            "--quantity",
            help=(
                "`integer` Specifies the number of runs shown on initial dashboard load.\n"
                "Usage behavior:\n"
                "  • Default value: 20\n"
                "  • Provide an integer to override, the higher this number the slower initial load\n"
                "Examples:\n"
                "  • '-q 25'\n"
            ),
            default=None,
        )
        parser.add_argument(
            "-u",
            "--uselogs",
            help=(
                "`boolean` Enables clickable graphs linking to log.html.\n"
                "Usage behavior:\n"
                "  • Default value: False\n"
                "  • Using '--uselogs' with no value -> True (reverse default)\n"
                "  • Using '--uselogs true'  -> True\n"
                "  • Using '--uselogs false' -> False\n"
            ),
            nargs="?",
            const=True,
            default=False,
        )
        parser.add_argument(
            "-g",
            "--generatedashboard",
            help=(
                "`boolean` Whether to generate the HTML dashboard.\n"
                "Usage behavior:\n"
                "  • Default value: True\n"
                "  • Using '--generatedashboard' with no value -> False (reverse default)\n"
                "  • Using '--generatedashboard true'  -> True\n"
                "  • Using '--generatedashboard false' -> False\n"
            ),
            nargs="?",
            const=False,
            default=True,
        )
        parser.add_argument(
            "-l",
            "--listruns",
            help=(
                "`boolean` Whether runs should be listed in the dashboard.\n"
                "Usage behavior:\n"
                "  • Default value: True\n"
                "  • Using '--listruns' with no value -> False (reverse default)\n"
                "  • Using '--listruns true'  -> True\n"
                "  • Using '--listruns false' -> False\n"
            ),
            nargs="?",
            const=False,
            default=True,
        )
        parser.add_argument(
            "--offlinedependencies",
            help=(
                "`boolean` Use locally embedded JS/CSS instead of CDN.\n"
                "Usage behavior:\n"
                "  • Default value: False\n"
                "  • Using '--offlinedependencies' with no value -> True (reverse default)\n"
                "  • Using '--offlinedependencies true'  -> True\n"
                "  • Using '--offlinedependencies false' -> False\n"
            ),
            nargs="?",
            const=True,
            default=False,
        )
        parser.add_argument(
            "--novacuum",
            help=(
                "`boolean` Disables automatic database vacuuming.\n"
                "Usage behavior:\n"
                "  • Default value: False\n"
                "  • Using '--novacuum' with no value -> True (reverse default)\n"
                "  • Using '--novacuum true'  -> True\n"
                "  • Using '--novacuum false' -> False\n"
            ),
            nargs="?",
            const=True,
            default=False,
        )
        parser.add_argument(
            "-c",
            "--databaseclass",
            help=(
                "`path` Specifies a custom database class to override SQLite.\n"
                "Usage behavior:\n"
                "  • Default value: None (built-in SQLite engine)\n"
                "  • Provide a .py file implementing a compatible database handler\n"
                "  • Detailed instructions can be found in the docs (url at the bottom of the help)\n"
                "Examples:\n"
                "  • '-c customdb.py'\n"
            ),
            default=None,
        )
        parser.add_argument(
            "-s",
            "--server",
            nargs="?",  # Makes the argument optional
            const="default",  # Value to use if the flag is given without an argument
            help=(
                "Starts the dashboard webserver.\n"
                "Usage behavior:\n"
                "  • Default value: None (no webserver)\n"
                "  • Provide 'default[:username:password]'\n"
                "  • Or provide 'host:port[:username:password]'\n"
                "  • Detailed instructions can be found in the docs (url at the bottom of the help)\n"
                "Examples:\n"
                "  • '--server' -> results in default behavior\n"
                "  • '--server default' -> default behaviour\n"
                "  • '--server 0.0.0.0:8080' -> custom host/port\n"
                "  • '--server 0.0.0.0:8080:admin:secret' -> custom host/port and admin username/password\n"
            ),
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

        # handles force_json_config if no json_config is provided
        if force_json_config and not arguments.jsonconfig:
            print(
                f"  ERROR: The --forcejsonconfig argument was provided without a valid --jsonconfig path"
            )
            exit(0)

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
            if not exists(database_class):
                raise Exception(
                    f"  ERROR: the provided database class did not exist in the expected path: {database_class}"
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
        }
        return dotdict(provided_args)
