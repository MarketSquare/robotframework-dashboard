import { get_graph_config } from '../graph_data/graph_config.js';
import {
    compare_to_average,
    transform_file_path,
    format_duration,
    debounce,
    show_loading_overlay,
    hide_loading_overlay,
} from '../common.js';
import { update_menu } from '../menu.js';
import {
    setup_collapsables,
    attach_run_card_version_listener
} from '../eventlisteners.js';
import { clockSVG, arrowRight } from '../variables/svg.js';
import {
    passedBackgroundColor,
    passedBackgroundBorderColor,
    failedBackgroundColor,
    failedBackgroundBorderColor,
    skippedBackgroundColor,
    skippedBackgroundBorderColor
} from '../variables/chartconfig.js';
import { settings } from '../variables/settings.js';
import {
    DEFAULT_DURATION_PERCENTAGE,
    projects_by_tag,
    projects_by_name,
    selectedRunSetting,
    selectedTagSetting,
    versionsByProject,
    latestRunByProjectName,
    latestRunByProjectTag,
    areGroupedProjectsPrepared
} from '../variables/globals.js';
import { runs, use_logs } from '../variables/data.js';
import {
    clear_all_filters,
    update_filter_active_indicator,
    setup_filter_checkbox_handler_listeners,
    generate_version_filter_list_item_html
} from '../filter.js';

// Data prep/aggregation
function prepare_projects_grouped_data() {
    for (const run of runs) {
        const tags = run.tags.split(",");
        const project_tags = tags.filter(tag => tag.toLowerCase().startsWith("project_"));
        for (const project of project_tags) {
            if (!projects_by_tag[project]) {
                projects_by_tag[project] = [];
            }
            projects_by_tag[project].push(run);
        }
        if (!projects_by_name[run.name]) {
            projects_by_name[run.name] = [];
        }
        projects_by_name[run.name].push(run);
    }
    areGroupedProjectsPrepared = true;
}

// versionByProject = {projectName:{version:amount}}
function prepare_projects_version_counts_map(projects) {
    for (const [project, runs] of Object.entries(projects)) {
        const versionCounts = {};
        for (const run of runs) {
            const projectVersion = run.project_version ?? "None";
            versionCounts[projectVersion] = (versionCounts[projectVersion] || 0) + 1;
        }
        versionsByProject[project] = versionCounts;
    }
}

function prepare_latest_run_by_project() {
    function map_latest_run_by_project(runsByProject) {
        const latestRunByProject = Object.entries(runsByProject)
            .map(([projectName, projectRuns]) => {
                return [projectName, projectRuns.at(-1)];
            });
        return Object.fromEntries(latestRunByProject);
    }
    Object.assign(latestRunByProjectName, map_latest_run_by_project(projects_by_name));
    Object.assign(latestRunByProjectTag, map_latest_run_by_project(projects_by_tag));
}

// Section/bar builders

// Helper function to generate common overview section HTML structure
function generate_overview_section_html(sectionId, prefix, filtersHtml = '') {
    return `
        <div class="card overview-bar" id="${sectionId}">
            <div class="card-header">
                <div class="row">
                    <div class="col-auto align-self-center">
                        <div class="btn btn-sm collapse-icon" id="collapsegridOverview${prefix}"></div>
                    </div>
                    <div class="col-3">
                        <h4 id="overview${prefix}Title"></h4>
                    </div>
                    <div class="d-flex flex-wrap align-items-start col align-items-center">
                        <div class="col-auto">
                            <a type="button" class="information information-icon me-2"
                                id="overview${prefix}Information"></a>
                        </div>
                        ${filtersHtml}
                        <div class="col-auto ms-auto">
                            <a class="move-up-section information" id="${sectionId}MoveUp" hidden></a>
                            <a class="move-down-section information" id="${sectionId}MoveDown" hidden></a>
                        </div>
                    </div>
                </div>
            </div>
            <div class="card-body" id="gridOverview${prefix}">
                <div id="overview${prefix}RunCardsContainer" class="project-run-cards-container"></div>
            </div>
        </div>
    `;
}

