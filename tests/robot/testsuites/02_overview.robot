*** Settings ***
Documentation    This testsuite covers the generated HTML dashboard of robotdashboard
...              And specifically the overview page

Resource    ../resources/keywords/dashboard-keywords.resource
Resource    ../resources/keywords/general-keywords.resource

Suite Setup    Start Browser
Suite Teardown    Stop Browser
Test Setup    Run Keywords    Generate Dashboard    Open Dashboard
Test Teardown    Run Keywords    Close Dashboard    Remove Database And Dashboard With Index


*** Test Cases ***
Validate Latest Runs
    Open Overview Page
    Validate Component    id=overviewLatestRunsSection    name=latestRuns    folder=overview

Validate Latest Runs Use Run Tags
    Open Overview Page
    Click    selector=id=settings
    Click    selector=id=overview-tab
    Click    selector=id=switchRunTags
    Click    selector=id=closeSettings
    Validate Component    id=overviewLatestRunsSection    name=latestRunsRunTags    folder=overview

Validate Total Statistics
    Open Overview Page
    Click    selector=id=collapsegridOverviewTotal
    Validate Component    id=overviewTotalStatsSection    name=totalStatistics    folder=overview

Validate Total Statistics Use Run Tags
    Open Overview Page
    Click    selector=id=settings
    Click    selector=id=overview-tab
    Click    selector=id=switchRunTags
    Click    selector=id=closeSettings
    Click    selector=id=collapsegridOverviewTotal
    Validate Component    id=overviewTotalStatsSection    name=totalStatisticsRunTags    folder=overview

Validate Project Tests
    Open Overview Page
    Click    selector=id=collapseTestsBody
    Validate Component    id=TestsSection    name=prjTests    folder=overview

Validate Project Testsuites
    Open Overview Page
    Click    selector=id=collapseTestsuitesBody
    Validate Component    id=TestsuitesSection    name=prjTestsuites    folder=overview

Validate Project Other
    Open Overview Page
    Click    selector=id=collapseTestsuitesBody
    Validate Component    id=TestsuitesSection    name=prjOther    folder=overview
