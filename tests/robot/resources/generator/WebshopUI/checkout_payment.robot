*** Settings ***
Documentation       Payment methods and payment gateway errors.

Resource            resources/checkout.resource
Resource            resources/login.resource

Test Setup          Prepare Checkout
Test Teardown       Close Webshop

Test Tags           payment    regression


*** Test Cases ***
Pay With Credit Card
    [Tags]    smoke    critical
    Fill Card Details
    Submit Payment
    Order Should Be Confirmed

Pay With Paypal
    Click    ${PAYMENT_PAYPAL}
    Submit Payment
    Order Should Be Confirmed

Pay With Ideal
    Click    ${PAYMENT_IDEAL}
    Select Options By    ${IDEAL_BANK}    label    Test Bank
    Submit Payment
    Order Should Be Confirmed

Pay With Expired Card Shows Error
    Fill Card Details    expiry=01/20
    Payment Should Fail With    Your card has expired

Pay With Declined Card Shows Error
    Fill Card Details    number=4000000000000002
    Payment Should Fail With    Your card was declined

Pay With Invalid Cvc
    Fill Card Details    cvc=12
    Payment Should Fail With    Security code is invalid

Payment Retry After Gateway Timeout
    [Documentation]    The gateway call is wrapped in a retry; this test exercises it.
    Fill Card Details
    Submit Payment
    Order Should Be Confirmed

Payment Three D Secure Flow
    Fill Card Details    number=4000000000003220
    Click    ${PAY_NOW}
    Wait For Elements State    ${THREE_D_SECURE_FRAME}    visible
    Click    ${THREE_D_SECURE_CONFIRM}
    Order Should Be Confirmed


*** Keywords ***
Prepare Checkout
    Open Webshop
    Login As Customer
    Checkout With Standard Shipping
