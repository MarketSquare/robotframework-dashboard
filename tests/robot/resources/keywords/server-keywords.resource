*** Settings ***
Documentation    Keywords for the --server end-to-end tests: one robotdashboard server process per test on
...              its own port and in its own working directory, driven through the REST API with the
...              Browser library's Http keyword and opened in the browser like a user would.
Library    OperatingSystem
Library    Process
Library    Browser
Resource    dashboard-keywords.resource
Resource    general-keywords.resource


*** Variables ***
${SERVER_BASE_PORT}    8600
${SERVER_USER}    admin
${SERVER_PASS}    secret
${SERVER_DIR}    ${None}
${SERVER_URL}    ${None}
${OUTPUTS_FOLDER}    ${CURDIR}/../outputs


*** Keywords ***
Start Dashboard Server
    [Documentation]    Starts `robotdashboard --server` in a fresh directory below the results folder
    ...    (the server writes robot_dashboard.html, the database and robot_logs/ into its working
    ...    directory). The port is derived from the shared dashboard index so parallel tests never
    ...    collide. ${auth}=True adds ${SERVER_USER}:${SERVER_PASS}; ${extra_args} are appended as-is.
    [Arguments]    ${auth}=False    ${extra_args}=${EMPTY}
    ${index}    Get Dashboard Index
    Release Lock    name=dashboard_index
    VAR    ${DASHBOARD_INDEX}    ${index}    scope=test
    ${port}    Evaluate    ${SERVER_BASE_PORT} + ${index}
    VAR    ${SERVER_URL}    http://127.0.0.1:${port}    scope=test
    VAR    ${SERVER_DIR}    ${OUTPUT_DIR}/server_${index}    scope=test
    Create Directory    path=${SERVER_DIR}
    VAR    ${server}    127.0.0.1:${port}
    IF    ${auth}    VAR    ${server}    ${server}:${SERVER_USER}:${SERVER_PASS}
    Start Process    robotdashboard --server ${server} -d robotresults.db ${extra_args}
    ...    shell=True    cwd=${SERVER_DIR}    alias=dashboard_server
    ...    stdout=${SERVER_DIR}/server_stdout.txt    stderr=STDOUT
    # the Http keyword runs fetch() inside the page, so the page must be on the server's origin
    # (the API sends no CORS headers); the JSON endpoint is the lightest page to park it on
    New Context    colorScheme=dark    viewport={"width": 1920, "height": 2000}
    New Page
    Wait Until Keyword Succeeds    30s    500ms    Go To    url=${SERVER_URL}/get-outputs
    Server Should Respond

Stop Dashboard Server
    Close Page
    Close Context
    ${result}    Terminate Process    handle=dashboard_server    kill=True
    ${stdout}    Get File    path=${SERVER_DIR}/server_stdout.txt
    Log    ${stdout}

Server Should Respond
    ${response}    Http    ${SERVER_URL}/get-outputs
    Should Be Equal As Integers    ${response}[status]    200

Basic Auth Header
    [Arguments]    ${user}=${SERVER_USER}    ${password}=${SERVER_PASS}
    ${token}    Evaluate    base64.b64encode(($user + ":" + $password).encode()).decode()    modules=base64
    RETURN    {"Authorization": "Basic ${token}"}

Server Request
    [Documentation]    One REST call; ${body} is a JSON string. Returns the Browser Http response dict
    ...    (status, body - parsed when JSON - and headers).
    [Arguments]    ${method}    ${path}    ${body}=${None}    ${headers}=${None}
    IF    $headers is None    VAR    &{headers}    &{EMPTY}
    ${response}    Http    ${SERVER_URL}${path}    method=${method}    body=${body}    headers=${headers}
    Log    ${response}
    RETURN    ${response}

