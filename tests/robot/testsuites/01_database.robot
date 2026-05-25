*** Settings ***
Documentation    This testsuite covers the generated database of robotdashboard

Resource    ../resources/keywords/database-keywords.resource
Resource    ../resources/keywords/general-keywords.resource

Test Setup    Run Keywords    Generate Dashboard    Create Database Connection
Test Teardown    Run Keywords    Close Database Connection    Remove Database And Dashboard With Index


*** Test Cases ***
Validate Database Runs
    Validate Database    table=runs

Validate Database Suites
    Validate Database    table=suites

Validate Database Tests
    Validate Database    table=tests

Validate Database Keywords
    Validate Database    table=keywords
