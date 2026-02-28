---
outline: deep
---

# Basic Command Line Interface (CLI)

This page explains the essential CLI commands used to create databases, process output XML files, and generate the HTML dashboard. It includes clear examples and describes exactly what each command does.

## Display Version and Help

### Display version information
```bash
robotdashboard -v  
robotdashboard --version  
```
- Optional: `-v` or `--version` displays the current installed version of RobotFramework Dashboard.

### Display CLI help
```bash
robotdashboard -h  
robotdashboard --help  
```
- Optional: `-h` or `--help` provides detailed information about all CLI options.

## Adding Output XML Files

### Add one or multiple output XML files
```bash
robotdashboard -o output1.xml -o output2.xml -o output3.xml  
```
- Optional: Each `-o` or `--outputpath` option specifies a single output XML file.  
- The tool will read the files, upload the results to the database, and optionally generate a dashboard HTML file.  
- Tags can be added to group or categorize runs. 
- See [Advanced CLI & Examples](/advanced-cli-examples#advanced-tagging-strategies) for more information on Tags!

### Add all output XMLs from a folder (including subfolders)
```bash
robotdashboard -f ./reports  
robotdashboard -f ../../some_folder/sub_folder/logs  
robotdashboard -f C:/nightly_runs:tag1:tag2:tag3 -f some/other/path/results
```
- Optional: `-f` or `--outputfolderpath` specifies a folder; the CLI will process all `*output*.xml` files it finds.  
- Tags can be added to group or categorize runs. 
- See [Advanced CLI & Examples](/advanced-cli-examples#advanced-tagging-strategies) for more information on Tags!

## Controlling Database and Dashboard Behavior

### Custom database path
```bash
robotdashboard -d result_data/robot_result_database.db  
```
- Optional: `-d` or `--databasepath` specifies a custom database file to store results.
- Default: database path is the **current folder** with **robot_results.db**.

### Custom dashboard HTML file name
```bash
robotdashboard -n results/result_robot_dashboard.html  
```
- Optional: `-n` or `--namedashboard` specifies the file name and path for the generated dashboard HTML.
- Default: dashboard name is **robot_dashboard_YYYYMMDD-HHMMSS.html**.

### Skip listing runs and/or skip generating dashboard
```bash
robotdashboard -l false -g false  
```
- Optional: `-l` or `--listruns` disables listing runs in the console. 
- Default: true, valid values are True, TRUE, T (similar for False).
- Optional: `-g` or `--generatedashboard` disables generating the HTML dashboard.
- Default: true, valid values are True, TRUE, T (similar for False).

### Project Version
You can pass version associated with a test run.  
For example, if you ran tests for your software/product version 1.2.1  
```bash
robotdashboard -o output.xml --projectversion=1.2.1
robotdashboard -f ./results --projectversion=1.2.1
```
If you want to supply versions for each output, use:
```bash
robotdashboard -o output.xml:version_1.2.1 -o output2.xml:version_2.3.4
robotdashboard -f ./results:version_1.1 ./results2:version_2.3.4
```
--projectversion and version_ are mutually exclusive
> Added in RobotDashboard v1.3.0  
> version_ tag support added in v1.4.0

## Removing Runs from the Database

### Remove runs by index, run start, alias, tag, or limit
```bash
robotdashboard -r index=0,index=1:4;9,index=10  
robotdashboard --removeruns 'run_start=2024-07-30 15:27:20.184407,index=20'  
robotdashboard -r alias=some_cool_alias,tag=prod,tag=dev -r alias=alias12345  
robotdashboard -r limit=10
```
- Optional: `-r` or `--removeruns` specifies one or more runs to remove.  
- Multiple values are separated by commas (,).  
- Must specify data types: index, run_start, alias, tag or limit.  
- Index ranges use `:` for ranges and `;` for lists.  
- Quotation marks are required when spaces exist in identifiers.
- With limit=10 only the 10 most recent runs will be kept, all others will be removed.

## Customizing the Dashboard

### Set a custom HTML title
```bash
robotdashboard -t "My Cool Title"  
```
- Optional: `-t` or `--dashboardtitle` sets a custom HTML title for the dashboard.
- Default: title is **Robot Framework Dashboard - YYYY-MM-DD HH:MM:SS**.
- It is also possible to combine all sections into a single unified view, see [Settings - General Settings (Graphs Tab)](/settings#general-settings-graphs-tab), for the details
- The unified title will be the same as the `-t, --dashboardtitle` argument if provided, otherwise it defaults to "Dashboard Statistics"

### Use a JSON dashboard configuration file to set default settings
```bash
robotdashboard -j ./path/to/config.json  
robotdashboard --jsonconfig default_settings.json  
```
- Optional: `-j` or `--jsonconfig` sets a JSON dashboard configuration file used on first load.
- See [Advanced CLI & Examples](/advanced-cli-examples#using-a-custom-dashboard-config-json) for more information on customized loading behaviour!

### Force the JSON config even if local storage exists
```bash
robotdashboard -j ./path/to/config.json --forcejsonconfig  
robotdashboard --jsonconfig default_settings.json --forcejsonconfig  
```
- Optional: `--forcejsonconfig` forces the use of the JSON dashboard configuration file even if local storage exists.
- See [Advanced CLI & Examples](/advanced-cli-examples#using-a-custom-dashboard-config-json) for more information on customized loading behaviour!

### Control number of runs displayed by default
```bash
robotdashboard -q 7  
robotdashboard --quantity 50  
```
- Optional: `-q` or `--quantity` sets the default number of runs shown in the dashboard on first load.
- Default: value in the dashboard is 20. This can be changed in the filters.

## Advanced Options

### Enable Log Linking in the dashboard
```bash
robotdashboard -u true  
robotdashboard --uselogs True  
```
- Optional: `-u` or `--uselogs` enables clickable graphs in the dashboard that open corresponding log.html files.  
- Requirements: log files must be in the same folder as their respective output.xml files, with `output` replaced by `log` and `.xml` replaced by `.html`.
- See [Log Linking](/log-linking.md) for the full guide on file naming, local vs. server usage, and remote log uploads.

### Add messages config for bundling test messages
```bash
robotdashboard -m message_config.txt  
robotdashboard --messageconfig path/to/message_config.txt  
```
- Optional: `-m` or `--messageconfig` specifies a file containing custom messages with placeholders like `${x}` or `${y}`.
- See [Advanced CLI & Examples](/advanced-cli-examples#message-config-details) for more details regarding the message config!

### Use local JS and CSS dependencies
```bash
robotdashboard --offlinedependencies  
robotdashboard --offlinedependencies True  
```
- Optional: `--offlinedependencies` specifies to use locally downloaded js/css files and embed them directly into the dashboard.  
- By default, urls to the actual JS and CSS CDN are used. 
- See [Advanced CLI & Examples](/advanced-cli-examples#offline-dependencies) for more information.

### Disable automatic database vacuuming
```bash
robotdashboard --novacuum
robotdashboard --novacuum True
```
- Optional: `--novacuum` disables automatic database vacuuming.
- Default: False. Using `--novacuum` with no value sets it to True.

### Use a custom database class
```bash
robotdashboard -c ./path/to/custom_class.py  
robotdashboard --databaseclass mysql.py  
```
- Optional: `-c` or `--databaseclass` specifies a custom database class implementation.  
- By default, Sqlite3 is used. See [Custom Database Class](/custom-database-class.md) for more information.

## Starting the Dashboard Server
```bash
robotdashboard --server  
robotdashboard --server default  
robotdashboard -s 0.0.0.0:8543  
```
- Optional: `-s` or `--server` starts the dashboard web server.  
- See [Dashboard Server](/dashboard-server.md) for advanced usage.  
- Docker users can bind to a specific host and port as shown.

### Deprecated options

- Exclude milliseconds: `-e False` (moved to dashboard Settings)  
- Aliases: `-a True` (moved to dashboard Settings)  


For more advanced usage, see [Advanced CLI & Examples](/advanced-cli-examples), the [Dashboard Server](/dashboard-server.md) and [Custom Database Class](/custom-database-class.md) pages.
