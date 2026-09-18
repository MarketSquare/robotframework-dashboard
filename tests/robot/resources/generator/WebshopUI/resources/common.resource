*** Settings ***
Library     BrowserSim
Library     Features
Resource    variables.resource


*** Keywords ***
Open Webshop
    [Documentation]    Start a browser and open the storefront homepage.
    New Browser    chromium    headless=True
    New Page    ${BASE_URL}
    Wait For Elements State    ${HEADER_LOGO}    visible
    Accept Cookies

Accept Cookies
    Click    ${COOKIE_ACCEPT}

Close Webshop
    [Documentation]    Take a screenshot on failure and close the browser.
    Run Keyword If Test Failed    Take Screenshot
    Close Browser

Open Page
    [Documentation]    Navigate to a storefront page relative to the base URL.
    [Arguments]    ${path}
    Go To    ${BASE_URL}/${path}
    Wait For Elements State    css=main    visible

Open Page With Retry
    [Documentation]    Navigate to a page; retry once when the platform is flaky.
    [Arguments]    ${path}
    TRY
        Open Page    ${path}
    EXCEPT    ConnectionError*    StaleElementError*    GatewayError*    RateLimitError*    type=glob
        Log    Page load failed, retrying once    level=WARN
        Open Page    ${path}
    END

Search For
    [Documentation]    Use the header search box.
    [Arguments]    ${term}
    Fill Text    ${SEARCH_INPUT}    ${term}
    Click    ${SEARCH_SUBMIT}
    Wait For Elements State    ${RESULT_TITLE}    visible

Search Results Should Contain At Least
    [Arguments]    ${amount}
    ${count}    Get Element Count    ${RESULT_CARDS}    expected=${amount}
    Should Be True    ${count} >= ${amount}
