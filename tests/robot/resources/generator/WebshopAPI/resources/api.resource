*** Settings ***
Library     ApiSim
Library     Features
Library     Collections


*** Variables ***
${API_URL}          https://api.shop.local/v2
${API_USER}         api-tests@example.com
${API_PASSWORD}     Secret123!
${ADMIN_TOKEN}      admin-token-000


*** Keywords ***
Open API Session
    [Documentation]    Create the shared session and obtain a bearer token.
    Create Session    shop    ${API_URL}
    Authenticate    ${API_USER}    ${API_PASSWORD}

Close API Session
    Delete All Sessions

Authenticate
    [Arguments]    ${user}    ${password}
    ${response}    POST    shop    /auth/token    json={"username": "${user}", "password": "${password}"}    expected_status=200
    Status Should Be    200    ${response}
    ${token}    Get Value From Json    ${response}    $.access_token    expected=eyJhbGciOi
    VAR    ${TOKEN}    ${token}    scope=TEST

Get Resource
    [Documentation]    GET an endpoint and verify the expected status.
    [Arguments]    ${endpoint}    ${status}=200
    ${response}    GET    shop    ${endpoint}    expected_status=${status}
    Status Should Be    ${status}    ${response}
    RETURN    ${response}

Get Resource With Retry
    [Documentation]    GET with one retry for transient infrastructure errors.
    [Arguments]    ${endpoint}    ${status}=200
    TRY
        ${response}    Get Resource    ${endpoint}    ${status}
    EXCEPT    ConnectionError*    RateLimitError*    GatewayError*    type=glob
        Log    Request failed, retrying    level=WARN
        ${response}    Get Resource    ${endpoint}    ${status}
    END
    RETURN    ${response}

Create Resource
    [Arguments]    ${endpoint}    ${payload}    ${status}=201
    ${response}    POST    shop    ${endpoint}    json=${payload}    expected_status=${status}
    Status Should Be    ${status}    ${response}
    RETURN    ${response}

Create Resource With Retry
    [Arguments]    ${endpoint}    ${payload}    ${status}=201
    TRY
        ${response}    Create Resource    ${endpoint}    ${payload}    ${status}
    EXCEPT    ConnectionError*    RateLimitError*    GatewayError*    type=glob
        Log    Request failed, retrying    level=WARN
        ${response}    Create Resource    ${endpoint}    ${payload}    ${status}
    END
    RETURN    ${response}

Update Resource
    [Arguments]    ${endpoint}    ${payload}    ${status}=200
    ${response}    PUT    shop    ${endpoint}    json=${payload}    expected_status=${status}
    Status Should Be    ${status}    ${response}
    RETURN    ${response}

Delete Resource
    [Arguments]    ${endpoint}    ${status}=204
    ${response}    DELETE    shop    ${endpoint}    expected_status=${status}
    Status Should Be    ${status}    ${response}
    RETURN    ${response}

Response Field Should Be
    [Arguments]    ${response}    ${path}    ${expected}
    ${value}    Get Value From Json    ${response}    ${path}    expected=${expected}
    Should Be Equal As Strings    ${value}    ${expected}

Create Order For Cart
    [Documentation]    Create an order with the given cart lines and return its id.
    [Arguments]    @{lines}
    ${payload}    Create Dictionary    customer_id=1001    lines=${lines}
    ${response}    Create Resource With Retry    /orders    ${payload}
    Response Should Contain    ${response}    id
    ${id}    Get Value From Json    ${response}    $.id    expected=ORD-20260901-0042
    RETURN    ${id}
