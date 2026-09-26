import { settings } from '../variables/settings.js';
import { runs } from '../variables/data.js';
import { collect_custom_filter_dimensions } from './pipeline.js';
import { set_filter_dropdown_visible, setup_filter_active_indicator, setup_filter_checkbox_handler_listeners, setup_filter_checkbox_subfilter } from './controls.js';

// function to setup run amount filter maximum
function setup_run_amount_filter() {
    document.getElementById("amount").setAttribute("max", runs.length)
}

// function that initializes the from date/time and to date/time selection boxes in the filters
function setup_lowest_highest_dates() {
    if (runs.length == 0) {
        document.getElementById("fromDate").value = "1900-01-01";
        document.getElementById("fromTime").value = "00:00";
        document.getElementById("toDate").value = "9999-12-31";
        document.getElementById("toTime").value = "23:59";
        return;
    }

    if (settings.show.convertTimezone) {
        // Convert to viewer's local timezone: parse the stored offset-aware timestamps as UTC
        // instants, then display the local wall-clock equivalent in the pickers.
        var dates = runs.map(run => new Date(run.run_start.replace(" ", "T")));
        var lowest = new Date(Math.min.apply(null, dates));
        var highest = new Date(Math.max.apply(null, dates));
        var tzoffset = new Date().getTimezoneOffset() * 60000;
        lowest = new Date(new Date(lowest - tzoffset).getTime() - 1 * 60000); // account for seconds
        highest = new Date(new Date(highest - tzoffset).getTime() + 1 * 60000); // account for seconds
        lowest.setTime(lowest.getTime() - 1 * 60 * 60 * 1000); // minus 1 hour for DST
        highest.setTime(highest.getTime() + 1 * 60 * 60 * 1000); // plus 1 hour for DST
        document.getElementById("fromDate").value = lowest.toISOString().split("T")[0];
        document.getElementById("fromTime").value = lowest.toISOString().split("T")[1].substring(0, 5);
        document.getElementById("toDate").value = highest.toISOString().split("T")[0];
        document.getElementById("toTime").value = highest.toISOString().split("T")[1].substring(0, 5);
    } else {
        // No conversion: strip the timezone suffix and treat the stored wall-clock datetime
        // as-is, so picker defaults match exactly what the user sees in the dashboard.
        const wallClocks = runs.map(run => {
            const rs = run.run_start;
            const suffix = rs.slice(-6);
            const hasTz = /^[+-]\d{2}:\d{2}$/.test(suffix);
            return hasTz ? rs.slice(0, 19) : rs.slice(0, 19);
        });
        wallClocks.sort();
        const lowestStr = wallClocks[0];
        const highestStr = wallClocks[wallClocks.length - 1];
        // Adjust by 1 minute and 1 hour (for seconds and DST) using plain date arithmetic
        const adjust = (dateStr, deltaMs) => {
            const d = new Date(dateStr.replace(" ", "T"));
            d.setTime(d.getTime() + deltaMs);
            const pad = n => String(n).padStart(2, "0");
            const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
            const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
            return { date, time };
        };
        const low = adjust(lowestStr, -(1 * 60 + 60 * 60) * 1000); // -1min -1hr
        const high = adjust(highestStr, (1 * 60 + 60 * 60) * 1000);  // +1min +1hr
        document.getElementById("fromDate").value = low.date;
        document.getElementById("fromTime").value = low.time;
        document.getElementById("toDate").value = high.date;
        document.getElementById("toTime").value = high.time;
    }
}

// metadata strings never change after the data is decoded, so the parsed items are cached:
// the option list is rebuilt on every refresh of the filter option counts
const parsedMetadataCache = new Map();

