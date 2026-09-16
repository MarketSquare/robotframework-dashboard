*** Settings ***
Resource    common.resource


*** Keywords ***
Open Product
    [Documentation]    Search for a product and open its detail page.
    [Arguments]    ${name}
    Search For    ${name}
    Click    ${RESULT_CARDS} >> text=${name}
    Wait For Elements State    ${PRODUCT_TITLE}    visible
    Get Text    ${PRODUCT_TITLE}    expected=${name}

Open Category
    [Arguments]    ${category}
    Open Page With Retry    category/${category}
    Wait For Elements State    ${RESULT_TITLE}    visible

Apply Filter
    [Documentation]    Select a value in one of the facet filters and apply.
    [Arguments]    ${facet}    ${value}
    Select Options By    ${facet}    label    ${value}
    Click    ${FILTER_APPLY}
    Wait For Elements State    ${RESULT_TITLE}    visible

Apply Price Range
    [Arguments]    ${min}    ${max}
    Fill Text    ${FILTER_PRICE_MIN}    ${min}
    Fill Text    ${FILTER_PRICE_MAX}    ${max}
    Click    ${FILTER_APPLY}
    Wait For Elements State    ${RESULT_TITLE}    visible

Sort Results By
    [Arguments]    ${option}
    Select Options By    ${SORT_SELECT}    label    ${option}
    Wait For Elements State    ${RESULT_TITLE}    visible

First Result Price Should Be
    [Arguments]    ${price}
    Get Text    ${RESULT_CARDS} >> nth=0 >> ${PRODUCT_PRICE}    expected=${price}

Open Product Tab
    [Arguments]    ${tab}    ${content}
    Click    ${tab}
    Wait For Elements State    ${content}    visible
