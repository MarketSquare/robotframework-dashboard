*** Settings ***
Documentation       Gift cards at checkout (added to the suite later than the rest).

Resource            resources/checkout.resource
Resource            resources/login.resource

Test Setup          Prepare Checkout
Test Teardown       Close Webshop

Test Tags           payment    gift-cards    regression


*** Test Cases ***
Apply Gift Card At Checkout
    [Tags]    smoke
    Require Feature    gift-cards
    Apply Gift Card    GC-2026-VALID
    Get Text    ${GIFT_CARD_MESSAGE}    expected=€ 25,00 gift card applied
    Get Text    ${ORDER_SUMMARY_TOTAL}    expected=€ 64,99

Apply Gift Card With Insufficient Balance
    Require Feature    gift-cards
    Apply Gift Card    GC-2026-EMPTY
    Get Text    ${GIFT_CARD_MESSAGE}    expected=This gift card has no remaining balance

Apply Expired Gift Card
    Require Feature    gift-cards
    Apply Gift Card    GC-2019-OLD
    Get Text    ${GIFT_CARD_MESSAGE}    expected=This gift card has expired

Combine Gift Card And Discount Code
    Require Feature    gift-cards
    Apply Gift Card    GC-2026-VALID
    Click    ${CHECKOUT_BACK}
    Apply Discount Code    SUMMER10
    Proceed To Checkout
    Get Text    ${ORDER_SUMMARY_TOTAL}    expected=€ 55,99

Buy Gift Card
    Require Feature    gift-cards
    Open Page    gift-cards
    Select Options By    id=gift-card-amount    label    € 50,00
    Click    id=gift-card-buy
    Wait For Elements State    ${CART_BADGE}    visible


*** Keywords ***
Prepare Checkout
    Open Webshop
    Login As Customer
    Checkout With Standard Shipping
