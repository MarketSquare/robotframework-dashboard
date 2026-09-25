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
    New Context    colorScheme=dark    viewport={"width": 1920, "height": 2000}
    New Page    url=file:${ROOT_FOLDER}/robotdashboard_${DASHBOARD_INDEX}.html
    Wait For Dashboard Ready

Reload Dashboard
    [Documentation]    Reloads the page the way a user would (F5) and re-injects the test-only idle hook,
    ...    which a reload drops. Use to prove that a change survived in localStorage.
    Reload
    Wait For Dashboard Ready

Wait For Dashboard Reload
    [Documentation]    For actions that call location.reload() themselves (apply/reset settings): waits
    ...    until the old document is gone - the injected idle hook disappears with it - before waiting
    ...    for the new one, otherwise the ready check can pass on the page that is about to unload.
    Wait Until Keyword Succeeds    10s    200ms    Idle Hook Should Be Gone
    Wait For Dashboard Ready

Idle Hook Should Be Gone
    ${gone}    Evaluate JavaScript    ${None}    () => window.dashboard_is_idle === undefined
    Should Be True    ${gone}

Wait For Dashboard Ready
    [Documentation]    Waits for the initial render of a freshly loaded dashboard page and installs the
    ...    test-only idle hook. Shared by Open Dashboard, Reload Dashboard and the server suite.
    Wait For Elements State    selector=id=loading    state=hidden
    # the relative run times on the overview cards ("2 hours ago") change as time passes,
    # hide them so the screenshot comparisons stay deterministic
    Add Style Tag    content=.run-card-run-time { visibility: hidden; }
    # chart animations are disabled through tests/robot/resources/test_config.json (-j), so Chart.js draws synchronously
    # test-only render-state hook, injected here so the shipped dashboard carries no test code
    ${script}    Get File    path=${CURDIR}/../scripts/dashboard_idle.js
    Evaluate JavaScript    ${None}    ${script}
    Wait For Dashboard Idle

Wait For Dashboard Idle
    [Documentation]    Waits until the dashboard reports that all rendering has finished: no spinner,
    ...    overlay, modal, fade or Chart.js animation, and 50 ms without any of those
    ...    (window.dashboard_is_idle, injected by Open Dashboard from resources/scripts/dashboard_idle.js).
    ...    Use before every screenshot or DOM assertion that follows a filter/settings change instead of sleeping.
    Wait For Function    () => window.dashboard_is_idle()    timeout=10s    polling=raf

Close Dashboard
    Close Page
    Close Context

Open Overview Page
    Click    selector=id=menuOverview
    Wait For Elements State    selector=id=overviewLatestRunsSection
    Wait For Elements State    selector=id=overviewTotalStatsSection

Enable Run Tags On Overview Page
    Click    selector=id=settings
    Click    selector=id=overview-tab
    Click    selector=id=switchRunTags
    Click    selector=id=closeSettings

Open Dashboard Page From Overview Project Card
    [Arguments]    ${project}
    Click    selector=id=overviewLatest${project}Card0
    Wait For Elements State    selector=id=runStatisticsSection

Open Dashboard Page
    Click    selector=id=menuDashboard
    Wait For Elements State    selector=id=runStatisticsSection

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
    Wait For Dashboard Idle
    Take Screenshot    filename=${SCREENSHOT_FOLDER}/${name}    selector=id=${id}
    Validate Screenshot    screenshot=${name}    reference=${name}    folder=${folder}    threshold=${threshold}

Set Test Statistics Rerun View
    [Arguments]    ${view}
    Select Options By    id=testRerunView    value    ${view}
    Wait For Elements State    selector=id=loading    state=hidden

Get Rerun Marked Bar Count
    [Documentation]    Bars in a timeline graph that carry the rerun border (blue, width 3).
    [Arguments]    ${graph}=testStatisticsGraph
    ${count}    Evaluate JavaScript    ${None}    () => window.${graph}.data.datasets.filter(dataset => dataset.borderWidth === 3).length
    RETURN    ${count}

Set Compare Tests Rerun View
    [Arguments]    ${view}
    Select Options By    id=compareRerunView    value    ${view}
    Wait For Elements State    selector=id=loading    state=hidden

Get Test Count With Attempts
    [Documentation]    Tests in the filtered data that carry a rerun attempt history.
    ${count}    Evaluate JavaScript    ${None}    () => filteredTests.filter(test => test.attempts).length
    RETURN    ${count}

