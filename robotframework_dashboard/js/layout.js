import { settings } from "./variables/settings.js";
import { set_local_storage_item } from "./localstorage.js";
import { graphMetadata } from "./variables/graphmetadata.js";
import { space_to_camelcase, add_alert } from "./common.js";
import { gridEditMode } from "./variables/globals.js";
import {
    gridUnified,
    gridRun,
    gridSuite,
    gridTest,
    gridKeyword,
    gridCompare
} from "./variables/globals.js"; // they are used in the window[grid] references
import { setup_data_and_graphs } from "./menu.js";

// function to order the sections according to the config
function setup_section_order() {
    // Show unified when dashboard menu is active AND unified mode is on
    document.getElementById("unified").hidden = !(settings.menu.dashboard && settings.show.unified);
    document.getElementById("overview").hidden = !settings.menu.overview;
    document.getElementById("dashboard").hidden = !(settings.menu.dashboard && !settings.show.unified);
    document.getElementById("compare").hidden = !settings.menu.compare;
    document.getElementById("tables").hidden = !settings.menu.tables;
    const order_sections = (sectionsConfig, topAnchorId) => {
        let prevId = `#${topAnchorId}`;
        // Show
        for (const section of sectionsConfig.show) {
            let sectionId;
            if (topAnchorId !== "topOverviewSection") {
                // 1. Keep overview statistics as-is (camel-cased id)
                sectionId = space_to_camelcase(section + "Section");
            } else {
                // 2. For overview non-defaults, use raw id pattern: section+"Section"
                sectionId = section + "Section";
            }
            const sectionEl = document.getElementById(sectionId);
            if (!sectionEl) continue;
            if (topAnchorId === "topDashboardSection") {
                sectionEl.hidden = false;
            }
            $(`#${sectionId}`).insertAfter(prevId);
            prevId = `#${sectionId}`;
        }
        // Hide
        for (const section of sectionsConfig.hide) {
            const sectionId = space_to_camelcase(section + "Section");
            const sectionEl = document.getElementById(sectionId);
            if (!sectionEl) continue;
            if (gridEditMode) {
                sectionEl.hidden = false;
                $(`#${sectionId}`).insertAfter(prevId);
                prevId = `#${sectionId}`;
            } else {
                sectionEl.hidden = true;
            }
        }
    };

    order_sections(settings.view.dashboard.sections, "topDashboardSection");
    order_sections(settings.view.overview.sections, "topOverviewSection");

    // expand only the top section in the overview page
    const overviewBars = document.querySelectorAll("#overview .overview-bar:not([hidden])");
    overviewBars.forEach((bar, i) => {
        const btn = bar.querySelector(".collapse-icon");
        const isExpanded = !!btn.querySelector(".lucide-chevron-down-icon");
        const isCollapsed = !!btn.querySelector(".lucide-chevron-right-icon");
        if (i === 0) {
            if (isCollapsed) {
                btn.click();
            }
            return;
        }
        if (isExpanded) {
            btn.click();
        }
    });

    if (gridEditMode) {
        document.querySelectorAll(".move-up-section").forEach(btn => { btn.hidden = false })
        document.querySelectorAll(".move-down-section").forEach(btn => { btn.hidden = false })
        document.querySelectorAll(".shown-section, .hidden-section").forEach(btn => {
            const prefix = btn.id.slice(0, 3);
            const label = prefix.charAt(0).toUpperCase();
            // Decide context: dashboard or overview based on the containing section/card
            const isOverview = !!btn.closest('#overview');
            const showList = isOverview
                ? settings.view.overview.sections.show
                : settings.view.dashboard.sections.show;

            let shouldShow = showList.some(section => section.startsWith(label));

            if (btn.classList.contains("shown-section")) {
                btn.hidden = !shouldShow;
            } else if (btn.classList.contains("hidden-section")) {
                btn.hidden = shouldShow;
            }
        });
    } else {
        document.querySelectorAll(".move-up-section").forEach(btn => { btn.hidden = true })
        document.querySelectorAll(".move-down-section").forEach(btn => { btn.hidden = true })
        document.querySelectorAll(".shown-section").forEach(btn => { btn.hidden = true })
        document.querySelectorAll(".hidden-section").forEach(btn => { btn.hidden = true })
    }
}

