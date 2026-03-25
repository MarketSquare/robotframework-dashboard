*** Settings ***
Library    Collections
Library    OperatingSystem
Library    String
Library    DatabaseLibrary
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
            ${contains_backslash}    Run Keyword And Return Status    Should Contain    container=${row}[-3]    item=\\
            IF    ${contains_backslash}
                ${path}    Split String From Right    string=${row}[-3]    separator=\\    max_split=1
            ELSE
                ${path}    Split String From Right    string=${row}[-3]    separator=/    max_split=1
            END
            Set List Value    ${row}    index=-3    value=${path}[1]
            Append To List    ${new_result}    ${row}
        END
    ELSE
        VAR    ${new_result}    ${result}
    END
    ${new_result}    Convert To String    item=${new_result}
    ${expected}    Get File    path=${CURDIR}/../database_output/${table}.txt
    VAR    ${pattern}    (\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}\\.\\d{6}\\+)\\d{2}:\\d{2}
    VAR    ${with}    \\1??:??
    ${new_result}    Replace String Using Regexp    string=${new_result}    pattern=${pattern}    replace_with=${with}
    ${expected}    Replace String Using Regexp    string=${expected}    pattern=${pattern}    replace_with=${with}
    Should Be Equal As Strings    first=${new_result}    second=${expected}
