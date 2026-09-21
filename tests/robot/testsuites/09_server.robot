*** Settings ***
Documentation    This testsuite covers the server mode of robotdashboard (`--server`) end to end: a real
...              `robotdashboard --server` process per test, the REST API, the hosted dashboard in the
...              browser, log linking and the packaged Robot Framework listener uploading into it.

Resource    ../resources/keywords/server-keywords.resource

Suite Setup    Start Browser
Suite Teardown    Close Browser
Test Setup    Start Dashboard Server
Test Teardown    Stop Dashboard Server


*** Test Cases ***
Server Hosts The Dashboard And The Admin Page
    ${response}    Server Request    GET    /
    Should Be Equal As Integers    ${response}[status]    200
    Should Contain    ${response}[body]    <title>Robot Framework Dashboard</title>
    ${response}    Server Request    GET    /admin
    Should Be Equal As Integers    ${response}[status]    200
    Should Contain    ${response}[body]    <title>Admin Page</title>

Server Adds Outputs And Regenerates The Dashboard
    Server Should Have 0 Outputs
    Add Output Via Server    output-20260817-021512.xml    tags=prod:project_1    version=1.0
    Add Output Via Server    output-20260817-060004.xml    tags=dev:project_2
    ${outputs}    Get Server Outputs
    Length Should Be    ${outputs}    2
    Should Be Equal    ${outputs}[0][name]    WebshopUI
    Should Be Equal    ${outputs}[0][tags]    prod,project_1
    Should Be Equal    ${outputs}[1][name]    WebshopAPI
    Open Served Dashboard
    Should Show 2 Of 2 Runs
    Set Run Filter    value=WebshopUI
    Should Show 1 Of 1 Runs

Server Adds Raw Output Data With An Alias
    Add Output Data Via Server    output-20260818-021545.xml    alias=nightly-ui
    ${outputs}    Get Server Outputs
    Length Should Be    ${outputs}    1
    Should Be Equal    ${outputs}[0][alias]    nightly-ui

Server Removes Outputs By Tag, Index And Alias
    [Documentation]    Runs added by path get their file name as alias.
    Add Output Via Server    output-20260817-021512.xml    tags=keep
    Add Output Via Server    output-20260818-021545.xml    tags=drop
    Add Output Via Server    output-20260819-144031.xml    tags=keep
    Server Should Have 3 Outputs
    Remove Outputs Via Server    {"tags": ["drop"]}
    Server Should Have 2 Outputs
    Remove Outputs Via Server    {"indexes": ["-1"]}
    ${outputs}    Get Server Outputs
    Length Should Be    ${outputs}    1
    Should Be Equal    ${outputs}[0][alias]    output-20260817-021512
    Add Output Via Server    output-20260818-021545.xml
    Remove Outputs Via Server    {"aliases": ["output-20260817-021512"]}
    ${outputs}    Get Server Outputs
    Length Should Be    ${outputs}    1
    Should Be Equal    ${outputs}[0][alias]    output-20260818-021545
    Remove Outputs Via Server    {"all": true}
    Server Should Have 0 Outputs
    Open Served Dashboard
    Should Show 0 Of 0 Runs

Server Links Uploaded Logs To Their Runs
    [Documentation]    log-XYZ.html is stored in robot_logs/ and linked to the run of output-XYZ.xml;
    ...    the hosted dashboard then opens it through /log?path=.
    Add Output Via Server    output-20260817-021512.xml
    Add Log Via Server    log-20260817-021512.html    <html><body>uploaded log</body></html>
    ${logs}    Get Server Logs
    Should Be Equal    ${logs}    ${{ ["log-20260817-021512.html"] }}
    File Should Exist    path=${SERVER_DIR}/robot_logs/log-20260817-021512.html
    ${response}    Server Request    GET    /log?path=robot_logs/log-20260817-021512.html
    Should Be Equal As Integers    ${response}[status]    200
    Should Contain    ${response}[body]    uploaded log
    Open Served Dashboard
    ${run_path}    Evaluate JavaScript    ${None}    () => runs[0].path
    Should End With    ${run_path}    log-20260817-021512.html
    Server Request Should Succeed    DELETE    /remove-log    {"log_name": "log-20260817-021512.html"}
    ${logs}    Get Server Logs
    Should Be Empty    ${logs}

Server Requires Basic Auth For Admin And Mutations When Configured
    [Setup]    Start Dashboard Server    auth=True
    ${response}    Server Request    GET    /admin
    Should Be Equal As Integers    ${response}[status]    401
    ${response}    Server Request    GET    /admin    headers=${{ {"Authorization": "Basic d3Jvbmc6d3Jvbmc="} }}
    Should Be Equal As Integers    ${response}[status]    401
    ${headers}    Basic Auth Header
    ${response}    Server Request    GET    /admin    headers=${headers}
    Should Be Equal As Integers    ${response}[status]    200
    ${response}    Server Request    POST    /add-outputs    {"output_path": "${OUTPUTS_FOLDER}/output-20260817-021512.xml"}
    Should Be Equal As Integers    ${response}[status]    401
    Add Output Via Server    output-20260817-021512.xml    headers=${headers}
    # read-only endpoints and the dashboard itself stay open
    Server Should Have 1 Outputs
    ${response}    Server Request    GET    /
    Should Be Equal As Integers    ${response}[status]    200

Server Without Autoupdate Regenerates On Refresh Only
    [Setup]    Start Dashboard Server    extra_args=--noautoupdate
    Add Output Via Server    output-20260817-021512.xml
    Open Served Dashboard
    Should Show 0 Of 0 Runs
    Server Request Should Succeed    POST    /refresh-dashboard
    Open Served Dashboard
    Should Show 1 Of 1 Runs

Listener Uploads Output And Log To The Server
    ${result}    Run Robot With Dashboard Listener    listener_args=:tags=listener,ci:version=2.0:uploadlog=true
    Should Not Contain    ${result.stdout}    ERROR
    Should Contain    ${result.stdout}    robotdashboardlistener: starting processing output.xml
    ${outputs}    Get Server Outputs
    Length Should Be    ${outputs}    1
    Should Be Equal    ${outputs}[0][name]    Listener Suite
    Should Be Equal    ${outputs}[0][tags]    listener,ci
    ${logs}    Get Server Logs
    Should Be Equal    ${logs}    ${{ ["log-listener.html"] }}
    Open Served Dashboard
    Should Show 1 Of 1 Runs
    ${run}    Evaluate JavaScript    ${None}    () => ({ passed: runs[0].passed, failed: runs[0].failed, version: runs[0].project_version })
    Should Be Equal As Integers    ${run}[passed]    1
    Should Be Equal As Integers    ${run}[failed]    1
    Should Be Equal    ${run}[version]    2.0
