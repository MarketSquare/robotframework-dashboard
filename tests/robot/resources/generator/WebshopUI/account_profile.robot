*** Settings ***
Documentation       Customer account settings.

Resource            resources/account.resource

Test Setup          Open Webshop And Login
Test Teardown       Close Webshop

Test Tags           account    regression


*** Test Cases ***
Update Profile Name
    [Tags]    smoke
    Open Account Page    profile
    Fill Text    ${PROFILE_NAME}    Jane Doe-Smith
    Save Profile
    Get Text    ${PROFILE_SUCCESS}    expected=Profile updated

Update Profile Email Requires Verification
    Open Account Page    profile
    Fill Text    ${PROFILE_EMAIL}    jane.new@example.com
    Save Profile
    Wait For Elements State    ${PROFILE_VERIFY_NOTICE}    visible

Change Password
    Change Password    ${CUSTOMER_PASSWORD}    NewSecret456!
    Wait For Elements State    ${PROFILE_SUCCESS}    visible
    Logout
    Login As    ${CUSTOMER_EMAIL}    NewSecret456!
    Login Should Succeed

Change Password With Wrong Current Password
    Change Password    not-my-password    NewSecret456!
    Wait For Elements State    ${PASSWORD_ERROR}    visible
    Get Text    ${PASSWORD_ERROR}    expected=Current password is incorrect

Add Shipping Address
    Add Address    Second Street 2    Utrecht
    ${count}    Get Element Count    ${ADDRESS_CARDS}    expected=2
    Should Be Equal As Integers    ${count}    2

Delete Shipping Address
    Add Address    Second Street 2    Utrecht
    Click    ${ADDRESS_DELETE} >> nth=1
    ${count}    Get Element Count    ${ADDRESS_CARDS}    expected=1
    Should Be Equal As Integers    ${count}    1

Set Default Address
    Add Address    Second Street 2    Utrecht
    Click    ${ADDRESS_SET_DEFAULT} >> nth=1
    Wait For Elements State    ${ADDRESS_CARDS} >> nth=1 >> ${ADDRESS_DEFAULT_BADGE}    visible

Delete Account
    Open Account Page    profile
    Click    ${ACCOUNT_DELETE}
    Click    ${ACCOUNT_DELETE_CONFIRM}
    Wait For Elements State    ${NAV_LOGIN}    visible
    Login As    ${CUSTOMER_EMAIL}    ${CUSTOMER_PASSWORD}
    Login Should Fail With    Invalid email or password


*** Keywords ***
Open Webshop And Login
    Open Webshop
    Login As Customer