// create overview latest runs section dynamically
function create_overview_latest_runs_section() {
    const percentageSelectHtml = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(val =>
        `<option value="${val}" ${val === DEFAULT_DURATION_PERCENTAGE ? 'selected' : ''}>${val}</option>`
    ).join('');

    const filtersHtml = `
        <div class="col-auto percentage-filter" id="overviewLatestPercentageFilterContainer">
            <div class="btn-group">
                <label class="form-check-label" for="overviewLatestDurationPercentage">Percentage</label>
            </div>
            <div class="btn-group">
                <select class="form-select form-select-sm me-2" id="overviewLatestDurationPercentage">
                    ${percentageSelectHtml}
                </select>
            </div>
        </div>
        <div class="col-auto me-2 version-filter" id="overviewLatestVersionFilterContainer">
            <div class="btn-group">
                <div id="overviewLatestVersionFilterDropDown" class="dropdown">
                    <button class="btn btn-sm btn-outline-dark dropdown-toggle" type="button"
                        id="overviewLatestVersionFilterBtn" data-bs-toggle="dropdown"
                        data-bs-auto-close="outside">
                        Select Versions
                        <span id="overviewLatestVersionSelectedIndicator"
                            class="version-selected-dot" style="display:none;"></span>
                    </button>
                    <ul id="overviewLatestVersionSelectorList" class="dropdown-menu p-3"
                        style="max-height: 50vh; overflow-y: auto;">
                    </ul>
                </div>
            </div>
            <div class="btn-group">
                <input type="text" class="form-control form-control-sm" id="overviewLatestVersionFilterSearch" placeholder="Version Filter...">
            </div>
        </div>
        <div class="col-auto me-1 sort-filter" id="overviewLatestSortFilterContainer">
            <div class="btn-group">
                <label class="form-label mb-0" for="overviewLatestSectionOrder">Sort</label>
            </div>
            <div class="btn-group">
                <select class="form-select form-select-sm section-order-filter"
                    id="overviewLatestSectionOrder">
                    <option value="newest" selected>Most Recent</option>
                    <option value="oldest">Oldest</option>
                    <option value="most failed">Most Failed</option>
                    <option value="most skipped">Most Skipped</option>
                    <option value="most passed">Most Passed</option>
                </select>
            </div>
        </div>
    `;
    const overviewLatestSection = generate_overview_section_html('overviewLatestRunsSection', 'Latest', filtersHtml);
    const overview = document.getElementById("overview");
    const topOverviewSection = document.getElementById("topOverviewSection");
    overview.insertBefore(document.createRange().createContextualFragment(overviewLatestSection), topOverviewSection.nextSibling);

    create_overview_latest_graphs();
    update_overview_latest_heading();

    // Setup event listeners for filters
    const percentageSelector = document.getElementById("overviewLatestDurationPercentage");
    if (percentageSelector) {
        percentageSelector.addEventListener('change', () => {
            show_loading_overlay();
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    create_overview_latest_graphs();
                    hide_loading_overlay();
                });
            });
        });
    }

    const versionFilterSearch = document.getElementById("overviewLatestVersionFilterSearch");
    if (versionFilterSearch) {
        const handle_version_filter_input = () => {
            apply_overview_latest_version_text_filter();
        };
        const maxDelay = 50;
        const delayScaledByRunAmount = Math.min(runs.length / 100, maxDelay);
        versionFilterSearch.addEventListener('input', debounce(handle_version_filter_input, delayScaledByRunAmount));
    }
}

// create overview total stats section dynamically
function create_overview_total_stats_section() {
    const overviewTotalSection = generate_overview_section_html('overviewTotalStatsSection', 'Total');

    const overview = document.getElementById("overview");
    const latestSection = document.getElementById("overviewLatestRunsSection");
    overview.insertBefore(document.createRange().createContextualFragment(overviewTotalSection), latestSection.nextSibling);

    create_overview_total_graphs();
    update_overview_total_heading();
}

