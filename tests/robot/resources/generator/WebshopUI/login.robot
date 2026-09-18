*** Settings ***
Documentation       Login, logout and password reset flows.

Resource            resources/login.resource

Test Setup          Open Webshop
Test Teardown       Close Webshop

Test Tags           login    regression


*** Test Cases ***
Login With Valid Credentials
    [Tags]    smoke    critical
    Login As    ${CUSTOMER_EMAIL}    ${CUSTOMER_PASSWORD}
    Login Should Succeed

Login With Invalid Password Shows Error
    [Tags]    smoke
    Login As    ${CUSTOMER_EMAIL}    wrong-password
    Login Should Fail With    Invalid email or password

Login With Unknown Email Shows Error
    Login As    nobody@example.com    ${CUSTOMER_PASSWORD}
    Login Should Fail With    Invalid email or password

Login With Empty Form Shows Validation
    Open Login Page
    Click    ${LOGIN_SUBMIT}
    Login Should Fail With    Email and password are required

Login Remember Me Keeps Session
    Login As    ${CUSTOMER_EMAIL}    ${CUSTOMER_PASSWORD}    remember=${True}
    Login Should Succeed
    Open Page    account/profile
    Wait For Elements State    ${ACCOUNT_MENU}    visible

Logout Returns To Homepage
    [Tags]    smoke
    Login As Customer
    Logout
    Get Url    expected=${BASE_URL}/

Login Locks Account After Five Attempts
    FOR    ${attempt}    IN RANGE    5
        Login As    locked@example.com    wrong-${attempt}
    END
    Login Should Fail With    Account locked, try again in 15 minutes

Login Redirects To Requested Page
    Open Page    account/orders
    Login As    ${CUSTOMER_EMAIL}    ${CUSTOMER_PASSWORD}
    Get Url    expected=${BASE_URL}/account/orders

Password Reset Sends Email
    Request Password Reset    ${CUSTOMER_EMAIL}
    Wait For Elements State    ${RESET_CONFIRMATION}    visible
    Get Text    ${RESET_CONFIRMATION}    expected=Check your inbox for a reset link

Password Reset With Unknown Email
    Request Password Reset    nobody@example.com
    Wait For Elements State    ${RESET_CONFIRMATION}    visible
    Get Text    ${RESET_CONFIRMATION}    expected=Check your inbox for a reset link

Login With Retry On Connection Error
    [Documentation]    The login form is retried once when the platform is flaky.
    Login With Retry    ${CUSTOMER_EMAIL}    ${CUSTOMER_PASSWORD}

Login Form Is Accessible By Keyboard
    [Tags]    accessibility
    Open Login Page
    Press Keys    ${LOGIN_EMAIL}    Tab
    Press Keys    ${LOGIN_PASSWORD}    Tab
    Press Keys    ${LOGIN_SUBMIT}    Enter
    Login Should Fail With    Email and password are required
