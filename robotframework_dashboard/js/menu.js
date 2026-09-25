import { setup_filtered_data_and_filters } from "./filter/pipeline.js";
import { clear_overview_project_navigation_filter } from "./filter/controls.js";
import { areGroupedProjectsPrepared, overviewNavStore, tablesNavStore } from "./variables/globals.js";
import { space_to_camelcase, fade_in, fade_out } from "./common.js";
import { set_local_storage_item, setup_overview_localstorage } from "./localstorage.js";
import { create_dashboard_graphs } from "./graph_creation/all.js";
import { settings } from "./variables/settings.js";
import { setup_theme } from "./theme.js";
import { setup_graph_view_buttons } from "./eventlisteners/graph_view_buttons.js";
import { setup_overview_order_filters } from "./eventlisteners/overview_listeners.js";
import { setup_section_order, setup_graph_order, setup_overview_section_layout_buttons } from "./layout.js";
import { setup_information_popups } from "./information.js";
import { prepare_overview, update_overview_prefix_display } from "./graph_creation/overview.js";
import { arrowDown, arrowRight } from "./variables/svg.js";

const PAGE_IDS = ["menuOverview", "menuDashboard", "menuCompare", "menuTables", "openDashboard"];
const PAGES_WITH_SECTIONS = ["menuOverview", "menuDashboard", "menuTables"];

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

function update_menu(item) {
    ["overview", "dashboard", "compare", "tables"].forEach(menuItem => {
        const id = `menu${menuItem.charAt(0).toUpperCase() + menuItem.slice(1)}`;
        set_local_storage_item(`menu.${menuItem}`, (item === id));
        document.getElementById(id).classList.toggle("active", id === item);
    });
    // the overview shows all projects, so a project filter that was applied by clicking an
    // overview card is dropped again when navigating back to it (issue #348)
    if (item === "menuOverview") { clear_overview_project_navigation_filter(); }
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

    // hiding, showing or reordering a table changes what the tables track should hold
    document.addEventListener("layout-user-action", () => setup_tables_section_menu_buttons());
}

// function to update all graph data, function is called when updating filters and when the page loads
function setup_data_and_graphs(menuUpdate = false, prepareOverviewProjectData = false) {
    setup_spinner(false);
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            setup_filtered_data_and_filters();
            if (prepareOverviewProjectData) {
                prepare_overview();
                setup_overview_localstorage();
                setup_overview_section_layout_buttons();
                setup_overview_order_filters();
            }
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
                setup_tables_section_menu_buttons();

                // Always create graphs from scratch because setup_graph_order()
                // rebuilds all GridStack grids and canvas DOM elements above
                create_dashboard_graphs();

                update_overview_prefix_display();

                document.dispatchEvent(new Event("graphs-finalized"));

                if (!menuUpdate) {
                    scroll_to_most_visible_section();
                }
            });
        });
    });
}

