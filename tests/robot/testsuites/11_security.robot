*** Settings ***
Documentation    This testsuite checks that result data cannot run script in the dashboard.
...              Robot Framework stores names, tags, metadata and messages as-is, so a payload in any
...              of them reaches the dashboard unchanged. The suite runs a payload test file, builds a
...              dashboard from it (with a payload run tag and project version) and opens every page.
...              Each payload pushes its name to window.__x when it runs; only the *HTML* message may,
...              because it is rendered as HTML on purpose, like in the Robot Framework log.

Library    OperatingSystem
Library    Process
Resource    ../resources/keywords/dashboard-keywords.resource

Suite Setup    Run Keywords    Generate Payload Dashboard    AND    Start Browser
Suite Teardown    Run Keywords    Stop Browser    AND    Remove Files    robotresults_security.db    robotdashboard_security.html


*** Variables ***
${PAYLOAD_START}    <img src=x onerror="(window.__x=window.__x||[]).push('
${PAYLOAD_END}      ')">


*** Test Cases ***
Result Data Is Not Rendered As HTML
    New Context    viewport={"width": 1920, "height": 2000}
    New Page    url=file:${ROOT_FOLDER}/robotdashboard_security.html
    Wait For Dashboard Ready
    Open Overview Page
    Open Dashboard Page
    Open Compare Page
    Open Tables Page
    Open Filter Dialog
    ${hits}    Evaluate JavaScript    ${None}    () => [...new Set(window.__x || [])].sort()
    Should Be Equal    ${hits}    ${{ ["htmlmessage"] }}


*** Keywords ***
Payload
    [Arguments]    ${name}
    RETURN    ${PAYLOAD_START}${name}${PAYLOAD_END}

Generate Payload Dashboard
    ${meta}    Payload    meta
    ${test}    Payload    testname
    ${tag}    Payload    tag
    ${message}    Payload    message
    ${html}    Payload    htmlmessage
    ${suite}    Payload    suite
    ${runtag}    Payload    runtag
    ${version}    Payload    version
    VAR    ${robot_file}    ${OUTPUT_DIR}/security_payload.robot
    VAR    ${output}    ${OUTPUT_DIR}/security_payload.xml
    ${content}    Catenate    SEPARATOR=\n
    ...    *** Settings ***
    ...    Metadata${SPACE*4}Env${meta}${SPACE*4}prod
    ...    ${EMPTY}
    ...    *** Test Cases ***
    ...    Test ${test}
    ...    ${SPACE*4}\[Tags]${SPACE*4}tag${tag}
    ...    ${SPACE*4}Fail${SPACE*4}Boom ${message}
    ...    ${EMPTY}
    ...    Html Message Test
    ...    ${SPACE*4}Fail${SPACE*4}*HTML* <b>bold</b>${html}
    Create File    ${robot_file}    ${content}
    Run Process    robot    --name    Suite${suite}    --output    ${output}    --log    NONE    --report    NONE
    ...    ${robot_file}
    Remove File    robotresults_security.db
    ${result}    Run Process    robotdashboard    -d    robotresults_security.db    -o    ${output}:tag${runtag}
    ...    --projectversion    v${version}    -n    robotdashboard_security.html
    Log    ${result.stdout}
    Should Be Equal As Integers    ${result.rc}    0