// create project bar (the collapsables below overview statistic) in overview
function create_project_bar(projectName, projectRuns, totalRunsAmount, passRate) {
    const projectVersions = new Set(
        Object.keys(versionsByProject[projectName])
            .sort()
            .reverse()
    );
    const versionAmount = projectVersions.size;
    const versionFilterListItemAllHtml = generate_version_filter_list_item_html("All", projectName, "checked", versionAmount, "version");
    const versionFilterListItemsHtml = versionFilterListItemAllHtml +
        [...projectVersions]
            .map(version => {
                const runAmount = versionsByProject[projectName][version];
                return generate_version_filter_list_item_html(version, projectName, "", runAmount, "run");
            })
            .join('');
    const percentageSelectHtml = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(val =>
        `<option value="${val}" ${val === DEFAULT_DURATION_PERCENTAGE ? 'selected' : ''}>${val}</option>`
    ).join('');
    // added here instead of adding to informationMap, since the dynamic IDs don't work with the map
    const displayProjectName = (!settings.show.prefixes && projectName.startsWith('project_'))
        ? projectName.replace(/^project_/, '')
        : projectName;
    const projectInformation = `This section shows the runs associated with the project '${displayProjectName}':
                                - Duration color indicates performance relative to the average: green if more than x% faster, red if more than x% slower. You can adjust this threshold using the Percentage toggle. Version filters do not affect this.
                                - Passed runs represent the percentage of runs with zero failures. Version filters do not affect this.
                                - The 'Select Versions' dropdown menu allows filtering the runs of the current project by the desired versions. Click 'All' to quickly deselect all other checkboxes.
                                - The runs can also be filtered to only those whose version contains the text entered in the 'Version Filter...' input, even when a checkbox filter is already applied.
                                - Clicking on the run card applies a filter for that project and switches to dashboard
                                - Clicking on the version element within the run card additionally applies a filter for that version
                                - Check out all options in the settings: 'Gear Icon' > 'Overview'`;

    const projectCard = `
    <div class="card mb-3 overview-bar overview-project-card" id="${projectName}Section">
            <div class="card-header">
                <div class="row">
                    <div class="col-auto align-self-center">
                        <div class="btn btn-sm collapse-icon" id="collapse${projectName}Body">
                            ${arrowRight}
                        </div>
                    </div>
                    <div class="col-3">
                        <h4>${displayProjectName}</h4>
                        <h6>Total Runs: ${totalRunsAmount} | Passed Runs: ${passRate}%</h6>
                    </div>
                    <div class="d-flex flex-wrap align-items-start col align-items-center">
                        <div class="col-auto">
                            <a type="button" class="information information-icon me-2" id="${projectName}Information" data-title="${projectInformation}"></a>
                        </div>
                         <div class="col-auto me-2 percentage-filter">
                            <div class="btn-group">
                                <label class="form-check-label" for="${projectName}DurationPercentage">Percentage</label>
                            </div>
                            <div class="btn-group">
                                <select class="form-select form-select-sm" id="${projectName}DurationPercentage">
                                    ${percentageSelectHtml}
                                </select>
                            </div>
                        </div>
                        <div class="col-auto me-2 version-filter">
                            <div class="btn-group">
                                <div id="${projectName}VersionFilterDropDown" class="dropdown" >
                                    <button class="btn btn-sm btn-outline-dark dropdown-toggle"
                                            type="button" id="${projectName}VersionFilterBtn"
                                            data-bs-toggle="dropdown" data-bs-auto-close="outside">
                                        Select Versions
                                    <span id="${projectName}VersionSelectedIndicator" class="version-selected-dot" style="display:none;"></span>
                                    </button>
                                    <ul class="dropdown-menu p-3" style="max-height: 50vh; overflow-y: auto;">
                                        ${versionFilterListItemsHtml}
                                    </ul>
                                </div>
                            </div>
                            <div class="btn-group">
                                <input type="text" class="form-control form-control-sm" id="${projectName}VersionFilterSearch" placeholder="Version Filter...">
                            </div>
                        </div>
                        <div class="col-auto me-1 sort-filter">
                            <div class="btn-group">
                                <label class="form-label mb-0" for="${projectName}SectionOrder">Sort</label>
                            </div>
                            <div class="btn-group">
                                <select class="form-select form-select-sm section-order-filter" id="${projectName}SectionOrder">
                                    <option value="newest" selected>Most Recent</option>
                                    <option value="oldest">Oldest</option>
                                    <option value="most failed">Most Failed</option>
                                    <option value="most skipped">Most Skipped</option>
                                    <option value="most passed">Most Passed</option>
                                </select>
                            </div>
                        </div>
                        <div class="col-auto ms-auto">
                            <a class="move-up-section information" id="${projectName}SectionMoveUp" hidden></a>
                            <a class="move-down-section information" id="${projectName}SectionMoveDown" hidden></a>
                        </div>
                    </div>
                </div>
            </div>
            <div class="card-body" id="${projectName}Body" hidden="">
                <div id="${projectName}RunCardsContainer" class="project-run-cards-container"></div>
            </div>
        </div>
    `;
    const overview = document.getElementById("overview")
    overview.appendChild(document.createRange().createContextualFragment(projectCard));

    // percentage selector
    const projectPercentageSelector = document.getElementById(`${projectName}DurationPercentage`);
    projectPercentageSelector.addEventListener('change', () => {
        const newPercent = parseInt(projectPercentageSelector.value, 10);
        update_duration_comparison_for_project(projectName, projectRuns, newPercent);
    });

    // version filters
    const versionFilterDropDownId = `${projectName}VersionFilterDropDown`;
    const versionFilterSearchId = `${projectName}VersionFilterSearch`;
    const versionFilterArgs = {
        cardsContainerId: `${projectName}RunCardsContainer`,
        versionDropDownFilterId: versionFilterDropDownId,
        versionStringFilterId: versionFilterSearchId,
    };
    const projectVersionFilterDropDown = document.getElementById(versionFilterDropDownId);
    const allVersionsCheckBox = document.getElementById(`${projectName}VersionFilterListItemAllInput`);
    const specificVersionSelectedIndicatorId = `${projectName}VersionSelectedIndicator`;
    setup_filter_checkbox_handler_listeners(
        projectVersionFilterDropDown,
        allVersionsCheckBox,
        specificVersionSelectedIndicatorId,
        () => { update_project_version_filter_run_card_visibility(versionFilterArgs) }
    );

    // version filter input
    const projectVersionFilterSearch = document.getElementById(versionFilterSearchId);
    const handle_version_filter_input = () => {
        update_project_version_filter_run_card_visibility(versionFilterArgs);
    }
    const maxDelay = 50;
    const delayScaledByRunAmount = Math.min(totalRunsAmount / 100, maxDelay); // ~0.01ms per run or 50ms max
    projectVersionFilterSearch.addEventListener('input', debounce(handle_version_filter_input, delayScaledByRunAmount));
}

function create_project_overview() {
    const projectData = { ...projects_by_name, ...projects_by_tag };
    // create run cards for each project
    Object.keys(projectData).sort().forEach(projectName => {
        create_project_cards_container(projectName, projectData[projectName]);
    });
    // setup collapsables specifically for overview project sections
    setup_collapsables();
    // set project bar visibility based on switch settings
    update_projectbar_visibility();
}