// function to order the grphs according to the localstorage config
function setup_graph_order() {
    setup_grid_graphs("Unified")
    setup_grid_graphs("Run")
    setup_grid_graphs("Suite")
    setup_grid_graphs("Test")
    setup_grid_graphs("Keyword")
    setup_grid_graphs("Compare")
    setup_tables()
}

function setup_grid_graphs(section) {
    const grid = `grid${section}`;
    const gridConfig = {
        cellHeight: 100,
        float: false,
        resizable: { handles: 'all' }
    };

    const initialize_grid = () => {
        const gridElement = document.getElementById(grid);
        return GridStack.init(gridConfig, gridElement);
    };

    if (!window[grid] || typeof window[grid].destroy !== 'function') {
        window[grid] = initialize_grid();
    } else {
        window[grid].destroy();
        const parentElement = document.getElementById(`${section.toLowerCase()}StatisticsSection`);
        parentElement.insertAdjacentHTML('beforeend', `<div class="card-body grid-stack" id="${grid}"></div>`);
        window[grid] = initialize_grid();
    }

    // Disable grid if not in edit mode
    if (!gridEditMode) {
        window[grid].disable();
    }

    // Clear hidden section data
    const sectionDataHidden = document.getElementById(`${section.toLowerCase()}DataHidden`);
    if (sectionDataHidden?.children.length > 0) {
        sectionDataHidden.innerHTML = "";
    }

    // Determine which graphs to show/hide based on mode and section
    const is_unified = settings.show.unified;
    let graph_show = [];
    let graph_hide = [];
    if (section === "Compare") {
        // Compare graphs always render in their own grid
        graph_show = [...settings.view.compare.graphs.show];
        graph_hide = [...settings.view.compare.graphs.hide];
    } else if (is_unified && section === "Unified") {
        // Unified mode: show all dashboard graphs in the unified grid
        graph_show = [...settings.view.unified.graphs.show];
        graph_hide = [...settings.view.unified.graphs.hide];
    } else if (!is_unified && section !== "Unified") {
        // Dashboard mode: show only section-specific graphs in their respective grids
        graph_show = [...settings.view.dashboard.graphs.show];
        graph_hide = [...settings.view.dashboard.graphs.hide];
    } else {
        // Skip processing if unified mode but not unified section, or vice versa
        return;
    }

    const saved_layout = settings.layouts?.[grid] ? JSON.parse(settings.layouts[grid]) : null;
    const default_size = { width: 4, height: 4 };
    const max_columns = 12;
    let current_x = 0;
    let current_y = 0;

    // Helper function to get next position for default layout
    const get_next_position = () => {
        const pos = { x: current_x, y: current_y };
        current_x += default_size.width;
        if (current_x >= max_columns) {
            current_x = 0;
            current_y += default_size.height;
        }
        return pos;
    };

    // Helper function to process graphs with layout
    const process_graphs_with_layout = (graphs, is_visible) => {
        graphs
            .filter(graph => graph.startsWith(section === "Unified" ? "" : section)) // Simple filter: all graphs for unified, section-specific otherwise
            .forEach(graph => {
                const layout = saved_layout?.find(g => g.id === graph);
                if (saved_layout && layout) {
                    add_graph(layout.id, layout.x, layout.y, layout.w, layout.h, is_visible);
                } else {
                    const pos = get_next_position();
                    add_graph(graph, pos.x, pos.y, default_size.width, default_size.height, is_visible);
                }
            });
    };

    // Process graphs based on mode
    if (gridEditMode) {
        process_graphs_with_layout(graph_show, true);
        process_graphs_with_layout(graph_hide, false);
    } else {
        process_graphs_with_layout(graph_show, true);
        graph_hide
            .filter(graph => graph.startsWith(section === "Unified" ? "" : section)) // Same simple filter
            .forEach(graph => add_hidden_graph(graph));
    }

    function add_graph(id, x, y, w, h, shown = true) {
        const item = document.createElement("div");
        item.classList.add("grid-stack-item");
        item.setAttribute("gs-x", x);
        item.setAttribute("gs-y", y);
        item.setAttribute("gs-w", w);
        item.setAttribute("gs-min-w", 3);
        item.setAttribute("gs-max-w", 12);
        item.setAttribute("gs-h", h);
        item.setAttribute("gs-min-h", 3);
        item.setAttribute("gs-max-h", 12);
        item.setAttribute("data-gs-id", id);

        // showGraphHidden, hideGraphHidden
        const graphConfig = graphMetadata.find(g => g.label == id);
        var html = `<div class="grid-stack-item-content">${graphConfig.html}</div>`;
        if (gridEditMode) {
            if (shown) {
                html = html.replace("showGraphHidden", "")
                html = html.replace("hideGraphHidden", "hidden")
            } else {
                html = html.replace("showGraphHidden", "hidden")
                html = html.replace("hideGraphHidden", "")
            }
        } else {
            html = html.replace("showGraphHidden", "hidden")
            html = html.replace("hideGraphHidden", "hidden")
        }
        item.innerHTML = html
        window[grid].makeWidget(item);
        if (settings.show.unified && section === "Unified") {
            document.getElementById(`${graphConfig.key}Title`).innerText = graphConfig.label;
        }
    }

    function add_hidden_graph(id) {
        sectionDataHidden.insertAdjacentHTML("beforeend", graphMetadata.find(g => g.label == id).html);
    }
}

