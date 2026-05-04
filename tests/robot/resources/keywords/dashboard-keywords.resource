*** Settings ***
Library    Collections
Library    String
Library    json
Library    Browser
Library    DocTest.VisualTest    embed_screenshots=True    screenshot_format=png
Resource    ../variables/variables.resource


*** Variables ***
${ROOT_FOLDER}    ${CURDIR}/../../../..
${SCREENSHOT_FOLDER}    ${ROOT_FOLDER}/results/browser/screenshot
${REFERENCE_FOLDER}    ${CURDIR}/../dashboard_output


*** Keywords ***
Start Browser
    New Browser    browser=chromium    headless=${True}

Stop Browser
    Close Browser

Open Dashboard
    New Context    colorScheme=dark    viewport={"width": 1920, "height": 1600}
    New Page    url=file:${ROOT_FOLDER}/robotdashboard_${DASHBOARD_INDEX}.html
    Wait For Elements State    selector=id=loading    state=hidden
    Click    selector=id=settings
    Fill Text    selector=id=toggleAnimationDuration    txt=0
    Click    selector=id=closeSettings
    Wait For Elements State    selector=id=loading    state=hidden

Close Dashboard
    Close Page
    Close Context

Open Overview Page
    Click    selector=id=menuOverview
    Wait For Elements State    selector=id=overviewLatestRunsSection
    Wait For Elements State    selector=id=overviewTotalStatsSection

Open Compare Page
    Click    selector=id=menuCompare
    Wait For Elements State    selector=id=compareStatisticsSection

Open Tables Page
    Click    selector=id=menuTables
    Wait For Elements State    selector=id=tablesStatisticsSection

Validate Screenshot
    [Arguments]    ${screenshot}    ${reference}    ${folder}    ${threshold}=${EMPTY}
    VAR    ${reference}    ${REFERENCE_FOLDER}/${folder}/${reference}.png
    VAR    ${screenshot}    ${SCREENSHOT_FOLDER}/${screenshot}.png
    IF    "${threshold}"=="${EMPTY}"    VAR    ${threshold}    0.005    # 99.5% accuracy by default
    Compare Images    reference_image=${reference}    candidate_image=${screenshot}    threshold=${threshold}

Validate Component
    [Arguments]    ${id}    ${name}    ${folder}    ${threshold}=${EMPTY}
    Sleep    time_=1s
    Take Screenshot    filename=${SCREENSHOT_FOLDER}/${name}    selector=id=${id}
    Validate Screenshot    screenshot=${name}    reference=${name}    folder=${folder}    threshold=${threshold}

Open Filter Dialog
    Click    selector=id=filters

Close Filter Dialog
    Click    selector=id=closeFilters

Set Run Filter
    [Arguments]    ${value}
    Open Filter Dialog
    Select Options By    id=runs    value    ${value}
    Close Filter Dialog

Set Run Tags Filter
    [Arguments]    @{tags}    ${strict}=False
    Open Filter Dialog
    Click    selector=id=selectRunTags
    IF    ${strict}
        ${elements}    Get Elements    selector=id=runTag >> css=input.form-check-input
        FOR    ${element}    IN    @{elements}
            ${id}    Get Attribute    ${element}    id
            IF    "${id}".startswith("runTagCheckBox")
                Uncheck Checkbox    selector=id=${id}
            END
        END
    END
    FOR    ${tag}    IN    @{tags}
        Check Checkbox    selector=id=runTagCheckBox${tag}
    END
    Close Filter Dialog

Set Versions Filter
    [Arguments]    @{versions}
    Open Filter Dialog
    Click    selector=id=selectProjectVersion
    FOR    ${version}    IN    @{versions}
        Check Checkbox    selector=id=projectVersionInputItem${version}
    END
    Close Filter Dialog

Set Date Filter
    [Arguments]    ${fromDate}=${None}    ${fromTime}=${None}    ${toDate}=${None}    ${toTime}=${None}
    Open Filter Dialog
    Sleep    time_=500ms
    IF    '${fromDate}' != '${None}'    Type Text    selector=id=fromDate    txt=${fromDate}    clear=True
    IF    '${fromTime}' != '${None}'    Type Text    selector=id=fromTime    txt=${fromTime}    clear=True
    IF    '${toDate}' != '${None}'    Type Text    selector=id=toDate    txt=${toDate}    clear=True
    IF    '${toTime}' != '${None}'    Type Text    selector=id=toTime    txt=${toTime}    clear=True
    Close Filter Dialog

Set Amount Filter
    [Arguments]    ${amount}    ${close_filter_dialog}=True
    Open Filter Dialog
    Fill Text    selector=id=amount    txt=${amount}
    IF    ${close_filter_dialog}    Close Filter Dialog

Change Settings
    Click    selector=id=themeDark
    Click    selector=id=settings
    Click    selector=id=toggleLegends
    Click    selector=id=toggleAxisTitles
    Select Options By    id=toggleBarRounding    value    0
    Click    selector=id=labels-time-tab
    Click    selector=id=toggleLabels
    Click    selector=id=closeSettings

Add Filter Profile For
    [Arguments]    @{selected_filters}    ${profile_name}
    Add Filter Profile ${profile_name} For    @{selected_filters}

