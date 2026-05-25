*** Settings ***
Documentation    This testsuite covers the generated database of robotdashboard

Resource    ../resources/keywords/database-keywords.resource
Resource    ../resources/keywords/general-keywords.resource

Suite Setup    Generate Dashboard
Suite Teardown    Remove Database And Dashboard With Index
Test Setup    Create Database Connection
Test Teardown    Close Database Connection


*** Test Cases ***
Validate Database Runs
    Validate Database    table=runs

Validate Database Suites
    Validate Database    table=suites

Validate Database Tests
    Validate Database    table=tests

Validate Database Keywords
    Validate Database    table=keywords
