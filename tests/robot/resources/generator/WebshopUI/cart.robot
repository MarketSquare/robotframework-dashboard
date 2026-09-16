*** Settings ***
Documentation       Shopping cart.

Resource            resources/cart.resource
Resource            resources/login.resource

Test Setup          Open Webshop
Test Teardown       Close Webshop

Test Tags           cart    regression


*** Test Cases ***
Add Product To Cart
    [Tags]    smoke    critical
    Add Product To Cart    Wireless Headphones
    Open Cart
    Cart Should Contain Items    1

Add Multiple Products To Cart
    Add Product To Cart    Wireless Headphones
    Add Product To Cart    Desk Lamp Nordic
    Add Product To Cart    Board Game Catan
    Open Cart
    Cart Should Contain Items    3

Remove Product From Cart
    Add Product To Cart    Wireless Headphones
    Open Cart
    Remove First Cart Item
    Wait For Elements State    ${CART_EMPTY}    visible

Update Quantity In Cart
    Add Product To Cart    Wireless Headphones
    Open Cart
    Set Cart Item Quantity    3
    Cart Total Should Be    € 269,97

Cart Persists After Reload
    Add Product To Cart    Wireless Headphones
    Open Page    cart
    Cart Should Contain Items    1

Cart Shows Correct Total
    Add Product To Cart    Wireless Headphones
    Add Product To Cart    Desk Lamp Nordic
    Open Cart
    Cart Total Should Be    € 134,98

Cart Empty State
    Open Cart
    Wait For Elements State    ${CART_EMPTY}    visible
    Get Text    ${CART_EMPTY}    expected=Your cart is empty

Cart Apply Discount Code
    Add Product To Cart    Wireless Headphones
    Open Cart
    Apply Discount Code    SUMMER10
    Get Text    ${CART_DISCOUNT_MESSAGE}    expected=10% discount applied
    Cart Total Should Be    € 80,99

Cart Invalid Discount Code
    Add Product To Cart    Wireless Headphones
    Open Cart
    Apply Discount Code    NOPE
    Get Text    ${CART_DISCOUNT_MESSAGE}    expected=This code is not valid

Cart Free Shipping Threshold
    Add Product To Cart    Wireless Headphones
    Open Cart
    Get Text    ${CART_SHIPPING_NOTICE}    expected=Add € 10,01 more for free shipping
    Set Cart Item Quantity    2
    Get Text    ${CART_SHIPPING_NOTICE}    expected=You qualify for free shipping

Cart Quantity Limit Per Product
    Add Product To Cart    Wireless Headphones
    Open Cart
    Set Cart Item Quantity    99
    Wait For Elements State    ${CART_QUANTITY_ERROR}    visible
    Get Text    ${CART_QUANTITY_ERROR}    expected=Maximum 10 per customer

Cart Merge After Login
    Add Product To Cart    Wireless Headphones
    Login As Customer
    Open Cart
    Cart Should Contain Items    2