function parse_metadata_items(metadata) {
    if (!metadata) return [];
    const cached = parsedMetadataCache.get(metadata);
    if (cached) return cached;
    const parsed = JSON.parse(metadata.replace(/'/g, '"'));
    parsedMetadataCache.set(metadata, parsed);
    return parsed;
}

// the metadata key:value pairs found in the run data, sorted for display
function get_metadata_options(runList = runs) {
    const metadataItems = new Set();
    for (const run of runList) {
        parse_metadata_items(run.metadata).forEach(item => metadataItems.add(item));
    }
    return Array.from(metadataItems).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

// function to setup metadata filter if there is metadata in the data
function setup_metadata_filter() {
    const metadataItems = get_metadata_options();
    const metadataFilter = document.getElementById("metadataFilter");
    if (metadataItems.length > 0) {
        metadataFilter.hidden = false;
        const optionsHtml = metadataItems
            .map(label => `<option value="${label}">${label}</option>`)
            .join("");
        const metadataSelect = document.getElementById("metadata");
        metadataSelect.innerHTML = `<option value="All">All</option>` + optionsHtml;
    } else {
        metadataFilter.hidden = true;
    }
}

// function to update the available runs to select in the filters
function setup_runs_in_select_filter_buttons() {
    const runOptions = new Set();
    runs.forEach(run => runOptions.add(run.name));
    const optionsHtml = Array.from(runOptions)
        .map(runName => `<option value="${runName}">${runName}</option>`)
        .join("");
    const runsSelect = document.getElementById("runs");
    runsSelect.innerHTML = `<option value="All">All</option>` + optionsHtml;
}

// function to update the available runtags to select in the filters
function setup_runtags_in_select_filter_buttons() {
    const tags = new Set();
    runs.forEach(run => {
        run.tags.split(",").forEach(tag => {
            if (tag) {
                tags.add(tag);
            }
        });
    });
    const andOrTags = `
        <li class="list-group-item d-flex small align-items-center">
            <label class="form-check-label me-2" for="tagMode">Tag Mode:</label>
            <select class="form-select form-select-sm" id="tagMode" style="width: auto;">
                <option value="AND">AND</option>
                <option value="OR">OR</option>
                <option value="NOT">NOT</option>
            </select>
        </li>
    `;
    const listItemTemplate = (value) => `
        <li class="list-group-item list-group-item-action d-flex small">
            <input class="form-check-input me-1" type="checkbox" value="${value}" id="runTagCheckBox${value}">
            <label class="form-check-label ms-2" for="runTagCheckBox${value}">${value}</label>
        </li>
    `;
    const listItems = [listItemTemplate("All")].concat(
        Array.from(tags).sort().map(tag => listItemTemplate(tag))
    ).join("");
    const tagsSelect = document.getElementById("runTag");
    tagsSelect.innerHTML = andOrTags + listItems;
    if (tags.size > 0) {
        document.getElementById("runTagFilter").hidden = false
    } else {
        document.getElementById("runTagFilter").hidden = true
    }
    const allRunTagsCheckBox = document.getElementById("runTagCheckBoxAll");
    allRunTagsCheckBox.checked = true;
    const filterActiveIndicatorId = "filterRunTagSelectedIndicator";
    setup_filter_active_indicator(allRunTagsCheckBox, filterActiveIndicatorId);
    setup_filter_checkbox_subfilter("runTagCheckBoxes");
    setup_filter_checkbox_handler_listeners(tagsSelect, allRunTagsCheckBox, filterActiveIndicatorId);
}

// create projectVersions checkboxes in filters
function setup_project_versions_in_select_filter_buttons() {
    const projectVersionList = document.getElementById("projectVersionList");
    projectVersionList.innerHTML = '';
    const projectVersionOptionsSet = new Set(
        runs
            .map(run => run.project_version)
            .filter(ver => ver != null)
    );
    const projectVersionOptions = [...projectVersionOptionsSet].sort().reverse();
    projectVersionOptions.unshift("None");
    projectVersionOptions.unshift("All");
    const prefix = "projectVersionInputItem";
    const listItemTemplate = (prefix, value) => `
        <li class="list-group-item list-group-item-action d-flex small">
            <input class="form-check-input me-1" type="checkbox" value="${value}" id="${prefix}${value}">
            <label class="form-check-label ms-2" for="${prefix}${value}">${value}</label>
        </li>
    `;
    const projectVersionListHtml = projectVersionOptions
        .map(projectVersion => listItemTemplate(prefix, projectVersion))
        .join('');
    projectVersionList.innerHTML = projectVersionListHtml;
    const allVersionsCheckBox = document.getElementById(`${prefix}All`);
    allVersionsCheckBox.checked = true;
    const filterVersionSelectedIndicatorId = "filterVersionSelectedIndicator";
    setup_filter_active_indicator(allVersionsCheckBox, filterVersionSelectedIndicatorId);
    setup_filter_checkbox_subfilter("projectVersionCheckBoxes", true);
    setup_filter_checkbox_handler_listeners(projectVersionList, allVersionsCheckBox, filterVersionSelectedIndicatorId);
}

// create custom filter dropdowns dynamically for each dimension found in run data
function setup_custom_filters_in_select_filter_buttons() {
    const container = document.getElementById("customFiltersList");
    container.innerHTML = '';
    const dimensions = collect_custom_filter_dimensions();
    const dimNames = Object.keys(dimensions).sort();
    for (const dimName of dimNames) {
        const values = [...dimensions[dimName]].sort();
        const allId = `customFilter_${dimName}_All`;
        const listId = `customFilter_${dimName}_List`;
        const checkBoxesId = `customFilter_${dimName}_CheckBoxes`;
        const selectId = `selectCustomFilter_${dimName}`;
        const indicatorId = `filterCustomFilter_${dimName}_Indicator`;
        const profileCheckId = `profileCheckCustomFilter_${dimName}`;
        const filterInputId = `customFilter_${dimName}_FilterInput`;
        const modeId = `customFilter_${dimName}_Mode`;

        const modeHtml = `
            <li class="list-group-item d-flex small align-items-center">
                <label class="form-check-label me-2" for="${modeId}">Mode:</label>
                <select class="form-select form-select-sm" id="${modeId}" style="width: auto;">
                    <option value="OR">OR</option>
                    <option value="AND">AND</option>
                    <option value="NOT">NOT</option>
                </select>
            </li>
        `;

        const itemsHtml = modeHtml + ["All", "None", ...values].map(v => `
            <li class="list-group-item list-group-item-action d-flex small">
                <input class="form-check-input me-1" type="checkbox" value="${v}" id="${listId}_${v}">
                <label class="form-check-label ms-2" for="${listId}_${v}">${v}</label>
            </li>
        `).join('');

        const rowHtml = `
            <div class="list-group-item" id="customFilter_${dimName}">
                <div class="d-flex justify-content-between align-items-start">
                    <input class="form-check-input filter-profile-check me-2 mt-2" type="checkbox"
                        id="${profileCheckId}" checked style="display: none;" />
                    <span class="d-flex align-items-center information info-label">
                        ${dimName}
                        <span id="${indicatorId}" class="version-selected-dot ms-2 mt-1" style="display: none;"></span>
                    </span>
                    <div style="width: 200px;">
                        <div class="selectBox" id="${selectId}">
                            <select class="form-select form-select-sm">
                                <option>Select Values</option>
                            </select>
                            <div class="overSelect"></div>
                        </div>
                        <div id="${checkBoxesId}" class="filterCheckBoxes mt-2" style="max-height: 50vh; overflow-y: auto;">
                            <input id="${filterInputId}" class="form-control form-control-sm" type="text" placeholder="Filter...">
                            <ul class="list-group" id="${listId}">
                                ${itemsHtml}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', rowHtml);

        // wire up checkbox behaviour
        const listEl = document.getElementById(listId);
        const allCheckBox = document.getElementById(`${listId}_All`);
        allCheckBox.checked = true;
        setup_filter_active_indicator(allCheckBox, indicatorId);
        setup_filter_checkbox_subfilter(checkBoxesId);
        setup_filter_checkbox_handler_listeners(listEl, allCheckBox, indicatorId);

        // wire up click-outside behaviour for the dropdown
        const selectEl = document.getElementById(selectId);
        const checkBoxesEl = document.getElementById(checkBoxesId);
        let showing = false;
        function toggle() { showing = !showing; set_filter_dropdown_visible(selectEl, checkBoxesEl, showing); }
        selectEl.addEventListener("pointerdown", toggle);
        document.body.addEventListener("pointerdown", function (event) {
            if (showing && !checkBoxesEl.contains(event.target) && !selectEl.contains(event.target)) {
                toggle();
            }
        });
    }
}

export {
    get_metadata_options,
    setup_custom_filters_in_select_filter_buttons,
    setup_lowest_highest_dates,
    setup_metadata_filter,
    setup_project_versions_in_select_filter_buttons,
    setup_run_amount_filter,
    setup_runs_in_select_filter_buttons,
    setup_runtags_in_select_filter_buttons,
};