// creates overview project section
function create_project_cards_container(projectName, projectRuns, percent = null) {
    const totalRunsAmount = projectRuns.length;
    const passedRunsAmount = projectRuns.filter(run => run.failed === 0).length;
    const passRate = ((passedRunsAmount / totalRunsAmount) * 100).toFixed(2);
    const cardsContainer = document.getElementById(`${projectName}RunCardsContainer`);
    const durations = projectRuns.map(r => r.elapsed_s);
    // create section for project in overview if not present
    if (!cardsContainer) create_project_bar(projectName, projectRuns, totalRunsAmount, passRate);

    // Read percentage from selector if not provided
    if (percent === null) {
        const percentageSelector = document.getElementById(`${projectName}DurationPercentage`);
        percent = percentageSelector ? parseInt(percentageSelector.value, 10) : DEFAULT_DURATION_PERCENTAGE;
    }

    const container = document.getElementById(`${projectName}RunCardsContainer`);
    container.innerHTML = '';
    const projectRunsToShow = projectRuns.slice().reverse();
    // create cards and charts for each run card
    projectRunsToShow.forEach((run, idx) => {
        const runNumber = projectRunsToShow.length - idx;
        const createdRunCardId = create_project_run_card(run, projectName, idx, runNumber, passRate, percent, durations, false);
        const createdRunCard = document.getElementById(createdRunCardId);
        container.appendChild(createdRunCard);
        create_overview_run_donut(run, idx, projectName);
    });
}

// Card/graph builders

// function to create overview latest runs statistics
function create_overview_latest_graphs(preFilteredRuns = null) {
    const order = document.getElementById("overviewLatestSectionOrder").value;
    const overviewCardsContainer = document.getElementById("overviewLatestRunCardsContainer");
    overviewCardsContainer.innerHTML = '';
    const allProjects = { ...projects_by_name, ...projects_by_tag };
    const durationsByProject = {};
    for (const [projectName, projectRuns] of Object.entries(allProjects)) {
        const durations = projectRuns.map(r => r.elapsed_s);
        durationsByProject[projectName] = durations;
    }
    let latestRunByProject = {};
    if (!preFilteredRuns) {
        settings.switch.runName && Object.assign(latestRunByProject, latestRunByProjectName);
        settings.switch.runTags && Object.assign(latestRunByProject, latestRunByProjectTag);
    } else { // if called by version filter listener
        Object.assign(latestRunByProject, preFilteredRuns);
    }
    // default order by newest (keep current insertion order)
    if (order === 'oldest') {
        // Reverse current order while preserving the same key->value pairs
        latestRunByProject = Object.fromEntries(
            Object.entries(latestRunByProject).reverse()
        );
    } else if (order === 'most failed') {
        latestRunByProject = Object.fromEntries(
            Object.entries(latestRunByProject).sort(([, runA], [, runB]) => runB.failed - runA.failed)
        );
    } else if (order === 'most skipped') {
        latestRunByProject = Object.fromEntries(
            Object.entries(latestRunByProject).sort(([, runA], [, runB]) => runB.skipped - runA.skipped)
        );
    } else if (order === 'most passed') {
        latestRunByProject = Object.fromEntries(
            Object.entries(latestRunByProject).sort(([, runA], [, runB]) => runB.passed - runA.passed)
        );
    }
    const percent = document.getElementById("overviewLatestDurationPercentage").value;
    for (const [projectName, latestRun] of Object.entries(latestRunByProject)) {
        const projectRuns = allProjects[projectName];
        const totalRunsAmount = projectRuns.length;
        const passedRunsAmount = projectRuns.filter(run => run.failed === 0).length;
        const passRate = ((passedRunsAmount / totalRunsAmount) * 100).toFixed(2);
        const projectRunDurations = projectRuns.map(run => run.elapsed_s);

        create_project_run_card(
            latestRun,
            projectName,
            0, // cardIndex, 0 since only 1 run per project in overview
            totalRunsAmount, //run Number
            passRate,
            percent,
            projectRunDurations,
            true, // isForOverviewStats
            false, // isTotalStats
            'overviewLatest'
        );
    }
    apply_overview_latest_version_text_filter();
}

