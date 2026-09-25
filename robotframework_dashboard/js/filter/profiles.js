import { settings } from '../variables/settings.js';
import { runs } from '../variables/data.js';
import { set_local_storage_item } from '../localstorage.js';
import { collect_custom_filter_dimensions } from './pipeline.js';
import { setup_suite_path_navigator } from './suite_path.js';
import { schedule_filter_option_availability_refresh } from './availability.js';
import { update_filter_active_indicator } from './controls.js';

// Track the currently active profile name (null if none applied)
let activeProfileName = null;

// Snapshot of the filter state at dashboard load time (used to determine checkbox defaults when creating a profile)
let defaultFilters = null;

function capture_default_filters() {
    defaultFilters = capture_current_filters();
}

function filter_key_differs_from_default(key) {
    if (!defaultFilters) return false;
    const current = capture_current_filters();
    if (key === 'runTags') {
        const defaultTagMap = {};
        (defaultFilters.runTags || []).forEach(t => { defaultTagMap[t.id] = t.checked; });
        for (const tag of (current.runTags || [])) {
            if (defaultTagMap[tag.id] !== tag.checked) return true;
        }
        return false;
    }
    if (key === 'projectVersions') {
        const defaultVersionMap = {};
        (defaultFilters.projectVersions || []).forEach(v => { defaultVersionMap[v.value] = v.checked; });
        for (const ver of (current.projectVersions || [])) {
            if (defaultVersionMap[ver.value] !== ver.checked) return true;
        }
        return false;
    }
    return String(current[key] ?? '') !== String(defaultFilters[key] ?? '');
}

function compute_profile_check_states() {
    const checkKeyMap = {
        profileCheckRuns: ['runs'],
        profileCheckRunTags: ['runTags', 'tagMode'],
        profileCheckVersions: ['projectVersions'],
        profileCheckFromDate: ['fromDate'],
        profileCheckFromTime: ['fromTime'],
        profileCheckToDate: ['toDate'],
        profileCheckToTime: ['toTime'],
        profileCheckMetadata: ['metadata'],
        profileCheckAmount: ['amount'],
        profileCheckSuitePaths: ['suitePath'],
    };
    const result = {};
    for (const [checkId, keys] of Object.entries(checkKeyMap)) {
        result[checkId] = keys.some(key => filter_key_differs_from_default(key));
    }
    return result;
}

function capture_current_filters() {
    const profile = {};
    profile.runs = document.getElementById("runs").value;
    const tagInputs = document.getElementById("runTag").querySelectorAll("input.form-check-input");
    profile.runTags = Array.from(tagInputs).map(el => ({ id: el.id.replace(/^runTagCheckBox/, ""), checked: el.checked }));
    profile.tagMode = document.getElementById("tagMode")?.value ?? "AND";
    const versionInputs = document.getElementById("projectVersionList").querySelectorAll("input.form-check-input");
    profile.projectVersions = Array.from(versionInputs).map(el => ({ value: el.value, checked: el.checked }));
    profile.fromDate = document.getElementById("fromDate").value;
    profile.fromTime = document.getElementById("fromTime").value;
    profile.toDate = document.getElementById("toDate").value;
    profile.toTime = document.getElementById("toTime").value;
    profile.metadata = document.getElementById("metadata").value;
    profile.amount = document.getElementById("amount").value;
    profile.suitePath = document.getElementById("suitePathValue").value;
    const dimensions = collect_custom_filter_dimensions();
    if (Object.keys(dimensions).length > 0) {
        profile.customFilters = {};
        profile.customFilterModes = {};
        for (const dimName of Object.keys(dimensions)) {
            const listEl = document.getElementById(`customFilter_${dimName}_List`);
            if (!listEl) continue;
            const inputs = listEl.querySelectorAll("input.form-check-input");
            profile.customFilters[dimName] = Array.from(inputs).map(el => ({ value: el.value, checked: el.checked }));
            const modeEl = document.getElementById(`customFilter_${dimName}_Mode`);
            profile.customFilterModes[dimName] = modeEl ? modeEl.value : "OR";
        }
    }
    return profile;
}

