*** Settings ***
Documentation    This testsuite covers the Live page: replaying a run from its robotframework-events file

Library    OperatingSystem
Library    String
Resource    ../resources/keywords/dashboard-keywords.resource
Resource    ../resources/keywords/general-keywords.resource

Suite Setup    Start Browser
Suite Teardown    Close Browser
Test Setup    Run Keywords    Generate Shared Dashboard    Open Dashboard With Editor Host    Open Live Page
Test Teardown    Close Dashboard


*** Variables ***
${EVENTS}    ${CURDIR}/../resources/events/live_sample_events.jsonl


*** Test Cases ***
Validate Live Page Without A Run
    Browser.Get Text    id=liveBadge    ==    WAITING
    Get Element States    id=liveEmpty    contains    visible
    Get Element States    id=liveReplayBar    contains    hidden
    # the editor host reads the events files of history runs
    Get Element States    id=liveReplayRun    contains    visible

Validate Live Page Is Hidden Without An Editor Host
    [Setup]    Run Keywords    Generate Shared Dashboard    Open Dashboard
    Get Element States    id=menuLive    contains    hidden
    Go To    file:${ROOT_FOLDER}/robotdashboard_${DASHBOARD_INDEX}.html?page=live
    Wait For Dashboard Ready
    Get Element States    id=live    contains    hidden
    Get Element States    id=overview    contains    visible

Validate Replay From Events File
    Upload File By Selector    id=liveReplayFileInput    ${EVENTS}
    Browser.Get Text    id=liveBadge    ==    FAIL
    Browser.Get Text    id=liveDone    ==    3/3
    Browser.Get Text    id=livePassed    ==    1
    Browser.Get Text    id=liveFailed    ==    1
    Browser.Get Text    id=liveSkipped    ==    1
    Get Element States    id=liveReplayBar    contains    visible
    Browser.Get Text    id=liveReplayName    ==    Replay: live_sample_events.jsonl
    Get Element Count    css=#liveTests .live-test-row    ==    3

Validate Replay Slider Moves Through The Run
    Upload File By Selector    id=liveReplayFileInput    ${EVENTS}
    Move Replay Slider    15
    Browser.Get Text    id=liveBadge    ==    REPLAY
    Browser.Get Text    id=liveDone    ==    0/3
    Get Element Count    css=#liveTests .live-test-row    ==    1
    Move Replay Slider    max
    Browser.Get Text    id=liveBadge    ==    FAIL
    Browser.Get Text    id=liveDone    ==    3/3

Validate Close Replay
    Upload File By Selector    id=liveReplayFileInput    ${EVENTS}
    Click    id=liveReplayClose
    Browser.Get Text    id=liveBadge    ==    WAITING
    Get Element States    id=liveReplayBar    contains    hidden
    Get Element States    id=liveEmpty    contains    visible

Validate Replay Of Gzipped Events File
    ${gzipped}    Set Variable    ${OUTPUT DIR}/live_sample_events_${DASHBOARD_INDEX}.jsonl.gz
    Evaluate    __import__("shutil").copyfileobj(open(r"${EVENTS}", "rb"), __import__("gzip").open(r"${gzipped}", "wb"))
    Upload File By Selector    id=liveReplayFileInput    ${gzipped}
    Browser.Get Text    id=liveDone    ==    3/3
    [Teardown]    Run Keywords    Remove File    ${gzipped}    AND    Close Dashboard

Validate Failed Test Shows Its Error
    Upload File By Selector    id=liveReplayFileInput    ${EVENTS}
    Click    css=#liveTests .live-test-row >> text=Failing Test
    Browser.Get Text    id=liveDetailTitle    *=    Should Be Equal
    Browser.Get Text    css=#liveDetailBody .live-error-box    ==    1 != 2

Validate Replay Of A File Without Events
    ${empty}    Set Variable    ${OUTPUT DIR}/no_events_${DASHBOARD_INDEX}.jsonl
    Create File    ${empty}    not an event${\n}
    Upload File By Selector    id=liveReplayFileInput    ${empty}
    Browser.Get Text    id=liveReplayError    ==    No events in no_events_${DASHBOARD_INDEX}.jsonl.
    Browser.Get Text    id=liveBadge    ==    WAITING
    [Teardown]    Run Keywords    Remove File    ${empty}    AND    Close Dashboard


*** Keywords ***
Open Dashboard With Editor Host
    [Documentation]    Opens a copy of the dashboard the way PyCharm shows it: a JCEF host object
    ...    (window.robotdashboardHost) exists before the page's scripts run. The Live page needs a host.
    ${html}    Get File    ${ROOT_FOLDER}/robotdashboard_${DASHBOARD_INDEX}.html
    ${html}    Replace String    ${html}    <head>    <head><script>window.robotdashboardHost = { postMessage() {} };</script>    count=1
    Create File    ${ROOT_FOLDER}/robotdashboard_${DASHBOARD_INDEX}_host.html    ${html}
    New Context    colorScheme=dark    viewport={"width": 1920, "height": 2000}
    New Page    url=file:${ROOT_FOLDER}/robotdashboard_${DASHBOARD_INDEX}_host.html
    Wait For Dashboard Ready

Open Live Page
    Click    id=menuLive
    Wait For Elements State    id=live    visible

Move Replay Slider
    [Arguments]    ${position}
    ${value}    Set Variable If    "${position}" == "max"    el.max    ${position}
    Evaluate JavaScript    id=liveReplaySlider    (el) => { el.value = ${value}; el.dispatchEvent(new Event("input")); }
    Wait For Dashboard Idle
