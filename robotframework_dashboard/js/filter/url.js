import { settings } from '../variables/settings.js';
import { runs, suites } from '../variables/data.js';
import { apply_filter_profile, capture_current_filters, get_default_filters, update_profile_select_display } from './profiles.js';
import { update_filters_button_indicator } from './controls.js';

// the active filters live in the query string so a filtered view can be shared or bookmarked (issue #385)
// only filters that differ from the defaults of this dashboard are written, in this order
const PAGES = ["overview", "dashboard", "compare", "tables"];
const VALUE_PARAMS = {
    runs: "run",
    tagMode: "tagMode",
    fromDate: "fromDate",
    fromTime: "fromTime",
    toDate: "toDate",
    toTime: "toTime",
    metadata: "metadata",
    amount: "amount",
    suitePath: "suite",
};
// checkbox lists: one parameter per checked option, e.g. ?tag=dev&tag=nightly
const LIST_PARAMS = { runTags: "tag", projectVersions: "version" };
// custom filters (--customfilters) are keyed by dimension, e.g. ?filter.Release=1.0&filterMode.Release=NOT
const CUSTOM_FILTER_PREFIX = "filter.";
const CUSTOM_FILTER_MODE_PREFIX = "filterMode.";
const VALUE_PATTERNS = {
    tagMode: /^(AND|OR|NOT)$/,
    fromDate: /^\d{4}-\d{2}-\d{2}$/,
    toDate: /^\d{4}-\d{2}-\d{2}$/,
    fromTime: /^\d{2}:\d{2}$/,
    toTime: /^\d{2}:\d{2}$/,
    amount: /^\d+$/,
};
const MODE_PATTERN = /^(AND|OR|NOT)$/;

function is_filter_param(key) {
    return key === "page"
        || Object.values(VALUE_PARAMS).includes(key)
        || Object.values(LIST_PARAMS).includes(key)
        || key.startsWith(CUSTOM_FILTER_PREFIX)
        || key.startsWith(CUSTOM_FILTER_MODE_PREFIX);
}

// the checked options of a checkbox list, "All" checked means the filter is not used
function checked_values(list) {
    const checked = (list || []).filter(item => item.checked).map(item => String(item.id ?? item.value));
    return checked.includes("All") ? [] : checked;
}

function same_values(a, b) {
    return a.length === b.length && a.every(value => b.includes(value));
}

// [key, value] pairs for every filter in current that differs from defaults
function build_filter_params(current, defaults) {
    const params = [];
    for (const [key, param] of Object.entries(VALUE_PARAMS)) {
        if (current[key] === undefined) continue;
        if (String(current[key]) !== String(defaults[key] ?? "")) params.push([param, String(current[key])]);
    }
    for (const [key, param] of Object.entries(LIST_PARAMS)) {
        const values = checked_values(current[key]);
        if (!same_values(values, checked_values(defaults[key]))) values.forEach(value => params.push([param, value]));
    }
    for (const [dimName, items] of Object.entries(current.customFilters || {})) {
        const values = checked_values(items);
        if (!same_values(values, checked_values(defaults.customFilters?.[dimName]))) {
            values.forEach(value => params.push([CUSTOM_FILTER_PREFIX + dimName, value]));
        }
    }
    for (const [dimName, mode] of Object.entries(current.customFilterModes || {})) {
        if (mode !== defaults.customFilterModes?.[dimName]) params.push([CUSTOM_FILTER_MODE_PREFIX + dimName, mode]);
    }
    return params;
}

// the filters in the query string: single values as strings, checkbox lists as arrays of the checked values;
// values that can never be valid (a malformed date, a negative amount) are dropped
function parse_filter_params(params) {
    const parsed = {};
    for (const [key, param] of Object.entries(VALUE_PARAMS)) {
        const value = params.get(param);
        if (value === null) continue;
        if (VALUE_PATTERNS[key] && !VALUE_PATTERNS[key].test(value)) continue;
        parsed[key] = value;
    }
    for (const [key, param] of Object.entries(LIST_PARAMS)) {
        const values = params.getAll(param);
        if (values.length) parsed[key] = values;
    }
    for (const [param, value] of params) {
        if (param.startsWith(CUSTOM_FILTER_PREFIX)) {
            const dimName = param.slice(CUSTOM_FILTER_PREFIX.length);
            parsed.customFilters ??= {};
            (parsed.customFilters[dimName] ??= []).push(value);
        } else if (param.startsWith(CUSTOM_FILTER_MODE_PREFIX) && MODE_PATTERN.test(value)) {
            parsed.customFilterModes ??= {};
            parsed.customFilterModes[param.slice(CUSTOM_FILTER_MODE_PREFIX.length)] = value;
        }
    }
    return parsed;
}

