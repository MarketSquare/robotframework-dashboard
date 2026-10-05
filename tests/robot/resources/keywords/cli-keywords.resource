*** Settings ***
Library    OperatingSystem
Library    SnapshotLibrary    normalizers=duration,timezone    snapshot_directory=${CURDIR}/../__snapshots__


*** Keywords ***
Validate CLI
    [Documentation]    Runs the command and, when ``expected`` is given, compares its output with the
    ...    snapshot of that name. Snapshots are shared: the short and the long form of an option
    ...    compare against the same file in resources/__snapshots__/00_cli/.
    [Arguments]    ${command}    ${expected}=${NONE}
    ${result}    Run    command=${command}
    IF    '${expected}' != '${NONE}'
        # every test uses its own database file, so the name differs between the short and long option
        Add Snapshot Normalizer    database_file    pattern='[^']*\\.db'    replacement='<DB>'    scope=test
        # absolute path, and spelled differently by the short and long option test
        Add Snapshot Normalizer    databaseclass_file    pattern=using provided databaseclass: .*
        ...    replacement=using provided databaseclass: <FILE>    scope=test
        # the generated dashboard path holds the working directory and, by default, a timestamp
        Add Snapshot Normalizer    dashboard_dir    pattern=created dashboard '.*[\\\\/]
        ...    replacement=created dashboard '<DIR>/    scope=test
        Add Snapshot Normalizer    dashboard_timestamp    pattern=robot_dashboard_\\d{8}-\\d{6}\\.html
        ...    replacement=robot_dashboard_<TIMESTAMP>.html    scope=test
        Should Match Snapshot    ${result}    name=${expected}    shared=True
    END
