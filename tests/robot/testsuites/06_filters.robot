*** Settings ***
Documentation    This testsuite covers the generated HTML dashboard of robotdashboard

Resource    ../resources/keywords/dashboard-keywords.resource
Resource    ../resources/keywords/general-keywords.resource

Suite Setup    Start Browser
Suite Teardown    Close Browser
Test Setup    Run Keywords    Generate Shared Dashboard    Open Dashboard
Test Teardown    Close Dashboard


*** Test Cases ***
Validate Filters Modal Buttons Are Right Aligned
    Open Filter Dialog
    Modal Buttons Should Be Right Aligned    modal=filtersModal    last_button=closeFilters
    Close Filter Dialog

Validate Dashboard Run Name Filter
    Set Run Filter    value=WebshopUI
    Validate Component    id=runStatisticsSection    name=runNameFilter    folder=run

Validate Dashboard Run Tags Filter
    Should Show 18 Of 18 Runs

    Set Run Tags Filter    dev
    Validate Component    id=runStatisticsSection    name=runTagsFilterDev    folder=run
    Should Show 14 Of 14 Runs

    Set Run Tags Filter    prod
    # the validation of the screenshot below should be 1 (99% accurate) because there is no data which makes the dates
    # in the duration graph change to "current date" which causes unwanted issues
    Validate Component    id=runStatisticsSection    name=runTagsFilterDevProd    folder=run    threshold=0.01
    Should Show 0 Of 0 Runs

    Set Run Tags Filter    prod    strict=True
    Validate Component    id=runStatisticsSection    name=runTagsFilterProd    folder=run
    Should Show 4 Of 4 Runs

    Set Run Tags Filter    dev    amount    strict=True
    Validate Component    id=runStatisticsSection    name=runTagsFilterAmount    folder=run
    Should Show 1 Of 1 Runs

Validate Dashboard Run Tags Filter From Overview Project Card
    Open Overview Page
    Enable Run Tags On Overview Page
    Open Dashboard Page From Overview Project Card    project=project_1
    Should Show 10 Of 10 Runs
    Validate Filter Settings    runTags=project_1

Validate Dashboard Date Filter
    Set Date Filter    fromDate=08252026    fromTime=1200am
    Validate Component    id=runStatisticsSection    name=runDateFilter    folder=run

Validate Dashboard Amount Filter
    Set Amount Filter    amount=5
    Validate Component    id=runStatisticsSection    name=runAmountFilter    folder=run

Add Filter Profile With Runs Filter
    Set Run Filter    value=WebshopUI
    Add Filter Profile PrfRuns For    Runs
    Filter Profile PrfRuns Should Be    {'runs': 'WebshopUI'}

Add Filter Profile With Run Tags Filter
    Set Run Tags Filter    prod    project_1
    Add Filter Profile PrfTags For    RunTags
    Validate Selected Run Tags Of Filter Profile PrfTags    prod    project_1    strict=True

Add Filter Profile With Versions Filter
    Set Versions Filter    None
    Add Filter Profile PrfVersions For    Versions
    Filter Profile PrfVersions Should Be    {'projectVersions': [{'value': 'All', 'checked': False}, {'value': 'None', 'checked': True}, {'value': '1.2', 'checked': False}, {'value': '1.1', 'checked': False}, {'value': '1.0', 'checked': False}]}

Versions Filter Search Selects Matching Versions
    Open Filter Dialog
    Click    selector=id=selectProjectVersion
    Fill Text    selector=id=projectVersionCheckBoxesFilter    txt=1.
    ${state10}    Get Checkbox State    selector=id=projectVersionInputItem1.0
    ${state11}    Get Checkbox State    selector=id=projectVersionInputItem1.1
    ${state12}    Get Checkbox State    selector=id=projectVersionInputItem1.2
    ${stateAll}    Get Checkbox State    selector=id=projectVersionInputItemAll
    ${stateNone}    Get Checkbox State    selector=id=projectVersionInputItemNone
    Should Be True    ${state10}
    Should Be True    ${state11}
    Should Be True    ${state12}
    Should Not Be True    ${stateAll}
    Should Not Be True    ${stateNone}
    Close Filter Dialog

