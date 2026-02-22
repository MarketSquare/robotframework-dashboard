import { set_local_storage_item } from "./localstorage.js";
import { setup_dashboard_graphs } from "./graph_creation/all.js";
import { settings } from "./variables/settings.js";
import { graphFontSize } from "./variables/chartconfig.js";
import {
    githubSVG,
    docsSVG,
    settingsSVG,
    databaseSVG,
    filterSVG,
    getRflogoLightSVG, getRflogoDarkSVG,
    moonSVG, sunSVG,
    bugSVG,
    customizeViewSVG,
    saveSVG,
    percentageSVG,
    barSVG,
    lineSVG,
    pieSVG,
    boxplotSVG,
    heatmapSVG,
    statsSVG,
    timelineSVG,
    radarSVG,
    fullscreenSVG,
    closeSVG,
    informationSVG,
    eyeSVG,
    eyeOffSVG,
    moveUpSVG,
    moveDownSVG,
    clockSVG,
} from "./variables/svg.js";

// function to update the theme when the button is clicked
function toggle_theme() {
    if (document.documentElement.classList.contains("dark-mode")) {
        set_local_storage_item("theme", "light");
    } else {
        set_local_storage_item("theme", "dark");
    }
    setup_theme()
    setup_dashboard_graphs()
}

// theme function based on browser/machine color scheme
function setup_theme() {
    Chart.defaults.font.size = graphFontSize;
    const html = document.documentElement;

    function swap_button_classes(from1, to1, from2, to2) {
        // bootstrap buttons theme swap (outline and regular)
        document.querySelectorAll(from1).forEach(btn => {
            btn.classList.remove(from1.replace(".", ""));
            btn.classList.add(to1);
        });
        document.querySelectorAll(from2).forEach(btn => {
            btn.classList.remove(from2.replace(".", ""));
            btn.classList.add(to2);
        });
    }

    function set_light_mode() {
        // menu theme
        document.getElementById("navigation").classList.remove("navbar-dark")
        document.getElementById("navigation").classList.add("navbar-light")
        document.getElementById("themeLight").hidden = false;
        document.getElementById("themeDark").hidden = true;
        // bootstrap related settings
        document.getElementsByTagName("html")[0].setAttribute("data-bs-theme", "light");
        html.style.setProperty("--bs-body-bg", "#fff");
        swap_button_classes(".btn-outline-light", "btn-outline-dark", ".btn-light", "btn-dark");
        // chartjs default graph settings
        Chart.defaults.color = "#666";
        Chart.defaults.borderColor = "rgba(0,0,0,0.1)";
        Chart.defaults.backgroundColor = "rgba(0,0,0,0.1)";
        Chart.defaults.elements.line.borderColor = "rgba(0,0,0,0.1)";
        // svgs
        const svgMap = {
            ids: {
                "github": githubSVG("black"),
                "docs": docsSVG("black"),
                "settings": settingsSVG("black"),
                "database": databaseSVG("black"),
                "filters": filterSVG("black"),
                "rflogo": getRflogoLightSVG(),
                "themeLight": moonSVG,
                "bug": bugSVG("black"),
                "customizeLayout": customizeViewSVG("black"),
                "saveLayout": saveSVG("black"),
            },
            classes: {
                ".percentage-graph": percentageSVG("black"),
                ".bar-graph": barSVG("black"),
                ".line-graph": lineSVG("black"),
                ".pie-graph": pieSVG("black"),
                ".boxplot-graph": boxplotSVG("black"),
                ".heatmap-graph": heatmapSVG("black"),
                ".stats-graph": statsSVG("black"),
                ".timeline-graph": timelineSVG("black"),
                ".radar-graph": radarSVG("black"),
                ".fullscreen-graph": fullscreenSVG("black"),
                ".close-graph": closeSVG("black"),
                ".information-icon": informationSVG("black"),
                ".shown-graph": eyeSVG("black"),
                ".hidden-graph": eyeOffSVG("black"),
                ".shown-section": eyeSVG("black"),
                ".hidden-section": eyeOffSVG("black"),
                ".move-up-table": moveUpSVG("black"),
                ".move-down-table": moveDownSVG("black"),
                ".move-up-section": moveUpSVG("black"),
                ".move-down-section": moveDownSVG("black"),
                ".clock-icon": clockSVG("black"),
            }
        };
        for (const [id, svg] of Object.entries(svgMap.ids)) {
            const el = document.getElementById(id);
            if (el) el.innerHTML = svg;
        }
        for (const [selector, svg] of Object.entries(svgMap.classes)) {
            document.querySelectorAll(selector).forEach(el => {
                el.innerHTML = svg;
            });
        }
    }

    function set_dark_mode() {
        // menu theme
        document.getElementById("themeLight").hidden = true;
        document.getElementById("themeDark").hidden = false;
        document.getElementById("navigation").classList.remove("navbar-light")
        document.getElementById("navigation").classList.add("navbar-dark")
        // bootstrap related settings
        document.getElementsByTagName("html")[0].setAttribute("data-bs-theme", "dark");
        html.style.setProperty("--bs-body-bg", "rgba(30, 41, 59, 0.9)");
        swap_button_classes(".btn-outline-dark", "btn-outline-light", ".btn-dark", "btn-light");
        // chartjs default graph settings
        Chart.defaults.color = "#eee";
        Chart.defaults.borderColor = "rgba(255,255,255,0.1)";
        Chart.defaults.backgroundColor = "rgba(255,255,0,0.1)";
        Chart.defaults.elements.line.borderColor = "rgba(255,255,0,0.4)";
        // svgs
        const svgMap = {
            ids: {
                "github": githubSVG("white"),
                "docs": docsSVG("white"),
                "settings": settingsSVG("white"),
                "database": databaseSVG("white"),
                "filters": filterSVG("white"),
                "rflogo": getRflogoDarkSVG(),
                "themeDark": sunSVG,
                "bug": bugSVG("white"),
                "customizeLayout": customizeViewSVG("white"),
                "saveLayout": saveSVG("white"),
            },
            classes: {
                ".percentage-graph": percentageSVG("white"),
                ".bar-graph": barSVG("white"),
                ".line-graph": lineSVG("white"),
                ".pie-graph": pieSVG("white"),
                ".boxplot-graph": boxplotSVG("white"),
                ".heatmap-graph": heatmapSVG("white"),
                ".stats-graph": statsSVG("white"),
                ".timeline-graph": timelineSVG("white"),
                ".radar-graph": radarSVG("white"),
                ".fullscreen-graph": fullscreenSVG("white"),
                ".close-graph": closeSVG("white"),
                ".information-icon": informationSVG("white"),
                ".shown-graph": eyeSVG("white"),
                ".hidden-graph": eyeOffSVG("white"),
                ".shown-section": eyeSVG("white"),
                ".hidden-section": eyeOffSVG("white"),
                ".move-up-table": moveUpSVG("white"),
                ".move-down-table": moveDownSVG("white"),
                ".move-up-section": moveUpSVG("white"),
                ".move-down-section": moveDownSVG("white"),
                ".clock-icon": clockSVG("white"),
            }
        };
        for (const [id, svg] of Object.entries(svgMap.ids)) {
            const el = document.getElementById(id);
            if (el) el.innerHTML = svg;
        }
        for (const [selector, svg] of Object.entries(svgMap.classes)) {
            document.querySelectorAll(selector).forEach(el => {
                el.innerHTML = svg;
            });
        }
    }

    // detect theme preference
    const isDark = html.classList.contains("dark-mode");

    if (settings.theme === "light") {
        if (isDark) html.classList.remove("dark-mode");
        set_light_mode();
    } else if (settings.theme === "dark") {
        if (!isDark) html.classList.add("dark-mode");
        set_dark_mode();
    } else {
        // No theme in localStorage, fall back to system preference
        if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
            html.classList.add("dark-mode");
            set_dark_mode();
        } else {
            html.classList.remove("dark-mode");
            set_light_mode();
        }
    }
    
    // Apply custom theme colors if set
    apply_theme_colors();
}

