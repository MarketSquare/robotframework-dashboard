*** Settings ***
Documentation       Stock levels and inventory management.

Resource            resources/api.resource

Test Setup          Open API Session
Test Teardown       Close API Session

Test Tags           inventory    regression


*** Test Cases ***
Stock Level For Product
    [Tags]    smoke
    ${response}    Get Resource    /inventory/1001
    Response Field Should Be    ${response}    $.available    250

Stock Decreases After Order
    ${before}    Get Resource    /inventory/1001
    Create Order For Cart    {"product_id": 1001, "quantity": 2}
    ${after}    Get Resource    /inventory/1001
    Response Field Should Be    ${after}    $.available    248

Stock Update Requires Admin
    Update Resource    /inventory/1001    {"available": 999}    status=403

Low Stock Webhook
    Authenticate    admin@example.com    ${API_PASSWORD}
    Update Resource    /inventory/1002    {"available": 2}
    ${response}    Get Resource With Retry    /webhooks/deliveries?event=inventory.low
    Response Field Should Be    ${response}    $.items[0].status    delivered

Bulk Stock Import
    Require Feature    bulk-import
    Authenticate    admin@example.com    ${API_PASSWORD}
    ${response}    Create Resource    /inventory/import    {"file": "stock-2026-09.csv"}    status=202
    ${job}    Get Value From Json    ${response}    $.job_id    expected=job-7781
    ${status}    Get Resource With Retry    /jobs/${job}
    Response Field Should Be    ${status}    $.state    completed

Inventory Report Export
    Authenticate    admin@example.com    ${API_PASSWORD}
    ${response}    Create Resource    /inventory/reports    {"format": "xlsx"}    status=202
    ${status}    Get Resource With Retry    /jobs/job-7782
    Response Field Should Be    ${status}    $.state    completed

Reserve Stock For Cart
    ${response}    Create Resource    /inventory/reservations    {"product_id": 1001, "quantity": 1}
    Response Should Contain    ${response}    reservation_id

Release Reserved Stock
    ${response}    Create Resource    /inventory/reservations    {"product_id": 1001, "quantity": 1}
    ${id}    Get Value From Json    ${response}    $.reservation_id    expected=res-5511
    Delete Resource    /inventory/reservations/${id}