function build_profile_from_checks() {
    const full = capture_current_filters();
    const profile = {};
    const checkMap = {
        profileCheckRuns: 'runs',
        profileCheckRunTags: ['runTags', 'tagMode'],
        profileCheckVersions: 'projectVersions',
        profileCheckFromDate: 'fromDate',
        profileCheckFromTime: 'fromTime',
        profileCheckToDate: 'toDate',
        profileCheckToTime: 'toTime',
        profileCheckMetadata: 'metadata',
        profileCheckAmount: 'amount',
        profileCheckSuitePaths: 'suitePath',
    };
    for (const [checkId, keys] of Object.entries(checkMap)) {
        const el = document.getElementById(checkId);
        if (el && el.checked) {
            if (Array.isArray(keys)) {
                keys.forEach(k => profile[k] = full[k]);
            } else {
                profile[keys] = full[keys];
            }
        }
    }
    const dimensions = collect_custom_filter_dimensions();
    const customFiltersResult = {};
    for (const dimName of Object.keys(dimensions)) {
        const checkEl = document.getElementById(`profileCheckCustomFilter_${dimName}`);
        if (checkEl && checkEl.checked && full.customFilters && full.customFilters[dimName]) {
            customFiltersResult[dimName] = full.customFilters[dimName];
        }
    }
    if (Object.keys(customFiltersResult).length > 0) {
        profile.customFilters = customFiltersResult;
        const customFilterModesResult = {};
        for (const dimName of Object.keys(customFiltersResult)) {
            const modeEl = document.getElementById(`customFilter_${dimName}_Mode`);
            customFilterModesResult[dimName] = modeEl ? modeEl.value : "OR";
        }
        profile.customFilterModes = customFilterModesResult;
    }
    return profile;
}

function profiles_match(saved, current) {
    for (const key of Object.keys(saved)) {
        const s = saved[key];
        const c = current[key];
        if (Array.isArray(s)) {
            if (!Array.isArray(c) || s.length !== c.length) return false;
            for (let i = 0; i < s.length; i++) {
                if (JSON.stringify(s[i]) !== JSON.stringify(c[i])) return false;
            }
        } else {
            if (String(s) !== String(c)) return false;
        }
    }
    return true;
}

function find_matching_profile() {
    const profiles = load_filter_profiles();
    const current = capture_current_filters();
    for (const [name, saved] of Object.entries(profiles)) {
        if (profiles_match(saved, current)) return name;
    }
    return null;
}

function update_profile_select_display() {
    const selectEl = document.getElementById("selectFilterProfile");
    const selectInner = selectEl.querySelector("select");
    const dot = document.getElementById("profileModifiedDot");
    const updateBtn = document.getElementById("updateFilterProfile");

    const matchingName = find_matching_profile();

    if (matchingName) {
        // Current filters exactly match a saved profile
        activeProfileName = matchingName;
        selectInner.options[0].textContent = matchingName;
        dot.style.display = "none";
        updateBtn.style.display = "none";
    } else if (activeProfileName) {
        // A profile was applied but filters have since changed
        selectInner.options[0].textContent = activeProfileName;
        dot.style.display = "";
        updateBtn.style.display = "";
    } else {
        // No profile active
        selectInner.options[0].textContent = "Apply Filter Profile";
        dot.style.display = "none";
        updateBtn.style.display = "none";
    }
}

function clear_active_profile() {
    activeProfileName = null;
}

function update_active_profile() {
    if (!activeProfileName) return;
    const profileData = capture_current_filters();
    // Only save the keys that were in the original profile
    const profiles = load_filter_profiles();
    const original = profiles[activeProfileName];
    if (!original) return;
    const updated = {};
    for (const key of Object.keys(original)) {
        updated[key] = profileData[key];
    }
    save_filter_profile_to_storage(activeProfileName, updated);
    update_profile_select_display();
}

