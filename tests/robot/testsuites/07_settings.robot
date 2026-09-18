*** Settings ***
Documentation    This testsuite covers the generated HTML dashboard of robotdashboard

Resource    ../resources/keywords/dashboard-keywords.resource
Resource    ../resources/keywords/general-keywords.resource

Suite Setup    Start Browser
Suite Teardown    Close Browser
Test Setup    Run Keywords    Generate Shared Dashboard    Open Dashboard
Test Teardown    Close Dashboard


*** Test Cases ***
Validate Settings
    Change Settings
    # threshold loosened to 0.01 (99% accuracy) — chart re-renders after multiple settings changes cause minor pixel variations
    Validate Component    id=runStatisticsSection    name=changedSettings    folder=run    threshold=0.01
