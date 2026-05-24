import { toggle_theme } from "./hub_theme.js";

const arrowDown = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down-icon lucide-chevron-down"><path d="m6 9 6 6 6-6"/></svg>';
const arrowRight = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-right-icon lucide-chevron-right"><path d="m9 18 6-6-6-6"/></svg>';

function setup_hub_eventlisteners() {
    const themeLight = document.getElementById("themeLight");
    const themeDark = document.getElementById("themeDark");
    if (themeLight) themeLight.addEventListener("click", () => toggle_theme());
    if (themeDark) themeDark.addEventListener("click", () => toggle_theme());
}

function setup_collapsables() {
    document.querySelectorAll(".collapse-icon").forEach(origIcon => {
        const icon = origIcon.cloneNode(true);
        origIcon.replaceWith(icon);
        const sectionId = icon.id.replace("collapse", "");
        const update_icon = () => {
            const section = document.getElementById(sectionId);
            icon.innerHTML = section.hidden ? arrowRight : arrowDown;
        };
        icon.addEventListener("click", () => {
            const section = document.getElementById(sectionId);
            section.hidden = !section.hidden;
            update_icon();
        });
        update_icon();
    });
}

function setup_hub_tabs() {
    const tabOverview = document.getElementById("tabOverview");
    const tabDashboard = document.getElementById("tabDashboard");
    const overviewPage = document.getElementById("hubOverviewPage");
    const dashboardPage = document.getElementById("hubDashboardPage");
    if (!tabOverview || !tabDashboard) return;
    tabOverview.addEventListener("click", (e) => {
        e.preventDefault();
        tabOverview.classList.add("active");
        tabDashboard.classList.remove("active");
        overviewPage.hidden = false;
        dashboardPage.hidden = true;
    });
    tabDashboard.addEventListener("click", (e) => {
        e.preventDefault();
        tabDashboard.classList.add("active");
        tabOverview.classList.remove("active");
        dashboardPage.hidden = false;
        overviewPage.hidden = true;
    });
}

export {
    setup_hub_eventlisteners,
    setup_collapsables,
    setup_hub_tabs,
};
