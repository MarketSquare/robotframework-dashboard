*** Settings ***
Documentation       Product search from the header search box.

Resource            resources/catalog.resource

Test Setup          Open Webshop
Test Teardown       Close Webshop
Test Template       Search Should Find

Test Tags           search    regression


*** Test Cases ***                TERM                  MIN RESULTS
Search Laptop                     laptop                12
Search Headphones                 headphones            8
Search Coffee Machine             coffee machine        5
Search Running Shoes              running shoes         20
Search Smartphone                 smartphone            15
Search Backpack                   backpack              6
Search Desk Lamp                  desk lamp             4
Search Board Game                 board game            9
Search Winter Jacket              winter jacket         11
Search Monitor                    monitor               7
Search Gaming Mouse               gaming mouse          5
Search Bluetooth Speaker          bluetooth speaker     6

Search With No Results Shows Suggestion
    [Template]    NONE
    Search For    xyzzy-does-not-exist
    Wait For Elements State    ${NO_RESULTS}    visible
    Get Text    ${NO_RESULTS}    expected=No products found. Try a different search term.

Search Autocomplete Shows Suggestions
    [Template]    NONE
    Fill Text    ${SEARCH_INPUT}    lap
    Wait For Elements State    ${SEARCH_SUGGESTIONS}    visible
    ${count}    Get Element Count    ${SEARCH_SUGGESTIONS}    expected=5
    Should Be True    ${count} > 0

Search Special Characters
    [Template]    NONE
    Search For    "quoted" & <tagged>
    Wait For Elements State    ${NO_RESULTS}    visible

Search Persists After Navigation
    [Template]    NONE
    Search For    laptop
    Click    ${RESULT_CARDS} >> nth=0
    Wait For Elements State    ${PRODUCT_TITLE}    visible
    Click    ${HEADER_LOGO}
    Get Text    ${SEARCH_INPUT}    expected=laptop


*** Keywords ***
Search Should Find
    [Arguments]    ${term}    ${min_results}
    Search For    ${term}
    Search Results Should Contain At Least    ${min_results}
