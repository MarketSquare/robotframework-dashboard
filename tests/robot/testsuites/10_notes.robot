*** Settings ***
Documentation    This testsuite covers the opt-in notes on test results: the Test Notes setting, adding notes from
...              a graph (right-click) and from the test table, categories, the Test Notes widget, the notes modal
...              with its cleanup of unmatched notes and import/export, and the storage warning.
...              Notes live in localStorage, so every change is asserted there and proven to survive a reload.

Resource    ../resources/keywords/dashboard-keywords.resource
Resource    ../resources/keywords/general-keywords.resource

Suite Setup    Start Browser
Suite Teardown    Close Browser
Test Setup    Run Keywords    Generate Shared Dashboard    Open Dashboard    Enable Test Notes
Test Teardown    Close Dashboard


*** Variables ***
&{UNMATCHED_NOTE}    text=Test of another dashboard    category=${EMPTY}    updated=2020-01-01T00:00:00.000Z
&{UNMATCHED_TEST}    Other.Suite.Some Test=&{UNMATCHED_NOTE}
&{UNMATCHED_RUN}    1999-01-01 00:00:00=&{UNMATCHED_TEST}
&{UNMATCHED_NOTES}    version=${1}    categories=@{EMPTY}    tests=&{UNMATCHED_RUN}


*** Test Cases ***
Test Notes Are Off By Default And Hidden Again When Turned Off
    Disable Test Notes
    Get Element States    id=notesNavItem    contains    hidden
    Grid Should Not Contain Graph    gridTest    Test Notes
    Right Click Bar In Graph    testStatisticsGraph    failed
    Note Context Menu Should Not Be Shown
    Open Tables Page
    Get Element Count    css=#testTable .note-edit-button    ==    0
    ${settings}    Get Settings From Local Storage
    Should Be Equal    ${settings}[show][notes]    ${False}

Right Click On A Failed Test Adds A Note That Survives A Reload
    Get Element States    id=notesNavItem    contains    visible
    Grid Should Contain Graph    gridTest    Test Notes
    Right Click Bar In Graph    testStatisticsGraph    failed
    Note Context Menu Should Offer    Add note
    Choose Note Menu Action    edit
    Save Note In Editor    Known issue, see https://example.com/issues/12
    ${texts}    Get Stored Note Texts
    Should Be Equal    ${texts}    ${{ ["Known issue, see https://example.com/issues/12"] }}
    ${marked}    Get Noted Bar Count    testStatisticsGraph
    Should Be Equal As Integers    ${marked}    1
    Reload Dashboard
    ${marked}    Get Noted Bar Count    testStatisticsGraph
    Should Be Equal As Integers    ${marked}    1
    ${widget_notes}    Get Test Notes Widget Notes
    Should Be Equal    ${widget_notes}    ${{ ["Known issue, see https://example.com/issues/12"] }}
    Right Click Bar In Graph    testStatisticsGraph    failed
    Note Context Menu Should Offer    Edit note    Delete note

Right Click On A Passed Test Offers A Note
    Right Click Bar In Graph    testStatisticsGraph    passed
    Note Context Menu Should Offer    Add note
    Choose Note Menu Action    edit
    Save Note In Editor    Passed only after the second attempt
    ${texts}    Get Stored Note Texts
    Should Be Equal    ${texts}    ${{ ["Passed only after the second attempt"] }}
    ${widget_notes}    Get Test Notes Widget Notes
    Should Contain    ${widget_notes}    Passed only after the second attempt

Note Editor Saves Changes When Dismissed Outside
    Right Click Bar In Graph    testStatisticsGraph    failed
    Choose Note Menu Action    edit
    Wait For Note Editor
    Fill Text    selector=id=noteEditorText    txt=Saved when closed
    Sleep    1s
    Mouse Button    click    20    300
    Wait For Elements State    selector=id=noteEditorModal    state=hidden
    ${texts}    Get Stored Note Texts
    Should Be Equal    ${texts}    ${{ ["Saved when closed"] }}

Notes List Bulk Actions Follow Update Mode
    Right Click Bar In Graph    testStatisticsGraph    failed
    Choose Note Menu Action    edit
    Save Note In Editor    Note for bulk action test
    Open Notes Modal    notes-list
    Get Element States    id=notesListBulkActions    contains    hidden
    Click    selector=id=notesListUpdateToggle
    Get Element States    id=notesListBulkActions    contains    visible
    Click    selector=id=notesListUpdateToggle
    Get Element States    id=notesListBulkActions    contains    hidden

Right Click Outside The Bars Keeps The Browser Menu
    Right Click Empty Area In Graph    testStatisticsGraph
    Note Context Menu Should Not Be Shown

Test Note With A New Category From The Test Table
    Open Tables Page
    Click    selector=css=#testTable .note-edit-button >> nth=0
    Wait For Note Editor
    Add Category In Note Editor    Environment
    Save Note In Editor    Test environment was down
    ${notes}    Get Notes From Local Storage
    Should Be Equal    ${notes}[categories][0][name]    Environment
    ${notes_of_run}    Get Dictionary Values    ${notes}[tests]
    ${test_notes}    Get Dictionary Values    ${notes_of_run}[0]
    Should Be Equal    ${test_notes}[0][category]    ${notes}[categories][0][id]
    Browser.Get Text    css=#testTable .note-cell >> nth=0    *=    Test environment was down

Unmatched Notes Are Kept Until They Are Deleted In The Notes Modal
    Store Notes In Browser    ${UNMATCHED_NOTES}
    Open Notes Modal    notes-unmatched
    Browser.Get Text    id=notesUnmatchedCount    ==    1
    Browser.Get Text    id=notesListCount    ==    0
    Click    selector=id=deleteAllUnmatchedNotes
    Confirm Action
    Browser.Get Text    id=notesUnmatchedCount    ==    0
    ${texts}    Get Stored Note Texts
    Should Be Empty    ${texts}

Notes Are Exported And Imported In The Notes Modal
    Store Notes In Browser    ${UNMATCHED_NOTES}
    Open Notes Modal    notes-transfer
    ${exported}    Download Notes JSON
    Should Be Equal    ${exported}    ${UNMATCHED_NOTES}
    VAR    &{note}    text=Imported note    category=${EMPTY}    updated=2021-01-01T00:00:00.000Z
    VAR    &{test}    Other.Suite.Imported Test=&{note}
    VAR    &{run}    2000-01-01 00:00:00=&{test}
    VAR    &{imported}    version=${1}    categories=@{EMPTY}    tests=&{run}
    Import Notes JSON    ${imported}
    ${texts}    Get Stored Note Texts
    Should Be Equal    ${texts}    ${{ ["Imported note", "Test of another dashboard"] }}

Storage Warning Shows On Every Page When The Browser Storage Is Nearly Full
    Get Element States    id=notesStorageWarning    contains    hidden
    Fill Browser Storage    4200000
    Reload Dashboard
    Get Element States    id=notesStorageWarning    contains    visible
    Open Overview Page
    Get Element States    id=notesStorageWarning    contains    visible
    Open Tables Page
    Get Element States    id=notesStorageWarning    contains    visible
    Click    selector=id=notesStorageWarningClose
    Get Element States    id=notesStorageWarning    contains    hidden