function setup_tables() {
    const tableGrid = document.getElementById("gridTable")
    const tableHidden = document.getElementById("tableDataHidden")
    tableGrid.innerHTML = ''
    tableHidden.innerHTML = ''
    settings.view.tables.graphs.show.forEach(table => {
        var html = graphMetadata.find(g => g.label == table).html
        if (gridEditMode) {
            html = html
                .replace("showGraphHidden", "")
                .replace("hideGraphHidden", "hidden")
                .replace("moveUpHidden", "")
                .replace("moveDownHidden", "")
        } else {
            html = html
                .replace("showGraphHidden", "hidden")
                .replace("hideGraphHidden", "hidden")
                .replace("moveUpHidden", "hidden")
                .replace("moveDownHidden", "hidden")
        }
        tableGrid.insertAdjacentHTML('beforeend', html);
    });
    settings.view.tables.graphs.hide.forEach(table => {
        var html = graphMetadata.find(g => g.label == table).html
        if (gridEditMode) {
            html = html.replace("showGraphHidden", "hidden")
            html = html.replace("hideGraphHidden", "")
            html = html.replace("moveUpHidden", "")
            html = html.replace("moveDownHidden", "")
            tableGrid.insertAdjacentHTML('beforeend', html);
        } else {
            html = html.replace("showGraphHidden", "hidden")
            html = html.replace("hideGraphHidden", "hidden")
            html = html.replace("moveUpHidden", "hidden")
            html = html.replace("moveDownHidden", "hidden")
            tableHidden.insertAdjacentHTML('beforeend', html);
        }
    })
}

function customize_layout() {
    document.getElementById("customizeLayout").hidden = true;
    document.getElementById("saveLayout").hidden = false;
    add_alert("You can now change your layout. Don't forget to save!", "info")
}