// function to add a spinner for slow loads
function setup_spinner(hide) {
    const pages = ["overview", "unified", "dashboard", "compare", "tables"].map(id => document.getElementById(id));
    const loading = document.getElementById("loading");
    if (hide) {
        fade_out(loading);
        pages.forEach(page => fade_in(page));
    } else {
        pages.forEach(page => { page.style.display = "none"; });
        loading.style.display = "";
    }
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
    // an empty track would still draw its pill background, so it goes with its last item
    document.getElementById("dashboardNavTrack").hidden = sectionButtons.every(btn => btn.hidden);

    const sections = Object.keys(sectionMap).map(id => document.getElementById(id));
    function update_active_section() {
        const bestIndex = compute_best_visible_index(sections);
        const bestMatch = sections[bestIndex];
        sectionButtons.forEach(btn => {
            btn.classList.remove("active");
            btn.removeAttribute("aria-current");
        });
        if (bestMatch && sectionMap[bestMatch.id]) {
            sectionMap[bestMatch.id].classList.add("active");
            sectionMap[bestMatch.id].setAttribute("aria-current", "true");
        }
    }

    window.addEventListener("scroll", update_active_section);
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
    const overviewTrack = document.getElementById("overviewNavTrack");
    if (!navbar || !overviewMenuLink || !overviewTrack) return;

    const existingOverviewButtons = Array.from(navbar.querySelectorAll('a[id^="overview-"][id$="Nav"]'));
    if (!isOverviewActive) {
        existingOverviewButtons.forEach(el => el.remove());
        overviewTrack.hidden = true;
        if (overviewNavStore.scrollHandler) {
            window.removeEventListener("scroll", overviewNavStore.scrollHandler);
            overviewNavStore.scrollHandler = null;
        }
        if (overviewNavStore.resizeHandler) {
            window.removeEventListener("resize", overviewNavStore.resizeHandler);
            overviewNavStore.resizeHandler = null;
        }
        return;
    }

    const sections = Array.from(document.querySelectorAll("#overview .overview-bar"))
        .filter(el => el.offsetParent !== null);
    if (sections.length === 0) {
        overviewTrack.hidden = true;
        return;
    }

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
            btn.className = "nav-item nav-link nav-track-item";
            btn.textContent = baseName;
            overviewTrack.appendChild(btn);

            btn.addEventListener("click", (e) => {
                e.preventDefault();
                expand_and_scroll_to(sectionEl);
            });
        }
        buttonMap.set(sectionId, btn);
    };

    sections.forEach(makeButtonForSection);

    // Sections come and go when the overview bar settings change (projects by name, projects by
    // tag), so buttons of sections that no longer exist have to go with them
    Array.from(overviewTrack.children).forEach(btn => {
        const sectionId = btn.id.replace(/^overview-/, "").replace(/Nav$/, "");
        if (!buttonMap.has(sectionId)) btn.remove();
    });

    // Before attaching new listeners, remove any previous ones to avoid stale closures
    if (overviewNavStore.scrollHandler) {
        window.removeEventListener("scroll", overviewNavStore.scrollHandler);
        overviewNavStore.scrollHandler = null;
    }
    if (overviewNavStore.resizeHandler) {
        window.removeEventListener("resize", overviewNavStore.resizeHandler);
        overviewNavStore.resizeHandler = null;
    }

    const updateVisibleButtons = () => {
        // If not on overview anymore, cleanup and stop
        const stillOverview = !!(settings.menu && settings.menu.overview);
        const showButtons = stillOverview;
        if (!stillOverview) {
            const toRemove = Array.from(navbar.querySelectorAll('a[id^="overview-"][id$="Nav"]'));
            toRemove.forEach(el => el.remove());
            overviewTrack.hidden = true;
            if (overviewNavStore.scrollHandler) {
                window.removeEventListener("scroll", overviewNavStore.scrollHandler);
                overviewNavStore.scrollHandler = null;
            }
            if (overviewNavStore.resizeHandler) {
                window.removeEventListener("resize", overviewNavStore.resizeHandler);
                overviewNavStore.resizeHandler = null;
            }
            return;
        }
        sections.forEach(section => {
            const btn = buttonMap.get(section.id);
            if (!btn) return;
            let name = section.id.replace(/Section$/i, "");
            if (!settings.show.prefixes && name.startsWith('project_')) {
                name = name.replace(/^project_/, '');
            }
            btn.textContent = name;
        });
        const bestIndex = compute_best_visible_index(sections);
        const indices = neighbor_indices(bestIndex, sections.length);

        // Reorder the visible buttons (up to 3) so they sit in section order inside the track
        indices.forEach(idx => {
            const btn = buttonMap.get(sections[idx].id);
            if (!btn) return;
            btn.hidden = !showButtons;
            overviewTrack.appendChild(btn);
        });

        sections.forEach((section, idx) => {
            const btn = buttonMap.get(section.id);
            if (!btn) return;
            btn.hidden = !showButtons || !indices.includes(idx);
            const isActive = showButtons && idx === bestIndex;
            btn.classList.toggle("active", isActive);
            if (isActive) {
                btn.setAttribute("aria-current", "true");
            } else {
                btn.removeAttribute("aria-current");
            }
        });
        overviewTrack.hidden = !showButtons || indices.length === 0;
    };

    window.addEventListener("scroll", updateVisibleButtons, { passive: true });
    window.addEventListener("resize", updateVisibleButtons);
    overviewNavStore.scrollHandler = updateVisibleButtons;
    overviewNavStore.resizeHandler = updateVisibleButtons;
    updateVisibleButtons();
}

