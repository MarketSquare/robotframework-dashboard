*** Settings ***
Documentation    This testsuite covers the layout editor of the generated HTML dashboard: hiding, resizing
...              and reordering GridStack graphs and sections, undo/redo, the custom stat and link widgets and the
...              custom graphs.
...              Every change is asserted in the DOM and in localStorage, and proven to survive a reload.

Resource    ../resources/keywords/dashboard-keywords.resource
Resource    ../resources/keywords/general-keywords.resource

Suite Setup    Start Browser
Suite Teardown    Close Browser
Test Setup    Run Keywords    Generate Shared Dashboard    Open Dashboard
Test Teardown    Close Dashboard


*** Test Cases ***
Hidden Graph Is Saved And Stays Hidden After Reload
    Grid Should Contain Graph    gridRun    Run Donut
    Enter Layout Edit Mode
    Hide Graph In Layout Editor    runDonut
    Graph Should Be Marked Hidden In Layout Editor    runDonut
    Save Layout
    Grid Should Not Contain Graph    gridRun    Run Donut
    # hidden graphs keep rendering in the section's hidden container so their data stays computed
    Get Element Count    selector=css=#runDataHidden #runDonutGraph    assertion_operator===    assertion_expected=1
    ${settings}    Get Settings From Local Storage
    Should Contain    ${settings}[view][dashboard][graphs][hide]    Run Donut
    Reload Dashboard
    Grid Should Not Contain Graph    gridRun    Run Donut
    Enter Layout Edit Mode
    Show Graph In Layout Editor    runDonut
    Save Layout
    Grid Should Contain Graph    gridRun    Run Donut

Resized Graph Is Saved And Restored After Reload
    Enter Layout Edit Mode
    Resize Graph In Layout Editor    gridRun    Run Statistics    8    6
    Save Layout
    ${layout}    Get Saved Graph Layout    gridRun    Run Statistics
    Should Be Equal As Integers    ${layout}[w]    8
    Should Be Equal As Integers    ${layout}[h]    6
    Reload Dashboard
    ${w}    ${h}    Get Graph Size In Grid    gridRun    Run Statistics
    Should Be Equal As Integers    ${w}    8
    Should Be Equal As Integers    ${h}    6

Undo And Redo Revert And Reapply A Layout Change
    Enter Layout Edit Mode
    Hide Graph In Layout Editor    runDonut
    Graph Should Be Marked Hidden In Layout Editor    runDonut
    Undo Layout Change
    Graph Should Be Marked Shown In Layout Editor    runDonut
    Redo Layout Change
    Graph Should Be Marked Hidden In Layout Editor    runDonut
    Save Layout
    Grid Should Not Contain Graph    gridRun    Run Donut

Reordered And Hidden Sections Are Saved And Restored After Reload
    Enter Layout Edit Mode
    Move Section Down In Layout Editor    run
    Hide Section In Layout Editor    test
    Save Layout
    ${settings}    Get Settings From Local Storage
    Should Be Equal    ${settings}[view][dashboard][sections][show]    ${{ ["Suite Statistics", "Run Statistics", "Keyword Statistics"] }}
    Should Be Equal    ${settings}[view][dashboard][sections][hide]    ${{ ["Test Statistics"] }}
    Reload Dashboard
    ${order}    Get Dashboard Section Order
    Should Be Equal    ${order}
    ...    ${{ ["suiteStatisticsSection", "runStatisticsSection", "keywordStatisticsSection", "testStatisticsSection:hidden"] }}

Custom Stat Widget Is Added, Saved And Deleted
    Enter Layout Edit Mode
    Add Stat Widget    run    run.passedRuns    My Passed Runs
    ${widgets}    Get Stat Widgets In Grid    gridRun
    Length Should Be    ${widgets}    1
    Should Be Equal    ${widgets}[0][0]    My Passed Runs
    Should Not Be Empty    ${widgets}[0][1]
    Save Layout
    Reload Dashboard
    ${widgets}    Get Stat Widgets In Grid    gridRun
    Should Be Equal    ${widgets}[0][0]    My Passed Runs
    ${settings}    Get Settings From Local Storage
    Length Should Be    ${settings}[statWidgets]    1
    Should Be Equal    ${settings}[statWidgets][0][statKey]    run.passedRuns
    Enter Layout Edit Mode
    Delete First Custom Widget    stat
    Save Layout
    ${widgets}    Get Stat Widgets In Grid    gridRun
    Should Be Empty    ${widgets}
    ${settings}    Get Settings From Local Storage
    Should Be Empty    ${settings}[statWidgets]

