*** Settings ***
Documentation    This testsuite covers the generated HTML dashboard of robotdashboard

Resource    ../resources/keywords/dashboard-keywords.resource
Resource    ../resources/keywords/general-keywords.resource

Suite Setup    Start Browser
Suite Teardown    Close Browser
Test Setup    Run Keywords    Generate Shared Dashboard    Open Dashboard
Test Teardown    Close Dashboard


*** Test Cases ***
Validate Settings
    Change Settings
    # threshold loosened to 0.01 (99% accuracy) — chart re-renders after multiple settings changes cause minor pixel variations
    Validate Component    id=runStatisticsSection    name=changedSettings    folder=run    threshold=0.01

Settings Toggles Persist To Local Storage And Survive A Reload
    Toggle Setting    toggleLegends
    Setting Should Be    show.legends    ${False}
    Toggle Setting    toggleAxisTitles
    Setting Should Be    show.axisTitles    ${False}
    Toggle Setting    toggleLabels    tab=labels-time
    Setting Should Be    show.dateLabels    ${False}
    Select Setting    toggleBarRounding    0
    Setting Should Be    show.rounding    ${0}
    Graph Legend Should Be Hidden    runStatisticsGraph
    Reload Dashboard
    Get Checkbox State    selector=id=toggleLegends    assertion_operator===    assertion_expected=unchecked
    Get Checkbox State    selector=id=toggleAxisTitles    assertion_operator===    assertion_expected=unchecked
    Graph Legend Should Be Hidden    runStatisticsGraph

Theme Switch Persists After Reload
    Get Attribute    selector=html    attribute=data-bs-theme    assertion_operator===    assertion_expected=dark
    Click    selector=id=themeDark
    Setting Should Be    theme    light
    Get Attribute    selector=html    attribute=data-bs-theme    assertion_operator===    assertion_expected=light
    Reload Dashboard
    Get Attribute    selector=html    attribute=data-bs-theme    assertion_operator===    assertion_expected=light

Unified View Renders All Dashboard Graphs In One Grid
    Toggle Setting    toggleUnified    tab=defaults
    Setting Should Be    show.unified    ${True}
    Get Property    selector=id=unified    property=hidden    assertion_operator===    assertion_expected=${False}
    Get Property    selector=id=dashboard    property=hidden    assertion_operator===    assertion_expected=${True}
    Get Element Count    selector=css=#gridUnified .grid-stack-item    assertion_operator=>    assertion_expected=20
    Get Element Count    selector=css=#gridRun .grid-stack-item    assertion_operator===    assertion_expected=0

Default Suite Selection Setting Is Applied On Load
    Select Setting    toggleSuitesSelectionInSuiteStats    All Suites Combined    tab=defaults
    Setting Should Be    show.suitesSelectionInSuiteStats    All Suites Combined
    Reload Dashboard
    Get Selected Options    id=suiteSelectSuites    value    ==    All Suites Combined

Apply Settings From The JSON Tab
    Apply Settings JSON    s.show.legends = false
    Setting Should Be    show.legends    ${False}
    Get Checkbox State    selector=id=toggleLegends    assertion_operator===    assertion_expected=unchecked
    Graph Legend Should Be Hidden    runStatisticsGraph

Reset Settings Restores The Defaults
    Toggle Setting    toggleLegends
    Setting Should Be    show.legends    ${False}
    Reset Settings To Default
    Setting Should Be    show.legends    ${True}
    Get Checkbox State    selector=id=toggleLegends    assertion_operator===    assertion_expected=checked