// function to create overview total statistics
function create_overview_total_graphs(preFilteredRuns = null) {
    const overviewCardsContainer = document.getElementById("overviewTotalRunCardsContainer");
    overviewCardsContainer.innerHTML = '';
    const allProjects = { ...projects_by_name, ...projects_by_tag };
    const durationsByProject = {};
    for (const [projectName, projectRuns] of Object.entries(allProjects)) {
        const durations = projectRuns.map(r => r.elapsed_s);
        durationsByProject[projectName] = durations;
    }
    let latestRunByProject = {};
    if (!preFilteredRuns) {
        settings.switch.runName && Object.assign(latestRunByProject, latestRunByProjectName);
        settings.switch.runTags && Object.assign(latestRunByProject, latestRunByProjectTag);
    } else { // if called by version filter listener
        Object.assign(latestRunByProject, preFilteredRuns);
    }
    for (const [projectName, latestRun] of Object.entries(latestRunByProject)) {
        const projectRuns = allProjects[projectName];
        const totalRunsAmount = projectRuns.length;
        const passedRunsAmount = projectRuns.filter(run => run.failed === 0 && run.passed > 0).length;
        const failedRunsAmount = projectRuns.filter(run => run.failed > 0).length;
        const skippedRunsAmount = projectRuns.filter(run => run.failed === 0 && run.passed === 0 && run.skipped > 0).length;
        const passRate = ((passedRunsAmount / totalRunsAmount) * 100).toFixed(2);
        const projectRunDurations = projectRuns.map(run => run.elapsed_s);
        const avgDuration = projectRunDurations.reduce((a, b) => a + Number(b), 0) / projectRunDurations.length;
        const aggregateRun = {
            passed_runs: passedRunsAmount,
            failed_runs: failedRunsAmount,
            skipped_runs: skippedRunsAmount,
            average_duration: avgDuration,
            elapsed_s: avgDuration,
            stats: [passedRunsAmount, failedRunsAmount, skippedRunsAmount],
            project_version: null,
            full_name: projectName,
            passed: passedRunsAmount,
            failed: failedRunsAmount,
            skipped: skippedRunsAmount,
            path: '',
        };
        create_project_run_card(
            aggregateRun,
            projectName,
            0,
            totalRunsAmount,
            passRate,
            null,
            projectRunDurations,
            true,
            true,
            'overviewTotal'
        );
    }
}

// create a run card that will be displayed within each project section in overview
function create_project_run_card(run, projectName, runIndex, runNumber, passRate, percent, durations, isForOverview = false, isTotalStats = false, sectionPrefix = 'overview') {
    const avg = arr => arr.reduce((a, b) => a + parseFloat(b), 0) / arr.length;
    const passedCount = isTotalStats ? run.passed_runs : run.passed;
    const failedCount = isTotalStats ? run.failed_runs : run.failed;
    const skippedCount = isTotalStats ? run.skipped_runs : run.skipped;
    const stats = [passedCount, failedCount, skippedCount, run.elapsed_s, run.path, run.full_name];
    const duration = isTotalStats ? run.average_duration ?? run.elapsed_s : run.elapsed_s;
    const duration_rounded = format_duration(Number(duration));
    const durationsForAvg = durations.filter(item => item !== duration);
    const average = durationsForAvg.length ? avg(durationsForAvg) : duration;
    const status = isTotalStats
        ? (failedCount > 0 ? 'failed' : (skippedCount > 0 && passedCount === 0 ? 'skipped' : 'passed'))
        : (run.failed > 0 ? 'failed' : (run.skipped > 0 && run.passed === 0 ? 'skipped' : 'passed'));
    const logPath = (!isTotalStats && use_logs) ? transform_file_path(run.path).replaceAll('\\', '\\\\') : '';
    const logName = (!isTotalStats && use_logs) ? 'log.html' : '';
    const isDark = document.documentElement.classList.contains("dark-mode");
    const svg = isDark ? clockSVG("white") : clockSVG("black");
    const compares = isTotalStats ? 'text-muted' : compare_to_average(duration, average, percent);
    const projectNameForId = isForOverview ? `${sectionPrefix}${projectName}` : projectName;

    const projectRunCardHTML = generate_overview_card_html(
        projectName,
        stats,
        duration_rounded,
        status,
        runNumber,
        compares,
        passRate,
        logPath,
        logName,
        svg,
        runIndex,
        run.project_version,
        isForOverview,
        isTotalStats,
        sectionPrefix,
    )
    const existingRunCard = document.getElementById(`${projectNameForId}Card${runIndex}`);
    if (existingRunCard) {
        // preserves listeners of element
        existingRunCard.replaceWith(document.createRange().createContextualFragment(projectRunCardHTML));
    } else {
        const cardsContainerIdPrefix = isForOverview ? sectionPrefix : projectName;
        const cardsContainer = document.getElementById(`${cardsContainerIdPrefix}RunCardsContainer`);
        cardsContainer.appendChild(document.createRange().createContextualFragment(projectRunCardHTML));
        const createdRunCard = document.getElementById(`${projectNameForId}Card${runIndex}`);
        createdRunCard.addEventListener("click", () => {
            clear_all_filters();
            set_filter_show_current_project(projectName);
            update_menu("menuDashboard");
        });
        create_overview_run_donut(run, runIndex, projectNameForId);
        const versionElement = createdRunCard.querySelector('[data-js-target="apply-version-filter"]');
        versionElement && attach_run_card_version_listener(versionElement, projectName, run.project_version ?? "None");
    }
    return `${projectNameForId}Card${runIndex}`;
}

