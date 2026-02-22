import { setup_filtered_data_and_filters, update_overview_version_select_list } from "./filter.js";
import { areGroupedProjectsPrepared } from "./variables/globals.js";
import { space_to_camelcase } from "./common.js";
import { set_local_storage_item, setup_overview_localstorage } from "./localstorage.js";
import { create_dashboard_graphs } from "./graph_creation/all.js";
import { settings } from "./variables/settings.js";
import { setup_theme } from "./theme.js";
import { setup_graph_view_buttons, setup_overview_order_filters } from "./eventlisteners.js";
import { setup_section_order, setup_graph_order, setup_overview_section_layout_buttons } from "./layout.js";
import { setup_information_popups } from "./information.js";
import { prepare_overview, update_overview_prefix_display } from "./graph_creation/overview.js";

// Track overview nav listeners so we can cleanly remove them when leaving Overview
let __overviewNavStore = {
    scrollHandler: null,
    resizeHandler: null,
};

// ---- Shared helpers for menu buttons ----
function get_sticky_height() {
    const stickyTop = document.getElementById("navigation");
    return stickyTop ? stickyTop.offsetHeight : 0;
}

function expand_and_scroll_to(targetEl) {
    const stickyHeight = get_sticky_height();
    const performScroll = () => {
        const targetTop = targetEl.getBoundingClientRect().top + window.pageYOffset;
        const top = targetTop < 200 ? 0 : targetTop - stickyHeight - 8;
        window.scrollTo({ top: top - 7, behavior: "auto" });
    };
    const collapseBtn = targetEl.querySelector(".collapse-icon");
    if (collapseBtn) {
        const svg = collapseBtn.querySelector("svg");
        const isExpanded = svg && (svg.classList.contains("lucide-chevron-down-icon") || svg.classList.contains("lucide-chevron-down"));
        if (!isExpanded) {
            collapseBtn.click();
            requestAnimationFrame(() => setTimeout(performScroll, 50));
            return;
        }
    }
    performScroll();
}

function compute_best_visible_index(sections) {
    const viewportHeight = window.innerHeight;
    const viewportTop = viewportHeight * 0.2;
    const viewportBottom = viewportHeight * 0.5;
    let bestIndex = 0;
    let bestAmount = -Infinity;
    sections.forEach((section, idx) => {
        const rect = section.getBoundingClientRect();
        const top = Math.max(rect.top, viewportTop);
        const bottom = Math.min(rect.bottom, viewportBottom);
        const overlap = bottom - top;
        if (overlap > bestAmount) {
            bestAmount = overlap;
            bestIndex = idx;
        }
    });
    return bestIndex;
}

function neighbor_indices(bestIndex, length) {
    const indices = [];
    const pushIfValid = (i) => { if (i >= 0 && i < length) indices.push(i); };
    if (bestIndex <= 0) {
        pushIfValid(0); pushIfValid(1); pushIfValid(2);
    } else if (bestIndex >= length - 1) {
        pushIfValid(length - 3);
        pushIfValid(length - 2);
        pushIfValid(length - 1);
    } else {
        pushIfValid(bestIndex - 1);
        pushIfValid(bestIndex);
        pushIfValid(bestIndex + 1);
    }
    return indices;
}

// function to update the section (menu) buttons with the correct eventlisteners
// also sets up the automatic highlighting of the section that is most visible in the top
// 20-50% percent of the screen
function setup_dashboard_section_menu_buttons() {
    const sectionButtons = [
        document.getElementById("runStatisticsSectionNav"),
        document.getElementById("suiteStatisticsSectionNav"),
        document.getElementById("testStatisticsSectionNav"),
        document.getElementById("keywordStatisticsSectionNav"),
    ];
    const sectionMap = {
        runStatisticsSection: sectionButtons[0],
        suiteStatisticsSection: sectionButtons[1],
        testStatisticsSection: sectionButtons[2],
        keywordStatisticsSection: sectionButtons[3],
    };

    if (settings.menu.dashboard && !settings.show.unified) {
        sectionButtons.forEach(btn => btn.hidden = false);
        sectionButtons.forEach(btn => btn.classList.remove('active'));
        settings.view.dashboard.sections.hide.forEach(hiddenSection => sectionMap[`${space_to_camelcase(hiddenSection)}Section`].hidden = true) // hide section menu buttons that should be hidden
    } else {
        sectionButtons.forEach(btn => btn.hidden = true);
    }

    const sections = Object.keys(sectionMap).map(id => document.getElementById(id));
    function update_active_section() {
        const bestIndex = compute_best_visible_index(sections);
        const bestMatch = sections[bestIndex];
        // Highlight the matching button
        sectionButtons.forEach(btn => btn.classList.remove("active"));
        if (bestMatch && sectionMap[bestMatch.id]) {
            sectionMap[bestMatch.id].classList.add("active");
        }
    }

    window.addEventListener("scroll", update_active_section);
    // Initial call to set active on load
    update_active_section();

    sectionButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const target = document.getElementById(btn.id.slice(0, -3));
            if (target) {
                expand_and_scroll_to(target);
            }
        });
    });
}