Open Filter Dialog
    [Documentation]    Waits for the modal fade to finish, Bootstrap ignores a hide while it is still
    ...    transitioning, which would leave the modal open and swallow the next click.
    Click    selector=id=filters
    Wait For Function    () => getComputedStyle(document.getElementById("filtersModal")).opacity === "1"    timeout=5s

Close Filter Dialog
    Click    selector=id=closeFilters
    Wait For Elements State    selector=id=filtersModal    state=hidden

Modal Buttons Should Be Right Aligned
    [Documentation]    The dashboard modals use their own button group instead of Bootstrap's .btn-close;
    ...    the last button must sit at the right edge of the modal header (Bootstrap 5.3.1+ stopped
    ...    spacing the header itself, see components.css).
    [Arguments]    ${modal}    ${last_button}
    Wait For Elements State    selector=id=${last_button}    state=visible
    ${header}    Get BoundingBox    selector=id=${modal} >> .modal-header
    ${button}    Get BoundingBox    selector=id=${last_button}
    ${gap}    Evaluate    (${header}[x] + ${header}[width]) - (${button}[x] + ${button}[width])
    Should Be True    0 <= ${gap} <= 32    msg=Last modal button ends ${gap}px before the header edge

Set Run Filter
    [Arguments]    ${value}
    Open Filter Dialog
    Select Options By    id=runs    value    ${value}
    Close Filter Dialog

Set Run Tags Filter
    [Documentation]    Checks the given run tags; strict=True also unchecks every other tag. The wanted
    ...    tags are checked first because "All" refuses to be unchecked while it is the only selection.
    [Arguments]    @{tags}    ${strict}=False
    Open Filter Dialog
    Click    selector=id=selectRunTags
    FOR    ${tag}    IN    @{tags}
        Check Checkbox    selector=id=runTagCheckBox${tag}
    END
    IF    ${strict}
        ${elements}    Get Elements    selector=id=runTag >> css=input.form-check-input
        FOR    ${element}    IN    @{elements}
            ${id}    Get Attribute    ${element}    id
            ${tag}    Replace String    string=${id}    search_for=runTagCheckBox    replace_with=${EMPTY}
            IF    "${id}".startswith("runTagCheckBox") and $tag not in $tags
                Uncheck Checkbox    selector=id=${id}
            END
        END
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

Get Settings From Local Storage
    [Documentation]    The persisted settings object (localStorage key `settings`) as a dictionary.
    ${settings_str}    LocalStorage Get Item    key=settings
    ${settings}    Loads    ${settings_str}
    RETURN    ${settings}

Get Filter Profile Settings
    [Arguments]    ${profile_name}
    ${settings}    Get Settings From Local Storage
    VAR    ${filter_profile}     ${settings}[filterProfiles][${profile_name}]
    RETURN    ${filter_profile}

Filter Profile ${profile_name} Should Not Exist
    ${settings}    Get Settings From Local Storage
    Dictionary Should Not Contain Key    ${settings}[filterProfiles]    ${profile_name}

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
    IF    len("${runTags}")
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

Set Run Tags Mode
    [Documentation]    Tag Mode select (AND/OR/NOT) inside the collapsed run tags filter.
    [Arguments]    ${mode}
    Open Filter Dialog
    Click    selector=id=selectRunTags
    Select Options By    id=tagMode    value    ${mode}
    Close Filter Dialog

Set Metadata Filter
    [Arguments]    ${value}
    Open Filter Dialog
    Select Options By    id=metadata    value    ${value}
    Close Filter Dialog

Select Suite Path
    [Documentation]    Clicks one child button of the suite path navigator (breadcrumb + children).
    [Arguments]    ${name}
    Open Filter Dialog
    Click    selector=id=suitePathChildren >> text="${name}"
    Get Property    selector=id=suitePathValue    property=value    assertion_operator===    assertion_expected=${name}
    Close Filter Dialog

Delete Filter Profile
    [Documentation]    The x behind a profile in the profile list, followed by the confirm dialog.
    ...    The delete span id is profileCheck<name>, the same prefix as the field checkboxes.
    [Arguments]    ${profile_name}
    Open Filter Dialog
    Click    selector=id=selectFilterProfile
    Click    selector=id=profileCheck${profile_name}
    Confirm Action
    Close Filter Dialog

