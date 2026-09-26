import { keywords } from "../variables/data.js";
import { settings } from "../variables/settings.js";
import { escape_html_for_merge } from "../variables/globals.js";
import { add_alert } from "../common.js";
import { set_local_storage_item } from "../localstorage.js";
import { setup_data_and_graphs } from "../menu.js";
import { toggle_theme, apply_theme_colors, apply_custom_branding } from "../theme.js";
import { collect_custom_filter_dimensions, dashboardPages } from "../filter/pipeline.js";
import { setup_lowest_highest_dates } from "../filter/modal_options.js";
import { set_filter_dropdown_visible } from "../filter/controls.js";
import { update_duration_comparison_for_all_projects } from "../graph_creation/overview.js";
import { confirm_action } from "./confirm_modal.js";

// function to create customized view eventlisteners
function setup_settings_modal() {
    // function to catch the closing of the settings modal
    document.getElementById("settingsModal").addEventListener("hidden.bs.modal", function () {
        setup_data_and_graphs();
    });
    // function to catch the closing of the settings modal
    document.getElementById("settingsModal").addEventListener("shown.bs.modal", function () {
        const libraries = [...new Set(
            keywords
                .map(item => item.owner)
                .filter(owner => owner)
        )];
        const keywordPrefs = settings.libraries ?? {};
        function render_keyword_libraries() {
            const container = document.getElementById("keywordLibraryList");
            container.innerHTML = "";
            libraries.forEach(lib => {
                const isChecked = keywordPrefs[lib] ?? true;
                const item = document.createElement("div");
                item.className = "list-group-item d-flex justify-content-between align-items-center";
                item.innerHTML = `
                    <span>${lib}</span>
                    <div class="form-check form-switch mb-0">
                        <input class="form-check-input" type="checkbox" id="keyword-${lib}"
                            ${isChecked ? "checked" : ""}>
                    </div>
                `;
                container.appendChild(item);
                document.getElementById(`keyword-${lib}`).addEventListener("change", e => {
                    keywordPrefs[lib] = e.target.checked;
                    set_local_storage_item("libraries", keywordPrefs)
                });
            });
        }
        render_keyword_libraries();
        dashboardPages.forEach(page => render_hidden_custom_filters(page));
    });
    function render_hidden_custom_filters(page) {
        const pageName = page.charAt(0).toUpperCase() + page.slice(1);
        const settingKey = `hiddenCustomFilters${pageName}`;
        const container = document.getElementById(`${settingKey}List`);
        if (!container) return;
        container.innerHTML = "";
        const dimNames = Object.keys(collect_custom_filter_dimensions()).sort();
        if (!dimNames.length) {
            container.innerHTML = `<li class="list-group-item small text-muted">No custom filters in run data.</li>`;
            return;
        }
        dimNames.forEach((dimName, dimIndex) => {
            const isChecked = (settings.show[settingKey] ?? []).includes(dimName);
            const checkBoxId = `${settingKey}_${dimIndex}`;
            const item = document.createElement("li");
            item.className = "list-group-item list-group-item-action d-flex small";
            item.innerHTML = `
                <input class="form-check-input me-1" type="checkbox" value="${escape_html_for_merge(dimName)}" id="${checkBoxId}" ${isChecked ? "checked" : ""}>
                <label class="form-check-label ms-2" for="${checkBoxId}">${escape_html_for_merge(dimName)}</label>
            `;
            container.appendChild(item);
            item.querySelector("input").addEventListener("change", e => {
                const hiddenCustomFilters = new Set(settings.show[settingKey] ?? []);
                if (e.target.checked) {
                    hiddenCustomFilters.add(dimName);
                } else {
                    hiddenCustomFilters.delete(dimName);
                }
                set_local_storage_item(`show.${settingKey}`, Array.from(hiddenCustomFilters));
            });
        });
    }
    // dropdown open/close behaviour, one selector per page
    dashboardPages.forEach(page => {
        const pageName = page.charAt(0).toUpperCase() + page.slice(1);
        const selectEl = document.getElementById(`selectHiddenCustomFilters${pageName}`);
        const checkBoxesEl = document.getElementById(`hiddenCustomFilters${pageName}CheckBoxes`);
        if (!selectEl || !checkBoxesEl) return;
        let showing = false;
        function toggle() {
            showing = !showing;
            set_filter_dropdown_visible(selectEl, checkBoxesEl, showing);
        }
        selectEl.addEventListener("pointerdown", toggle);
        document.body.addEventListener("pointerdown", function (event) {
            if (showing && !checkBoxesEl.contains(event.target) && !selectEl.contains(event.target)) {
                toggle();
            }
        });
    });
    // function to create setting toggle handlers
    function create_toggle_handler({ key, elementId, datatype = "boolean" }) {
        return function (load = false) {
            const element = document.getElementById(elementId);
            if (load) {
                const storedValue = key.split(".").reduce((acc, k) => acc?.[k], settings);
                if (datatype == "number") {
                    if (typeof storedValue === "number") {
                        element.value = storedValue;
                    }
                } else if (datatype == "string") {
                    if (typeof storedValue === "string") {
                        element.value = storedValue;
                    }
                } else {
                    if (typeof storedValue === "boolean") {
                        element.checked = storedValue;
                    }
                }
            } else {
                let newValue;
                if (datatype == "number") {
                    newValue = parseInt(element.value);
                } else if (datatype == "string") {
                    newValue = element.value;
                } else {
                    const currentValue = key.split(".").reduce((acc, k) => acc?.[k], settings);
                    newValue = !currentValue;
                    element.checked = newValue;
                }
                set_local_storage_item(key, newValue);
            }
        };
    }

    [
        { key: "show.unified", elementId: "toggleUnified" },
        { key: "show.dateLabels", elementId: "toggleLabels" },
        { key: "show.legends", elementId: "toggleLegends" },
        { key: "show.aliases", elementId: "toggleAliases", datatype: "string", event: "change" },
        { key: "show.milliseconds", elementId: "toggleMilliseconds" },
        { key: "show.timezones", elementId: "toggleTimezones" },
        { key: "show.axisTitles", elementId: "toggleAxisTitles" },
        { key: "show.animation", elementId: "toggleAnimations" },
        { key: "show.duration", elementId: "toggleAnimationDuration", datatype: "number", event: "change" },
        { key: "show.rounding", elementId: "toggleBarRounding", datatype: "number", event: "change" },
        { key: "show.prefixes", elementId: "togglePrefixes" },
        { key: "show.convertTimezone", elementId: "toggleTimezone" },
        { key: "show.suitesSelectionInSuiteStats", elementId: "toggleSuitesSelectionInSuiteStats", datatype: "string", event: "change" },
        { key: "show.suitesSelectionInTestStats", elementId: "toggleSuitesSelectionInTestStats", datatype: "string", event: "change" },
        { key: "show.overviewDurationPercentage", elementId: "overviewDurationPercentage", datatype: "number", event: "change" },
        { key: "show.filterAvailability", elementId: "toggleFilterAvailability" },
        { key: "show.filterCounts", elementId: "toggleFilterCounts" },
    ].forEach(def => {
        const handler = create_toggle_handler(def);
        handler(true);
        document.getElementById(def.elementId).addEventListener(def.event || "click", () => handler());
    });
    document.getElementById("overviewDurationPercentage").addEventListener("change", () => {
        if (settings.menu.overview) update_duration_comparison_for_all_projects();
    });
    // Re-populate the date filter pickers when either timezone toggle changes,
    // since the displayed timestamps change and the defaults need to match.
    document.getElementById("toggleTimezone").addEventListener("click", () => setup_lowest_highest_dates());
    document.getElementById("toggleTimezones").addEventListener("click", () => setup_lowest_highest_dates());
    document.getElementById("themeLight").addEventListener("click", () => toggle_theme());
    document.getElementById("themeDark").addEventListener("click", () => toggle_theme());

    function to_hex_color(color) {
        const rgbaMatch = color.match(/^rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/);
        if (rgbaMatch) {
            const [, r, g, b] = rgbaMatch.map(Number);
            return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
        }
        // For hex shorthand (#eee) and other CSS colors, use canvas normalization
        const ctx = document.createElement('canvas').getContext('2d');
        ctx.fillStyle = color;
        return ctx.fillStyle;
    }

    function create_theme_color_handler(colorKey, elementId) {
        function load_color() {
            const element = document.getElementById(elementId);
            const isDarkMode = document.documentElement.classList.contains("dark-mode");
            const themeMode = isDarkMode ? 'dark' : 'light';

            const customColors = settings.theme_colors?.custom?.[themeMode];
            const storedColor = customColors?.[colorKey];

            if (storedColor) {
                element.value = to_hex_color(storedColor);
            } else {
                const defaults = settings.theme_colors[themeMode];
                element.value = to_hex_color(defaults[colorKey]);
            }
        }

        function update_color() {
            const element = document.getElementById(elementId);
            const newColor = element.value;
            const isDarkMode = document.documentElement.classList.contains("dark-mode");
            const themeMode = isDarkMode ? 'dark' : 'light';

            if (!settings.theme_colors.custom) {
                settings.theme_colors.custom = { light: {}, dark: {} };
            }
            if (!settings.theme_colors.custom[themeMode]) {
                settings.theme_colors.custom[themeMode] = {};
            }

            settings.theme_colors.custom[themeMode][colorKey] = newColor;
            set_local_storage_item(`theme_colors.custom.${themeMode}.${colorKey}`, newColor);
            apply_theme_colors();
        }

        function reset_color() {
            const element = document.getElementById(elementId);
            const isDarkMode = document.documentElement.classList.contains("dark-mode");
            const themeMode = isDarkMode ? 'dark' : 'light';

            const defaults = settings.theme_colors[themeMode];
            element.value = to_hex_color(defaults[colorKey]);

            if (settings.theme_colors?.custom?.[themeMode]) {
                delete settings.theme_colors.custom[themeMode][colorKey];
                set_local_storage_item('theme_colors.custom', settings.theme_colors.custom);
            }

            apply_theme_colors();
        }

        return { load_color, update_color, reset_color };
    }

    const backgroundColorHandler = create_theme_color_handler('background', 'themeBackgroundColor');
    const cardColorHandler = create_theme_color_handler('card', 'themeCardColor');
    const highlightColorHandler = create_theme_color_handler('highlight', 'themeHighlightColor');
    const textColorHandler = create_theme_color_handler('text', 'themeTextColor');

    document.getElementById("settingsModal").addEventListener("shown.bs.modal", function () {
        backgroundColorHandler.load_color();
        cardColorHandler.load_color();
        highlightColorHandler.load_color();
        textColorHandler.load_color();
        document.getElementById('customBrandingTitle').value = settings.branding?.title || "";
        const hasLogo = !!settings.branding?.logo;
        document.getElementById('removeCustomLogo').disabled = !hasLogo;
        document.getElementById('customLogoUpload').value = "";
    });

    document.getElementById('themeBackgroundColor').addEventListener('change', () => backgroundColorHandler.update_color());
    document.getElementById('themeCardColor').addEventListener('change', () => cardColorHandler.update_color());
    document.getElementById('themeHighlightColor').addEventListener('change', () => highlightColorHandler.update_color());
    document.getElementById('themeTextColor').addEventListener('change', () => textColorHandler.update_color());

    document.getElementById('resetBackgroundColor').addEventListener('click', () => backgroundColorHandler.reset_color());
    document.getElementById('resetCardColor').addEventListener('click', () => cardColorHandler.reset_color());
    document.getElementById('resetHighlightColor').addEventListener('click', () => highlightColorHandler.reset_color());
    document.getElementById('resetTextColor').addEventListener('click', () => textColorHandler.reset_color());

    document.getElementById('customBrandingTitle').addEventListener('input', function () {
        const title = this.value.trim();
        set_local_storage_item('branding.title', title);
        apply_custom_branding();
    });

    document.getElementById('clearCustomTitle').addEventListener('click', function () {
        document.getElementById('customBrandingTitle').value = "";
        set_local_storage_item('branding.title', "");
        apply_custom_branding();
    });

    document.getElementById('customLogoUpload').addEventListener('change', function () {
        const file = this.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (e) {
            const img = new Image();
            img.onload = function () {
                const size = Math.max(img.width, img.height);
                const canvas = document.createElement('canvas');
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d');
                const offsetX = Math.floor((size - img.width) / 2);
                const offsetY = Math.floor((size - img.height) / 2);
                ctx.drawImage(img, offsetX, offsetY, img.width, img.height);
                const squaredDataUrl = canvas.toDataURL('image/png');
                set_local_storage_item('branding.logo', squaredDataUrl);
                document.getElementById('removeCustomLogo').disabled = false;
                apply_custom_branding();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });

    document.getElementById('removeCustomLogo').addEventListener('click', function () {
        set_local_storage_item('branding.logo', "");
        document.getElementById('customLogoUpload').value = "";
        this.disabled = true;
        apply_custom_branding();
    });

    function show_settings_in_textarea() {
        const textArea = document.getElementById("settingsTextArea");
        textArea.value = JSON.stringify(settings, null, 2);
    }

    function copy_settings_to_clipboard() {
        const textArea = document.getElementById("settingsTextArea");
        textArea.select();
        textArea.setSelectionRange(0, 99999);
        navigator.clipboard.writeText(textArea.value);
        add_alert("Copied settings to clipboard!", "success")
    }

    async function reset_settings_to_default() {
        const confirmed = await confirm_action(`Are you sure you want to resset all settings?<br><br>
                    This may override:<br>
                    - Graph settings<br>
                    - Custom layouts (e.g., moved or resized graphs)<br>
                    - Hidden graphs
                    If you only want to update a few small settings it is recommended to update the settings json and re-apply it.
                `);
        if (confirmed) {
            localStorage.removeItem("settings");
            location.reload();
        }
    }

    async function apply_settings_from_textarea() {
        const confirmed = await confirm_action(`Are you sure you want to apply the new settings?<br><br>
                    This may override:<br>
                    - Graph settings<br>
                    - Custom layouts (e.g., moved or resized graphs)<br>
                    - Hidden graphs
                `);
        if (confirmed) {
            try {
                const input = document.getElementById("settingsTextArea").value;
                const newSettings = JSON.parse(input);
                settings = newSettings
                localStorage.setItem("settings", JSON.stringify(newSettings));
                location.reload();
            } catch (e) {
                add_alert("Failed to update json config: " + e, "danger")
            }
        }
    }
    document.getElementById("copySettings").addEventListener("click", copy_settings_to_clipboard);
    document.getElementById("resetSettings").addEventListener("click", reset_settings_to_default);
    document.getElementById("applySettings").addEventListener("click", apply_settings_from_textarea);
    document.getElementById("settingsModal").addEventListener("shown.bs.modal", show_settings_in_textarea);
}

export { setup_settings_modal };