Server Request Should Succeed
    [Documentation]    Runs the request and checks the ResponseMessage success flag of a mutation endpoint.
    [Arguments]    ${method}    ${path}    ${body}=${None}    ${headers}=${None}
    ${response}    Server Request    ${method}    ${path}    ${body}    ${headers}
    Should Be Equal As Integers    ${response}[status]    200
    Should Be Equal    ${response}[body][success]    1    msg=${response}[body][message]
    RETURN    ${response}

Add Output Via Server
    [Documentation]    POST /add-outputs with a fixture path; ${tags} colon separated like the CLI.
    ...    The alias of a run added by path is its file name (output_alias only applies to output_data).
    [Arguments]    ${output_name}    ${tags}=${EMPTY}    ${version}=${EMPTY}    ${headers}=${None}
    ${tag_list}    Evaluate    [tag for tag in $tags.split(":") if tag]
    ${body}    Evaluate
    ...    json.dumps({"output_path": $OUTPUTS_FOLDER + "/" + $output_name, "output_tags": $tag_list, "output_version": $version or None})
    ...    modules=json
    ${response}    Server Request Should Succeed    POST    /add-outputs    ${body}    ${headers}
    RETURN    ${response}

Add Output Data Via Server
    [Documentation]    POST /add-outputs with the raw XML of a fixture in output_data.
    [Arguments]    ${output_name}    ${alias}
    ${xml}    Get File    path=${OUTPUTS_FOLDER}/${output_name}
    ${body}    Evaluate    json.dumps({"output_data": $xml, "output_alias": $alias})    modules=json
    ${response}    Server Request Should Succeed    POST    /add-outputs    ${body}
    RETURN    ${response}

Get Server Outputs
    [Documentation]    GET /get-outputs as a list of {run_start, name, alias, tags, custom_filters}.
    ${response}    Server Request    GET    /get-outputs
    Should Be Equal As Integers    ${response}[status]    200
    RETURN    ${response}[body]

Server Should Have ${amount} Outputs
    ${outputs}    Get Server Outputs
    Length Should Be    ${outputs}    ${amount}

Remove Outputs Via Server
    [Documentation]    DELETE /remove-outputs; ${selector} is the JSON body, e.g. {"aliases": ["abc"]}.
    [Arguments]    ${selector}
    ${response}    Server Request Should Succeed    DELETE    /remove-outputs    ${selector}
    RETURN    ${response}

Add Log Via Server
    [Documentation]    POST /add-log links log-XYZ.html to the run of output-XYZ.xml in the database.
    [Arguments]    ${log_name}    ${content}
    ${body}    Evaluate    json.dumps({"log_name": $log_name, "log_data": $content})    modules=json
    ${response}    Server Request Should Succeed    POST    /add-log    ${body}
    RETURN    ${response}

Get Server Logs
    [Documentation]    GET /get-logs as a plain list of log file names.
    ${response}    Server Request    GET    /get-logs
    Should Be Equal As Integers    ${response}[status]    200
    ${logs}    Evaluate    [entry["log_name"] for entry in $response["body"]]
    RETURN    ${logs}

Open Served Dashboard
    [Documentation]    Opens the dashboard the server hosts at / in the browser page of this test.
    Go To    url=${SERVER_URL}/
    Wait For Dashboard Ready

Run Robot With Dashboard Listener
    [Documentation]    Runs the listener fixture suite with the packaged listener pointed at this test's
    ...    server, the way a CI job would; output and log names follow the log linking convention.
    [Arguments]    ${listener_args}=${EMPTY}
    # built as a variable first: a literal "port=" in the argument would be taken as a named argument
    VAR    ${listener}    robotframework_dashboard.robotdashboardlistener:port=${SERVER_URL.split(":")[-1]}${listener_args}
    VAR    ${command}
    ...    robot --listener ${listener} --outputdir ${SERVER_DIR}/listener --output output-listener.xml --log log-listener.html --report report-listener.html ${CURDIR}/../listener/listener_suite.robot
    ${result}    Run Process    ${command}    shell=True    cwd=${SERVER_DIR}
    Log    ${result.stdout}
    Log    ${result.stderr}
    RETURN    ${result}