// function to create and manage the tables page buttons: one per table that is currently
// shown, in the order the user arranged them, highlighting the one that is most visible
function setup_tables_section_menu_buttons() {
    const isTablesActive = !!(settings.menu && settings.menu.tables);
    const navbar = document.querySelector(".navbar-nav");
    const tablesTrack = document.getElementById("tablesNavTrack");
    if (!navbar || !tablesTrack) return;

    const remove_handlers = () => {
        if (tablesNavStore.scrollHandler) {
            window.removeEventListener("scroll", tablesNavStore.scrollHandler);
            tablesNavStore.scrollHandler = null;
        }
        if (tablesNavStore.resizeHandler) {
            window.removeEventListener("resize", tablesNavStore.resizeHandler);
            tablesNavStore.resizeHandler = null;
        }
    };

    if (!isTablesActive) {
        Array.from(navbar.querySelectorAll('a[id^="tables-"][id$="Nav"]')).forEach(el => el.remove());
        tablesTrack.hidden = true;
        remove_handlers();
        return;
    }

    const sections = Array.from(document.querySelectorAll("#tables .table-section"))
        .filter(el => el.offsetParent !== null);
    if (sections.length === 0) {
        tablesTrack.hidden = true;
        remove_handlers();
        return;
    }

    const label_for = (sectionEl) => {
        const heading = sectionEl.querySelector("h6");
        const name = heading
            ? heading.textContent.replace(/\s*Table$/i, "").trim()
            : sectionEl.id.replace(/TableCanvas$/, "");
        return `${name}s`;
    };

    const buttonMap = new Map();
    sections.forEach(sectionEl => {
        const btnId = `tables-${sectionEl.id}Nav`;
        let btn = document.getElementById(btnId);
        if (!btn) {
            btn = document.createElement("a");
            btn.id = btnId;
            btn.className = "nav-item nav-link nav-track-item";
            btn.addEventListener("click", (e) => {
                e.preventDefault();
                expand_and_scroll_to(sectionEl);
            });
        }
        btn.textContent = label_for(sectionEl);
        // re-appending in section order keeps the track following the user's table order
        tablesTrack.appendChild(btn);
        buttonMap.set(sectionEl.id, btn);
    });

    Array.from(tablesTrack.children).forEach(btn => {
        const sectionId = btn.id.replace(/^tables-/, "").replace(/Nav$/, "");
        if (!buttonMap.has(sectionId)) btn.remove();
    });

    remove_handlers();
    const update_active_table = () => {
        if (!(settings.menu && settings.menu.tables)) {
            tablesTrack.hidden = true;
            remove_handlers();
            return;
        }
        const bestIndex = compute_best_visible_index(sections);
        sections.forEach((section, idx) => {
            const btn = buttonMap.get(section.id);
            if (!btn) return;
            const isActive = idx === bestIndex;
            btn.classList.toggle("active", isActive);
            if (isActive) {
                btn.setAttribute("aria-current", "true");
            } else {
                btn.removeAttribute("aria-current");
            }
        });
    };

    window.addEventListener("scroll", update_active_table, { passive: true });
    window.addEventListener("resize", update_active_table);
    tablesNavStore.scrollHandler = update_active_table;
    tablesNavStore.resizeHandler = update_active_table;
    tablesTrack.hidden = false;
    update_active_table();
}

