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

Validate Dashboard Run Tags Filter
    Should Show 15 Of 15 Runs

    Set Run Tags Filter    dev
    Validate Component    id=runStatisticsSection    name=runTagsFilterDev    folder=run
    Should Show 7 Of 7 Runs

    Set Run Tags Filter    prod
    # the validation of the screenshot below should be 1% because there is no data which makes the dates
    # in the duration graph change to "current date" which causes unwanted issues
    Validate Component    id=runStatisticsSection    name=runTagsFilterDevProd    folder=run    threshold=0.01
    Should Show 0 Of 0 Runs

    Set Run Tags Filter    prod    strict=True
    Validate Component    id=runStatisticsSection    name=runTagsFilterProd    folder=run
    Should Show 8 Of 8 Runs

    Set Run Tags Filter    dev    amount    strict=True
    Validate Component    id=runStatisticsSection    name=runTagsFilterAmount    folder=run
    Should Show 1 Of 1 Runs

Validate Dashboard Date Filter
    Set Date Filter    fromDate=03132025    fromTime=1225am
    Validate Component    id=runStatisticsSection    name=runDateFilter    folder=run

Validate Dashboard Amount Filter
    Set Amount Filter    amount=5
    Validate Component    id=runStatisticsSection    name=runAmountFilter    folder=run

Add Filter Profile With Runs Filter
    Set Run Filter    value=Tests
    Add Filter Profile PrfRuns For    Runs
    Filter Profile PrfRuns Should Be    {'runs': 'Tests'}

Add Filter Profile With Run Tags Filter
    Set Run Tags Filter    prod    project_1
    Add Filter Profile PrfTags For    RunTags
    Validate Selected Run Tags Of Filter Profile PrfTags    prod    project_1    strict=True

Add Filter Profile With Versions Filter
    Set Versions Filter    None
    Add Filter Profile PrfVersions For    Versions
    Filter Profile PrfVersions Should Be    {'projectVersions': [{'value': 'All', 'checked': False}, {'value': 'None', 'checked': True}, {'value': '1.2', 'checked': False}, {'value': '1.1', 'checked': False}, {'value': '1.0', 'checked': False}]}

Add Filter Profile With Date Filters
    Set Date Filter    fromDate=03132025    fromTime=1225am    toDate=04012025    toTime=1159pm

    Add Filter Profile PrfFrom For    FromDate    FromTime
    Filter Profile PrfFrom Should Be    {'fromDate': '2025-03-13', 'fromTime': '00:25'}

    Add Filter Profile PrfTo For    ToDate    ToTime
    Filter Profile PrfTo Should Be    {'toDate': '2025-04-01', 'toTime': '23:59'}

    Add Filter Profile PrfFromTo For    FromDate    ToTime
    Filter Profile PrfFromTo Should Be    {'fromDate': '2025-03-13', 'toTime': '23:59'}

Add Filter Profile With Amount Filter
    Set Amount Filter    amount=200    close_filter_dialog=False
    Add Filter Profile PrfAmount For    Amount    open_filter_dialog=False
    Filter Profile PrfAmount Should Be    {'amount': '200'}

Applied Filter Profile Adds New Filter
    Set Run Filter    value=Tests
    Set Run Tags Filter    prod    project_1
    Set Versions Filter    1.2
    Set Date Filter    fromDate=03102025    fromTime=1010pm    toDate=03142025    toTime=0245am
    Set Amount Filter    amount=13    close_filter_dialog=False
    Add Filter Profile Profile1 For    Runs    RunTags    Versions
    ...    FromDate    FromTime    ToDate    ToTime    Amount    open_filter_dialog=False
    Reset Filters
    Apply Filter Profile    profile_name=Profile1
    Validate Filter Settings    runs=Tests    runTags=prod project_1    versions=1.2
    ...    fromDate=2025-03-10    fromTime=22:10    toDate=2025-03-14    toTime=02:45
    ...    amount=13