// function to create and manage overview section buttons that highlight dynamically
// Shows at most 3 buttons: the most visible section in the 20%-50% viewport band
// plus one above and one below it. At edges, show first or last 3 accordingly.
function setup_overview_section_menu_buttons() {
    // Only render when Overview menu is active; otherwise remove any existing dynamic buttons
    const isOverviewActive = !!(settings.menu && settings.menu.overview);
    const navbar = document.querySelector(".navbar-nav");
    const overviewMenuLink = document.getElementById("menuOverview");
    if (!navbar || !overviewMenuLink) return;

    // Cleanup any previously created overview dynamic buttons
    const existingOverviewButtons = Array.from(navbar.querySelectorAll('a[id^="overview-"][id$="Nav"]'));
    if (!isOverviewActive) {
        existingOverviewButtons.forEach(el => el.remove());
        // Detach listeners if still attached
        if (__overviewNavStore.scrollHandler) {
            window.removeEventListener("scroll", __overviewNavStore.scrollHandler);
            __overviewNavStore.scrollHandler = null;
        }
        if (__overviewNavStore.resizeHandler) {
            window.removeEventListener("resize", __overviewNavStore.resizeHandler);
            __overviewNavStore.resizeHandler = null;
        }
        return;
    }

    const sections = Array.from(document.querySelectorAll("#overview .overview-bar"))
        .filter(el => el.offsetParent !== null);
    if (sections.length === 0) return;

    // Helper to insert after Overview menu item
    const insertAfter = (newNode, referenceNode) => {
        if (referenceNode.nextSibling) {
            referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
        } else {
            referenceNode.parentNode.appendChild(newNode);
        }
    };

    // Build a map of sectionId -> button (anchor) in navbar
    const buttonMap = new Map();
    const makeButtonForSection = (sectionEl) => {
        const sectionId = sectionEl.id || "";
        let baseName = sectionId.replace(/Section$/i, "");
        // Apply prefix display setting to tagged sections
        if (!settings.show.prefixes && baseName.startsWith('project_')) {
            baseName = baseName.replace(/^project_/, '');
        }
        const btnId = `overview-${sectionId}Nav`;
        let btn = document.getElementById(btnId);
        if (!btn) {
            btn = document.createElement("a");
            btn.id = btnId;
            btn.className = "nav-item nav-link";
            const label = document.createElement("i");
            label.textContent = baseName;
            btn.appendChild(label);
            insertAfter(btn, overviewMenuLink);

            btn.addEventListener("click", (e) => {
                e.preventDefault();
                const stickyTop = document.getElementById("navigation");
                const stickyHeight = stickyTop ? stickyTop.offsetHeight : 0;

                const performScroll = () => {
                    const targetTop = sectionEl.getBoundingClientRect().top + window.pageYOffset;
                    const top = targetTop < 200 ? 0 : targetTop - stickyHeight - 8;
                    window.scrollTo({ top: top - 7, behavior: "auto" });
                };

                // Expand the section if it is currently collapsed, then scroll
                const collapseBtn = sectionEl.querySelector(".collapse-icon");
                if (collapseBtn) {
                    const svg = collapseBtn.querySelector("svg");
                    const isExpanded = svg && (svg.classList.contains("lucide-chevron-down-icon") || svg.classList.contains("lucide-chevron-down"));
                    if (!isExpanded) {
                        // Trigger expansion and wait a tick for layout update
                        collapseBtn.click();
                        requestAnimationFrame(() => setTimeout(performScroll, 50));
                        return;
                    }
                }
                performScroll();
            });
        }
        buttonMap.set(sectionId, btn);
    };

    sections.forEach(makeButtonForSection);

    // Before attaching new listeners, remove any previous ones to avoid stale closures
    if (__overviewNavStore.scrollHandler) {
        window.removeEventListener("scroll", __overviewNavStore.scrollHandler);
        __overviewNavStore.scrollHandler = null;
    }
    if (__overviewNavStore.resizeHandler) {
        window.removeEventListener("resize", __overviewNavStore.resizeHandler);
        __overviewNavStore.resizeHandler = null;
    }

    const updateVisibleButtons = () => {
        // If not on overview anymore, cleanup and stop
        const stillOverview = !!(settings.menu && settings.menu.overview);
        const showButtons = stillOverview;
        if (!stillOverview) {
            const toRemove = Array.from(navbar.querySelectorAll('a[id^="overview-"][id$="Nav"]'));
            toRemove.forEach(el => el.remove());
            if (__overviewNavStore.scrollHandler) {
                window.removeEventListener("scroll", __overviewNavStore.scrollHandler);
                __overviewNavStore.scrollHandler = null;
            }
            if (__overviewNavStore.resizeHandler) {
                window.removeEventListener("resize", __overviewNavStore.resizeHandler);
                __overviewNavStore.resizeHandler = null;
            }
            return;
        }
        // Refresh labels to reflect current prefix setting
        sections.forEach(section => {
            const btn = buttonMap.get(section.id);
            if (!btn) return;
            let name = section.id.replace(/Section$/i, "");
            if (!settings.show.prefixes && name.startsWith('project_')) {
                name = name.replace(/^project_/, '');
            }
            const label = btn.querySelector('i');
        });
        // Determine most visible section and neighboring indices
        const bestIndex = compute_best_visible_index(sections);
        const indices = neighbor_indices(bestIndex, sections.length);

        // Desired left-to-right order: highest (above) on the left, then current, then below
        const desiredOrder = indices.slice(); // already in [best-1, best, best+1] or edges

        // Reorder buttons in the navbar immediately after the Overview link
        let last = overviewMenuLink;
        desiredOrder.forEach(idx => {
            const section = sections[idx];
            const btn = buttonMap.get(section.id);
            if (!btn) return;
            // Ensure visibility before positioning
            btn.hidden = !showButtons ? true : false;
            // Move button to desired position
            if (last.nextSibling === btn) {
                // Already in place
            } else {
                insertAfter(btn, last);
            }
            last = btn;
        });

        // Update active state and hide non-selected buttons
        sections.forEach((section, idx) => {
            const btn = buttonMap.get(section.id);
            if (!btn) return;
            const shouldShow = showButtons && desiredOrder.includes(idx);
            btn.hidden = !shouldShow;
            btn.classList.toggle("active", showButtons && idx === bestIndex);
        });
    };

    window.addEventListener("scroll", updateVisibleButtons, { passive: true });
    window.addEventListener("resize", updateVisibleButtons);
    __overviewNavStore.scrollHandler = updateVisibleButtons;
    __overviewNavStore.resizeHandler = updateVisibleButtons;
    updateVisibleButtons();
}

