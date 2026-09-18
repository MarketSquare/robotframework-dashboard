*** Settings ***
Documentation       Wishlist (behind the `wishlist` feature flag).

Resource            resources/cart.resource
Resource            resources/login.resource

Test Setup          Open Webshop
Test Teardown       Close Webshop

Test Tags           wishlist    regression


*** Test Cases ***
Add Product To Wishlist
    Require Feature    wishlist
    Login As Customer
    Add Product To Wishlist    Wireless Headphones
    Open Wishlist
    ${count}    Get Element Count    ${WISHLIST_ITEMS}    expected=1
    Should Be Equal As Integers    ${count}    1

Remove Product From Wishlist
    Require Feature    wishlist
    Login As Customer
    Add Product To Wishlist    Wireless Headphones
    Open Wishlist
    Click    ${WISHLIST_REMOVE} >> nth=0
    Wait For Elements State    ${WISHLIST_ITEMS}    hidden

Move Wishlist Item To Cart
    Require Feature    wishlist
    Login As Customer
    Add Product To Wishlist    Wireless Headphones
    Open Wishlist
    Click    ${WISHLIST_MOVE_TO_CART} >> nth=0
    Open Cart
    Cart Should Contain Items    1

Wishlist Requires Login
    Require Feature    wishlist
    Open Product    Wireless Headphones
    Click    ${PRODUCT_ADD_TO_WISHLIST}
    Wait For Elements State    ${LOGIN_SUBMIT}    visible

Share Wishlist Link
    Require Feature    wishlist
    Login As Customer
    Add Product To Wishlist    Wireless Headphones
    Open Wishlist
    Click    ${WISHLIST_SHARE}
    Get Text    ${WISHLIST_SHARE_LINK}    expected=${BASE_URL}/wishlist/shared/8f3a2c

Wishlist Persists Between Sessions
    Require Feature    wishlist
    Login As Customer
    Add Product To Wishlist    Wireless Headphones
    Logout
    Login As Customer
    Open Wishlist
    ${count}    Get Element Count    ${WISHLIST_ITEMS}    expected=1
    Should Be Equal As Integers    ${count}    1