Versions Filter Search Clear Button Keeps Selection
    Open Filter Dialog
    Click    selector=id=selectProjectVersion
    Wait For Elements State    selector=id=projectVersionCheckBoxesFilterClear    state=hidden
    Fill Text    selector=id=projectVersionCheckBoxesFilter    txt=1.
    Wait For Elements State    selector=id=projectVersionCheckBoxesFilterClear    state=visible
    Wait For Elements State    selector=id=projectVersionInputItemNone    state=hidden
    Click    selector=id=projectVersionCheckBoxesFilterClear
    Wait For Elements State    selector=id=projectVersionCheckBoxesFilterClear    state=hidden
    Wait For Elements State    selector=id=projectVersionInputItemNone    state=visible
    Get Property    selector=id=projectVersionCheckBoxesFilter    property=value    assertion_operator===    assertion_expected=${EMPTY}
    ${state10}    Get Checkbox State    selector=id=projectVersionInputItem1.0
    ${state11}    Get Checkbox State    selector=id=projectVersionInputItem1.1
    ${state12}    Get Checkbox State    selector=id=projectVersionInputItem1.2
    ${stateAll}    Get Checkbox State    selector=id=projectVersionInputItemAll
    ${stateNone}    Get Checkbox State    selector=id=projectVersionInputItemNone
    Should Be True    ${state10}
    Should Be True    ${state11}
    Should Be True    ${state12}
    Should Not Be True    ${stateAll}
    Should Not Be True    ${stateNone}
    Close Filter Dialog

Add Filter Profile With Date Filters
    Set Date Filter    fromDate=03132025    fromTime=1225am    toDate=04012025    toTime=1159pm

    Add Filter Profile PrfFrom For    FromDate    FromTime
    Filter Profile PrfFrom Should Be    {'fromDate': '2025-03-13', 'fromTime': '00:25'}

    Add Filter Profile PrfTo For    ToDate    ToTime
    Filter Profile PrfTo Should Be    {'toDate': '2025-04-01', 'toTime': '23:59'}

    Add Filter Profile PrfFromTo For    FromDate    ToTime
    Filter Profile PrfFromTo Should Be    {'fromDate': '2025-03-13', 'toTime': '23:59'}

Add Filter Profile With Amount Filter
    Set Amount Filter    amount=200    close_filter_dialog=False
    Add Filter Profile PrfAmount For    Amount    open_filter_dialog=False
    Filter Profile PrfAmount Should Be    {'amount': '200'}

Applied Filter Profile Adds New Filter
    Set Run Filter    value=WebshopUI
    Set Run Tags Filter    prod    project_1
    Set Versions Filter    1.2
    Set Date Filter    fromDate=03102025    fromTime=1010pm    toDate=03142025    toTime=0245am
    Set Amount Filter    amount=13    close_filter_dialog=False
    Add Filter Profile Profile1 For    Runs    RunTags    Versions
    ...    FromDate    FromTime    ToDate    ToTime    Amount    open_filter_dialog=False
    Reset Filters
    Apply Filter Profile    profile_name=Profile1
    Validate Filter Settings    runs=WebshopUI    runTags=prod project_1    versions=1.2
    ...    fromDate=2025-03-10    fromTime=22:10    toDate=2025-03-14    toTime=02:45
    ...    amount=13

Validate Dashboard Run Tags Filter OR Mode
    [Documentation]    AND needs every selected tag on a run (no fixture run has both), OR any of them.
    Set Run Tags Filter    prod    amount    strict=True
    Should Show 0 Of 0 Runs
    Set Run Tags Mode    OR
    Should Show 5 Of 5 Runs

Validate Dashboard Run Tags Filter NOT Mode
    Set Run Tags Filter    prod    amount    strict=True
    Set Run Tags Mode    NOT
    Should Show 13 Of 13 Runs

Validate Dashboard Metadata Filter
    [Documentation]    The four prod runs carry the metadata "Environment: production".
    Set Metadata Filter    Environment: production
    Should Show 4 Of 4 Runs

Validate Dashboard Suite Path Filter
    [Documentation]    Selecting a top-level suite keeps only the runs that contain it and narrows the
    ...    suite data to that path.
    Select Suite Path    WebshopAPI
    Should Show 8 Of 8 Runs
    ${roots}    Evaluate JavaScript    ${None}    () => [...new Set(filteredSuites.map(suite => suite.full_name.split(".")[0]))]
    Should Be Equal    ${roots}    ${{ ["WebshopAPI"] }}

