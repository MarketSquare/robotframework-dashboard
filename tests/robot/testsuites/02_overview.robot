*** Settings ***
Documentation    This testsuite covers the generated HTML dashboard of robotdashboard
...              And specifically the overview page

Resource    ../resources/keywords/dashboard-keywords.resource
Resource    ../resources/keywords/general-keywords.resource

Suite Setup    Start Browser
Suite Teardown    Stop Browser
Test Setup    Run Keywords    Generate Shared Dashboard    Open Dashboard
Test Teardown    Close Dashboard


*** Test Cases ***
Validate Latest Runs
    Open Overview Page
    Validate Component    id=overviewLatestRunsSection    name=overviewLatestRuns
    Validate Section Data    id=overviewLatestRunsSection    name=overviewLatestRuns    text=${True}

Validate Latest Runs Use Run Tags
    Open Overview Page
    Click    selector=id=settings
    Click    selector=id=overview-tab
    Click    selector=id=switchRunTags
    Click    selector=id=closeSettings
    Validate Section Data    id=overviewLatestRunsSection    name=overviewLatestRunsRunTags    text=${True}

Validate Total Statistics
    Open Overview Page
    Click    selector=id=collapsegridOverviewTotal
    Validate Component    id=overviewTotalStatsSection    name=overviewTotalStatistics
    Validate Section Data    id=overviewTotalStatsSection    name=overviewTotalStatistics    text=${True}

Validate Total Statistics Use Run Tags
    Open Overview Page
    Click    selector=id=settings
    Click    selector=id=overview-tab
    Click    selector=id=switchRunTags
    Click    selector=id=closeSettings
    Click    selector=id=collapsegridOverviewTotal
    Validate Section Data    id=overviewTotalStatsSection    name=overviewTotalStatisticsRunTags    text=${True}

Validate Project WebshopUI
    Open Overview Page
    Click    selector=id=collapseWebshopUIBody
    Validate Component    id=WebshopUISection    name=overviewProjectWebshopUI
    Validate Section Data    id=WebshopUISection    name=overviewProjectWebshopUI    text=${True}

Validate Project WebshopAPI
    Open Overview Page
    Click    selector=id=collapseWebshopAPIBody
    Validate Section Data    id=WebshopAPISection    name=overviewProjectWebshopAPI    text=${True}

Overview Section Track Follows The Project Bar Settings
    [Documentation]    Switching the project bars on or off changes which overview sections exist, so
    ...    the section track has to be rebuilt with them. It used to keep items for bars that were
    ...    switched off, which then scrolled nowhere.
    Open Overview Page
    ${stale}    Get Stale Section Track Items    overviewNavTrack    overview
    Should Be Empty    ${stale}
    Click    selector=id=settings
    Click    selector=id=overview-tab
    Click    selector=id=switchRunTags
    Click    selector=id=closeSettings
    Wait For Dashboard Idle
    ${stale}    Get Stale Section Track Items    overviewNavTrack    overview
    Should Be Empty    ${stale}
    Click    selector=id=settings
    Click    selector=id=overview-tab
    Click    selector=id=switchRunName
    Click    selector=id=closeSettings
    Wait For Dashboard Idle
    ${stale}    Get Stale Section Track Items    overviewNavTrack    overview
    Should Be Empty    ${stale}
