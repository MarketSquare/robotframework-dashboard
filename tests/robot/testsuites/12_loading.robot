*** Settings ***
Documentation    Loading recovery opens usable recent results, identifies the reduced scope, and
...              stops the animation if corrupt data cannot be recovered. Runs in Docker only.
Resource    ../resources/keywords/dashboard-keywords.resource
Resource    ../resources/keywords/general-keywords.resource

Suite Setup    Run Keywords    Start Browser    AND    Generate Shared Dashboard
Suite Teardown    Close Browser
Test Teardown    Close Context


*** Test Cases ***
Standalone Report Opens A Smaller Consistent History
    Open Recent Report    loadRuns=5&run=WebshopUI&tag=dev
    Loaded Run Count Should Be    5
    ${consistent}    Evaluate JavaScript    ${None}
    ...    () => { const keys = new Set(filteredRuns.map(run => run.raw_run_start ?? run.run_start)); return filteredRuns.every(run => run.name === "WebshopUI" && run.tags.split(",").includes("dev")) && [suites, tests, keywords, exceptions].every(rows => rows.every(row => keys.has(row.run_start))); }
    Should Be True    ${consistent}
    Browser.Get Text    id=dataLoadScope    ==    Showing 5 of 8 matching runs.
    Browser.Get Text    id=dataLoadRange    contains    Use Filters to change the date range, choose a project, or show more runs.
    Take Screenshot    filename=${OUTPUT_DIR}/loading-recent.png
    Click    id=dataLoadFilters
    Wait For Modal Opened    filtersModal
    Take Screenshot    filename=${OUTPUT_DIR}/loading-filters.png
    Close Filter Dialog

Existing Filters Open Another Project And Can Restore Full History
    Open Recent Report    loadRuns=5
    Click    id=dataLoadFilters
    Wait For Modal Opened    filtersModal
    Select Options By    id=runs    value    WebshopAPI
    Fill Text    id=amount    1
    Close Filter Dialog
    Loaded Run Count Should Be    1
    ${names}    Evaluate JavaScript    ${None}    () => filteredRuns.map(run => run.name)
    Should Be Equal    ${names}    ${{ ["WebshopAPI"] }}
    Open Filter Dialog
    Select Options By    id=runs    value    All
    Click    id=allRuns
    Close Filter Dialog
    Loaded Run Count Should Be    18
    Wait For Elements State    id=dataLoadNotice    hidden

Existing Date Filters Open Older Results Outside The Initial Scope
    Open Recent Report    loadRuns=1&run=WebshopUI
    ${oldest_date}    Evaluate JavaScript    ${None}    () => runs.filter(run => run.name === "WebshopUI").map(run => run.run_start.slice(0, 10)).sort()[0]
    ${initial}    Evaluate JavaScript    ${None}    () => filteredRuns[0].raw_run_start ?? filteredRuns[0].run_start
    Open Filter Dialog
    Fill Text    id=fromDate    ${oldest_date}
    Fill Text    id=fromTime    00:00
    Fill Text    id=toDate    ${oldest_date}
    Fill Text    id=toTime    23:59
    Close Filter Dialog
    Loaded Run Count Should Be    1
    ${opened}    Evaluate JavaScript    ${None}    () => { const run = filteredRuns[0]; const key = run.raw_run_start ?? run.run_start; return { key, date: run.run_start.slice(0, 10), consistent: tests.length > 0 && tests.every(row => row.run_start === key) }; }
    Should Be Equal    ${opened}[date]    ${oldest_date}
    Should Not Be Equal    ${opened}[key]    ${initial}
    Should Be True    ${opened}[consistent]

All Matching Results Do Not Show A Partial History Notice
    Open Recent Report    loadRuns=5&run=WebshopUI
    Open Filter Dialog
    Click    id=allRuns
    Close Filter Dialog
    Loaded Run Count Should Be    10
    Wait For Elements State    id=dataLoadNotice    hidden