function create_overview_run_donut(run, chartElementPostfix, projectName) {
    let passed, failed, skipped;
    const idGraphSubString = "Graph";
    // when called for overview statistics
    if (run.stats) {
        [passed, failed, skipped] = run.stats;
    }
    // when called for projects section in overview
    else {
        passed = run.passed;
        failed = run.failed;
        skipped = run.skipped;
    }
    const el = document.getElementById(`${projectName}${idGraphSubString}${chartElementPostfix}`);
    if (!el) {
        console.warn(
            `No element with ID ${projectName}${idGraphSubString}${chartElementPostfix} found for donut chart creation`
        );
        return;
    }
    if (el.chartInstance) el.chartInstance.destroy();
    const chartData = {
        labels: [],
        datasets: [{
            data: [],
            backgroundColor: [],
            borderColor: [],
            hoverOffset: 4
        }]
    };
    const pushIf = (label, value, bg, border) => {
        if (value > 0) {
            chartData.labels.push(label);
            chartData.datasets[0].data.push(value);
            chartData.datasets[0].backgroundColor.push(bg);
            chartData.datasets[0].borderColor.push(border);
        }
    };
    pushIf('passed', passed, passedBackgroundColor, passedBackgroundBorderColor);
    pushIf('skipped', skipped, skippedBackgroundColor, skippedBackgroundBorderColor);
    pushIf('failed', failed, failedBackgroundColor, failedBackgroundBorderColor);
    const config = get_graph_config('donut', chartData, 'Run Status');
    delete config.options.plugins.datalabels;
    config.options.plugins.legend.display = false;
    el.chartInstance = new Chart(el, config);
}

function generate_overview_card_html(
    projectName,
    stats,
    rounded_duration,
    status,
    runNumber,
    compares,
    passed_runs,
    log_path,
    log_name,
    svg,
    idPostfix,
    projectVersion = null,
    isForOverview = false,
    isTotalStats = false,
    sectionPrefix = 'overview',
) {
    const normalizedProjectVersion = projectVersion ?? "None";
    // ensure overview stats and project bar card ids unique
    const projectNameForElementId = isForOverview ? `${sectionPrefix}${projectName}` : projectName;
    const showRunNumber = !(isForOverview && isTotalStats);
    const runNumberHtml = showRunNumber ? `<div class="col-auto"><h5>#${runNumber}</h5></div>` : '';
    let smallVersionHtml = `
        <div id="${projectName}RunCardVersion${idPostfix}"
        class="run-card-small-version"
        title="Click to filter for project and version"
        data-projectVersion="${normalizedProjectVersion}"
        data-js-target="apply-version-filter">
            <div class="text-muted">Version:</div>
            <div>${normalizedProjectVersion}</div>
        </div>`;
    if (isTotalStats) {
        smallVersionHtml = '';
        compares = '';
    }
    // for project bars
    const versionsForProject = Object.keys(versionsByProject[projectName]);
    const projectHasVersions = !(versionsForProject.length === 1 && versionsForProject[0] === "None");
    // for overview statistics
    // Preserve the original project name (used for logic like tag-detection),
    // but compute a display name that omits the 'project_' prefix when prefixes are hidden.
    const originalProjectName = projectName;
    const displayProjectName = settings.show.prefixes ? projectName : projectName.replace(/^project_/, '');
    projectName = displayProjectName;
    let cardTitle = `
            <h5 class="card-title mb-0 fw-semibold">${displayProjectName}</h5>
        `;
    if (!isForOverview) {
        // Project bar cards: customize based on project type
        if (originalProjectName.startsWith('project_')) {
            // Tagged projects: display name with inline version
            cardTitle = `
                <h5 class="card-title mb-0 fw-semibold">${stats[5]}, <span class="text-muted">Version:</span> ${normalizedProjectVersion}</h5>
            `;
        } else if (projectHasVersions) {
            // Non-tagged projects with versions: interactive version title
            cardTitle = `
                <div class="mx-auto run-card-version-title"
                title="Click to filter for project and version"
                data-js-target="apply-version-filter">
                    <h5 class="card-title mb-0 d-inline text-muted">Version:</h5>
                    <h5 class="card-title mb-0 d-inline fw-semibold">
                        ${normalizedProjectVersion}
                    </h5>
                </div>
            `;
        } else {
            // Non-tagged projects without versions: empty title placeholder
            cardTitle = `
                <h5 class="card-title mb-0 fw-semibold"></h5>
            `;
        }
        smallVersionHtml = '';
    }
    const totalStatsHeader = isTotalStats ? `<div>Run Stats</div>` : '';
    const totalStatsAverage = isTotalStats ? `<div>Average Run Duration</div>` : '';
    const logLinkHtml = log_name ? `<a href="#" onclick="event.stopPropagation(); open_log_from_path('${log_path}'); return false;" target="_blank">${log_name}</a>` : '';
    return `
    <div class="col-4 overview-card" id="${projectNameForElementId}Card${idPostfix}" data-project-version="${normalizedProjectVersion}">
        <div class="card border-3 border-${status}">
            <div class="card-body">
                <div class="row">
                    <div class="col text-center">
                        ${cardTitle}
                    </div>
                    ${runNumberHtml}
                </div>
                <div class="row">
                    <div class="col-4 overview-canvas">
                        <canvas id="${projectNameForElementId}Graph${idPostfix}"></canvas>
                    </div>
                    <div class="col-3 d-flex align-items-center">
                        <div>
                            ${totalStatsHeader}
                            <div class="green-text">Passed: ${stats[0]}</div>
                            <div class="red-text">Failed: ${stats[1]}</div>
                            <div class="yellow-text">Skipped: ${stats[2]}</div>
                        </div>
                    </div>
                    <div class="col-5 d-flex align-items-center" style="overflow:auto;">
                        <div>
                            ${totalStatsAverage}
                            <div class="${compares}" id="${projectNameForElementId}RunCardCompares${idPostfix}" title="${isTotalStats ? 'Average duration across runs' : 'Run duration'}">
                                <span class="clock-icon">
                                    ${svg}
                                </span>
                                <i id="${projectNameForElementId}RunCardComparesValue${idPostfix}" value="${rounded_duration}">
                                    ${rounded_duration}
                                </i>
                            </div>
                            <div>Passed Runs: ${passed_runs}%</div>
                            ${smallVersionHtml}
                            ${logLinkHtml}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>`;
}