Update Active Filter Profile
    [Documentation]    The Update button that appears next to the profile select once the filters
    ...    differ from the applied profile (together with the modified dot).
    Open Filter Dialog
    Wait For Elements State    selector=id=profileModifiedDot    state=visible
    Click    selector=id=updateFilterProfile
    Wait For Elements State    selector=id=profileModifiedDot    state=hidden
    Close Filter Dialog

Merge Filter Profiles Into
    [Arguments]    ${left}    ${right}    ${new_name}
    Open Filter Dialog
    Click    selector=id=mergeFilterProfiles
    Select Options By    id=mergeProfileLeft    value    ${left}
    Select Options By    id=mergeProfileRight    value    ${right}
    Fill Text    selector=id=mergeProfileNewName    txt=${new_name}
    Click    selector=id=saveMergeProfile
    Wait For Elements State    selector=id=mergeProfilesModal    state=hidden
    Close Filter Dialog

Confirm Action
    [Documentation]    Presses OK in the confirm dialog (confirm_action in eventlisteners.js). Waits for the
    ...    fade-in to finish first: Bootstrap ignores hide() while the modal is still transitioning, so an
    ...    early click would leave the dialog open. wait_for_hidden=False for actions that reload the page.
    [Arguments]    ${wait_for_hidden}=True
    Wait For Function    () => getComputedStyle(document.getElementById("confirmModal")).opacity === "1"    timeout=5s
    Click    selector=id=confirmOk
    IF    ${wait_for_hidden}    Wait For Elements State    selector=id=confirmModal    state=hidden

Open Settings Tab
    [Documentation]    Waits for the modal fade to finish, the tab panes are only filled on its shown event.
    [Arguments]    ${tab}
    Click    selector=id=settings
    Wait For Function    () => getComputedStyle(document.getElementById("settingsModal")).opacity === "1"    timeout=5s
    Click    selector=id=${tab}-tab

Close Settings
    Click    selector=id=closeSettings
    Wait For Dashboard Idle

Toggle Setting
    [Documentation]    Clicks one switch in the settings modal; ${tab} is the settings tab it lives on.
    [Arguments]    ${element_id}    ${tab}=appearance
    Open Settings Tab    ${tab}
    Click    selector=id=${element_id}
    Close Settings

Select Setting
    [Arguments]    ${element_id}    ${value}    ${tab}=appearance
    Open Settings Tab    ${tab}
    Select Options By    id=${element_id}    value    ${value}
    Close Settings

Setting Should Be
    [Documentation]    Compares one dot-path of the persisted settings (e.g. show.legends) with a value.
    [Arguments]    ${path}    ${expected}
    ${value}    Evaluate JavaScript    ${None}    () => JSON.parse(localStorage.getItem("settings")).${path}
    Should Be Equal    ${value}    ${expected}

Apply Settings JSON
    [Documentation]    Edits the settings JSON in the settings modal JSON tab through ${patch}, a JS
    ...    statement that receives the parsed settings as `s`, then applies it (reloads the page).
    [Arguments]    ${patch}
    Open Settings Tab    json
    Evaluate JavaScript    ${None}
    ...    () => { const area = document.getElementById("settingsTextArea"); const s = JSON.parse(area.value); ${patch}; area.value = JSON.stringify(s); }
    Click    selector=id=applySettings
    Confirm Action    wait_for_hidden=False
    Wait For Dashboard Reload

Reset Settings To Default
    Open Settings Tab    json
    Click    selector=id=resetSettings
    Confirm Action    wait_for_hidden=False
    Wait For Dashboard Reload

Enter Layout Edit Mode
    Click    selector=id=customizeLayout
    Wait For Dashboard Idle

Save Layout
    Click    selector=id=saveLayout
    Wait For Dashboard Idle

Undo Layout Change
    Click    selector=id=undoLayout
    Wait For Dashboard Idle

Redo Layout Change
    Click    selector=id=redoLayout
    Wait For Dashboard Idle

Hide Graph In Layout Editor
    [Documentation]    ${graph_key} is the graphmetadata key (runDonut), the buttons are <key>Shown/<key>Hidden.
    [Arguments]    ${graph_key}
    Click    selector=id=${graph_key}Shown
    Wait For Dashboard Idle

