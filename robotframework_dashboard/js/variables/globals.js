// UI defaults
const CARDS_PER_ROW = 3;
const DEFAULT_DURATION_PERCENTAGE = 20;

// populated by prepare_overview()
const projects_by_tag = {};
const projects_by_name = {};
const latestRunByProjectTag = {};
const latestRunByProjectName = {};
const versionsByProject = {};
let areGroupedProjectsPrepared = false;

// filtered data vars
var filteredRuns;
var filteredSuites;
var filteredTests;
var filteredKeywords;

// vars to keep track of grids
var gridUnified = null
var gridRun = null
var gridSuite = null
var gridTest = null
var gridKeyword = null
var gridCompare = null
var gridEditMode = false; // used to check how the graphs should be shown when rendered

// global vars for switching between overview and dashboard
var selectedRunSetting = '';
var selectedTagSetting = '';

// some global vars for various functionalities
var showingRunTags = false; // used to keep track if the runtags popup is showing and determine if it should be closed when clicked outside
let showingProjectVersionDialogue = false; // used to keep track if the projectVersion popup is showing and determine if it should be closed when clicked outside
var inFullscreen = false; // used to keep track if fullscreen view is being shown
var inFullscreenGraph = ""; // used to keep track of the graph being shown in fullscreen
var heatMapHourAll = true; // used to keep track of the heatmap setting, is it set to an hour or all
var previousFolder = ""; // used to update the suite folder donut to the previous folder with the button
var lastScrollY = 0; // used to scroll back to where you were previously
var ignoreSkips = false; // test most flaky graph
var ignoreSkipsRecent = false; // test recent most flaky graph
var onlyFailedFolders = false; // suite folder donut

// Merge profiles modal
let lastMergeResult = {};

function escape_html_for_merge(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

// Each entry describes one checkbox row in the merge settings panel
const filterRows = [
    {
        key: 'runs',
        label: 'Run',
        fields: ['runs'],
        present: p => p.runs !== undefined,
        valueHtml: p => escape_html_for_merge(p.runs),
    },
    {
        key: 'runTags',
        label: 'Run Tags',
        fields: ['runTags', 'useOrTags'],
        present: p => p.runTags !== undefined,
        valueHtml: p => {
            const checked = (p.runTags || []).filter(t => t.checked).map(t => escape_html_for_merge(t.id));
            const mode = p.useOrTags ? ' <em>(OR)</em>' : ' <em>(AND)</em>';
            return (checked.length ? checked.join(', ') : '<em>none</em>') + mode;
        },
    },
    {
        key: 'projectVersions',
        label: 'Versions',
        fields: ['projectVersions'],
        present: p => p.projectVersions !== undefined,
        valueHtml: p => {
            const checked = (p.projectVersions || []).filter(v => v.checked).map(v => escape_html_for_merge(v.value));
            return checked.length ? checked.join(', ') : '<em>none</em>';
        },
    },
    {
        key: 'fromDate',
        label: 'From',
        fields: ['fromDate', 'fromTime'],
        present: p => p.fromDate !== undefined || p.fromTime !== undefined,
        valueHtml: p => escape_html_for_merge(`${p.fromDate || ''} ${p.fromTime || ''}`.trim()),
    },
    {
        key: 'toDate',
        label: 'To',
        fields: ['toDate', 'toTime'],
        present: p => p.toDate !== undefined || p.toTime !== undefined,
        valueHtml: p => escape_html_for_merge(`${p.toDate || ''} ${p.toTime || ''}`.trim()),
    },
    {
        key: 'metadata',
        label: 'Metadata',
        fields: ['metadata'],
        present: p => p.metadata !== undefined,
        valueHtml: p => escape_html_for_merge(p.metadata),
    },
    {
        key: 'amount',
        label: 'Amount',
        fields: ['amount'],
        present: p => p.amount !== undefined,
        valueHtml: p => escape_html_for_merge(String(p.amount)),
    },
];

// Track overview nav listeners so we can cleanly remove them when leaving Overview
let overviewNavStore = {
    scrollHandler: null,
    resizeHandler: null,
};

export {
    CARDS_PER_ROW,
    DEFAULT_DURATION_PERCENTAGE,
    projects_by_tag,
    projects_by_name,
    latestRunByProjectTag,
    latestRunByProjectName,
    versionsByProject,
    areGroupedProjectsPrepared,
    filteredRuns,
    filteredSuites,
    filteredTests,
    filteredKeywords,
    gridUnified,
    gridRun,
    gridSuite,
    gridTest,
    gridKeyword,
    gridCompare,
    gridEditMode,
    selectedRunSetting,
    selectedTagSetting,
    showingRunTags,
    showingProjectVersionDialogue,
    inFullscreen,
    inFullscreenGraph,
    heatMapHourAll,
    previousFolder,
    lastScrollY,
    ignoreSkips,
    ignoreSkipsRecent,
    onlyFailedFolders,
    overviewNavStore,
    lastMergeResult,
    filterRows,
};