// apply version select checkbox and version textinput filter
function update_project_version_filter_run_card_visibility({ cardsContainerId, versionDropDownFilterId, versionStringFilterId }) {
    const cardsContainerElement = document.getElementById(cardsContainerId);
    const scrollOffsetBefore = cardsContainerElement.getBoundingClientRect().top;
    const versionDropDownFilter = document.getElementById(versionDropDownFilterId);
    const dropDownCheckBoxes = versionDropDownFilter.querySelectorAll(".version-checkbox");
    const selectedVersions = Array.from(dropDownCheckBoxes)
        .filter(checkBox => checkBox.checked)
        .map(checkBox => checkBox.value);
    const runCardNodeList = cardsContainerElement.querySelectorAll("div.overview-card");
    const runCardsArray = Array.from(runCardNodeList);
    let dropDownFilteredRunCards = runCardsArray;
    if (!selectedVersions.includes("All")) {
        dropDownFilteredRunCards = runCardsArray.filter(runCard =>
            selectedVersions.includes(runCard.dataset.projectVersion)
        );
    }
    const versionStringFilter = document.getElementById(versionStringFilterId);
    const lowerCaseVersionStringFilterValue = versionStringFilter.value.toLowerCase();
    const fullyFilteredRunCards = dropDownFilteredRunCards.filter(runCard =>
        runCard.dataset.projectVersion.toLowerCase()
            .includes(lowerCaseVersionStringFilterValue)
    );
    runCardsArray.forEach(runCard => {
        runCard.style.display = "none";
    });
    fullyFilteredRunCards.forEach(runCard => {
        runCard.style.display = "";
    });
    const scrollOffsetAfter = cardsContainerElement.getBoundingClientRect().top;
    window.scrollBy(0, scrollOffsetAfter - scrollOffsetBefore);
}

function apply_overview_latest_version_text_filter() {
    const versionFilterInput = document.getElementById("overviewLatestVersionFilterSearch");
    const cardsContainer = document.getElementById("overviewLatestRunCardsContainer");
    if (!versionFilterInput || !cardsContainer) return;
    const filterValue = versionFilterInput.value.toLowerCase();
    const runCards = Array.from(cardsContainer.querySelectorAll("div.overview-card"));
    runCards.forEach(card => {
        const version = (card.dataset.projectVersion ?? "").toLowerCase();
        card.style.display = version.includes(filterValue) ? "" : "none";
    });
}

function clear_project_filter() {
    document.getElementById("runs").value = "All";
    document.getElementById("runTagCheckBoxesFilter").value = "";
    const tagElements = document.getElementById("runTag").getElementsByTagName("input");
    for (const input of tagElements) {
        input.checked = false;
        input.parentElement.classList.remove("d-none"); //show filtered rows
        if (input.id == "All") input.checked = true;
    }
    update_filter_active_indicator("All", "filterRunTagSelectedIndicator");
}

function set_filter_show_current_project(projectName) {
    if (projectName.startsWith("project_")) {
        selectedTagSetting = projectName;
        setTimeout(() => { // hack to prevent update_menu calls from hinderance
            update_filter_active_indicator("All", "filterRunTagSelectedIndicator");
        }, 500);

    } else {
        selectedRunSetting = projectName;
    }
}

function _update_overview_heading(containerId, titleId, titleText) {
    const overviewCardsContainer = document.getElementById(containerId);
    if (!overviewCardsContainer) return;
    const amountOfProjectsShown = overviewCardsContainer.querySelectorAll(".overview-card").length;
    const pluralPostFix = amountOfProjectsShown !== 1 ? 's' : '';
    const headerContent = `<h6>showing ${amountOfProjectsShown} project${pluralPostFix}</h6>`;
    document.getElementById(titleId).innerHTML = `
            ${titleText}
            ${headerContent}
        `;
}

function update_overview_latest_heading() {
    _update_overview_heading("overviewLatestRunCardsContainer", "overviewLatestTitle", "Latest Runs");
}

