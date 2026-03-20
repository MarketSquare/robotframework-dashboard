*** Settings ***
Documentation    This testsuite covers the generated HTML dashboard of robotdashboard

Resource    ../resources/keywords/dashboard-keywords.resource
Resource    ../resources/keywords/general-keywords.resource

Suite Setup    Start Browser
Suite Teardown    Close Browser
Test Setup    Run Keywords    Generate Dashboard    Open Dashboard
Test Teardown    Run Keywords    Close Dashboard    Remove Database And Dashboard With Index


*** Test Cases ***
Validate Dashboard Run Name Filter
    Set Run Filter    value=Tests
    Validate Component    id=runStatisticsSection    name=runNameFilter    folder=run

Validate Dashboard Date Filter
    Set Date Filter    fromDate=03132025    fromTime=1225am
    Validate Component    id=runStatisticsSection    name=runDateFilter    folder=run

Validate Dashboard Amount Filter
    Set Amount Filter    amount=5
    Validate Component    id=runStatisticsSection    name=runAmountFilter    folder=run

Add Filter Profile With Runs Filter
    Set Run Filter    value=Tests
    Add Filter Profile prfRuns For    Runs
    Filter Profile prfRuns Should Be    {'runs': 'Tests'}

Add Filter Profile With Run Tags Filter
    Set Run Tags Filter    prod    project_1
    Add Filter Profile prfTags For    RunTags
    Validate Selected Run Tags Of Filter Profile prfTags    prod    project_1    strict=True

Add Filter Profile With Versions Filter
    Set Versions Filter    None
    Add Filter Profile prfVersions For    Versions
    Filter Profile prfVersions Should Be    {'projectVersions': [{'value': 'All', 'checked': False}, {'value': 'None', 'checked': True}]}

Add Filter Profile With Date Filters
    Set Date Filter    fromDate=03132025    fromTime=1225am    toDate=04012025    toTime=1159pm

    Add Filter Profile prfFrom For    FromDate    FromTime
    Filter Profile prfFrom Should Be    {'fromDate': '2025-03-13', 'fromTime': '00:25'}

    Add Filter Profile prfTo For    ToDate    ToTime
    Filter Profile prfTo Should Be    {'toDate': '2025-04-01', 'toTime': '23:59'}

    Add Filter Profile prfFromTo For    FromDate    ToTime
    Filter Profile prfFromTo Should Be    {'fromDate': '2025-03-13', 'toTime': '23:59'}

Add Filter Profile With Amount Filter
    [Setup]    Run Keywords    Generate Dashboard With Mixed Tags    Open Dashboard
    Set Amount Filter    amount=200    close_filter_dialog=False
    Add Filter Profile prfAmount For    Amount    open_filter_dialog=False
    Filter Profile prfAmount Should Be    {'amount': '200'}
