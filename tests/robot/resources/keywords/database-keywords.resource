*** Settings ***
Library    Collections
Library    OperatingSystem
Library    String
Library    DatabaseLibrary
Library    SnapshotLibrary    snapshot_directory=${CURDIR}/../__snapshots__
Resource    ../variables/variables.resource


*** Keywords ***
Create Database Connection
    Connect To Database    db_module=sqlite3    db_name=robotresults_${DASHBOARD_INDEX}.db

Close Database Connection
    Disconnect From Database

Validate Database
    [Arguments]    ${table}
    ${result}    Query    select_statement=SELECT * FROM ${table}
    ${result}    Evaluate    [list(x) for x in $result]
    VAR    @{new_result}    @{EMPTY}
    IF    $table == 'runs'
        FOR    ${row}    IN    @{result}
            Log    ${row}
            ${contains_backslash}    Run Keyword And Return Status    Should Contain    container=${row}[-4]    item=\\
            IF    ${contains_backslash}
                ${path}    Split String From Right    string=${row}[-4]    separator=\\    max_split=1
            ELSE
                ${path}    Split String From Right    string=${row}[-4]    separator=/    max_split=1
            END
            Set List Value    ${row}    index=-4    value=${path}[1]
            Append To List    ${new_result}    ${row}
        END
    ELSE
        VAR    ${new_result}    ${result}
    END
    Should Match Snapshot    ${new_result}    name=${table}    shared=True    normalizers=timezone
