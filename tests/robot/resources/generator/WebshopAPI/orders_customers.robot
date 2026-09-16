*** Settings ***
Documentation       Customer accounts.

Resource            resources/api.resource

Test Setup          Open API Session
Test Teardown       Close API Session

Test Tags           customers    regression


*** Test Cases ***
Create Customer
    [Tags]    smoke
    ${response}    Create Resource    /customers    {"email": "new.customer@example.com", "name": "New Customer"}
    Response Should Contain    ${response}    id

Get Customer Profile
    [Tags]    smoke
    ${response}    Get Resource With Retry    /customers/me
    Response Field Should Be    ${response}    $.email    ${API_USER}

Update Customer Email
    ${response}    Update Resource    /customers/me    {"email": "changed@example.com"}
    Response Field Should Be    ${response}    $.email_verified    false
    Update Resource    /customers/me    {"email": "${API_USER}"}

Delete Customer Gdpr
    ${response}    Create Resource    /customers    {"email": "gdpr@example.com", "name": "Forget Me"}
    ${id}    Get Value From Json    ${response}    $.id    expected=1099
    Delete Resource    /customers/${id}
    Get Resource    /customers/${id}    status=404

Customer Address Book
    ${response}    Create Resource    /customers/me/addresses    {"street": "Main Street 1", "city": "Amsterdam"}
    ${id}    Get Value From Json    ${response}    $.id    expected=addr-77
    ${list}    Get Resource    /customers/me/addresses
    Response Field Should Be    ${list}    $.total    2
    Delete Resource    /customers/me/addresses/${id}

Customer Search By Email
    Authenticate    admin@example.com    ${API_PASSWORD}
    ${response}    Get Resource With Retry    /customers?email=${API_USER}
    Response Field Should Be    ${response}    $.items[0].id    1001

Customer Merge Duplicates
    Authenticate    admin@example.com    ${API_PASSWORD}
    ${response}    Create Resource    /customers/merge    {"source": 1050, "target": 1001}    status=200
    Response Field Should Be    ${response}    $.merged_orders    3

Customer Newsletter Preferences
    ${response}    Update Resource    /customers/me/preferences    {"newsletter": true}
    Response Field Should Be    ${response}    $.newsletter    true
