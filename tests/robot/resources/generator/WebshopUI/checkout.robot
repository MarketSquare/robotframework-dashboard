*** Settings ***
Documentation       Checkout flow up to the payment step.

Resource            resources/checkout.resource
Resource            resources/login.resource
Resource            resources/account.resource

Test Setup          Open Webshop
Test Teardown       Close Webshop

Test Tags           checkout    regression


*** Test Cases ***
Checkout As Guest
    [Tags]    smoke    critical
    Add Product To Cart    Wireless Headphones
    Proceed To Checkout
    Continue As Guest    guest@example.com
    Fill Shipping Address
    Select Shipping Method    ${SHIPPING_STANDARD}
    Accept Terms And Continue

Checkout As Registered Customer
    [Tags]    smoke    critical
    Login As Customer
    Checkout With Standard Shipping

Checkout Shipping Address Validation
    Add Product To Cart    Wireless Headphones
    Proceed To Checkout
    Continue As Guest    guest@example.com
    Fill Shipping Address    zip=${EMPTY}    city=${EMPTY}
    Wait For Elements State    ${ADDRESS_ERROR}    visible
    Get Text    ${ADDRESS_ERROR}    expected=Postal code is required

Checkout Select Express Shipping
    Add Product To Cart    Wireless Headphones
    Proceed To Checkout
    Continue As Guest    guest@example.com
    Fill Shipping Address
    Select Shipping Method    ${SHIPPING_EXPRESS}
    Get Text    ${ORDER_SUMMARY_TOTAL}    expected=€ 99,98

Checkout Select Pickup Point
    Add Product To Cart    Wireless Headphones
    Proceed To Checkout
    Continue As Guest    guest@example.com
    Fill Shipping Address
    Click    ${SHIPPING_PICKUP}
    Select Options By    ${PICKUP_POINT_SELECT}    label    Pickup Point Central Station
    Click    ${CHECKOUT_CONTINUE}
    Wait For Elements State    ${ORDER_SUMMARY_TOTAL}    visible

Checkout Change Billing Address
    Login As Customer
    Add Product To Cart    Wireless Headphones
    Proceed To Checkout
    Check Checkbox    ${BILLING_DIFFERENT}
    Fill Shipping Address    street=Invoice Street 9    city=Rotterdam
    Select Shipping Method    ${SHIPPING_STANDARD}

Checkout Order Summary Matches Cart
    Add Product To Cart    Wireless Headphones
    Add Product To Cart    Desk Lamp Nordic
    Proceed To Checkout
    Continue As Guest    guest@example.com
    Fill Shipping Address
    Select Shipping Method    ${SHIPPING_STANDARD}
    ${items}    Get Element Count    ${ORDER_SUMMARY_ITEMS}    expected=2
    Should Be Equal As Integers    ${items}    2
    Get Text    ${ORDER_SUMMARY_TOTAL}    expected=€ 134,98

Checkout Back To Cart Keeps Items
    Add Product To Cart    Wireless Headphones
    Proceed To Checkout
    Click    ${CHECKOUT_BACK}
    Wait For Elements State    ${CART_TOTAL}    visible
    Cart Should Contain Items    1

Checkout Terms Must Be Accepted
    Add Product To Cart    Wireless Headphones
    Proceed To Checkout
    Continue As Guest    guest@example.com
    Fill Shipping Address
    Select Shipping Method    ${SHIPPING_STANDARD}
    Click    ${CHECKOUT_CONTINUE}
    Wait For Elements State    ${CHECKOUT_TERMS_ERROR}    visible

Checkout With Empty Cart Redirects
    Open Page    checkout
    Get Url    expected=${BASE_URL}/cart
    Wait For Elements State    ${CART_EMPTY}    visible

Checkout Order Confirmation Email
    Login As Customer
    Checkout With Standard Shipping
    Fill Card Details
    Submit Payment
    Order Should Be Confirmed
    Open Page    account/notifications
    Get Text    css=.notification >> nth=0    expected=Order confirmation sent to ${CUSTOMER_EMAIL}

Checkout Order Appears In History
    Login As Customer
    Checkout With Standard Shipping
    Fill Card Details
    Submit Payment
    Order Should Be Confirmed
    Open Order History
    Get Text    ${ORDER_ROWS} >> nth=0 >> .status    expected=Processing
