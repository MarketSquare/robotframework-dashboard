*** Settings ***
Documentation    This testsuite covers the generated HTML dashboard of robotdashboard

Resource    ../resources/keywords/dashboard-keywords.resource
Resource    ../resources/keywords/general-keywords.resource

Suite Setup    Run Keywords    Start Browser    Generate Dashboard
Suite Teardown    Run Keywords    Close Browser    Remove Database And Dashboard With Index
Test Setup    Open Dashboard
Test Teardown    Close Dashboard


*** Test Cases ***
Validate Compare Base View
    Open Compare Page
    Validate Component    id=compareStatisticsSection    name=baseCompareSection    folder=compare