function update_overview_total_heading() {
    _update_overview_heading("overviewTotalRunCardsContainer", "overviewTotalTitle", "Total Statistics");
}

function update_overview_sections_visibility() {
    const latestSection = document.getElementById("overviewLatestRunsSection");
    const totalSection = document.getElementById("overviewTotalStatsSection");
    if (latestSection) latestSection.hidden = !settings.switch.latestRuns;
    if (totalSection) totalSection.hidden = !settings.switch.totalStats;
}

function update_overview_filter_visibility() {
    // Update filter visibility for all bars using classes
    const percentageFilters = document.querySelectorAll(".percentage-filter");
    const versionFilters = document.querySelectorAll(".version-filter");
    const sortFilters = document.querySelectorAll(".sort-filter");

    percentageFilters.forEach(container => {
        container.hidden = !settings.switch.percentageFilters;
    });
    versionFilters.forEach(container => {
        container.hidden = !settings.switch.versionFilters;
    });
    sortFilters.forEach(container => {
        container.hidden = !settings.switch.sortFilters;
    });
}

function update_donut_charts() {
    document.querySelectorAll(".overview-canvas").forEach(canvas => {
        const chart = canvas.querySelector("canvas").chartInstance;
        if (chart) chart.update();
    });
}

// hide project bars based on switch config
function update_projectbar_visibility() {
    const bars = document.querySelectorAll('.overview-project-card');
    const tagged = [];
    const untagged = [];
    for (const el of bars) {
        (el.id.startsWith("project_") ? tagged : untagged).push(el);
    }
    const toggleVisibility = (elements, visible) => {
        for (const el of elements) el.hidden = !visible;
    };
    toggleVisibility(tagged, settings.switch.runTags);
    toggleVisibility(untagged, settings.switch.runName);
}

// Update displayed project names to show/hide the 'project_' prefix everywhere
function update_overview_prefix_display() {
    const showPrefixes = !!(settings && settings.show && settings.show.prefixes);
    // Update Overview Statistics card titles
    const overviewCards = document.querySelectorAll('#overviewRunCardsContainer .overview-card');
    overviewCards.forEach(card => {
        const id = card.id; // e.g., overviewproject_1Card0
        const match = id.match(/^overview(.+?)Card\d+$/);
        if (!match) return;
        const originalProjectName = match[1];
        const headerTitle = card.querySelector('.col.text-center h5.card-title');
        if (!headerTitle) return;
        headerTitle.textContent = showPrefixes
            ? originalProjectName
            : (originalProjectName.startsWith('project_')
                ? originalProjectName.replace(/^project_/, '')
                : originalProjectName);
    });

    // Update Project Bar section headers
    const projectBars = document.querySelectorAll('.overview-project-card');
    projectBars.forEach(section => {
        const sectionId = section.id; // e.g., project_1Section or MyRunSection
        const originalProjectName = sectionId.replace(/Section$/, '');
        const headerTitle = section.querySelector('.card-header h4');
        if (!headerTitle) return;
        headerTitle.textContent = showPrefixes
            ? originalProjectName
            : (originalProjectName.startsWith('project_')
                ? originalProjectName.replace(/^project_/, '')
                : originalProjectName);
    });
}

// prevents regeneration of run cards, just changes class for duration highlight
function update_duration_comparison_for_project(projectName, projectRuns, percentage) {
    const projectRunsReversed = projectRuns.slice().reverse();
    projectRunsReversed.forEach((run, idx) => {
        const comparesElement = document.getElementById(`${projectName}RunCardCompares${idx}`);
        const comparesValueElement = document.getElementById(`${projectName}RunCardComparesValue${idx}`);
        if (!comparesElement || !comparesValueElement) return;

        const duration = parseFloat(comparesValueElement.getAttribute("value"));
        const durationsForAvg = projectRunsReversed
            .map(r => parseFloat(r.elapsed_s))
            .filter((_, i) => i !== idx);
        const averageDuration = durationsForAvg.reduce((a, b) => a + b, 0) / durationsForAvg.length;
        comparesElement.className = compare_to_average(duration, averageDuration, percentage);
    });
}

function prepare_overview() {
    // prepare data
    prepare_projects_grouped_data();
    prepare_projects_version_counts_map({ ...projects_by_name, ...projects_by_tag });
    prepare_latest_run_by_project();
    // create 2 default bars: latest runs and total stats, and update visibility
    create_overview_latest_runs_section();
    create_overview_total_stats_section();
    update_overview_sections_visibility();
    // create all other project bars (by name and by tag)
    create_project_overview();
    // update all bar filters visibility based on settings
    update_overview_filter_visibility();
}

export {
    create_overview_latest_graphs,
    create_overview_total_graphs,
    prepare_projects_grouped_data,
    create_project_overview,
    update_projectbar_visibility,
    update_overview_prefix_display,
    update_donut_charts,
    clear_project_filter,
    set_filter_show_current_project,
    prepare_overview,
    update_overview_latest_heading,
    update_overview_total_heading,
    update_overview_sections_visibility,
    update_overview_filter_visibility
};
