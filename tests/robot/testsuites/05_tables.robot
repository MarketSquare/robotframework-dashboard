*** Settings ***
Documentation    This testsuite covers the generated HTML dashboard of robotdashboard

Resource    ../resources/keywords/dashboard-keywords.resource
Resource    ../resources/keywords/general-keywords.resource

Suite Setup    Start Browser
Suite Teardown    Close Browser
Test Setup    Run Keywords    Generate Shared Dashboard    Open Dashboard
Test Teardown    Close Dashboard


*** Test Cases ***
Validate Compare Run Table Base View
    Open Tables Page
    Validate Component    id=runTableCanvas    name=baseRunTable    folder=tables

Validate Compare Suite Table Base View
    Open Tables Page
    Validate Component    id=suiteTableCanvas    name=baseSuiteTable    folder=tables

Validate Compare Test Table Base View
    Open Tables Page
    Validate Component    id=testTableCanvas    name=baseTestTable    folder=tables

Validate Compare Keyword Table Base View
    Open Tables Page
    Validate Component    id=keywordTableCanvas    name=baseKeywordTable    folder=tables

Validate Compare Exception Table Base View
    Open Tables Page
    Validate Component    id=exceptionTableCanvas    name=baseExceptionTable    folder=tables

Tables Track Holds One Item Per Shown Table
    [Documentation]    The tables page carries the same segmented track as the dashboard, one pill per
    ...    table, in the order the tables are laid out.
    Open Tables Page
    Wait For Elements State    selector=id=tablesNavTrack    state=visible
    ${items}    Get Section Track Items    tablesNavTrack
    Should Be Equal    ${items}    ${{ ['Runs', 'Suites', 'Tests', 'Keywords', 'Exceptions'] }}
    ${stale}    Get Stale Section Track Items    tablesNavTrack    tables
    Should Be Empty    ${stale}

Tables Track Item Scrolls To Its Table And Fills Its Pill
    Open Tables Page
    Click    selector=id=tables-keywordTableCanvasNav
    Wait For Dashboard Idle
    Wait Until Keyword Succeeds    5s    200ms    Section Track Item Should Be Active    tablesNavTrack    Keywords

Tables Track Is Gone On A Page Without Tables
    Open Tables Page
    Wait For Elements State    selector=id=tablesNavTrack    state=visible
    Open Overview Page
    Wait For Elements State    selector=id=tablesNavTrack    state=hidden
