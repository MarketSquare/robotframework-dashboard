*** Settings ***
Documentation       Facet filters and sorting on category pages.

Resource            resources/catalog.resource

Test Setup          Open Webshop
Test Teardown       Close Webshop

Test Tags           filters    regression


*** Test Cases ***
Filter By Category
    [Tags]    smoke
    Open Category    electronics
    Apply Filter    ${FILTER_CATEGORY}    Audio
    Search Results Should Contain At Least    5

Filter By Price Range
    Open Category    electronics
    Apply Price Range    50    150
    Search Results Should Contain At Least    3

Filter By Brand
    Open Category    electronics
    Apply Filter    ${FILTER_BRAND}    Soundwave
    Search Results Should Contain At Least    2

Filter By Rating
    Open Category    electronics
    Apply Filter    ${FILTER_RATING}    4 stars & up
    Search Results Should Contain At Least    4

Filter Combination Category And Price
    Open Category    electronics
    Apply Filter    ${FILTER_CATEGORY}    Audio
    Apply Price Range    50    150
    Apply Filter    ${FILTER_BRAND}    Soundwave
    Search Results Should Contain At Least    1

Clear All Filters
    Open Category    electronics
    Apply Filter    ${FILTER_CATEGORY}    Audio
    Click    ${FILTER_CLEAR}
    Wait For Elements State    ${RESULT_TITLE}    visible
    Search Results Should Contain At Least    40

Sort By Price Ascending
    Open Category    electronics
    Sort Results By    Price: low to high
    First Result Price Should Be    € 4,99

Sort By Price Descending
    Open Category    electronics
    Sort Results By    Price: high to low
    First Result Price Should Be    € 1.299,00

Sort By Newest
    Open Category    electronics
    Sort Results By    Newest first
    Get Text    ${RESULT_CARDS} >> nth=0 >> ${PRODUCT_TITLE}    expected=Smart Speaker Mini

Filter Results Pagination
    Open Category    electronics
    Click    ${PAGINATION_NEXT}
    Wait For Elements State    ${RESULT_TITLE}    visible
    Get Url    expected=${BASE_URL}/category/electronics?page=2
    Search Results Should Contain At Least    24
