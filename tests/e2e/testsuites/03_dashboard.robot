*** Settings ***
Documentation    This testsuite covers the generated HTML dashboard of robotdashboard

Resource    ../resources/keywords/dashboard-keywords.resource
Resource    ../resources/keywords/general-keywords.resource

Suite Setup    Start Browser
Suite Teardown    Close Browser
Test Setup    Run Keywords    Generate Dashboard    Open Dashboard
Test Teardown    Run Keywords    Close Dashboard    Remove Database And Dashboard With Index


*** Test Cases ***
Validate Dashboard Run Statistics
    Validate Component    id=runStatisticsSection    name=baseRunSection    folder=run

Validate Dashboard Suite Statistics
    Validate Component    id=suiteStatisticsSection    name=baseSuiteSection    folder=suite

Validate Dashboard Test Statistics
    Validate Component    id=testStatisticsSection    name=baseTestSection    folder=test

Validate Dashboard Keyword Statistics
    Validate Component    id=keywordStatisticsSection    name=baseKeywordSection    folder=keyword
