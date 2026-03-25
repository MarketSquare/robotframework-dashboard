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
};