Custom Link Widget Is Added, Saved And Deleted
    Enter Layout Edit Mode
    Add Link Widget    suite    Docs    https://example.com/docs
    ${widgets}    Get Link Widgets In Grid    gridSuite
    Should Be Equal    ${widgets}    ${{ [["Docs", "https://example.com/docs"]] }}
    Save Layout
    Reload Dashboard
    ${widgets}    Get Link Widgets In Grid    gridSuite
    Should Be Equal    ${widgets}    ${{ [["Docs", "https://example.com/docs"]] }}
    ${settings}    Get Settings From Local Storage
    Should Be Equal    ${settings}[linkWidgets][0][url]    https://example.com/docs
    Enter Layout Edit Mode
    Delete First Custom Widget    link
    Save Layout
    ${widgets}    Get Link Widgets In Grid    gridSuite
    Should Be Empty    ${widgets}

Custom Graph From A Preset Is Added, Saved And Deleted
    Enter Layout Edit Mode
    Add Custom Graph From Preset    run    mostFailed
    ${graphs}    Get Custom Graphs In Grid    gridRun
    Length Should Be    ${graphs}    1
    Should Be Equal    ${graphs}[0][0]    Most failed tests
    Should Be True    0 < len($graphs[0][1]) <= 10
    Save Layout
    Reload Dashboard
    ${graphs}    Get Custom Graphs In Grid    gridRun
    Should Be Equal    ${graphs}[0][0]    Most failed tests
    ${settings}    Get Settings From Local Storage
    Should Be Equal    ${settings}[customGraphs][0][metric][agg]    fail_count
    Enter Layout Edit Mode
    Delete First Custom Graph    gridRun
    Save Layout
    ${graphs}    Get Custom Graphs In Grid    gridRun
    Should Be Empty    ${graphs}
    ${settings}    Get Settings From Local Storage
    Should Be Empty    ${settings}[customGraphs]

Custom Graph Built From Scratch Follows Its Edits
    Enter Layout Edit Mode
    Open Custom Graph Builder    test
    Pick Custom Graph Preset    ${EMPTY}
    Set Custom Graph X Axis    project_version
    Save Custom Graph
    ${graphs}    Get Custom Graphs In Grid    gridTest
    Should Be Equal    ${graphs}[0][2]    ${{ ["Passed", "Failed", "Skipped"] }}
    Should Contain    ${graphs}[0][1]    1.0
    Edit First Custom Graph    gridTest
    Set Custom Graph Chart Type    table
    Save Custom Graph
    Get Element Count    selector=css=#gridTest .custom-graph-table tbody tr    assertion_operator===    assertion_expected=${{ len($graphs[0][1]) }}
    Save Layout
    Reload Dashboard
    ${settings}    Get Settings From Local Storage
    Should Be Equal    ${settings}[customGraphs][0][viz][type]    table

Custom Graph Definition Is Pasted In The JSON Tab
    Enter Layout Edit Mode
    Add Custom Graph From JSON    suite
    ...    {"title": "Pass rate per run", "source": "runs", "x": {"field": "run"}, "metric": {"agg": "pass_rate"}, "viz": {"type": "line"}}
    ${graphs}    Get Custom Graphs In Grid    gridSuite
    Should Be Equal    ${graphs}[0][0]    Pass rate per run
    Should Be Equal As Integers    ${graphs}[0][3]    18
    Edit First Custom Graph    gridSuite
    Click    selector=id=customGraphJsonTab-tab
    Get Property    selector=id=customGraphJson    property=value    assertion_operator=contains    assertion_expected="pass_rate"

Deleting A Custom Graph Is Undone And Redone
    Enter Layout Edit Mode
    Add Custom Graph From Preset    keyword    keywordTimePerLibrary
    Delete First Custom Graph    gridKeyword
    ${graphs}    Get Custom Graphs In Grid    gridKeyword
    Should Be Empty    ${graphs}
    Undo Layout Change
    ${graphs}    Get Custom Graphs In Grid    gridKeyword
    Should Be Equal    ${graphs}[0][0]    Keyword time per library
    Redo Layout Change
    ${graphs}    Get Custom Graphs In Grid    gridKeyword
    Should Be Empty    ${graphs}

Custom Graph From A Settings JSON Without An Id Is Rendered
    [Documentation]    Graphs written by hand into a (--jsonconfig) settings JSON may leave out id and section.
    Apply Settings JSON
    ...    s.customGraphs = [{ title: "From config", source: "tests", x: { field: "run" }, series: { field: "status" }, metric: { agg: "count" }, viz: { type: "stacked_bar" } }]
    ${graphs}    Get Custom Graphs In Grid    gridRun
    Should Be Equal    ${graphs}[0][0]    From config
    Length Should Be    ${graphs}[0][1]    18
    Should Be Equal    ${graphs}[0][2]    ${{ ["Passed", "Failed", "Skipped"] }}

