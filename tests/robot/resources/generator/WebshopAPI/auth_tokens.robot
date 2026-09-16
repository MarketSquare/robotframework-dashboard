*** Settings ***
Documentation       Authentication and token lifecycle.

Resource            resources/api.resource

Test Setup          Create Session    shop    ${API_URL}
Test Teardown       Close API Session

Test Tags           auth    regression


*** Test Cases ***
Obtain Token With Valid Credentials
    [Tags]    smoke    critical
    Authenticate    ${API_USER}    ${API_PASSWORD}
    Should Not Be Empty    ${TOKEN}

Obtain Token With Invalid Credentials
    [Tags]    smoke
    ${response}    POST    shop    /auth/token    json={"username": "${API_USER}", "password": "nope"}    expected_status=401
    Status Should Be    401    ${response}
    Response Field Should Be    ${response}    $.error    invalid_credentials

Refresh Token
    Authenticate    ${API_USER}    ${API_PASSWORD}
    ${response}    Create Resource    /auth/refresh    {"refresh_token": "${TOKEN}"}    status=200
    Response Should Contain    ${response}    access_token

Refresh Expired Token
    ${response}    POST    shop    /auth/refresh    json={"refresh_token": "expired"}    expected_status=401
    Status Should Be    401    ${response}
    Response Field Should Be    ${response}    $.error    token_expired

Revoke Token
    Authenticate    ${API_USER}    ${API_PASSWORD}
    Create Resource    /auth/revoke    {"token": "${TOKEN}"}    status=200
    Get Resource    /customers/me    status=401

Token Rate Limit
    FOR    ${attempt}    IN RANGE    6
        POST    shop    /auth/token    json={"username": "${API_USER}", "password": "nope"}    expected_status=401
    END
    ${response}    POST    shop    /auth/token    json={"username": "${API_USER}", "password": "nope"}    expected_status=429
    Status Should Be    429    ${response}

Token Scopes Restrict Access
    Authenticate    readonly@example.com    ${API_PASSWORD}
    Get Resource    /products    status=200
    Create Resource    /products    {"name": "Nope"}    status=403

Access Without Token Returns 401
    Get Resource    /customers/me    status=401
