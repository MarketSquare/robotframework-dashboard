*** Settings ***
Documentation    This testsuite covers the generated HTML dashboard of robotdashboard

Resource    ../resources/keywords/dashboard-keywords.resource
Resource    ../resources/keywords/general-keywords.resource

Suite Setup    Start Browser
Suite Teardown    Close Browser
Test Setup    Run Keywords    Generate Shared Dashboard    Open Dashboard
Test Teardown    Close Dashboard


*** Test Cases ***
Validate Dashboard Run Statistics
    Validate Component    id=runStatisticsSection    name=baseRunSection    folder=run

Validate Dashboard Suite Statistics
    Validate Component    id=suiteStatisticsSection    name=baseSuiteSection    folder=suite

Validate Dashboard Test Statistics
    Validate Component    id=testStatisticsSection    name=baseTestSection    folder=test

Validate Dashboard Keyword Statistics
    Validate Component    id=keywordStatisticsSection    name=baseKeywordSection    folder=keyword

Validate Dashboard Test Statistics Rerun View
    [Documentation]    A run merged with `rebot --merge` keeps the attempt history of its tests: the
    ...    Reruns select marks re-executed tests and can show their first attempt instead.
    [Setup]    Run Keywords    Generate Dashboard With Merged Output    Open Dashboard
    [Teardown]    Run Keywords    Close Dashboard    Remove Database And Dashboard With Index
    ${withAttempts}    Get Test Count With Attempts
    Should Be True    ${withAttempts} > 0
    ${marked}    Get Rerun Marked Bar Count
    Should Be True    ${marked} > 0    # default view marks re-executed tests
    Set Test Statistics Rerun View    final
    ${marked}    Get Rerun Marked Bar Count
    Should Be Equal As Integers    ${marked}    0
    Set Test Statistics Rerun View    first
    ${marked}    Get Rerun Marked Bar Count
    Should Be True    ${marked} > 0
    Set Test Statistics Rerun View    reruns
    ${marked}    Get Rerun Marked Bar Count
    Should Be True    ${marked} > 0
    Open Compare Page
    ${markedCompare}    Get Rerun Marked Bar Count    graph=compareTestsGraph
    Should Be True    ${markedCompare} > 0
    Set Compare Tests Rerun View    final
    ${markedCompare}    Get Rerun Marked Bar Count    graph=compareTestsGraph
    Should Be Equal As Integers    ${markedCompare}    0