Custom Graph Follows The Section Filters When Enabled
    Enter Layout Edit Mode
    Open Custom Graph Builder    test
    Pick Custom Graph Preset    slowestTests
    Follow Section Filters In Custom Graph Builder
    Save Custom Graph
    Save Layout
    Select Test In Test Statistics    Download Invoice
    ${graphs}    Get Custom Graphs In Grid    gridTest
    Should Be Equal    ${graphs}[0][1]    ${{ ["Download Invoice"] }}
    Select Test In Test Statistics    All
    ${graphs}    Get Custom Graphs In Grid    gridTest
    Should Be True    len($graphs[0][1]) > 1

Custom Graph Shows More Values In Fullscreen
    [Documentation]    A limited graph shows five times its limit in fullscreen, like the built-in top 10 -> top 50.
    Enter Layout Edit Mode
    Add Custom Graph From Preset    run    mostFailed
    Save Layout
    ${graphs}    Get Custom Graphs In Grid    gridRun
    Length Should Be    ${graphs}[0][1]    10
    Open First Custom Graph In Fullscreen    gridRun
    ${graphs}    Get Custom Graphs In Grid    gridRun
    Should Be True    len($graphs[0][1]) > 10
    Close Custom Graph Fullscreen With Escape
    ${graphs}    Get Custom Graphs In Grid    gridRun
    Length Should Be    ${graphs}[0][1]    10

Custom Graph Heatmap Shows A Cell Per Run And Test
    Enter Layout Edit Mode
    Add Custom Graph From Preset    run    failureHeatmap
    ${type}    Evaluate JavaScript    ${None}
    ...    () => Chart.getChart(document.querySelector('#gridRun [data-gs-id^="customGraph-"] canvas')).config.type
    Should Be Equal    ${type}    matrix
    ${graphs}    Get Custom Graphs In Grid    gridRun
    Should Be Equal    ${graphs}[0][0]    Failure heatmap
    # one cell per (run, test that failed at least once): 18 runs times at least one test
    Should Be True    ${graphs}[0][3] >= 18 and ${graphs}[0][3] % 18 == 0

All Stat Widgets Of A Section Are Added From The All Tab
    [Documentation]    The "All" tab lists every stat of the section with a toggle and an editable title;
    ...    reopening it marks the stats that already have a widget.
    Enter Layout Edit Mode
    Open Add All Stat Widgets Tab    run
    Get Element Count    selector=css=#addAllWidgetsList .add-all-widgets-toggle    assertion_operator===    assertion_expected=7
    Uncheck Checkbox    selector=id=addAllWidgetsToggle-run.skippedRuns
    Fill Text    selector=id=addAllWidgetsTitle-run.totalRuns    txt=Total Runs
    Confirm Add All Stat Widgets
    ${widgets}    Get Stat Widgets In Grid    gridRun
    Length Should Be    ${widgets}    6
    ${titles}    Evaluate    [widget[0] for widget in $widgets]
    Should Contain    ${titles}    Total Runs
    Should Not Contain    ${titles}    Skipped Runs
    Save Layout
    Reload Dashboard
    ${widgets}    Get Stat Widgets In Grid    gridRun
    Length Should Be    ${widgets}    6
    ${settings}    Get Settings From Local Storage
    Length Should Be    ${settings}[statWidgets]    6
    Enter Layout Edit Mode
    Open Add All Stat Widgets Tab    run
    Get Element Count    selector=css=#addAllWidgetsList .add-all-widgets-badge    assertion_operator===    assertion_expected=6
    Click    selector=id=addAllWidgetsToggleAll
    Get Element Count    selector=css=#addAllWidgetsList .add-all-widgets-toggle:checked    assertion_operator===    assertion_expected=0

Custom Section Divider In Unified View Is Added, Saved And Deleted
    Toggle Setting    toggleUnified    tab=defaults
    Wait For Dashboard Idle
    Enter Layout Edit Mode
    Add Custom Section    Smoke Suite
    ${titles}    Get Custom Section Titles In Grid
    Should Be Equal    ${titles}    ${{ ["Smoke Suite"] }}
    Save Layout
    Reload Dashboard
    ${titles}    Get Custom Section Titles In Grid
    Should Be Equal    ${titles}    ${{ ["Smoke Suite"] }}
    ${settings}    Get Settings From Local Storage
    Length Should Be    ${settings}[customSections]    1
    Should Be Equal    ${settings}[customSections][0][title]    Smoke Suite
    Enter Layout Edit Mode
    Delete First Custom Section
    Save Layout
    ${titles}    Get Custom Section Titles In Grid
    Should Be Empty    ${titles}
    ${settings}    Get Settings From Local Storage
    Should Be Empty    ${settings}[customSections]

Section Tracks Step Aside While The Layout Is Edited
    [Documentation]    The undo/redo buttons are centred over the navbar, where the section track sits,
    ...    so the track hides for as long as the layout is being edited.
    Wait For Elements State    selector=id=dashboardNavTrack    state=visible
    Enter Layout Edit Mode
    Wait For Elements State    selector=id=dashboardNavTrack    state=hidden
    Save Layout
    Wait For Elements State    selector=id=dashboardNavTrack    state=visible
