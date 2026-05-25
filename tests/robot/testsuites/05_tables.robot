*** Settings ***
Documentation    This testsuite covers the generated HTML dashboard of robotdashboard

Resource    ../resources/keywords/dashboard-keywords.resource
Resource    ../resources/keywords/general-keywords.resource

Suite Setup    Run Keywords    Start Browser    Generate Dashboard
Suite Teardown    Run Keywords    Close Browser    Remove Database And Dashboard With Index
Test Setup    Open Dashboard
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
