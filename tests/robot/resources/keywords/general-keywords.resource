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
    [Documentation]    Own database + dashboard for this test (robotresults_N.db / robotdashboard_N.html).
    ...    Only needed when the test inspects the database or the generated files; browser tests use
    ...    Generate Shared Dashboard instead.
    ${index}    Get Dashboard Index
    Release Lock    name=dashboard_index
    VAR    ${DASHBOARD_INDEX}    ${index}    scope=test
    ${files}    Output Arguments
    ${output}    Run    command=robotdashboard -d robotresults_${DASHBOARD_INDEX}.db ${files} -n robotdashboard_${DASHBOARD_INDEX}.html
    Log    ${output}

Generate Shared Dashboard
    [Documentation]    Generate robotdashboard_shared.html once per run and let every browser test open it.
    ...    All browser tests use the same inputs, and each test gets its own browser context (own
    ...    localStorage), so one read-only HTML is enough; parsing the 18 output files per test was the
    ...    single biggest cost of the suite. The files are removed in the __init__.robot teardown.
    ...    The JSON config disables chart animations (show.animation=false); the tests used to set the
    ...    animation duration through the settings UI, which only changes the stagger delay, not the 1 s draw.
    Acquire Lock    name=shared_dashboard
    ${exists}    Run Keyword And Return Status    Should Exist    path=robotdashboard_shared.html
    IF    not ${exists}
        ${files}    Output Arguments
        ${output}    Run
        ...    command=robotdashboard -d robotresults_shared.db ${files} -n robotdashboard_shared.html -j ${CURDIR}/../test_config.json
        Log    ${output}
    END
    Release Lock    name=shared_dashboard
    VAR    ${DASHBOARD_INDEX}    shared    scope=test

Output Arguments
    [Documentation]    The -o arguments (file:tags) for all 18 fixtures.
    ${files}    Catenate  SEPARATOR=${SPACE}  
    ...    -o ${CURDIR}/../outputs/output-20260817-021512.xml:dev:project_1:version_1.0
    ...    -o ${CURDIR}/../outputs/output-20260817-060004.xml:dev:project_2:version_1.0
    ...    -o ${CURDIR}/../outputs/output-20260818-021545.xml:dev:project_1:version_1.0
    ...    -o ${CURDIR}/../outputs/output-20260819-144031.xml:dev:project_1:version_1.0
    ...    -o ${CURDIR}/../outputs/output-20260820-060009.xml:dev:project_2:version_1.0
    ...    -o ${CURDIR}/../outputs/output-20260821-021503.xml:dev:project_1:version_1.0
    ...    -o ${CURDIR}/../outputs/output-20260822-101527.xml:dev:project_2:version_1.0
    ...    -o ${CURDIR}/../outputs/output-20260824-090558.xml:prod:project_1:version_1.1
    ...    -o ${CURDIR}/../outputs/output-20260825-060016.xml:prod:project_2:version_1.1
    ...    -o ${CURDIR}/../outputs/output-20260826-021522.xml:dev:project_1:version_1.1
    ...    -o ${CURDIR}/../outputs/output-20260828-162040.xml:dev:project_1:version_1.1
    ...    -o ${CURDIR}/../outputs/output-20260828-174502.xml:dev:project_2:version_1.1
    ...    -o ${CURDIR}/../outputs/output-20260901-021519.xml:dev:project_1:version_1.2
    ...    -o ${CURDIR}/../outputs/output-20260902-060033.xml:dev:project_2:version_1.1
    ...    -o ${CURDIR}/../outputs/output-20260904-113007.xml:dev:project_1:version_1.2
    ...    -o ${CURDIR}/../outputs/output-20260905-130049.xml:dev:project_2:amount:version_1.2
    ...    -o ${CURDIR}/../outputs/output-20260909-021536.xml:prod:project_1:version_1.2
    ...    -o ${CURDIR}/../outputs/output-20260910-060011.xml:prod:project_2:version_1.2
    RETURN    ${files}

Generate Dashboard With Merged Output
    [Documentation]    Generates a dashboard with one regular run and one run merged from two outputs
    ...    with `rebot --merge`, the way `robot --rerunfailed` results are combined (see docs/reruns.md).
    ${index}    Get Dashboard Index
    Release Lock    name=dashboard_index
    VAR    ${DASHBOARD_INDEX}    ${index}    scope=test
    ${merged}    Set Variable    ${OUTPUT_DIR}/merged_${DASHBOARD_INDEX}.xml
    ${output}    Run    command=rebot --merge --output ${merged} --log NONE --report NONE ${CURDIR}/../outputs/output-20260817-021512.xml ${CURDIR}/../outputs/output-20260818-021545.xml
    Log    ${output}
    ${files}    Catenate  SEPARATOR=${SPACE}
    ...    -o ${CURDIR}/../outputs/output-20260817-021512.xml:prod:project_1:version_1.0
    ...    -o ${merged}:prod:project_1:version_1.0
    ${output}    Run    command=robotdashboard -d robotresults_${DASHBOARD_INDEX}.db ${files} -n robotdashboard_${DASHBOARD_INDEX}.html -j ${CURDIR}/../test_config.json
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