Add Filter Profile ${profile_name} For
    [Arguments]    @{selected_filters}    ${open_filter_dialog}=True
    IF    ${open_filter_dialog}   Open Filter Dialog
    Click    selector=id=addFilterProfile
    Fill Text    selector=id=filterProfileName    txt=${profile_name}
    VAR    @{filters}    Runs    RunTags    Versions    FromDate    FromTime    ToDate    ToTime    Amount
    FOR    ${filter}    IN    @{filters}
        ${check}    Evaluate    '${filter}' in @{selected_filters}
        IF    ${check}
            Check Checkbox    selector=id=profileCheck${filter}
        ELSE
            Uncheck Checkbox    selector=id=profileCheck${filter}
        END
    END
    Click    selector=id=saveFilterProfile
    Close Filter Dialog

Apply Filter Profile
    [Arguments]    ${profile_name}
    Open Filter Dialog
    Click    selector=id=selectFilterProfile
    Click    selector=id=profile${profile_name}
    Take Screenshot
    Close Filter Dialog

Get Filter Profile Settings
    [Arguments]    ${profile_name}
    ${settings_str}    LocalStorage Get Item    key=settings
    ${settings}    Loads    ${settings_str}
    VAR    ${filter_profile}     ${settings}[filterProfiles][${profile_name}]
    RETURN    ${filter_profile}

Reset Filters
    Open Filter Dialog
    Click    selector=id=resetFilters
    Close Filter Dialog

Filter Profile ${profile_name} Should Be
    [Arguments]    ${filter_value_str}
    ${settings}    Get Filter Profile Settings    profile_name=${profile_name}
    ${expected}    Evaluate    ${filter_value_str}
    Should Be Equal    first=${settings}    second=${expected}

Validate Selected Run Tags Of Filter Profile ${profile_name}
    [Arguments]    @{tags}    ${strict}=True
    ${settings}    Get Filter Profile Settings    profile_name=${profile_name}
    VAR    ${run_tags}    ${settings}[runTags]
    VAR    @{checked_tags}    @{EMPTY}
    FOR    ${run_tag}    IN    @{run_tags}
        Log    ${run_tag}
        IF    ${run_tag}[checked]
            Append To List    ${checked_tags}    ${run_tag}[id]
        END
    END
    FOR    ${tag}    IN    @{tags}
        List Should Contain Value    list_=${checked_tags}    value=${tag}
    END
    IF    '${strict}' == 'True'
        FOR    ${tag}    IN    @{checked_tags}
            List Should Contain Value    list_=${tags}    value=${tag}
        END
    END

Validate Filter Settings
    #TODO
    [Arguments]    ${runs}=${EMPTY}
    ...    ${runTags}=${EMPTY}
    ...    ${versions}=${EMPTY}
    ...    ${fromDate}=${EMPTY}
    ...    ${fromTime}=${EMPTY}
    ...    ${toDate}=${EMPTY}
    ...    ${toTime}=${EMPTY}
    ...    ${amount}=${EMPTY}

    Open Filter Dialog
    IF    len("${runs}")    Get Selected Options    id=runs    value    ==    ${runs}
    IF    len("S{run_tags}")
        VAR    @{selected_run_tags}    @{EMPTY}
        ${elements}    Get Elements    selector=id=runTag >> css=input.form-check-input
        FOR    ${element}    IN    @{elements}
            ${id}    Get Attribute    ${element}    id
            IF    "${id}".startswith("runTagCheckBox")
                ${state}    Get Checkbox State    selector=${element}
                IF    ${state}
                    ${tag}    Replace String    string=${id}    search_for=runTagCheckBox    replace_with=${EMPTY}
                    Append To List    ${selected_run_tags}    ${tag}
                END
            END
        END
        Log    ${selected_run_tags}
        Should Be True    ${selected_run_tags} == "${runTags}".split()
    END

    IF    len("${versions}")
        VAR    @{selected_versions}    @{EMPTY}
        ${elements}    Get Elements    selector=id=projectVersionList >> css=input.form-check-input
        FOR    ${element}    IN    @{elements}
            ${id}    Get Attribute    ${element}    id
            IF    "${id}".startswith("projectVersionInputItem")
                ${state}    Get Checkbox State    selector=${element}
                IF    ${state}
                    ${version}    Replace String    string=${id}    search_for=projectVersionInputItem    replace_with=${EMPTY}
                    Append To List    ${selected_versions}    ${version}
                END
            END
        END
        Log    ${selected_versions}
        Should Be True    ${selected_versions} == "${versions}".split()
    END
    IF    len("${fromDate}")    Browser.Get Text    id=fromDate    ==    ${fromDate}
    IF    len("${fromTime}")    Browser.Get Text    id=fromTime    ==    ${fromTime}
    IF    len("${toDate}")    Browser.Get Text    id=toDate    ==    ${toDate}
    IF    len("${toTime}")    Browser.Get Text    id=toTime    ==    ${toTime}
    IF    len("${amount}")    Browser.Get Text    id=amount    ==    ${amount}

    Close Filter Dialog

Should Show ${runs} Of ${total_runs} Runs
    Get Property    selector=id=runTitle >> h6    property=innerText    assertion_operator===    assertion_expected=showing ${runs} of ${total_runs} runs
