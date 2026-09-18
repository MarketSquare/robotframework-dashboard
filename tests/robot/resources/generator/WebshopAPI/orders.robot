*** Settings ***
Documentation       Order creation and management.

Resource            resources/api.resource

Test Setup          Open API Session
Test Teardown       Close API Session

Test Tags           orders    regression


*** Test Cases ***
Create Order
    [Tags]    smoke    critical
    ${id}    Create Order For Cart    {"product_id": 1001, "quantity": 1}
    Should Not Be Empty    ${id}

Create Order With Retry
    [Documentation]    Order creation is wrapped in a retry for transient errors.
    ${id}    Create Order For Cart    {"product_id": 1001, "quantity": 1}    {"product_id": 1002, "quantity": 3}
    ${response}    Get Resource With Retry    /orders/${id}
    Response Field Should Be    ${response}    $.lines.length    2

Create Order With Empty Cart Returns 400
    ${payload}    Create Dictionary    customer_id=1001    lines=@{EMPTY}
    ${response}    Create Resource    /orders    ${payload}    status=400
    Response Field Should Be    ${response}    $.error    empty_cart

Get Order By Id
    [Tags]    smoke
    ${response}    Get Resource With Retry    /orders/ORD-20260901-0042
    Response Field Should Be    ${response}    $.status    processing

List Orders For Customer
    ${response}    Get Resource With Retry    /customers/1001/orders
    Response Should Contain    ${response}    items
    Response Field Should Be    ${response}    $.total    5

Cancel Order
    ${id}    Create Order For Cart    {"product_id": 1001, "quantity": 1}
    ${response}    Create Resource    /orders/${id}/cancel    {}    status=200
    Response Field Should Be    ${response}    $.status    cancelled

Cancel Shipped Order Returns 409
    ${response}    Create Resource    /orders/ORD-20260815-0001/cancel    {}    status=409
    Response Field Should Be    ${response}    $.error    already_shipped

Update Shipping Address On Order
    ${id}    Create Order For Cart    {"product_id": 1001, "quantity": 1}
    ${response}    Update Resource    /orders/${id}/shipping-address    {"street": "New Street 5", "city": "Leiden"}
    Response Field Should Be    ${response}    $.shipping_address.city    Leiden

Order Status Transitions
    ${id}    Create Order For Cart    {"product_id": 1001, "quantity": 1}
    FOR    ${status}    IN    paid    packed    shipped    delivered
        ${response}    Update Resource    /orders/${id}/status    {"status": "${status}"}
        Response Field Should Be    ${response}    $.status    ${status}
    END

Order Total Includes Tax
    ${id}    Create Order For Cart    {"product_id": 1001, "quantity": 2}
    ${response}    Get Resource    /orders/${id}
    Response Field Should Be    ${response}    $.subtotal    179.98
    Response Field Should Be    ${response}    $.tax    37.80
    Response Field Should Be    ${response}    $.total    217.78

Order With Discount Code
    ${payload}    Create Dictionary    customer_id=1001    discount_code=SUMMER10    lines=[{"product_id": 1001, "quantity": 1}]
    ${response}    Create Resource With Retry    /orders    ${payload}
    Response Field Should Be    ${response}    $.discount    9.00

Order Pagination
    FOR    ${page}    IN RANGE    1    4
        ${response}    Get Resource With Retry    /orders?page=${page}&size=50
        Response Should Contain    ${response}    items
    END
    ${response}    Get Resource    /orders?page=99&size=50
    Response Field Should Be    ${response}    $.items.length    0

Order Webhook Delivered
    ${id}    Create Order For Cart    {"product_id": 1001, "quantity": 1}
    ${response}    Get Resource With Retry    /webhooks/deliveries?event=order.created&order=${id}
    Response Field Should Be    ${response}    $.items[0].status    delivered

Order Export Csv
    Authenticate    admin@example.com    ${API_PASSWORD}
    ${response}    Create Resource    /orders/export    {"format": "csv", "from": "2026-08-01"}    status=202
    ${job}    Get Value From Json    ${response}    $.job_id    expected=job-7790
    ${status}    Get Resource With Retry    /jobs/${job}
    Response Field Should Be    ${status}    $.state    completed
