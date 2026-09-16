*** Settings ***
Documentation       Product detail page.

Resource            resources/catalog.resource

Test Setup          Open Webshop
Test Teardown       Close Webshop

Test Tags           product    regression


*** Test Cases ***
Product Page Shows Price And Stock
    [Tags]    smoke    critical
    Open Product    Wireless Headphones
    Get Text    ${PRODUCT_PRICE}    expected=€ 89,99
    Get Text    ${PRODUCT_STOCK}    expected=In stock

Product Page Image Gallery
    Open Product    Wireless Headphones
    FOR    ${index}    IN RANGE    3
        Click    ${PRODUCT_GALLERY_NEXT}
        Wait For Elements State    ${PRODUCT_GALLERY_IMAGE}    visible
    END

Product Page Shows Reviews
    Open Product    Wireless Headphones
    Open Product Tab    ${PRODUCT_REVIEWS_TAB}    ${PRODUCT_REVIEW_ITEMS}
    ${count}    Get Element Count    ${PRODUCT_REVIEW_ITEMS}    expected=14
    Should Be True    ${count} > 10

Product Page Related Products
    Open Product    Wireless Headphones
    Scroll To Element    ${PRODUCT_RELATED}
    ${count}    Get Element Count    ${PRODUCT_RELATED}    expected=4
    Should Be Equal As Integers    ${count}    4

Product Page Out Of Stock Notice
    Open Product    Retro Game Console
    Get Text    ${PRODUCT_STOCK}    expected=Out of stock
    Wait For Elements State    ${PRODUCT_ADD_TO_CART}    disabled

Product Page Size Selector
    Open Product    Running Shoes Pro
    Select Options By    ${PRODUCT_SIZE_SELECT}    label    42
    Get Text    ${PRODUCT_STOCK}    expected=In stock

Product Page Add Review Requires Login
    Open Product    Wireless Headphones
    Open Product Tab    ${PRODUCT_REVIEWS_TAB}    ${PRODUCT_REVIEW_ITEMS}
    Click    ${PRODUCT_WRITE_REVIEW}
    Wait For Elements State    ${LOGIN_SUBMIT}    visible

Product Page Share Buttons
    [Tags]    randomtag
    Open Product    Wireless Headphones
    Hover    ${PRODUCT_SHARE_TWITTER}
    Click    ${PRODUCT_SHARE_TWITTER}
    Get Url    expected=https://twitter.com/intent/tweet

Product Page Breadcrumbs
    Open Product    Wireless Headphones
    Get Text    ${PRODUCT_BREADCRUMBS}    expected=Home / Electronics / Audio / Wireless Headphones

Product Page Specifications Tab
    Open Product    Wireless Headphones
    Open Product Tab    ${PRODUCT_SPECS_TAB}    ${PRODUCT_SPECS_TABLE}
    Get Text    ${PRODUCT_SPECS_TABLE} >> text=Battery    expected=Battery
