import { set_local_storage_item } from "./localstorage.js";
import { update_dashboard_graphs } from "./graph_creation/all.js";
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
    update_dashboard_graphs()
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

    function apply_theme(isDark) {
        const color = isDark ? "white" : "black";
        // menu theme
        document.getElementById("navigation").classList.remove(isDark ? "navbar-light" : "navbar-dark");
        document.getElementById("navigation").classList.add(isDark ? "navbar-dark" : "navbar-light");
        document.getElementById("themeLight").hidden = isDark;
        document.getElementById("themeDark").hidden = !isDark;
        // bootstrap related settings
        document.getElementsByTagName("html")[0].setAttribute("data-bs-theme", isDark ? "dark" : "light");
        html.style.setProperty("--bs-body-bg", isDark ? "rgba(30, 41, 59, 0.9)" : "#fff");
        if (isDark) {
            swap_button_classes(".btn-outline-dark", "btn-outline-light", ".btn-dark", "btn-light");
        } else {
            swap_button_classes(".btn-outline-light", "btn-outline-dark", ".btn-light", "btn-dark");
        }
        // chartjs default graph settings
        Chart.defaults.color = isDark ? "#eee" : "#666";
        Chart.defaults.borderColor = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
        Chart.defaults.backgroundColor = isDark ? "rgba(255,255,0,0.1)" : "rgba(0,0,0,0.1)";
        Chart.defaults.elements.line.borderColor = isDark ? "rgba(255,255,0,0.4)" : "rgba(0,0,0,0.1)";
        // svgs
        const svgMap = {
            ids: {
                "github": githubSVG(color),
                "docs": docsSVG(color),
                "settings": settingsSVG(color),
                "database": databaseSVG(color),
                "filters": filterSVG(color),
                "rflogo": isDark ? getRflogoDarkSVG() : getRflogoLightSVG(),
                [isDark ? "themeDark" : "themeLight"]: isDark ? sunSVG : moonSVG,
                "bug": bugSVG(color),
                "customizeLayout": customizeViewSVG(color),
                "saveLayout": saveSVG(color),
            },
            classes: {
                ".percentage-graph": percentageSVG(color),
                ".bar-graph": barSVG(color),
                ".line-graph": lineSVG(color),
                ".pie-graph": pieSVG(color),
                ".boxplot-graph": boxplotSVG(color),
                ".heatmap-graph": heatmapSVG(color),
                ".stats-graph": statsSVG(color),
                ".timeline-graph": timelineSVG(color),
                ".radar-graph": radarSVG(color),
                ".fullscreen-graph": fullscreenSVG(color),
                ".close-graph": closeSVG(color),
                ".information-icon": informationSVG(color),
                ".shown-graph": eyeSVG(color),
                ".hidden-graph": eyeOffSVG(color),
                ".shown-section": eyeSVG(color),
                ".hidden-section": eyeOffSVG(color),
                ".move-up-table": moveUpSVG(color),
                ".move-down-table": moveDownSVG(color),
                ".move-up-section": moveUpSVG(color),
                ".move-down-section": moveDownSVG(color),
                ".clock-icon": clockSVG(color),
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
    const currentlyDark = html.classList.contains("dark-mode");

    if (settings.theme === "light") {
        if (currentlyDark) html.classList.remove("dark-mode");
        apply_theme(false);
    } else if (settings.theme === "dark") {
        if (!currentlyDark) html.classList.add("dark-mode");
        apply_theme(true);
    } else {
        // No theme in localStorage, fall back to system preference
        if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
            html.classList.add("dark-mode");
            apply_theme(true);
        } else {
            html.classList.remove("dark-mode");
            apply_theme(false);
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