function scroll_to_most_visible_section() {
    setTimeout(() => {
        const mostVisibleSectionId = get_most_visible_section();
        if (mostVisibleSectionId) {
            const offsetTop = document.getElementById(mostVisibleSectionId).getBoundingClientRect().top;
            window.scrollTo({ top: offsetTop - 67, behavior: "auto" });
        }
    }, 100);
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

// Level 1: page-menu items (Overview, Dashboard, …) move into the sidebar
// Level 2: icon items also move into the sidebar
//
function setup_navbar_overflow() {
    const nav = document.getElementById('navigation');
    const mainNavDiv = document.getElementById('mainNavItems');
    const hamburgerBtn = document.getElementById('navHamburger');
    const iconNavUl = document.getElementById('iconNavItems');
    const sidenav = document.getElementById('sidenav');
    const sidenavBody = document.getElementById('sidenavBody');
    const sidenavBackdrop = document.getElementById('sidenavBackdrop');
    const sidenavClose = document.getElementById('sidenavClose');

    // Capture icon <li> references (they move, but references stay valid)
    const iconLiEls = Array.from(iconNavUl.children);
    // the section tracks are not .nav-item themselves, so they are hidden separately
    const trackEls = ['overviewNavTrack', 'dashboardNavTrack', 'tablesNavTrack']
        .map(id => document.getElementById(id))
        .filter(Boolean);

    let navInSidebar = false;
    let iconsInSidebar = false;
    let updating = false;

    function nav_item_els() {
        return Array.from(mainNavDiv.querySelectorAll('.nav-item'))
            .filter(el => el.id !== 'menuCustomTitle');
    }

    function is_overflowing() {
        // Temporarily disable flex-shrink so we can measure natural width
        const saved = mainNavDiv.style.flexShrink;
        mainNavDiv.style.flexShrink = '0';
        const overflows = nav.scrollWidth > nav.clientWidth + 1;
        mainNavDiv.style.flexShrink = saved;
        return overflows;
    }

    function open_sidebar() {
        sidenav.hidden = false;
        sidenavBackdrop.hidden = false;
        void sidenav.offsetHeight; // reflow for CSS transition
        sidenav.classList.add('sidenav-open');
    }

    function close_sidebar() {
        sidenav.classList.remove('sidenav-open');
        sidenavBackdrop.hidden = true;
    }

    hamburgerBtn.addEventListener('click', open_sidebar);
    sidenavClose.addEventListener('click', close_sidebar);
    sidenavBackdrop.addEventListener('click', close_sidebar);

    // Build an ordered list of nav items for the sidebar, matching the
    // actual section order on the page (which can be rearranged by the user).
    function ordered_sidebar_items() {
        const items = [];
        const byId = id => document.getElementById(id);

        const push = (el, forceShow) => {
            if (!el) return;
            const isOverviewSub = el.id && el.id.startsWith('overview-') && el.id.endsWith('Nav');
            if (el.hidden && !isOverviewSub && !forceShow) return;
            items.push(el);
        };

        // Overview
        push(byId('menuOverview'));
        // Overview sub-items in actual DOM section order
        if (settings.menu && settings.menu.overview) {
            const overviewBars = Array.from(document.querySelectorAll('#overview .overview-bar'))
                .filter(el => el.offsetParent !== null || !el.hidden);
            overviewBars.forEach(bar => {
                const btn = byId(`overview-${bar.id}Nav`);
                if (btn) items.push(btn);
            });
        }

        // Dashboard
        push(byId('menuDashboard'));
        // Dashboard sub-items in settings order
        if (settings.menu && settings.menu.dashboard && !settings.show.unified) {
            const dashSections = settings.view.dashboard.sections;
            dashSections.show.forEach(name => {
                const navId = space_to_camelcase(name) + 'SectionNav';
                push(byId(navId));
            });
        }

        // Remaining pages
        push(byId('menuCompare'));
        push(byId('menuTables'));
        // Tables sub-items in actual DOM table order
        if (settings.menu && settings.menu.tables) {
            Array.from(document.querySelectorAll('#tables .table-section'))
                .filter(el => el.offsetParent !== null || !el.hidden)
                .forEach(section => {
                    const btn = byId(`tables-${section.id}Nav`);
                    if (btn) items.push(btn);
                });
        }
        push(byId('openDashboard'));

        return items;
    }

    // Turn the flat, ordered nav item list into one group per page plus its section items
    function grouped_sidebar_items() {
        const groups = [];
        ordered_sidebar_items().forEach(el => {
            if (PAGE_IDS.includes(el.id)) {
                groups.push({ page: el, subItems: [] });
            } else if (groups.length) {
                groups[groups.length - 1].subItems.push(el);
            }
        });
        return groups;
    }

    function build_page_group(group) {
        const wrapper = document.createElement('div');
        wrapper.className = 'sidenav-group';
        const isActivePage = group.page.classList.contains('active');

        const header = document.createElement('div');
        header.className = 'sidenav-group-header' + (isActivePage ? ' active' : '');
        const link = document.createElement('a');
        link.className = 'sidenav-nav-item';
        link.textContent = group.page.textContent;
        if (isActivePage) link.setAttribute('aria-current', 'page');
        link.addEventListener('click', () => {
            group.page.click();
            close_sidebar();
        });
        header.appendChild(link);
        wrapper.appendChild(header);

        if (!PAGES_WITH_SECTIONS.includes(group.page.id)) return wrapper;

        const subGroup = document.createElement('div');
        subGroup.className = 'sidenav-subgroup';
        subGroup.hidden = !isActivePage;
        group.subItems.forEach(el => {
            const item = document.createElement('a');
            item.className = 'sidenav-sub-item';
            if (el.classList.contains('active')) {
                item.classList.add('active');
                item.setAttribute('aria-current', 'true');
            }
            item.textContent = el.textContent;
            item.addEventListener('click', () => {
                el.click();
                close_sidebar();
                subGroup.querySelectorAll('.sidenav-sub-item').forEach(n => {
                    n.classList.remove('active');
                    n.removeAttribute('aria-current');
                });
                item.classList.add('active');
                item.setAttribute('aria-current', 'true');
            });
            subGroup.appendChild(item);
        });
        wrapper.appendChild(subGroup);

        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'sidenav-group-toggle';
        const set_toggle_state = (expanded) => {
            toggle.setAttribute('aria-expanded', String(expanded));
            toggle.setAttribute('aria-label', `${expanded ? 'Collapse' : 'Expand'} ${link.textContent} sections`);
            toggle.innerHTML = expanded ? arrowDown : arrowRight;
        };
        set_toggle_state(isActivePage);
        toggle.addEventListener('click', (event) => {
            event.stopPropagation();
            // section items only exist for the page that is open, so expanding another page's
            // group means going there first - its group is then expanded on the rebuild
            if (!isActivePage) {
                group.page.click();
                close_sidebar();
                return;
            }
            subGroup.hidden = !subGroup.hidden;
            set_toggle_state(!subGroup.hidden);
        });
        header.appendChild(toggle);

        return wrapper;
    }

    function build_sidebar_content() {
        sidenavBody.innerHTML = '';

        if (navInSidebar) {
            const label = document.createElement('div');
            label.className = 'sidenav-section-label';
            label.textContent = 'Pages';
            sidenavBody.appendChild(label);

            grouped_sidebar_items().forEach(group => {
                sidenavBody.appendChild(build_page_group(group));
            });
        }

        if (iconsInSidebar) {
            const label = document.createElement('div');
            label.className = 'sidenav-section-label';
            label.textContent = 'Shortcuts';
            sidenavBody.appendChild(label);

            const row = document.createElement('div');
            row.className = 'sidenav-icon-row';
            iconLiEls.forEach(li => {
                if (li.hidden) return;
                const link = li.querySelector('a');
                if (!link) return;
                const clone = link.cloneNode(true);
                clone.removeAttribute('id');  // prevent duplicate IDs conflicting with theme SVG updates
                clone.addEventListener('click', (e) => {
                    if (link.dataset.bsToggle) {
                        e.preventDefault();
                        close_sidebar();
                        link.click();
                    } else if (!link.getAttribute('target')) {
                        e.preventDefault();
                        close_sidebar();
                        link.click();
                    } else {
                        close_sidebar();
                    }
                });
                row.appendChild(clone);
            });
            sidenavBody.appendChild(row);
        }
    }

    function apply_nav_to_sidebar(on) {
        if (on === navInSidebar) return;
        navInSidebar = on;
        nav_item_els().forEach(el => {
            el.style.display = on ? 'none' : '';
        });
        trackEls.forEach(el => {
            el.style.display = on ? 'none' : '';
        });
    }

    function apply_icons_to_sidebar(on) {
        if (on === iconsInSidebar) return;
        iconsInSidebar = on;
        iconLiEls.forEach(li => {
            li.style.display = on ? 'none' : '';
        });
    }

    function update_overflow() {
        if (updating) return;
        updating = true;

        apply_icons_to_sidebar(false);
        apply_nav_to_sidebar(false);

        const shouldShowHamburger = is_overflowing();

        if (shouldShowHamburger) {
            apply_nav_to_sidebar(true);                        // level 1
            if (is_overflowing()) {
                apply_icons_to_sidebar(true);                  // level 2
            }
        }

        hamburgerBtn.hidden = !navInSidebar && !iconsInSidebar;
        build_sidebar_content();
        updating = false;
    }

    let debounce = null;
    const triggerUpdate = () => {
        clearTimeout(debounce);
        debounce = setTimeout(update_overflow, 40);
    };
    const ro = new ResizeObserver(triggerUpdate);
    ro.observe(nav);

    // Re-check when dynamic nav items are added/removed (e.g. overview sub-items)
    const mo = new MutationObserver(triggerUpdate);
    mo.observe(mainNavDiv, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });

    requestAnimationFrame(update_overflow);
}

export {
    setup_menu,
    setup_data_and_graphs,
    setup_spinner,
    update_menu,
    setup_overview_section_menu_buttons,
    setup_navbar_overflow
};
