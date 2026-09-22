*** Settings ***
Documentation    This testsuite covers the generated HTML dashboard of robotdashboard

Resource    ../resources/keywords/dashboard-keywords.resource
Resource    ../resources/keywords/general-keywords.resource

Suite Setup    Start Browser
Suite Teardown    Close Browser
Test Setup    Run Keywords    Generate Shared Dashboard    Open Dashboard
Test Teardown    Close Dashboard


*** Variables ***
# every test graph whose timeline view marks re-executed tests with the rerun border
@{RERUN_MARKING_GRAPHS}    testStatisticsGraph    testMessagesGraph    testMostFlakyGraph    testRecentMostFlakyGraph
...    testMostFailedGraph    testRecentMostFailedGraph


*** Test Cases ***
Validate Dashboard Run Statistics
    Validate Component    id=runStatisticsSection    name=baseRunSection    folder=run

Validate Dashboard Suite Statistics
    Validate Component    id=suiteStatisticsSection    name=baseSuiteSection    folder=suite

Validate Dashboard Test Statistics
    Validate Component    id=testStatisticsSection    name=baseTestSection    folder=test

Validate Dashboard Keyword Statistics
    Validate Component    id=keywordStatisticsSection    name=baseKeywordSection    folder=keyword

Validate Dashboard Test Statistics Rerun View
    [Documentation]    A run merged with `rebot --merge` keeps the attempt history of its tests: the
    ...    Reruns select marks re-executed tests and can show their first attempt instead.
    [Setup]    Run Keywords    Generate Dashboard With Merged Output    Open Dashboard
    [Teardown]    Run Keywords    Close Dashboard    Remove Database And Dashboard With Index
    ${withAttempts}    Get Test Count With Attempts
    Should Be True    ${withAttempts} > 0
    ${marked}    Get Rerun Marked Bar Count
    Should Be True    ${marked} > 0    # default view marks re-executed tests
    # the section filter defaults to the first suite, which has no re-executed test in this fixture
    Select Suite In Test Statistics    All
    # the select drives every test graph that marks re-executed tests, not only the statistics graph
    FOR    ${graph}    IN    @{RERUN_MARKING_GRAPHS}
        ${marked}    Get Rerun Marked Bar Count    graph=${graph}
        Should Be True    ${marked} > 0    msg=${graph} should mark re-executed tests in the default view
    END
    Set Test Statistics Rerun View    final
    FOR    ${graph}    IN    @{RERUN_MARKING_GRAPHS}
        ${marked}    Get Rerun Marked Bar Count    graph=${graph}
        Should Be Equal As Integers    ${marked}    0    msg=${graph} should not mark re-executed tests in the final view
    END
    Set Test Statistics Rerun View    first
    FOR    ${graph}    IN    @{RERUN_MARKING_GRAPHS}
        ${marked}    Get Rerun Marked Bar Count    graph=${graph}
        Should Be True    ${marked} > 0    msg=${graph} should mark re-executed tests in the first attempt view
    END
    Set Test Statistics Rerun View    reruns
    ${marked}    Get Rerun Marked Bar Count
    Should Be True    ${marked} > 0
    Open Compare Page
    ${markedCompare}    Get Rerun Marked Bar Count    graph=compareTestsGraph
    Should Be True    ${markedCompare} > 0
    Set Compare Tests Rerun View    final
    ${markedCompare}    Get Rerun Marked Bar Count    graph=compareTestsGraph
    Should Be Equal As Integers    ${markedCompare}    0

Validate Suite Statistics Suite Filter
    [Documentation]    Auth Tokens only exists in the 8 WebshopAPI runs; the section filter also
    ...    narrows the "most" graphs because switchSectionFiltersApplySuite is on by default.
    Select Suite In Suite Statistics    Auth Tokens
    ${labels}    Get Graph Labels    suiteStatisticsGraph
    Length Should Be    ${labels}    8
    ${datasets}    Get Graph Dataset Labels    suiteDurationGraph
    Should Be Equal    ${datasets}    ${{ ["Auth Tokens"] }}
    ${most_failed}    Get Graph Labels    suiteMostFailedGraph
    Should Be Equal    ${most_failed}    ${{ ["Auth Tokens"] }}

Validate Test Statistics Suite And Test Filters
    Select Suite In Test Statistics    Login
    ${tests}    Get Select Options    testSelect
    Should Contain    ${tests}    Login With Valid Credentials
    Should Not Contain    ${tests}    Download Invoice
    Select Test In Test Statistics    Login With Valid Credentials
    ${datasets}    Get Graph Dataset Labels    testStatisticsGraph
    Should Be Equal    ${datasets}    ${{ ["Login With Valid Credentials"] }}
    ${datasets}    Get Graph Dataset Labels    testDurationGraph
    Should Be Equal    ${datasets}    ${{ ["Login With Valid Credentials"] }}

