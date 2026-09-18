*** Settings ***
Documentation       Customer registration.

Resource            resources/login.resource

Test Setup          Open Webshop
Test Teardown       Close Webshop

Test Tags           registration    regression


*** Test Cases ***
Register New Account
    [Tags]    smoke    critical
    Register Account    John Smith    john.smith@example.com    Welcome2026!
    Registration Should Succeed

Register With Existing Email Shows Error
    Register Account    Jane Doe    ${CUSTOMER_EMAIL}    Welcome2026!
    Registration Should Fail With    An account with this email already exists

Register With Weak Password Shows Error
    Register Account    John Smith    john.weak@example.com    1234
    Registration Should Fail With    Password must be at least 8 characters

Register Without Accepting Terms
    Open Registration Form
    Fill Registration Form    John Smith    john.terms@example.com    Welcome2026!    terms=${False}
    Click    ${REGISTER_SUBMIT}
    Registration Should Fail With    You must accept the terms and conditions

Register Newsletter Opt In
    Register Account    John Smith    john.news@example.com    Welcome2026!    newsletter=${True}
    Registration Should Succeed
    Open Page    account/preferences
    Get Text    id=newsletter-status    expected=Subscribed

Register Form Validates Email Format
    Open Registration Form
    Fill Registration Form    John Smith    not-an-email    Welcome2026!
    Click    ${REGISTER_SUBMIT}
    Registration Should Fail With    Please enter a valid email address

Register Account And Login
    Register Account    John Smith    john.login@example.com    Welcome2026!
    Registration Should Succeed
    Logout
    Login As    john.login@example.com    Welcome2026!
    Wait For Elements State    ${ACCOUNT_MENU}    visible

Register With Very Long Name
    [Tags]    VeryLongTagWithALotOfTextThatKeepsGoingAndGoing
    ${name}    Evaluate    "Maximilian " * 20
    Register Account    ${name}    john.long@example.com    Welcome2026!
    Registration Should Succeed
