*** Settings ***
Documentation       Product catalog endpoints.

Resource            resources/api.resource

Test Setup          Open API Session
Test Teardown       Close API Session
Test Template       Category Listing Should Return

Test Tags           products    regression


*** Test Cases ***          CATEGORY        MIN
List Electronics            electronics     40
List Books                  books           120
List Clothing               clothing        75
List Toys                   toys            30
List Garden                 garden          18
List Sports                 sports          55

Get Product By Id
    [Template]    NONE
    [Tags]    smoke    critical
    ${response}    Get Resource With Retry    /products/1001
    Response Field Should Be    ${response}    $.name    Wireless Headphones
    Response Field Should Be    ${response}    $.price    89.99

Get Unknown Product Returns 404
    [Template]    NONE
    ${response}    Get Resource    /products/999999    status=404
    Response Field Should Be    ${response}    $.error    not_found

Create Product Requires Admin
    [Template]    NONE
    Create Resource    /products    {"name": "Smart Speaker Mini", "price": 49.99}    status=403

Update Product Price
    [Template]    NONE
    Authenticate    admin@example.com    ${API_PASSWORD}
    ${response}    Update Resource    /products/1001    {"price": 79.99}
    Response Field Should Be    ${response}    $.price    79.99
    Update Resource    /products/1001    {"price": 89.99}

Delete Product
    [Template]    NONE
    Authenticate    admin@example.com    ${API_PASSWORD}
    ${response}    Create Resource    /products    {"name": "Temporary", "price": 1.00}
    ${id}    Get Value From Json    ${response}    $.id    expected=2077
    Delete Resource    /products/${id}
    Get Resource    /products/${id}    status=404

Product Search Endpoint
    [Template]    NONE
    ${response}    Get Resource With Retry    /products/search?q=laptop
    Response Should Contain    ${response}    items
    Response Field Should Be    ${response}    $.total    12


*** Keywords ***
Category Listing Should Return
    [Arguments]    ${category}    ${min}
    ${response}    Get Resource With Retry    /products?category=${category}
    Response Should Contain    ${response}    items
    ${total}    Get Value From Json    ${response}    $.total    expected=${min}
    Should Be True    ${total} >= ${min}