// a checkbox list with exactly the given values checked, null when none of them is an option of this
// dashboard: an empty selection would hide every run instead of ignoring a link made for other data
function select_checkbox_values(options, values) {
    if (!options || !options.some(item => values.includes(String(item.id ?? item.value)))) return null;
    return options.map(item => {
        const option = String(item.id ?? item.value);
        return { ...item, checked: option !== "All" && values.includes(option) };
    });
}

// turns parsed url filters into a filter profile for the options the dashboard currently offers
function url_filters_to_profile(parsed, current, is_valid_option) {
    const profile = {};
    for (const key of Object.keys(VALUE_PARAMS)) {
        if (parsed[key] === undefined) continue;
        if (is_valid_option && !is_valid_option(key, parsed[key])) continue;
        profile[key] = parsed[key];
    }
    for (const key of Object.keys(LIST_PARAMS)) {
        if (!parsed[key]) continue;
        const list = select_checkbox_values(current[key], parsed[key]);
        if (list) profile[key] = list;
    }
    for (const [dimName, values] of Object.entries(parsed.customFilters || {})) {
        const list = select_checkbox_values(current.customFilters?.[dimName], values);
        if (!list) continue;
        profile.customFilters ??= {};
        profile.customFilters[dimName] = list;
    }
    for (const [dimName, mode] of Object.entries(parsed.customFilterModes || {})) {
        if (!current.customFilterModes || !(dimName in current.customFilterModes)) continue;
        profile.customFilterModes ??= {};
        profile.customFilterModes[dimName] = mode;
    }
    return profile;
}

function select_has_option(selectId, value) {
    const select = document.getElementById(selectId);
    return !!select && Array.from(select.options).some(option => option.value === value);
}

function is_valid_dom_option(key, value) {
    if (key === "runs") return select_has_option("runs", value);
    if (key === "metadata") return select_has_option("metadata", value);
    if (key === "suitePath") return value === "All" || suites.some(suite => suite.full_name === value || suite.full_name.startsWith(value + "."));
    return true;
}

// applies the filters of the query string to the filter modal, called once on load after the defaults are captured
function apply_url_filters() {
    const parsed = parse_filter_params(new URLSearchParams(window.location.search));
    if (Object.keys(parsed).length === 0) return;
    const profile = url_filters_to_profile(parsed, capture_current_filters(), is_valid_dom_option);
    if (Object.keys(profile).length === 0) return;
    apply_filter_profile(profile);
    update_profile_select_display();
    update_filters_button_indicator();
}

// writes the active page and filters to the query string, keeping parameters the dashboard does not own
function update_url_from_filters() {
    const loadDefaults = get_default_filters();
    if (!loadDefaults) return;
    // the first filter pass lowers an amount above the number of runs to that number (filter_amount),
    // which is still the default and does not belong in the url
    const defaultAmount = Number(loadDefaults.amount);
    const defaults = Number.isFinite(defaultAmount)
        ? { ...loadDefaults, amount: String(Math.min(defaultAmount, runs.length)) }
        : loadDefaults;
    const params = new URLSearchParams();
    const page = PAGES.find(name => settings.menu?.[name]);
    if (page) params.set("page", page);
    build_filter_params(capture_current_filters(), defaults).forEach(([key, value]) => params.append(key, value));
    for (const [key, value] of new URLSearchParams(window.location.search)) {
        if (!is_filter_param(key)) params.append(key, value);
    }
    const search = params.toString();
    if (`?${search}` === window.location.search || (!search && !window.location.search)) return;
    const url = (search ? `?${search}` : window.location.pathname) + window.location.hash;
    try {
        history.replaceState(history.state, "", url);
    } catch (error) {
        // a browser that refuses to change the url of a local file keeps working, only without the link
        console.warn("Could not store the filters in the url", error);
    }
}

export {
    apply_url_filters,
    build_filter_params,
    parse_filter_params,
    update_url_from_filters,
    url_filters_to_profile,
};
