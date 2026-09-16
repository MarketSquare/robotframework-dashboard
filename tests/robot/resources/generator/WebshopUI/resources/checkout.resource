*** Settings ***
Resource    cart.resource


*** Keywords ***
Proceed To Checkout
    Open Cart
    Click    ${CART_CHECKOUT}
    Wait For Elements State    ${CHECKOUT_CONTINUE}    visible

Continue As Guest
    [Arguments]    ${email}
    Click    ${CHECKOUT_GUEST}
    Fill Text    ${CHECKOUT_EMAIL}    ${email}
    Click    ${CHECKOUT_CONTINUE}

Fill Shipping Address
    [Documentation]    Fill the shipping address form; leaves fields empty when given empty strings.
    [Arguments]    ${first}=Jane    ${last}=Doe    ${street}=Main Street 1    ${zip}=1234 AB    ${city}=Amsterdam    ${country}=Netherlands
    Fill Text    ${ADDRESS_FIRST_NAME}    ${first}
    Fill Text    ${ADDRESS_LAST_NAME}    ${last}
    Fill Text    ${ADDRESS_STREET}    ${street}
    Fill Text    ${ADDRESS_ZIP}    ${zip}
    Fill Text    ${ADDRESS_CITY}    ${city}
    Select Options By    ${ADDRESS_COUNTRY}    label    ${country}
    Click    ${CHECKOUT_CONTINUE}

Select Shipping Method
    [Arguments]    ${method}
    Click    ${method}
    Click    ${CHECKOUT_CONTINUE}
    Wait For Elements State    ${ORDER_SUMMARY_TOTAL}    visible

Accept Terms And Continue
    Check Checkbox    ${CHECKOUT_TERMS}
    Click    ${CHECKOUT_CONTINUE}
    Wait For Elements State    ${PAY_NOW}    visible

Fill Card Details
    [Arguments]    ${number}=4111111111111111    ${expiry}=12/30    ${cvc}=123
    Click    ${PAYMENT_CARD}
    Fill Text    ${CARD_NUMBER}    ${number}
    Fill Text    ${CARD_EXPIRY}    ${expiry}
    Fill Text    ${CARD_CVC}    ${cvc}

Submit Payment
    [Documentation]    Click pay; the payment gateway is retried once when it times out.
    TRY
        Click    ${PAY_NOW}
        Wait For Elements State    ${ORDER_CONFIRMATION}    visible
    EXCEPT    ConnectionError*    GatewayError*    RateLimitError*    StaleElementError*    type=glob
        Log    Payment gateway did not respond, retrying    level=WARN
        Click    ${PAY_NOW}
        Wait For Elements State    ${ORDER_CONFIRMATION}    visible
    END

Payment Should Fail With
    [Arguments]    ${message}
    Click    ${PAY_NOW}
    Wait For Elements State    ${PAYMENT_ERROR}    visible
    Get Text    ${PAYMENT_ERROR}    expected=${message}

Order Should Be Confirmed
    Wait For Elements State    ${ORDER_CONFIRMATION}    visible
    ${number}    Get Text    ${ORDER_NUMBER}    expected=WS-100234
    Should Match Regexp    ${number}    WS-\\d+

Checkout With Standard Shipping
    [Documentation]    Add a product and walk through checkout up to the payment step.
    [Arguments]    ${product}=Wireless Headphones
    Add Product To Cart    ${product}
    Proceed To Checkout
    Fill Shipping Address
    Select Shipping Method    ${SHIPPING_STANDARD}
    Accept Terms And Continue

Apply Gift Card
    [Arguments]    ${code}
    Fill Text    ${GIFT_CARD_INPUT}    ${code}
    Click    ${GIFT_CARD_APPLY}
    Wait For Elements State    ${GIFT_CARD_MESSAGE}    visible