Show Graph In Layout Editor
    [Arguments]    ${graph_key}
    Click    selector=id=${graph_key}Hidden
    Wait For Dashboard Idle

Graph Should Be Marked Hidden In Layout Editor
    [Arguments]    ${graph_key}
    Get Property    selector=id=${graph_key}Hidden    property=hidden    assertion_operator===    assertion_expected=${False}
    Get Property    selector=id=${graph_key}Shown    property=hidden    assertion_operator===    assertion_expected=${True}

Graph Should Be Marked Shown In Layout Editor
    [Arguments]    ${graph_key}
    Get Property    selector=id=${graph_key}Shown    property=hidden    assertion_operator===    assertion_expected=${False}
    Get Property    selector=id=${graph_key}Hidden    property=hidden    assertion_operator===    assertion_expected=${True}

Grid Should Contain Graph
    [Documentation]    ${label} is the graphmetadata label (Run Donut), used as data-gs-id of the tile.
    [Arguments]    ${grid}    ${label}
    Get Element Count    selector=css=#${grid} [data-gs-id="${label}"]    assertion_operator===    assertion_expected=1

Grid Should Not Contain Graph
    [Arguments]    ${grid}    ${label}
    Get Element Count    selector=css=#${grid} [data-gs-id="${label}"]    assertion_operator===    assertion_expected=0

Resize Graph In Layout Editor
    [Documentation]    Resizes through the GridStack API (a mouse drag of the resize handle is not
    ...    deterministic in headless runs); what is under test is that save/restore keeps the size.
    [Arguments]    ${grid}    ${label}    ${w}    ${h}
    Evaluate JavaScript    ${None}
    ...    () => { window.${grid}.update(document.querySelector('#${grid} [data-gs-id="${label}"]'), { w: ${w}, h: ${h} }); }
    Wait For Dashboard Idle

Get Graph Size In Grid
    [Arguments]    ${grid}    ${label}
    ${w}    Get Attribute    selector=css=#${grid} [data-gs-id="${label}"]    attribute=gs-w
    ${h}    Get Attribute    selector=css=#${grid} [data-gs-id="${label}"]    attribute=gs-h
    RETURN    ${w}    ${h}

Get Saved Graph Layout
    [Documentation]    The {x, y, w, h, id} entry of one graph in settings.layouts.<grid> (a JSON string).
    [Arguments]    ${grid}    ${label}
    ${settings}    Get Settings From Local Storage
    ${layout}    Loads    ${settings}[layouts][${grid}]
    FOR    ${entry}    IN    @{layout}
        IF    $entry["id"] == $label    RETURN    ${entry}
    END
    Fail    msg=No saved layout entry for graph "${label}" in ${grid}

Get Dashboard Section Order
    [Documentation]    Ids of the dashboard page sections in DOM order, hidden ones suffixed with ":hidden".
    ${order}    Evaluate JavaScript    ${None}
    ...    () => [...document.querySelectorAll("#dashboard [id$=StatisticsSection]")].map(el => el.hidden ? el.id + ":hidden" : el.id)
    RETURN    ${order}

Hide Section In Layout Editor
    [Arguments]    ${section}
    Click    selector=id=${section}SectionShown
    Wait For Dashboard Idle

Move Section Down In Layout Editor
    [Arguments]    ${section}
    Click    selector=id=${section}SectionMoveDown
    Wait For Dashboard Idle

Add Stat Widget
    [Documentation]    Adds a custom stat widget through the "+" in the section header (edit mode only).
    ...    ${stat} is the statwidgetdefs key, e.g. run.passedRuns.
    [Arguments]    ${section}    ${stat}    ${title}
    Click    selector=id=${section}AddStatWidgetHeader
    Select Options By    id=addStatWidgetStat    value    ${stat}
    Fill Text    selector=id=addStatWidgetTitle    txt=${title}
    Click    selector=id=addStatWidgetConfirm
    Wait For Dashboard Idle

Add Link Widget
    [Arguments]    ${section}    ${label}    ${url}
    Click    selector=id=${section}AddLinkWidgetHeader
    Fill Text    selector=id=addLinkWidgetLabel    txt=${label}
    Fill Text    selector=id=addLinkWidgetUrl    txt=${url}
    Click    selector=id=addLinkWidgetConfirm
    Wait For Dashboard Idle