function save_layout() {
    document.getElementById("customizeLayout").hidden = false;
    document.getElementById("saveLayout").hidden = true;
    const shownDashboardItems = [];
    const hiddenDashboardItems = [];
    const shownUnifiedItems = [];
    const hiddenUnifiedItems = [];
    const shownCompareItems = [];
    const hiddenCompareItems = [];
    // save dashboard/unified/compare graph layout
    const grids = document.querySelectorAll(".grid-stack");
    grids.forEach(grid => {
        const layout = window[`${grid.id}`].engine.nodes.map(w => {
            const id = w.el?.getAttribute('data-gs-id');
            return {
                x: w.x,
                y: w.y,
                w: w.w,
                h: w.h,
                id
            };
        }).filter(w => w.id);
        if (layout.length > 0) {
            set_local_storage_item(`layouts.${grid.id}`, JSON.stringify(layout));
        }
        const shown = document.querySelectorAll(`#${grid.id} .shown-graph:not([hidden])`);
        const hidden = document.querySelectorAll(`#${grid.id} .hidden-graph:not([hidden])`);
        shown.forEach(btn => {
            if (grid.id.includes("Compare")) {
                shownCompareItems.push(graphMetadata.find(graph => graph.key == btn.id.replace("Shown", "")).label)
            } else if (grid.id.includes("Unified")) {
                shownUnifiedItems.push(graphMetadata.find(graph => graph.key == btn.id.replace("Shown", "")).label)
            } else {
                shownDashboardItems.push(graphMetadata.find(graph => graph.key == btn.id.replace("Shown", "")).label)
            }
        })
        hidden.forEach(btn => {
            if (grid.id.includes("Compare")) {
                hiddenCompareItems.push(graphMetadata.find(graph => graph.key == btn.id.replace("Hidden", "")).label)
            } else if (grid.id.includes("Unified")) {
                hiddenUnifiedItems.push(graphMetadata.find(graph => graph.key == btn.id.replace("Hidden", "")).label)
            } else {
                hiddenDashboardItems.push(graphMetadata.find(graph => graph.key == btn.id.replace("Hidden", "")).label)
            }
        })
        if (shownDashboardItems.length + hiddenDashboardItems.length > 0) {
            set_local_storage_item("view.dashboard.graphs.show", shownDashboardItems)
            set_local_storage_item("view.dashboard.graphs.hide", hiddenDashboardItems)
        }
        if (shownUnifiedItems.length + hiddenUnifiedItems.length > 0) {
            set_local_storage_item("view.unified.graphs.show", shownUnifiedItems)
            set_local_storage_item("view.unified.graphs.hide", hiddenUnifiedItems)
        }
        if (shownCompareItems.length + hiddenCompareItems.length > 0) {
            set_local_storage_item("view.compare.graphs.show", shownCompareItems)
            set_local_storage_item("view.compare.graphs.hide", hiddenCompareItems)
        }
    });
    // save table section layout
    const shownTables = [...document.querySelectorAll("#gridTable .shown-graph:not([hidden])")]
        .map(el => {
            const key = el.id.replace("Shown", "");
            return graphMetadata.find(graph => graph.key === key)?.label;
        });

    const hiddenTables = [...document.querySelectorAll("#gridTable .hidden-graph:not([hidden])")]
        .map(el => {
            const key = el.id.replace("Hidden", "");
            return graphMetadata.find(graph => graph.key === key)?.label;
        });
    if (shownTables.length + hiddenTables.length > 0) {
        set_local_storage_item("view.tables.graphs.show", shownTables)
        set_local_storage_item("view.tables.graphs.hide", hiddenTables)
    }
    // save dashboard section layout
    const shownDashboardSections = [...document.querySelectorAll("#dashboard .shown-section:not([hidden])")]
        .map(el => {
            var key = el.id.replace("SectionShown", "");
            key = String(key).charAt(0).toUpperCase() + String(key).slice(1);
            return `${key} Statistics`
        });
    const hiddenDashboardSections = [...document.querySelectorAll("#dashboard .hidden-section:not([hidden])")]
        .map(el => {
            var key = el.id.replace("SectionHidden", "");
            key = String(key).charAt(0).toUpperCase() + String(key).slice(1);
            return `${key} Statistics`
        });
    if (shownDashboardSections.length + hiddenDashboardSections.length > 0) {
        set_local_storage_item("view.dashboard.sections.show", shownDashboardSections)
        set_local_storage_item("view.dashboard.sections.hide", hiddenDashboardSections)
    }
    // save overview section layout always shown
    const shownOverviewSections = [...document.querySelectorAll("#overview .move-up-section")]
        .map(el => {
            if (el.id === "overviewSectionMoveUp") {
                return "Overview Statistics"
            }
            return el.id.replace("SectionMoveUp", "");
        });
    if (shownOverviewSections.length > 0) {
        set_local_storage_item("view.overview.sections.show", shownOverviewSections)
    }

    add_alert("Layout has been updated and saved to settings in local storage!", "success")
}

