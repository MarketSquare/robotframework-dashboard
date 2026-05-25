*** Settings ***
Documentation    This testsuite covers the generated HTML dashboard of robotdashboard

Resource    ../resources/keywords/dashboard-keywords.resource
Resource    ../resources/keywords/general-keywords.resource

Suite Setup    Run Keywords    Start Browser    Generate Dashboard
Suite Teardown    Run Keywords    Close Browser    Remove Database And Dashboard With Index
Test Setup    Open Dashboard
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