Delete First Custom Widget
    [Documentation]    The x on a custom widget tile, shown in edit mode only. ${type} is stat or link.
    [Arguments]    ${type}
    Click    selector=css=.delete-custom-${type}-widget
    Wait For Dashboard Idle

Get Stat Widgets In Grid
    [Documentation]    [title, value] of every custom stat widget tile in the grid.
    [Arguments]    ${grid}
    ${widgets}    Evaluate JavaScript    ${None}
    ...    () => [...document.querySelectorAll('#${grid} [data-gs-id^="customStatWidget-"]')].map(el => [el.querySelector(".stat-widget-title").innerText, el.querySelector(".stat-value").innerText])
    RETURN    ${widgets}

Get Link Widgets In Grid
    [Documentation]    [label, href] of every custom link widget tile in the grid.
    [Arguments]    ${grid}
    ${widgets}    Evaluate JavaScript    ${None}
    ...    () => [...document.querySelectorAll('#${grid} [data-gs-id^="customLinkWidget-"] .link-widget-inner')].map(el => [el.querySelector(".link-widget-label").innerText, el.dataset.href])
    RETURN    ${widgets}

Select Suite In Suite Statistics
    [Arguments]    ${suite}
    Select Options By    id=suiteSelectSuites    value    ${suite}
    Wait For Dashboard Idle

Select Suite In Test Statistics
    [Arguments]    ${suite}
    Select Options By    id=suiteSelectTests    value    ${suite}
    Wait For Dashboard Idle

Select Test In Test Statistics
    [Arguments]    ${test}
    Select Options By    id=testSelect    value    ${test}
    Wait For Dashboard Idle

Select Test Tag In Test Statistics
    [Arguments]    ${tag}
    Select Options By    id=testTagsSelect    value    ${tag}
    Wait For Dashboard Idle

Select Keyword In Keyword Statistics
    [Arguments]    ${keyword}
    Select Options By    id=keywordSelect    value    ${keyword}
    Wait For Dashboard Idle

Get Graph Labels
    [Documentation]    The x-axis labels of a Chart.js graph (window.<graphId>).
    [Arguments]    ${graph}
    ${labels}    Evaluate JavaScript    ${None}    () => window.${graph}.data.labels
    RETURN    ${labels}

Get Graph Dataset Labels
    [Documentation]    The dataset (legend) labels of a Chart.js graph (window.<graphId>).
    [Arguments]    ${graph}
    ${labels}    Evaluate JavaScript    ${None}    () => window.${graph}.data.datasets.map(dataset => dataset.label)
    RETURN    ${labels}

Graph Legend Should Be Hidden
    [Arguments]    ${graph}
    ${display}    Evaluate JavaScript    ${None}    () => window.${graph}.options.plugins.legend.display
    Should Not Be True    ${display}

Get Select Options
    [Arguments]    ${select_id}
    ${options}    Evaluate JavaScript    ${None}    () => [...document.querySelectorAll("#${select_id} option")].map(option => option.value)
    RETURN    ${options}

# compare page section filters
Select Compare Run
    [Documentation]    Picks the option of compareRun<n> whose value starts with ${run_start}: the run_start
    ...    labels carry a timezone offset that differs per machine, so only the wall-clock part is given.
    ...    "None" clears the slot. Returns the selected option value.
    [Arguments]    ${n}    ${run_start}
    ${options}    Get Select Options    compareRun${n}
    ${matches}    Evaluate    [option for option in $options if option.startswith("""${run_start}""")]
    Length Should Be    ${matches}    1    msg=No unique compareRun${n} option starts with ${run_start}: ${options}
    Select Options By    id=compareRun${n}    value    ${matches}[0]
    Wait For Dashboard Idle
    RETURN    ${matches}[0]

Set Compare Tests Status Filter
    [Documentation]    The Status select on the compare Tests graph: All / Passed / Failed / Skipped.
    [Arguments]    ${status}
    Select Options By    id=compareNoChanges    value    ${status}
    Wait For Dashboard Idle

Toggle Compare Tests Only Changes
    Click    selector=id=compareOnlyChanges
    Wait For Dashboard Idle

Toggle Compare Suite Paths
    Click    selector=id=switchSuitePathsCompareSection
    Wait For Dashboard Idle