function get_most_visible_section() {
    const SECTION_IDS = [
        "overviewStatisticsSection",
        "runStatisticsSection",
        "suiteStatisticsSection",
        "testStatisticsSection",
        "keywordStatisticsSection",
        "compareStatisticsSection",
        "runTableCanvas",
        "suiteTableCanvas",
        "testTableCanvas",
        "keywordTableCanvas"
    ];
    const viewportTop = window.scrollY;
    const focusTop = viewportTop + window.innerHeight * 0.2;
    const focusBottom = viewportTop + window.innerHeight * 0.5;

    let bestMatchId = null;
    let maxVisibleArea = 0;

    SECTION_IDS.forEach(id => {
        const el = document.getElementById(id);
        if (!el || el.offsetParent === null) return; // skip hidden elements

        const rect = el.getBoundingClientRect();
        const elTop = rect.top + window.scrollY;
        const elBottom = elTop + rect.height;

        const visibleTop = Math.max(elTop, focusTop);
        const visibleBottom = Math.min(elBottom, focusBottom);

        const visibleHeight = visibleBottom - visibleTop;
        if (visibleHeight > maxVisibleArea) {
            maxVisibleArea = visibleHeight;
            bestMatchId = id;
        }
    });
    return bestMatchId;
}

function update_menu(item) {
    ["overview", "dashboard", "compare", "tables"].forEach(menuItem => {
        set_local_storage_item(`menu.${menuItem}`, (item === `menu${menuItem.charAt(0).toUpperCase() + menuItem.slice(1)}`));
    });
    ["menuOverview", "menuDashboard", "menuCompare", "menuTables"].forEach(id => {
        document.getElementById(id).classList.toggle("active", id === item);
    });
    document.getElementById("filters").hidden = (item === "menuOverview");
    setup_data_and_graphs(true, item === "menuOverview" && !areGroupedProjectsPrepared);
}