function setup_edit_mode_icons(hidden) {
    document.querySelectorAll(".bar-graph").forEach(btn => btn.hidden = hidden)
    document.querySelectorAll(".line-graph").forEach(btn => btn.hidden = hidden)
    document.querySelectorAll(".timeline-graph").forEach(btn => btn.hidden = hidden)
    document.querySelectorAll(".radar-graph").forEach(btn => btn.hidden = hidden)
    document.querySelectorAll(".pie-graph").forEach(btn => btn.hidden = hidden)
    document.querySelectorAll(".percentage-graph").forEach(btn => btn.hidden = hidden)
    document.querySelectorAll(".stats-graph").forEach(btn => btn.hidden = hidden)
    document.querySelectorAll(".boxplot-graph").forEach(btn => btn.hidden = hidden)
    document.querySelectorAll(".heatmap-graph").forEach(btn => btn.hidden = hidden)
    document.querySelectorAll(".fullscreen-graph").forEach(btn => btn.hidden = hidden)
    if (hidden) {
        document.querySelector('.navbar-nav').classList.add('navbar-disabled');
        document.querySelectorAll('.navbar-disabled').forEach(el => {
            el.classList.add("information")
            el.setAttribute("data-title", "Save your layout changes first! (Save Icon)");
        });
    } else {
        document.querySelectorAll('.navbar-disabled').forEach(el => {
            el.classList.remove("information")
            el.removeAttribute("data-title")
        });
        document.querySelector('.navbar-nav').classList.remove('navbar-disabled');
    }
}

// Reusable handler to wire show/hide and move controls within a container
function attach_section_order_buttons(containerId) {
    const root = `#${containerId}`;
    // Toggle shown/hidden buttons
    document.querySelectorAll(`${root} .shown-section`).forEach(btn => {
        btn.addEventListener("click", () => {
            btn.hidden = true;
            const target = document.getElementById(`${btn.id.replace("Shown", "Hidden")}`);
            if (target) target.hidden = false;
        });
    });
    document.querySelectorAll(`${root} .hidden-section`).forEach(btn => {
        btn.addEventListener("click", () => {
            btn.hidden = true;
            const target = document.getElementById(`${btn.id.replace("Hidden", "Shown")}`);
            if (target) target.hidden = false;
        });
    });
    // Move cards up/down within the container
    document.querySelectorAll(`${root} .move-up-section`).forEach(btn => {
        btn.addEventListener("click", () => {
            const card = btn.closest(".card");
            const previousCard = card?.previousElementSibling;
            if (previousCard && !previousCard.hidden && previousCard.classList.contains("card")) {
                card.parentNode.insertBefore(card, previousCard);
            }
        });
    });
    document.querySelectorAll(`${root} .move-down-section`).forEach(btn => {
        btn.addEventListener("click", () => {
            const card = btn.closest(".card");
            const nextCard = card?.nextElementSibling;
            if (nextCard && !nextCard.hidden && nextCard.classList.contains("card")) {
                card.parentNode.insertBefore(nextCard, card);
            }
        });
    });
}

// function to add the layout eventlisteners
function setup_dashboard_section_layout_buttons() {
    document.addEventListener("graphs-finalized", () => {
        if (gridEditMode) {
            setup_edit_mode_icons(true);
        } else {
            setup_edit_mode_icons(false);
        }
    });
    document.getElementById("customizeLayout").addEventListener("click", (e) => {
        gridEditMode = !gridEditMode;
        customize_layout();
        setup_data_and_graphs();
    });
    document.getElementById("saveLayout").addEventListener("click", (e) => {
        gridEditMode = !gridEditMode;
        save_layout()
        setup_data_and_graphs();
    });
    attach_section_order_buttons("dashboard");
}

// function to separately add the eventlisteners for overview section layout buttons
// this happens on first render of overview section only
function setup_overview_section_layout_buttons() {
    attach_section_order_buttons("overview");
}

export {
    setup_section_order,
    setup_graph_order,
    setup_tables,
    setup_dashboard_section_layout_buttons,
    setup_overview_section_layout_buttons,
};