// function to apply custom theme colors
function apply_theme_colors() {
    const root = document.documentElement;
    const isDarkMode = root.classList.contains("dark-mode");
    const themeMode = isDarkMode ? 'dark' : 'light';
    
    // Get default colors for current theme mode
    const defaultColors = settings.theme_colors[themeMode];
    
    // Get custom colors if they exist
    const customColors = settings.theme_colors?.custom?.[themeMode] || {};
    
    // Apply colors (custom overrides default)
    const finalColors = {
        background: customColors.background || defaultColors.background,
        card: customColors.card || defaultColors.card,
        highlight: customColors.highlight || defaultColors.highlight,
        text: customColors.text || defaultColors.text,
    };
    
    // Set CSS custom properties - background color
    root.style.setProperty('--color-bg', finalColors.background);
    root.style.setProperty('--color-fullscreen-bg', finalColors.background);
    root.style.setProperty('--color-modal-bg', finalColors.background);
    
    // Set CSS custom properties - card color (propagate to all card-like surfaces)
    root.style.setProperty('--color-card', finalColors.card);
    // In light mode, section cards match background; in dark mode they use card color
    root.style.setProperty('--color-section-card-bg', finalColors.card);
    root.style.setProperty('--color-tooltip-bg', finalColors.card);
    
    // Set CSS custom properties - highlight color
    root.style.setProperty('--color-highlight', finalColors.highlight);
    
    // Set CSS custom properties - text color (propagate to all text)
    root.style.setProperty('--color-text', finalColors.text);
    root.style.setProperty('--color-menu-text', finalColors.text);
    root.style.setProperty('--color-table-text', finalColors.text);
    root.style.setProperty('--color-tooltip-text', finalColors.text);
    root.style.setProperty('--color-section-card-text', finalColors.text);
}

export {
    toggle_theme,
    setup_theme,
    apply_theme_colors
};