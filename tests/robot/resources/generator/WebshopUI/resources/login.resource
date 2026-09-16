*** Settings ***
Resource    common.resource


*** Keywords ***
Open Login Page
    Click    ${NAV_LOGIN}
    Wait For Elements State    ${LOGIN_SUBMIT}    visible

Login As
    [Documentation]    Fill in the login form and submit it.
    [Arguments]    ${email}    ${password}    ${remember}=${False}
    Open Login Page
    Fill Text    ${LOGIN_EMAIL}    ${email}
    Fill Text    ${LOGIN_PASSWORD}    ${password}
    IF    ${remember}
        Check Checkbox    ${LOGIN_REMEMBER}
    END
    Click    ${LOGIN_SUBMIT}

Login Should Succeed
    Wait For Elements State    ${ACCOUNT_MENU}    visible
    Get Text    ${WELCOME_BANNER}    expected=Welcome back, Jane

Login Should Fail With
    [Arguments]    ${message}
    Wait For Elements State    ${LOGIN_ERROR}    visible
    Get Text    ${LOGIN_ERROR}    expected=${message}

Login As Customer
    [Documentation]    Log in with the default customer account and verify it worked.
    Login As    ${CUSTOMER_EMAIL}    ${CUSTOMER_PASSWORD}
    Login Should Succeed

Login With Retry
    [Documentation]    Log in; retry once when the platform is flaky.
    [Arguments]    ${email}    ${password}
    TRY
        Login As    ${email}    ${password}
        Login Should Succeed
    EXCEPT    ConnectionError*    StaleElementError*    GatewayError*    RateLimitError*    type=glob
        Log    Login failed due to infrastructure, retrying    level=WARN
        Login As    ${email}    ${password}
        Login Should Succeed
    END

Logout
    Click    ${NAV_ACCOUNT}
    Click    ${LOGOUT_LINK}
    Wait For Elements State    ${NAV_LOGIN}    visible

Request Password Reset
    [Arguments]    ${email}
    Open Login Page
    Click    ${FORGOT_PASSWORD_LINK}
    Fill Text    ${RESET_EMAIL}    ${email}
    Click    ${RESET_SUBMIT}

Open Registration Form
    Open Login Page
    Click    ${REGISTER_LINK}
    Wait For Elements State    ${REGISTER_SUBMIT}    visible

Fill Registration Form
    [Arguments]    ${name}    ${email}    ${password}    ${terms}=${True}    ${newsletter}=${False}
    Fill Text    ${REGISTER_NAME}    ${name}
    Fill Text    ${REGISTER_EMAIL}    ${email}
    Fill Text    ${REGISTER_PASSWORD}    ${password}
    IF    ${terms}
        Check Checkbox    ${REGISTER_TERMS}
    END
    IF    ${newsletter}
        Check Checkbox    ${REGISTER_NEWSLETTER}
    END

Register Account
    [Documentation]    Register a new customer account through the UI.
    [Arguments]    ${name}    ${email}    ${password}    ${newsletter}=${False}
    Open Registration Form
    Fill Registration Form    ${name}    ${email}    ${password}    newsletter=${newsletter}
    Click    ${REGISTER_SUBMIT}

Registration Should Succeed
    Wait For Elements State    ${REGISTER_SUCCESS}    visible
    Get Text    ${REGISTER_SUCCESS}    expected=Your account has been created

Registration Should Fail With
    [Arguments]    ${message}
    Wait For Elements State    ${REGISTER_ERROR}    visible
    Get Text    ${REGISTER_ERROR}    expected=${message}
