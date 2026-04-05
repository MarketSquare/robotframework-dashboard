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
    ${files}    Catenate  SEPARATOR=${SPACE}  
    ...    -o ${CURDIR}/../outputs/output-20250313-002134.xml:prod:project_1:version_1.0
    ...    -o ${CURDIR}/../outputs/output-20250313-002151.xml:dev:project_1:version_1.0
    ...    -o ${CURDIR}/../outputs/output-20250313-002222.xml:prod:project_2:version_1.0
    ...    -o ${CURDIR}/../outputs/output-20250313-002257.xml:dev:project_2:version_1.1
    ...    -o ${CURDIR}/../outputs/output-20250313-002338.xml:prod:project_1:version_1.1
    ...    -o ${CURDIR}/../outputs/output-20250313-002400.xml:dev:project_1:version_1.1
    ...    -o ${CURDIR}/../outputs/output-20250313-002431.xml:prod:project_2:version_1.1
    ...    -o ${CURDIR}/../outputs/output-20250313-002457.xml:dev:project_2:version_1.1
    ...    -o ${CURDIR}/../outputs/output-20250313-002528.xml:prod:project_1:version_1.1
    ...    -o ${CURDIR}/../outputs/output-20250313-002549.xml:prod:project_1:version_1.2
    ...    -o ${CURDIR}/../outputs/output-20250313-002636.xml:prod:project_2:version_1.2
    ...    -o ${CURDIR}/../outputs/output-20250313-002703.xml:prod:project_2:version_1.2
    ...    -o ${CURDIR}/../outputs/output-20250313-002739.xml:dev:project_1:version_1.2
    ...    -o ${CURDIR}/../outputs/output-20250313-002915.xml:dev:project_1:version_1.2
    ...    -o ${CURDIR}/../outputs/output-20250313-003006.xml:dev:project_2:amount:version_1.2
    ${output}    Run    command=robotdashboard -d robotresults_${DASHBOARD_INDEX}.db ${files} -n robotdashboard_${DASHBOARD_INDEX}.html
    Log    ${output}

Remove Database And Dashboard
    ${files}    List Files In Directory    path=${CURDIR}/../../../..
    FOR    ${file}    IN    @{files}
        IF    ('.db' in $file or '.html' in $file) and not ('robotresults_' in $file or 'robotdashboard_' in $file)
            Remove File    path=${file}
        END
    END

Remove Database And Dashboard With Index
    Remove File    path=robotresults_${DASHBOARD_INDEX}.db
    Remove File    path=robotdashboard_${DASHBOARD_INDEX}.html