Validate Test Statistics Tag Filter
    Select Suite In Test Statistics    All
    Select Test Tag In Test Statistics    smoke
    ${graph_tests}    Get Graph Dataset Labels    testStatisticsGraph
    ${smoke_tests}    Evaluate JavaScript    ${None}
    ...    () => [...new Set(filteredTests.filter(test => test.tags.includes("smoke")).map(test => test.name))]
    Should Not Be Empty    ${graph_tests}
    ${unique_graph_tests}    Evaluate    sorted(set($graph_tests))
    Should Be Equal    ${unique_graph_tests}    ${{ sorted($smoke_tests) }}

Validate Keyword Statistics Keyword Filter
    Select Keyword In Keyword Statistics    Add Product To Cart
    ${datasets}    Get Graph Dataset Labels    keywordTimesRunGraph
    Should Be Equal    ${datasets}    ${{ ["Add Product To Cart"] }}
    ${datasets}    Get Graph Dataset Labels    keywordAverageDurationGraph
    Should Be Equal    ${datasets}    ${{ ["Add Product To Cart"] }}

Validate Compare Run Selection
    [Documentation]    The compare selects default to the two most recent runs; every selected run becomes
    ...    one dataset of the statistics graph and "None" drops it again.
    Open Compare Page
    ${datasets}    Get Graph Dataset Labels    compareStatisticsGraph
    Length Should Be    ${datasets}    2
    Should Start With    ${datasets}[0]    2026-09-10 06:00:11
    Should Start With    ${datasets}[1]    2026-09-09 02:15:3
    ${run3}    Select Compare Run    3    2026-09-02 06:00:33
    ${datasets}    Get Graph Dataset Labels    compareStatisticsGraph
    Length Should Be    ${datasets}    3
    Should Be Equal    ${datasets}[2]    ${run3}
    ${datasets}    Get Graph Dataset Labels    compareSuiteDurationGraph
    Length Should Be    ${datasets}    3
    Select Compare Run    3    None
    ${datasets}    Get Graph Dataset Labels    compareStatisticsGraph
    Length Should Be    ${datasets}    2

Validate Compare Suite Paths Switch
    [Documentation]    Use Suite Paths labels the suite duration radar and the tests timeline with full
    ...    suite paths instead of bare names.
    Open Compare Page
    Select Compare Run    1    2026-09-10 06:00:11
    Select Compare Run    2    2026-09-05 13:00:49
    ${suites}    Get Graph Labels    compareSuiteDurationGraph
    Should Contain    ${suites}    Auth Tokens
    ${tests}    Get Graph Labels    compareTestsGraph
    Should Contain    ${tests}    Token Rate Limit
    Toggle Compare Suite Paths
    ${suites}    Get Graph Labels    compareSuiteDurationGraph
    Should Not Contain    ${suites}    Auth Tokens
    Should Contain    ${suites}    WebshopAPI.Auth Tokens
    ${tests}    Get Graph Labels    compareTestsGraph
    Should Not Contain    ${tests}    Token Rate Limit
    Should Contain    ${tests}    WebshopAPI.Auth Tokens.Token Rate Limit
    Toggle Compare Suite Paths
    ${suites}    Get Graph Labels    compareSuiteDurationGraph
    Should Contain    ${suites}    Auth Tokens

Validate Compare Tests Status And Only Changes Filters
    [Documentation]    Between the WebshopAPI runs of 2026-09-10 and 2026-09-05 four tests fail in both,
    ...    three change status and the other 43 pass in both. Status keeps the tests with that single
    ...    status, Only Changes keeps the tests whose status differs, both together match nothing.
    Open Compare Page
    Select Compare Run    1    2026-09-10 06:00:11
    Select Compare Run    2    2026-09-05 13:00:49
    ${tests}    Get Graph Labels    compareTestsGraph
    Length Should Be    ${tests}    50
    Set Compare Tests Status Filter    Failed
    ${tests}    Get Graph Labels    compareTestsGraph
    Should Be Equal    ${{ sorted($tests) }}
    ...    ${{ ["Bulk Stock Import", "Customer Merge Duplicates", "Inventory Report Export", "Order Export Csv"] }}
    Set Compare Tests Status Filter    Passed
    ${tests}    Get Graph Labels    compareTestsGraph
    Length Should Be    ${tests}    43
    Set Compare Tests Status Filter    All
    Toggle Compare Tests Only Changes
    ${tests}    Get Graph Labels    compareTestsGraph
    Should Be Equal    ${{ sorted($tests) }}    ${{ ["Low Stock Webhook", "Order Webhook Delivered", "Token Rate Limit"] }}
    Set Compare Tests Status Filter    Failed
    ${tests}    Get Graph Labels    compareTestsGraph
    Should Be Empty    ${tests}
    Toggle Compare Tests Only Changes
    Set Compare Tests Status Filter    All
    ${tests}    Get Graph Labels    compareTestsGraph
    Length Should Be    ${tests}    50