// function to setup the menu eventlisteners
function setup_menu() {
    document.getElementById("menuOverview").addEventListener("click", () => update_menu("menuOverview"));
    document.getElementById("menuDashboard").addEventListener("click", () => update_menu("menuDashboard"));
    document.getElementById("menuCompare").addEventListener("click", () => update_menu("menuCompare"));
    document.getElementById("menuTables").addEventListener("click", () => update_menu("menuTables"));

    const params = new URLSearchParams(window.location.search);
    const pageParam = params.get("page");
    let selectedMenu;

    if (pageParam) {
        switch (pageParam.toLowerCase()) {
            case "overview":
                selectedMenu = "menuOverview";
                break;
            case "dashboard":
                selectedMenu = "menuDashboard";
                break;
            case "compare":
                selectedMenu = "menuCompare";
                break;
            case "tables":
                selectedMenu = "menuTables";
                break;
        }
        if (selectedMenu) {
            settings.menu = {
                overview: selectedMenu === "menuOverview",
                dashboard: selectedMenu === "menuDashboard",
                compare: selectedMenu === "menuCompare",
                tables: selectedMenu === "menuTables",
            };
        }
    }

    // Priority 2: fall back to settings if no valid URL param
    if (!selectedMenu) {
        const menuSettings = settings.menu;
        if (menuSettings.overview) selectedMenu = "menuOverview";
        else if (menuSettings.dashboard) selectedMenu = "menuDashboard";
        else if (menuSettings.compare) selectedMenu = "menuCompare";
        else if (menuSettings.tables) selectedMenu = "menuTables";
    }
    update_menu(selectedMenu);
}

// function to update all graph data, function is called when updating filters and when the page loads
function setup_data_and_graphs(menuUpdate = false, prepareOverviewProjectData = false) {
    setup_spinner(false); // show spinner immediately
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            if (prepareOverviewProjectData) {
                prepare_overview();
                setup_overview_localstorage();
                setup_overview_section_layout_buttons();
                setup_overview_order_filters();
                update_overview_version_select_list();
            }
            setup_filtered_data_and_filters();
            setup_section_order();
            setup_graph_order();
            setup_information_popups();
            setup_graph_view_buttons();
            setup_theme();

            // let the page sections and events be setup before removing the spinner
            // then load the graphs
            requestAnimationFrame(() => {
                setup_spinner(true);
                setup_dashboard_section_menu_buttons();
                setup_overview_section_menu_buttons();

                // Always create graphs from scratch because setup_graph_order()
                // rebuilds all GridStack grids and canvas DOM elements above
                create_dashboard_graphs();

                // Ensure overview titles reflect current prefix setting
                update_overview_prefix_display();

                document.dispatchEvent(new Event("graphs-finalized"));

                if (!menuUpdate) {
                    setTimeout(() => {
                        const mostVisibleSectionId = get_most_visible_section();
                        if (mostVisibleSectionId) {
                            const offsetTop = document.getElementById(mostVisibleSectionId).getBoundingClientRect().top;
                            window.scrollTo({
                                top: offsetTop - 67,
                                behavior: "auto"
                            });
                        }
                    }, 100);
                }
            });
        });
    });
}

// function to add a spinner for slow loads
function setup_spinner(hide) {
    if (hide) {
        // Instant transition - hide spinner and show all content immediately
        $("#loading").fadeOut(200);
        $("#overview").fadeIn(200);
        $("#unified").fadeIn(200);
        $("#dashboard").fadeIn(200);
        $("#compare").fadeIn(200);
        $("#tables").fadeIn(200);
    } else {
        $("#overview").hide()
        $("#unified").hide()
        $("#dashboard").hide()
        $("#compare").hide()
        $("#tables").hide()
        $("#loading").show();
    }
}

export {
    setup_menu,
    setup_data_and_graphs,
    setup_spinner,
    update_menu,
    setup_overview_section_menu_buttons
};