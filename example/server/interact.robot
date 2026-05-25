*** Settings ***
Documentation    Prerequisite: pip install robotframework-requests
...              Usage: robot example/server/interact.robot
...              Update the Variables section to match your --server argument.
...              When the server has no auth configured the AUTH tuple is ignored by the server.
...              And the AUTH parameter can be completely left out.

Library    RequestsLibrary
Suite Setup    Initialize Auth


*** Variables ***
${HOST}     127.0.0.1
${PORT}     8543
${USER}     user
${PASS}     pass
${URL}      http://${HOST}:${PORT}
${AUTH}     placeholder    # overwritten by Suite Setup with a proper tuple


*** Test Cases ***
Get Outputs
    [Documentation]    Get the outputs currently in the database (no auth required)
    ${response}    GET    url=${URL}/get-outputs
    Log    ${response.json()}

Get Logs
    [Documentation]    Get the log files currently on the server (no auth required)
    ${response}    GET    url=${URL}/get-logs
    Log    ${response.json()}

Add Output By Path With All Options
    [Documentation]    Add an output by absolute path with tags, version, alias, and custom filters (auth required)
    VAR    @{tags}    tag1    cool-tag2    production_tag
    VAR    &{body}
    ...    output_path=C:\\users\\docs\\output.xml
    ...    output_tags=${tags}
    ...    output_alias=nightly_run
    ...    output_version=v1.2.3
    ...    output_custom_filters=env=prod:team=backend
    ${response}    POST    url=${URL}/add-outputs    json=${body}    auth=${AUTH}
    Log    ${response.json()}

Add Output By Folder Path
    [Documentation]    Add all *output*.xml files found recursively in a folder (auth required)
    VAR    @{tags}    production-run
    VAR    &{body}
    ...    output_folder_path=C:\\users\\docs\\prod-outputs
    ...    output_tags=${tags}
    ...    output_version=v1.2.3
    ${response}    POST    url=${URL}/add-outputs    json=${body}    auth=${AUTH}
    Log    ${response.json()}

Remove Outputs With Mixed Selectors
    [Documentation]    Remove outputs by index, run_start, alias, and tag in one call (auth required)
    VAR    @{indexes}      0    -1
    VAR    @{run_starts}   2025-03-13 00:22:22.304104
    VAR    @{aliases}      nightly_run
    VAR    @{tags}         old-tag
    VAR    &{body}
    ...    indexes=${indexes}
    ...    run_starts=${run_starts}
    ...    aliases=${aliases}
    ...    tags=${tags}
    ${response}    DELETE    url=${URL}/remove-outputs    json=${body}    auth=${AUTH}
    Log    ${response.json()}

Remove Outputs By Limit
    [Documentation]    Keep only the 100 most recent runs, auto-delete the rest (auth required)
    VAR    &{body}    limit=${100}
    ${response}    DELETE    url=${URL}/remove-outputs    json=${body}    auth=${AUTH}
    Log    ${response.json()}

Add Log By Content
    [Documentation]    Add a log file by HTML content and associate it with the matching run (auth required)
    VAR    &{body}
    ...    log_name=log-20250219-172527.html
    ...    log_data=<!DOCTYPE html><html lang="en"><head><title>Log</title></head><body>...</body></html>
    ${response}    POST    url=${URL}/add-log    json=${body}    auth=${AUTH}
    Log    ${response.json()}

Remove Log By Name
    [Documentation]    Remove a specific log file from the server (auth required)
    VAR    &{body}    log_name=log-20250219-172527.html
    ${response}    DELETE    url=${URL}/remove-log    json=${body}    auth=${AUTH}
    Log    ${response.json()}

Refresh Dashboard
    [Documentation]    Manually trigger dashboard HTML regeneration — useful when --noautoupdate is active (auth required)
    ${response}    POST    url=${URL}/refresh-dashboard    auth=${AUTH}
    Log    ${response.json()}


*** Keywords ***
Initialize Auth
    [Documentation]    Create the Basic Auth tuple from the USER and PASS variables
    ${auth}=    Evaluate    ('${USER}', '${PASS}')
    Set Suite Variable    ${AUTH}    ${auth}