Reset Filters Restores Defaults
    Set Run Filter    value=WebshopUI
    Set Run Tags Filter    project_1    strict=True
    Set Run Tags Mode    NOT
    Set Metadata Filter    Environment: production
    Select Suite Path    WebshopAPI
    Set Amount Filter    amount=3
    Should Show 0 Of 0 Runs
    Reset Filters
    Should Show 18 Of 18 Runs
    # the amount input is clamped to the number of available runs once the filters are applied
    Validate Filter Settings    runs=All    runTags=All    amount=18
    Get Selected Options    id=metadata    value    ==    All
    Get Selected Options    id=tagMode    value    ==    AND
    Get Property    selector=id=suitePathValue    property=value    assertion_operator===    assertion_expected=All

Deleting A Filter Profile Removes It
    Set Run Filter    value=WebshopUI
    Add Filter Profile PrfKeep For    Runs
    Add Filter Profile PrfDelete For    Runs
    Delete Filter Profile    PrfDelete
    Filter Profile PrfDelete Should Not Exist
    Filter Profile PrfKeep Should Be    {'runs': 'WebshopUI'}
    Reload Dashboard
    Filter Profile PrfDelete Should Not Exist

Update Filter Profile After Changing Filters
    [Documentation]    Once an applied profile is modified the profile select shows a dot and an Update
    ...    button; updating re-saves only the keys the profile already had.
    Set Run Filter    value=WebshopUI
    Add Filter Profile PrfUpdate For    Runs
    Reset Filters
    Apply Filter Profile    profile_name=PrfUpdate
    Set Run Filter    value=WebshopAPI
    Update Active Filter Profile
    Filter Profile PrfUpdate Should Be    {'runs': 'WebshopAPI'}

Merge Two Filter Profiles Into A New One
    [Documentation]    Fields that exist on one side only pass through, so the merge of a runs-only and
    ...    an amount-only profile carries both.
    Set Run Filter    value=WebshopUI
    Add Filter Profile PrfLeft For    Runs
    Set Amount Filter    amount=5    close_filter_dialog=False
    Add Filter Profile PrfRight For    Amount    open_filter_dialog=False
    Merge Filter Profiles Into    PrfLeft    PrfRight    PrfMerged
    Filter Profile PrfMerged Should Be    {'runs': 'WebshopUI', 'amount': '5'}
    Reset Filters
    Apply Filter Profile    profile_name=PrfMerged
    Validate Filter Settings    runs=WebshopUI    amount=5
    Should Show 5 Of 10 Runs

Validate Dashboard Custom Filters
    [Documentation]    --customfilters key=value pairs become one dropdown per key; runs processed without
    ...    the key are listed under "None". Dimensions combine with AND, values within one dimension with
    ...    the dropdown's mode.
    [Setup]    Run Keywords    Generate Dashboard With Custom Filters    Open Dashboard
    [Teardown]    Run Keywords    Close Dashboard    Remove Database And Dashboard With Index
    Should Show 5 Of 5 Runs
    Open Filter Dialog
    ${dimensions}    Get Custom Filter Dimensions
    Should Be Equal    ${dimensions}    ${{ ["Browser", "Env"] }}
    ${values}    Get Custom Filter Values    Browser
    Should Be Equal    ${values}    ${{ ["All", "None", "chrome", "firefox"] }}
    Close Filter Dialog
    Set Custom Filter    Browser    chrome
    Should Show 3 Of 3 Runs
    Set Custom Filter Mode    Browser    NOT
    Should Show 2 Of 2 Runs
    Set Custom Filter    Browser    None    strict=True
    Set Custom Filter Mode    Browser    OR
    Should Show 1 Of 1 Runs
    Reset Filters
    Should Show 5 Of 5 Runs
    Set Custom Filter    Env    prod
    Should Show 1 Of 1 Runs
    Set Custom Filter    Browser    firefox
    Should Show 1 Of 1 Runs
    Set Custom Filter    Browser    chrome    strict=True
    Should Show 0 Of 0 Runs
