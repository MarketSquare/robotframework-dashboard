import { graphMetadata } from "./graphmetadata.js";
import { camelcase_to_underscore } from "../common.js";

const tables = graphMetadata.filter(graph => graph.label.includes('Table'))
// hideGraphs (contains all graphs that can be hidden or shown)
const hideGraphs = graphMetadata
    .map(graph => graph.label)
    .filter(label => label !== "Run Donut Total" && label !== "Suite Folder Fail Donut");
// fullscreenButtons (contains all graphs that have a fullscreen/close button)
const fullscreenButtons = graphMetadata
    .filter(graph => graph.hasFullscreenButton)
    .map(graph => graph.key);
// defaultGraphTypes (stored in localstorge like percentage, bar etc.)
const defaultGraphTypes = {};
graphMetadata.forEach(graph => {
    defaultGraphTypes[`${graph.key}GraphType`] = graph.defaultType;
});
// graphChangeButtons (adds the eventlisteners to the buttons ike percentage, bar, etc.)
const excludeKeys = ["runDonutTotal", "suiteFolderFailDonut"];
const graphChangeButtons = {};
graphMetadata.forEach(graph => {
    if (!excludeKeys.includes(graph.key) && graph.type !== "Table" && graph.viewOptions.length > 1) {
        const snakeKey = camelcase_to_underscore(graph.key);
        graphChangeButtons[snakeKey] = graph.viewOptions.join(',');
    }
});
// graphVars
const graphVars = graphMetadata.map(g => g.defaultType === "table" ? g.key : `${g.key}Graph`);
graphVars.forEach(name => {
    window[name] = undefined;
});

// Run compare filter Id's
const compareRunIds = ['compareRun1', 'compareRun2', 'compareRun3', 'compareRun4']

// customize view lists
const overviewSections = ["overviewLatestRuns", "overviewTotalStats",]
const dashboardSections = ["Run Statistics", "Suite Statistics", "Test Statistics", "Keyword Statistics",]
const unifiedSections = ["Dashboard Statistics"]
const compareSections = ["Compare Statistics"]
const tableSections = ["Table Statistics"]

const _isDashboardGraph = (graph) =>
    !graph.label.startsWith("Compare") &&
    !graph.label.startsWith("Table") &&
    graph.label !== "Run Donut Total" &&
    graph.label !== "Suite Folder Fail Donut";

const dashboardGraphs = graphMetadata
    .filter(graph => _isDashboardGraph(graph) && !graph.defaultHidden)
    .map(graph => graph.label);

const defaultHiddenDashboardGraphs = graphMetadata
    .filter(graph => _isDashboardGraph(graph) && graph.defaultHidden)
    .map(graph => graph.label);

const compareGraphs = graphMetadata
    .filter(graph => graph.label.startsWith("Compare"))
    .map(graph => graph.label)
const tableGraphs = graphMetadata
    .filter(graph => graph.label.startsWith("Table"))
    .map(graph => graph.label)

export {
    tables,
    hideGraphs,
    fullscreenButtons,
    defaultGraphTypes,
    graphChangeButtons,
    graphVars,
    compareRunIds,
    overviewSections,
    unifiedSections,
    dashboardSections,
    compareSections,
    tableSections,
    dashboardGraphs,
    defaultHiddenDashboardGraphs,
    compareGraphs,
    tableGraphs,
};