Suite Filtering Searches Older Runs Before Applying The Amount
    Open Recent Report    loadRuns=1&run=WebshopUI
    ${root}    Evaluate JavaScript    ${None}    () => suites[0].full_name.split(".")[0]
    Open Filter Dialog
    Click    id=suitePathChildren >> text="${root}"
    Click    id=allRuns
    Close Filter Dialog
    ${opened}    Evaluate JavaScript    ${None}    () => filteredRuns.length
    Should Be True    ${opened} > 1
    ${consistent}    Evaluate JavaScript    ${None}    () => filteredSuites.every(suite => suite.full_name === "${root}" || suite.full_name.startsWith("${root}.")) && filteredRuns.every(run => suites.some(suite => suite.run_start === (run.raw_run_start ?? run.run_start)))
    Should Be True    ${consistent}

Failed Full Json Read Opens Recent Results Automatically
    ${html}    Get File    ${ROOT_FOLDER}/robotdashboard_shared.html
    ${injection}    Catenate    SEPARATOR=${EMPTY}
    ...    <head><script>(() => { const original = Response.prototype.json; let reads = 0;
    ...    Response.prototype.json = function() { if (++reads === 3) return Promise.reject(new SyntaxError("Unexpected end of JSON input")); return original.call(this); }; })();</script>
    ${html}    Replace String    ${html}    <head>    ${injection}
    ${path}    Set Variable    ${OUTPUT_DIR}/loading-full-failure.html
    Create File    ${path}    ${html}
    New Context    colorScheme=dark    viewport={"width": 1280, "height": 1000}
    New Page    url=file:${path}?run=WebshopUI&tag=dev
    Wait For Dashboard Ready
    ${recovered}    Evaluate JavaScript    ${None}    () => data_load_scope.recovered && filteredRuns.length > 0 && filteredRuns.length < data_load_scope.totalRuns
    Should Be True    ${recovered}
    Wait For Elements State    id=dataLoadNotice    hidden

An Empty Recovery Scope Can Be Cleared Without Editing The Url
    Open Recent Report    loadRuns=5&run=WebshopAPI&tag=project_1
    Loaded Run Count Should Be    0
    Browser.Get Text    id=dataLoadScope    ==    No runs match these filters.
    Reset Filters
    Loaded Run Count Should Be    10
    Browser.Get Text    id=dataLoadRange    contains    Use Filters

A Recent Limit Above The Report Size Does Not Imply Missing History
    New Context    colorScheme=dark    viewport={"width": 1280, "height": 1000}
    New Page    url=file:${ROOT_FOLDER}/robotdashboard_shared.html?loadRuns=20
    Wait For Dashboard Ready
    Loaded Run Count Should Be    18
    Wait For Elements State    id=dataLoadNotice    hidden

Corrupt Data Stops The Animation And Offers Recovery Controls
    ${html}    Get File    ${ROOT_FOLDER}/robotdashboard_shared.html
    ${bad}    Evaluate    base64.b64encode(zlib.compress(b'[broken]')).decode()    modules=base64,zlib
    ${html}    Evaluate    re.sub(r'tests: "[A-Za-z0-9+/=]+"', 'tests: "' + $bad + '"', $html, count=1)    modules=re
    ${path}    Set Variable    ${OUTPUT_DIR}/loading-corrupt.html
    Create File    ${path}    ${html}
    New Context    colorScheme=dark    viewport={"width": 1280, "height": 1000}
    New Page    url=file:${path}
    Browser.Get Text    id=dataLoadStatus    ==    This report could not be opened.
    Wait For Elements State    id=loading >> .ball-grid-beat    hidden
    Wait For Elements State    id=loadingHistoryOpen    visible
    Click    id=dataLoadTechnical >> summary
    Browser.Get Text    id=dataLoadError    contains    Could not read tests
    Take Screenshot    filename=${OUTPUT_DIR}/loading-corrupt.png


*** Keywords ***
Open Recent Report
    [Arguments]    ${query}
    New Context    colorScheme=dark    viewport={"width": 1280, "height": 1000}
    New Page    url=file:${ROOT_FOLDER}/robotdashboard_shared.html?${query}
    Wait For Dashboard Ready
    Wait For Elements State    id=dataLoadNotice    visible

Loaded Run Count Should Be
    [Arguments]    ${expected}
    ${count}    Evaluate JavaScript    ${None}    () => filteredRuns.length
    Should Be Equal As Integers    ${count}    ${expected}
