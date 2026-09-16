*** Settings ***
Resource    catalog.resource


*** Keywords ***
Add Product To Cart
    [Documentation]    Open a product page and add it to the cart.
    [Arguments]    ${name}
    Open Product    ${name}
    Click    ${PRODUCT_ADD_TO_CART}
    Wait For Elements State    ${CART_BADGE}    visible

Open Cart
    Click    ${NAV_CART}
    Wait For Elements State    ${CART_TOTAL}    visible

Cart Should Contain Items
    [Arguments]    ${amount}
    ${count}    Get Element Count    ${CART_ITEMS}    expected=${amount}
    Should Be Equal As Integers    ${count}    ${amount}

Cart Total Should Be
    [Arguments]    ${total}
    Get Text    ${CART_TOTAL}    expected=${total}

Remove First Cart Item
    Click    ${CART_REMOVE} >> nth=0
    Wait For Elements State    ${CART_TOTAL}    visible

Set Cart Item Quantity
    [Arguments]    ${quantity}
    Fill Text    ${CART_QUANTITY} >> nth=0    ${quantity}
    Press Keys    ${CART_QUANTITY} >> nth=0    Enter
    Wait For Elements State    ${CART_TOTAL}    visible

Apply Discount Code
    [Arguments]    ${code}
    Fill Text    ${CART_DISCOUNT_INPUT}    ${code}
    Click    ${CART_DISCOUNT_APPLY}
    Wait For Elements State    ${CART_DISCOUNT_MESSAGE}    visible

Add Product To Wishlist
    [Arguments]    ${name}
    Open Product    ${name}
    Click    ${PRODUCT_ADD_TO_WISHLIST}

Open Wishlist
    Click    ${NAV_WISHLIST}
    Wait For Elements State    ${WISHLIST_ITEMS}    visible
