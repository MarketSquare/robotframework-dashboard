// Mock for variables/graphs.js — provides minimal graph config for tests
import { camelcase_to_underscore } from '@js/common.js';

const tables = [];
const hideGraphs = [];
const fullscreenButtons = [];
const defaultGraphTypes = {};
const graphChangeButtons = {};
const graphVars = [];
const compareRunIds = ['compareRun1', 'compareRun2', 'compareRun3', 'compareRun4'];
const overviewSections = ["overviewLatestRuns", "overviewTotalStats"];
const dashboardSections = ["Run Statistics", "Suite Statistics", "Test Statistics", "Keyword Statistics"];
const unifiedSections = ["Dashboard Statistics"];
const compareSections = ["Compare Statistics"];
const tableSections = ["Table Statistics"];
const dashboardGraphs = [];
const compareGraphs = [];
const tableGraphs = [];

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
    compareGraphs,
    tableGraphs,
};