# custom filters (--customfilters key=value pairs, one dropdown per key)
Get Custom Filter Dimensions
    [Documentation]    The custom filter keys shown in the filter modal on the active page, in display order.
    ...    Keys hidden for that page in "Settings > Filters" are left out.
    ${dimensions}    Evaluate JavaScript    ${None}
    ...    () => [...document.querySelectorAll('#customFiltersList > .list-group-item:not([hidden])')].map(el => el.id.replace("customFilter_", ""))
    RETURN    ${dimensions}

Get Overview Run Card Custom Filter Keys
    [Documentation]    The distinct custom filter keys rendered on the Overview run cards, sorted.
    ${keys}    Evaluate JavaScript    ${None}
    ...    () => [...new Set([...document.querySelectorAll('.run-card-custom-filter span')].map(el => el.textContent.trim().replace(":", "")))].sort()
    RETURN    ${keys}

Hide Custom Filters On Page
    [Documentation]    Checks custom filter keys in "Settings > Filters" so they are hidden on one page;
    ...    ${page} is the capitalized page name (Overview, Dashboard, Compare or Tables).
    [Arguments]    ${page}    @{dimensions}
    Open Settings Tab    filters-settings
    Click    selector=id=selectHiddenCustomFilters${page}
    FOR    ${dimension}    IN    @{dimensions}
        Check Checkbox    selector=id=hiddenCustomFilters${page}List >> css=input[value="${dimension}"]
    END
    Close Settings

Get Custom Filter Values
    [Documentation]    The checkbox values of one custom filter dropdown (All, None and the run values).
    [Arguments]    ${dimension}
    ${values}    Evaluate JavaScript    ${None}
    ...    () => [...document.querySelectorAll('#customFilter_${dimension}_List input.form-check-input')].map(input => input.value)
    RETURN    ${values}

Set Custom Filter
    [Documentation]    Checks the given values of one custom filter; strict=True also unchecks every other
    ...    value ("All" refuses to be unchecked while it is the only selection, so the wanted values go first).
    [Arguments]    ${dimension}    @{values}    ${strict}=False
    Open Filter Dialog
    Click    selector=id=selectCustomFilter_${dimension}
    FOR    ${value}    IN    @{values}
        Check Checkbox    selector=id=customFilter_${dimension}_List_${value}
    END
    IF    ${strict}
        ${all_values}    Get Custom Filter Values    ${dimension}
        FOR    ${value}    IN    @{all_values}
            IF    $value not in $values
                Uncheck Checkbox    selector=id=customFilter_${dimension}_List_${value}
            END
        END
    END
    Close Filter Dialog

Set Custom Filter Mode
    [Documentation]    Mode select (OR/AND/NOT) inside one custom filter dropdown.
    [Arguments]    ${dimension}    ${mode}
    Open Filter Dialog
    Click    selector=id=selectCustomFilter_${dimension}
    Select Options By    id=customFilter_${dimension}_Mode    value    ${mode}
    Close Filter Dialog

# "All" tab of the Add Stat Widget modal
Open Add All Stat Widgets Tab
    [Documentation]    Opens the Add Stat Widget modal of a section (edit mode only) on its "All" tab and
    ...    waits for the toggle list, which is built on the tab's shown event.
    [Arguments]    ${section}
    Click    selector=id=${section}AddStatWidgetHeader
    Click    selector=id=addStatWidgetAllTab-tab
    Wait For Elements State    selector=css=#addAllWidgetsList .add-all-widgets-toggle >> nth=0    state=visible

Confirm Add All Stat Widgets
    Click    selector=id=addAllWidgetsConfirm
    Wait For Dashboard Idle

# custom sections (unified view only)
Add Custom Section
    [Documentation]    Adds a section divider through the "+" section button in the unified grid header
    ...    (edit mode only).
    [Arguments]    ${title}
    Click    selector=id=unifiedAddSectionHeader
    Fill Text    selector=id=addCustomSectionTitle    txt=${title}
    Click    selector=id=addCustomSectionConfirm
    Wait For Dashboard Idle

Get Custom Section Titles In Grid
    ${titles}    Evaluate JavaScript    ${None}
    ...    () => [...document.querySelectorAll('#gridUnified [data-gs-id^="customSection-"] .custom-section-title')].map(el => el.innerText)
    RETURN    ${titles}

Delete First Custom Section
    Click    selector=css=.delete-custom-section
    Wait For Dashboard Idle
