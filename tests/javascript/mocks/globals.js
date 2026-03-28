// Mock for variables/globals.js — provides mutable global state for testing

const CARDS_PER_ROW = 3;
const DEFAULT_DURATION_PERCENTAGE = 20;
const projects_by_tag = {};
const projects_by_name = {};
const latestRunByProjectTag = {};
const latestRunByProjectName = {};
const versionsByProject = {};
let areGroupedProjectsPrepared = false;
let filteredRuns;
let filteredSuites;
let filteredTests;
let filteredKeywords;
let gridUnified = null;
let gridRun = null;
let gridSuite = null;
let gridTest = null;
let gridKeyword = null;
let gridCompare = null;
let gridEditMode = false;
let selectedRunSetting = '';
let selectedTagSetting = '';
let showingRunTags = false;
let showingProjectVersionDialogue = false;
let inFullscreen = false;
let inFullscreenGraph = "";
let heatMapHourAll = true;
let previousFolder = "";
let lastScrollY = 0;
let ignoreSkips = false;
let ignoreSkipsRecent = false;
let onlyFailedFolders = false;
let overviewNavStore = { scrollHandler: null, resizeHandler: null };

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