function apply_filter_profile(profile, name) {
    if (name) activeProfileName = name;
    if (profile.runs !== undefined) {
        document.getElementById("runs").value = profile.runs;
    }

    if (profile.runTags !== undefined) {
        const tagInputs = document.getElementById("runTag").querySelectorAll("input.form-check-input");
        const tagMap = {};
        profile.runTags.forEach(t => tagMap[t.id] = t.checked);
        tagInputs.forEach(el => {
            tag=el.id.replace(/^runTagCheckBox/, "")
            if (tagMap[tag] !== undefined) el.checked = tagMap[tag];
        });
        update_filter_active_indicator("runTagCheckBoxAll", "filterRunTagSelectedIndicator");
    }
    if (profile.tagMode !== undefined) {
        const tagModeEl = document.getElementById("tagMode");
        if (tagModeEl) tagModeEl.value = profile.tagMode;
    } else if (profile.useOrTags !== undefined) {
        // Backward compatibility: convert old useOrTags boolean to tagMode
        const tagModeEl = document.getElementById("tagMode");
        if (tagModeEl) tagModeEl.value = profile.useOrTags ? "OR" : "AND";
    }
    if (profile.projectVersions !== undefined) {
        const versionInputs = document.getElementById("projectVersionList").querySelectorAll("input.form-check-input");
        const versionMap = {};
        profile.projectVersions.forEach(v => versionMap[v.value] = v.checked);
        versionInputs.forEach(el => {
            if (versionMap[el.value] !== undefined) el.checked = versionMap[el.value];
        });
        update_filter_active_indicator("projectVersionInputItemAll", "filterVersionSelectedIndicator");
    }
    if (profile.fromDate !== undefined) {
        document.getElementById("fromDate").value = profile.fromDate;
    }
    if (profile.fromTime !== undefined) {
        document.getElementById("fromTime").value = profile.fromTime;
    }
    if (profile.toDate !== undefined) {
        document.getElementById("toDate").value = profile.toDate;
    }
    if (profile.toTime !== undefined) {
        document.getElementById("toTime").value = profile.toTime;
    }
    if (profile.metadata !== undefined) {
        document.getElementById("metadata").value = profile.metadata;
    }
    if (profile.amount !== undefined) {
        document.getElementById("amount").value = profile.amount;
    }
    if (profile.suitePath !== undefined) {
        setup_suite_path_navigator(profile.suitePath);
    } else if (profile.suitePaths !== undefined) {
        // Backward compatibility: old format stored an array of {value, checked}
        const checked = (profile.suitePaths || []).filter(p => p.checked && p.value !== "All").map(p => p.value);
        setup_suite_path_navigator(checked.length === 1 ? checked[0] : "All");
    }
    if (profile.customFilters !== undefined) {
        for (const [dimName, items] of Object.entries(profile.customFilters)) {
            const listEl = document.getElementById(`customFilter_${dimName}_List`);
            if (!listEl) continue;
            const valueMap = {};
            items.forEach(v => { valueMap[v.value] = v.checked; });
            listEl.querySelectorAll("input.form-check-input").forEach(el => {
                if (valueMap[el.value] !== undefined) el.checked = valueMap[el.value];
            });
            update_filter_active_indicator(`customFilter_${dimName}_List_All`, `filterCustomFilter_${dimName}_Indicator`);
        }
    }
    if (profile.customFilterModes !== undefined) {
        for (const [dimName, mode] of Object.entries(profile.customFilterModes)) {
            const modeEl = document.getElementById(`customFilter_${dimName}_Mode`);
            if (modeEl) modeEl.value = mode;
        }
    }
    const runsIndicator = document.getElementById("filterRunSelectedIndicator");
    const runsVal = document.getElementById("runs")?.value;
    if (runsIndicator)
        runsIndicator.style.display =
            runsVal && runsVal !== "All" ? "inline-block" : "none";
    schedule_filter_option_availability_refresh();
}

function load_filter_profiles() {
    return settings.filterProfiles || {};
}

function save_filter_profile_to_storage(name, profileData) {
    const profiles = load_filter_profiles();
    profiles[name] = profileData;
    set_local_storage_item("filterProfiles", profiles);
}

function delete_filter_profile(name) {
    const profiles = load_filter_profiles();
    delete profiles[name];
    set_local_storage_item("filterProfiles", profiles);
}

function populate_filter_profile_select() {
    const list = document.getElementById("filterProfileList");
    const profiles = load_filter_profiles();
    list.innerHTML = '';
    const names = Object.keys(profiles).sort();
    if (names.length === 0) {
        list.innerHTML = '<li class="list-group-item small text-muted">No profiles saved</li>';
        return;
    }
    for (const name of names) {
        const li = document.createElement("li");
        li.className = "list-group-item list-group-item-action d-flex align-items-center small";
        li.innerHTML = `<span class="filter-profile-apply flex-grow-1" data-profile="${name}" id="profile${name}" style="cursor: pointer;">${name}</span>`
            + `<span class="filter-profile-delete ms-2" data-profile="${name}" id="profileCheck${name}" title="Delete profile" style="cursor: pointer;">&times;</span>`;
        list.appendChild(li);
    }
}

function enter_profile_edit_mode() {
    document.getElementById("addFilterProfile").style.display = "none";
    document.getElementById("cancelFilterProfile").style.display = "";
    document.getElementById("filterProfileEditorInline").style.display = "";
    document.getElementById("filterProfileEditorInline").classList.add("d-flex");
    document.getElementById("filterProfileName").value = "";
    document.querySelectorAll(".filter-profile-check").forEach(el => {
        el.style.display = "";
    });
    // Set each checkbox based on whether the corresponding filter currently differs from the default state
    const states = compute_profile_check_states();
    for (const [id, checked] of Object.entries(states)) {
        const el = document.getElementById(id);
        if (el) el.checked = checked;
    }
}

function exit_profile_edit_mode() {
    document.getElementById("cancelFilterProfile").style.display = "none";
    document.getElementById("addFilterProfile").style.display = "";
    document.getElementById("filterProfileEditorInline").style.display = "none";
    document.getElementById("filterProfileEditorInline").classList.remove("d-flex");
    document.querySelectorAll(".filter-profile-check").forEach(el => {
        el.style.display = "none";
    });
}

export {
    apply_filter_profile,
    build_profile_from_checks,
    capture_current_filters,
    capture_default_filters,
    clear_active_profile,
    delete_filter_profile,
    enter_profile_edit_mode,
    exit_profile_edit_mode,
    populate_filter_profile_select,
    save_filter_profile_to_storage,
    update_active_profile,
    update_profile_select_display,
};
