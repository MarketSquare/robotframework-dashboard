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
    Set Date Filter    fromDate=13032025    fromTime=0025
    Validate Component    id=runStatisticsSection    name=runDateFilter    folder=run

Validate Dashboard Amount Filter
    Set Amount Filter    amount=5
    Validate Component    id=runStatisticsSection    name=runAmountFilter    folder=run
