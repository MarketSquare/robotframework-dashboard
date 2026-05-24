import { setup_theme } from "./hub_theme.js";
import { setup_information_popups } from "./hub_information.js";
import { hub_projects, hub_title_raw, hub_version_raw } from "./hub_data.js";
import { create_stat_widgets, create_global_trend_chart, create_project_bar_chart, create_duration_chart } from "./hub_charts.js";
import { create_project_table } from "./hub_table.js";
import { setup_hub_eventlisteners, setup_collapsables, setup_hub_tabs } from "./hub_eventlisteners.js";
import { setup_hub_admin } from "./hub_admin.js";

function main() {
    setup_theme();
    setup_hub_eventlisteners();
    setup_hub_tabs();
    setup_hub_admin();

    // Set Chart.js defaults to match dashboard theme
    const isDarkMode = document.documentElement.classList.contains('dark-mode');
    Chart.defaults.font.size = 12;
    Chart.defaults.color = isDarkMode ? '#eee' : '#666';
    Chart.defaults.borderColor = isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';

    // Display hub title in the navbar
    const titleEl = document.getElementById('hubTitleDisplay');
    if (titleEl && !String(hub_title_raw).includes('placeholder_')) {
        titleEl.textContent = hub_title_raw;
    }

    // Set version tooltip before wiring information popups
    const versionEl = document.getElementById('versionInformation');
    if (versionEl && !String(hub_version_raw).includes('placeholder_')) {
        versionEl.setAttribute('data-title', hub_version_raw);
    }

    setup_information_popups();

    if (!hub_projects || hub_projects.length === 0) {
        const container = document.getElementById("hubStatWidgets");
        if (container) {
            container.innerHTML = '<div class="col-12"><div class="card"><div class="card-body text-muted">No project data available. Add sources with <code>--hub</code> or <code>--offlinehub</code>.</div></div></div>';
        }
        return;
    }

    create_stat_widgets(hub_projects);
    create_global_trend_chart(hub_projects);
    create_project_bar_chart(hub_projects);
    create_duration_chart(hub_projects);
    create_project_table(hub_projects);
    setup_collapsables();
}

main();
