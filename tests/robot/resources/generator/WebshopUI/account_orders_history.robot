*** Settings ***
Documentation       Order history and order details for logged-in customers.

Resource            resources/account.resource

Test Setup          Open Webshop And Login
Test Teardown       Close Webshop

Test Tags           account    orders    regression


*** Test Cases ***
Order History Shows Recent Orders
    [Tags]    smoke
    Open Order History
    ${count}    Get Element Count    ${ORDER_ROWS}    expected=5
    Should Be True    ${count} >= 1

Order History Filter By Status
    Open Order History
    Select Options By    ${ORDER_STATUS_FILTER}    label    Delivered
    Wait For Elements State    ${ORDER_ROWS}    visible
    Get Text    ${ORDER_ROWS} >> nth=0 >> .status    expected=Delivered

Order Details Page
    Open First Order
    Get Text    ${ORDER_DETAILS_TITLE}    expected=Order WS-100234

Reorder From History
    Open First Order
    Click    ${ORDER_REORDER}
    Wait For Elements State    ${CART_BADGE}    visible

Download Invoice
    Open First Order
    Click    ${ORDER_INVOICE}
    Wait For Elements State    css=.download-toast    visible

Track Shipment
    Open First Order
    Click    ${ORDER_TRACKING}
    Wait For Elements State    ${TRACKING_STATUS}    visible
    Get Text    ${TRACKING_STATUS}    expected=Out for delivery


*** Keywords ***
Open Webshop And Login
    Open Webshop
    Login As Customer
