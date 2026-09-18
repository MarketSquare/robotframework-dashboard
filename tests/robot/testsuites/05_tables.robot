*** Settings ***
Documentation    This testsuite covers the generated HTML dashboard of robotdashboard

Resource    ../resources/keywords/dashboard-keywords.resource
Resource    ../resources/keywords/general-keywords.resource

Suite Setup    Start Browser
Suite Teardown    Close Browser
Test Setup    Run Keywords    Generate Shared Dashboard    Open Dashboard
Test Teardown    Close Dashboard


*** Test Cases ***
Validate Compare Run Table Base View
    Open Tables Page
    Validate Component    id=runTableCanvas    name=baseRunTable    folder=tables

Validate Compare Suite Table Base View
    Open Tables Page
    Validate Component    id=suiteTableCanvas    name=baseSuiteTable    folder=tables

Validate Compare Test Table Base View
    Open Tables Page
    Validate Component    id=testTableCanvas    name=baseTestTable    folder=tables

Validate Compare Keyword Table Base View
    Open Tables Page
    Validate Component    id=keywordTableCanvas    name=baseKeywordTable    folder=tables

Validate Compare Exception Table Base View
    Open Tables Page
    Validate Component    id=exceptionTableCanvas    name=baseExceptionTable    folder=tables
