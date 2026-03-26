*** Settings ***
Library    OperatingSystem
Library    String
Library    pabot.pabotlib
Resource    ../variables/variables.resource


*** Keywords ***
Get Dashboard Index
    Acquire Lock    name=dashboard_index
    ${exists}    Run Keyword And Return Status    Should Exist    path=index.txt
    IF    not ${exists}
        Create File    path=index.txt    content=1:${TEST_NAME}
        RETURN   ${1}
    END
    ${index}    Get File    path=index.txt
    ${index}    Split String    string=${index}    separator=:
    ${index}    Convert To Integer    ${index}[0]
    ${index}    Evaluate    ${index} + 1
    Create File    path=index.txt    content=${index}:${TEST_NAME}
    RETURN    ${index}

Generate Dashboard
    ${index}    Get Dashboard Index
    Release Lock    name=dashboard_index
    VAR    ${DASHBOARD_INDEX}    ${index}    scope=test
    ${output}    Run    command=robotdashboard -d robotresults_${DASHBOARD_INDEX}.db -f ${CURDIR}/../outputs:dev:prod:project_1 -n robotdashboard_${DASHBOARD_INDEX}.html
    Log    ${output}

Remove Database And Dashboard
    ${files}    List Files In Directory    path=${CURDIR}/../../..
    FOR    ${file}    IN    @{files}
        IF    ('.db' in $file or '.html' in $file) and not ('robotresults_' in $file or 'robotdashboard_' in $file)
            Remove File    path=${file}
        END
    END

Remove Database And Dashboard With Index
    Remove File    path=robotresults_${DASHBOARD_INDEX}.db
    Remove File    path=robotdashboard_${DASHBOARD_INDEX}.html
