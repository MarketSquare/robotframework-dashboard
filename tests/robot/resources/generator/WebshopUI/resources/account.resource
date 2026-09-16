*** Settings ***
Resource    login.resource


*** Keywords ***
Open Account Page
    [Arguments]    ${section}=profile
    Click    ${NAV_ACCOUNT}
    Open Page With Retry    account/${section}

Save Profile
    Click    ${PROFILE_SAVE}
    Wait For Elements State    ${PROFILE_SUCCESS}    visible

Change Password
    [Arguments]    ${current}    ${new}
    Open Account Page    security
    Fill Text    ${PASSWORD_CURRENT}    ${current}
    Fill Text    ${PASSWORD_NEW}    ${new}
    Click    ${PASSWORD_SAVE}

Add Address
    [Arguments]    ${street}    ${city}
    Open Account Page    addresses
    Click    ${ADDRESS_ADD}
    Fill Text    ${ADDRESS_STREET}    ${street}
    Fill Text    ${ADDRESS_CITY}    ${city}
    Click    ${ADDRESS_SAVE}
    Wait For Elements State    ${ADDRESS_CARDS}    visible

Open Order History
    Open Account Page    orders
    Wait For Elements State    ${ORDER_ROWS}    visible

Open First Order
    Open Order History
    Click    ${ORDER_DETAILS_LINK} >> nth=0
    Wait For Elements State    ${ORDER_DETAILS_TITLE}    visible
