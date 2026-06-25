import { settings } from './variables/settings.js';
import { set_local_storage_item } from './localstorage.js';
import { setup_data_and_graphs } from './menu.js';
import { apply_widget_control_icons } from './theme.js';
import { format_duration, generate_id, apply_bg_class, fill_color_picker, build_move_controls_html } from './common.js';
import {
    filteredRuns,
    filteredSuites,
    filteredTests,
    filteredKeywords,
} from './variables/globals.js';
import {
    get_stats_data,
    get_suite_stats_data,
    get_test_stats_data,
    get_keyword_stats_data,
} from './graph_data/stats.js';
import { STAT_WIDGET_DEFS, STAT_WIDGET_COLORS, STAT_WIDGET_BG_COLORS, TIME_PROPS } from './variables/statwidgetdefs.js';

// Computes the display value for a given statKey (e.g. "run.totalRuns")
function get_stat_value(statKey) {
    const dot = statKey.indexOf('.');
    const scope = statKey.slice(0, dot);
    const prop  = statKey.slice(dot + 1);
    let data;
    if (scope === 'run') {
        data = get_stats_data(filteredRuns, filteredSuites, filteredTests, filteredKeywords);
    } else if (scope === 'suite') {
        data = get_suite_stats_data(filteredSuites);
    } else if (scope === 'test') {
        data = get_test_stats_data(filteredTests);
    } else if (scope === 'keyword') {
        data = get_keyword_stats_data(filteredKeywords);
    }
    if (!data) return '—';
    const val = data[prop];
    if (val === undefined || val === null) return '—';
    if (TIME_PROPS.has(prop)) return format_duration(val);
    return val;
}

// Builds the inner HTML for one custom stat widget card slot
function build_widget_html(widget, editMode) {
    const deleteBtn = editMode
        ? `<a class="delete-custom-stat-widget information" role="button" aria-label="Remove widget" data-title="Remove widget" data-widget-id="${widget.id}"></a>`
        : '';
    const moveBtns = editMode ? build_move_controls_html(deleteBtn) : '';
    return `<div class="stat-widget-inner">
                ${moveBtns}
                <h6 class="stat-widget-title" id="customStatWidget-${widget.id}-title">${widget.title}</h6>
                <div class="stat-value ${widget.color}" id="customStatWidget-${widget.id}-value"></div>
            </div>`;
}

// Adds all custom stat widgets that belong to sectionKey (lowercase, e.g. "run") to the provided GridStack
function render_custom_stat_widgets(gridStack, sectionKey, editMode) {
    const capSection = sectionKey.charAt(0).toUpperCase() + sectionKey.slice(1);
    const gridId     = `grid${capSection}`;
    const savedLayout = settings.layouts?.[gridId]
        ? JSON.parse(settings.layouts[gridId])
        : null;

    const widgets = (settings.statWidgets || []).filter(w => w.section === sectionKey);
    for (const widget of widgets) {
        const saved = savedLayout?.find(l => l.id === `customStatWidget-${widget.id}`);

        const item = document.createElement('div');
        item.classList.add('grid-stack-item');
        item.setAttribute('gs-w',     saved ? saved.w : 2);
        item.setAttribute('gs-h',     saved ? saved.h : 2);
        if (saved) {
            item.setAttribute('gs-x', saved.x);
            item.setAttribute('gs-y', saved.y);
        }
        item.setAttribute('gs-min-w', 1);
        item.setAttribute('gs-min-h', 1);
        item.setAttribute('gs-max-w', 12);
        item.setAttribute('gs-max-h', 12);
        item.setAttribute('data-gs-id', `customStatWidget-${widget.id}`);
        item.innerHTML = `<div class="grid-stack-item-content">${build_widget_html(widget, editMode)}</div>`;
        gridStack.makeWidget(item);
        apply_bg_class(item, widget.bgColor);
    }
    update_values_for_section(sectionKey);
}

// Updates the displayed values of all rendered custom stat widgets for one section
function update_values_for_section(sectionKey) {
    const widgets = (settings.statWidgets || []).filter(w => w.section === sectionKey);
    for (const widget of widgets) {
        const el = document.getElementById(`customStatWidget-${widget.id}-value`);
        if (el) el.innerText = get_stat_value(widget.statKey);
    }
}

// Updates the displayed values of ALL rendered custom stat widgets (all sections)
function update_custom_stat_widgets() {
    for (const section of ['run', 'suite', 'test', 'keyword', 'unified']) {
        update_values_for_section(section);
    }
}

// Saves a new custom stat widget to localStorage and returns it
function add_custom_stat_widget(section, statKey, title, color, bgColor) {
    const id     = generate_id();
    const widget = { id, section, statKey, title, color, bgColor };
    const list   = settings.statWidgets ? [...settings.statWidgets] : [];
    list.push(widget);
    set_local_storage_item('statWidgets', list);
    return widget;
}

// Removes a custom stat widget from localStorage by its id
function remove_custom_stat_widget(id) {
    const list = (settings.statWidgets || []).filter(w => w.id !== id);
    set_local_storage_item('statWidgets', list);
}

// Populates the stat dropdown in the Add Stat Widget modal with optgroups per section
function populate_stat_widget_select() {
    const select = document.getElementById('addStatWidgetStat');
    if (!select) return;
    select.innerHTML = '';
    const sections = ['Run', 'Suite', 'Test', 'Keyword'];
    for (const section of sections) {
        const group = document.createElement('optgroup');
        group.label = section;
        for (const def of STAT_WIDGET_DEFS.filter(d => d.section === section)) {
            const opt = document.createElement('option');
            opt.value           = def.key;
            opt.textContent     = def.label;
            opt.dataset.section = section.toLowerCase();
            group.appendChild(opt);
        }
        select.appendChild(group);
    }
}

// Populates the text color picker buttons in the Add Stat Widget modal
function populate_stat_widget_colors() {
    const picker = document.getElementById('addStatWidgetColorPicker');
    if (!picker) return;
    fill_color_picker(picker, STAT_WIDGET_COLORS, 'white-text');
}

// Populates the background color picker buttons in the Add Stat Widget modal
function populate_stat_widget_bg_colors() {
    const picker = document.getElementById('addStatWidgetBgColorPicker');
    if (!picker) return;
    fill_color_picker(picker, STAT_WIDGET_BG_COLORS, '');
}

// Pre-selects a stat by section key (lowercase) and updates title / color accordingly
function preselectStatSection(sectionKey) {
    const select = document.getElementById('addStatWidgetStat');
    if (!select) return;
    // For 'unified', no options have data-section="unified", so fall back to the first available option
    const opt = select.querySelector(`option[data-section="${sectionKey}"]`) || select.options[0];
    if (opt) {
        select.value = opt.value;
        sync_modal_defaults_from_stat(opt);
    }
}

// Reads the selected option and updates the title default only (color is not auto-changed)
function sync_modal_defaults_from_stat(opt) {
    const titleEl = document.getElementById('addStatWidgetTitle');
    if (titleEl && !titleEl.dataset.userEdited) titleEl.value = opt.textContent;
}

// Returns all stat widget definitions available for the given section ("run"/"suite"/"test"/"keyword"/"unified")
function get_all_stat_defs(sectionKey) {
    return sectionKey === 'unified'
        ? STAT_WIDGET_DEFS
        : STAT_WIDGET_DEFS.filter(d => d.section.toLowerCase() === sectionKey);
}

// Populates the "All" tab list with one toggle + title input row per available stat for the given section
function populate_all_widgets_list(sectionKey) {
    const container = document.getElementById('addAllWidgetsList');
    if (!container) return;
    container.innerHTML = '';

    const existingKeys = new Set((settings.statWidgets || []).filter(w => w.section === sectionKey).map(w => w.statKey));
    const defs = get_all_stat_defs(sectionKey);

    let currentGroup = null;
    for (const def of defs) {
        if (sectionKey === 'unified' && def.section !== currentGroup) {
            currentGroup = def.section;
            const heading = document.createElement('div');
            heading.className = 'add-all-widgets-group-heading';
            heading.textContent = currentGroup;
            container.appendChild(heading);
        }

        const row = document.createElement('div');
        row.classList.add('add-all-widgets-row');

        const switchWrapper = document.createElement('div');
        switchWrapper.classList.add('form-check', 'form-switch');
        const toggle = document.createElement('input');
        toggle.classList.add('form-check-input', 'add-all-widgets-toggle');
        toggle.type = 'checkbox';
        toggle.role = 'switch';
        toggle.id = `addAllWidgetsToggle-${def.key}`;
        toggle.dataset.statKey = def.key;
        toggle.checked = true;
        switchWrapper.appendChild(toggle);

        const titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.classList.add('form-control', 'form-control-sm', 'add-all-widgets-title');
        titleInput.id = `addAllWidgetsTitle-${def.key}`;
        titleInput.maxLength = 40;
        titleInput.value = def.label;

        row.appendChild(switchWrapper);
        row.appendChild(titleInput);

        if (existingKeys.has(def.key)) {
            const badge = document.createElement('span');
            badge.classList.add('badge', 'bg-secondary', 'add-all-widgets-badge');
            badge.textContent = 'Added';
            row.appendChild(badge);
        }

        container.appendChild(row);
    }

    const toggleAll = document.getElementById('addAllWidgetsToggleAll');
    if (toggleAll) toggleAll.checked = true;
}

// Adds a stat widget for every toggled-on row in the "All" tab list
function add_selected_stat_widgets(sectionKey, randomColors, color, bgColor) {
    const container = document.getElementById('addAllWidgetsList');
    if (!container) return 0;

    const list = settings.statWidgets ? [...settings.statWidgets] : [];
    let added = 0;
    container.querySelectorAll('.add-all-widgets-toggle:checked').forEach(toggle => {
        const statKey = toggle.dataset.statKey;
        const def = STAT_WIDGET_DEFS.find(d => d.key === statKey);
        if (!def) return;

        const titleInput = document.getElementById(`addAllWidgetsTitle-${statKey}`);
        const title = titleInput?.value.trim() || def.label;
        const widgetColor = randomColors
            ? STAT_WIDGET_COLORS[Math.floor(Math.random() * STAT_WIDGET_COLORS.length)].value
            : color;
        const widgetBgColor = randomColors
            ? STAT_WIDGET_BG_COLORS[Math.floor(Math.random() * STAT_WIDGET_BG_COLORS.length)].value
            : bgColor;
        list.push({ id: generate_id(), section: sectionKey, statKey, title, color: widgetColor, bgColor: widgetBgColor });
        added++;
    });
    set_local_storage_item('statWidgets', list);
    return added;
}

// Wires all events inside the Add Stat Widget modal (call once after DOM ready)
function setup_add_stat_widget_modal() {
    populate_stat_widget_select();
    populate_stat_widget_colors();
    populate_stat_widget_bg_colors();
    fill_color_picker(document.getElementById('addAllWidgetsColorPicker'), STAT_WIDGET_COLORS, 'white-text');
    fill_color_picker(document.getElementById('addAllWidgetsBgColorPicker'), STAT_WIDGET_BG_COLORS, '');

    const statSelect = document.getElementById('addStatWidgetStat');
    const titleInput = document.getElementById('addStatWidgetTitle');
    const singleConfirm = document.getElementById('addStatWidgetConfirm');
    const allConfirm = document.getElementById('addAllWidgetsConfirm');

    // Toggle footer confirm buttons based on the active tab
    document.querySelectorAll('#addStatWidgetTab button[data-bs-toggle="tab"]').forEach(tabBtn => {
        tabBtn.addEventListener('shown.bs.tab', (e) => {
            const isAllTab = e.target.id === 'addStatWidgetAllTab-tab';
            if (singleConfirm) singleConfirm.hidden = isAllTab;
            if (allConfirm) allConfirm.hidden = !isAllTab;
            if (isAllTab) {
                const modal = document.getElementById('addStatWidgetModal');
                populate_all_widgets_list(modal.dataset.pendingSection || 'run');
            }
        });
    });

    // Toggle the "All" tab's color pickers based on the random colors switch
    document.getElementById('addAllWidgetsRandom')?.addEventListener('change', (e) => {
        const group = document.getElementById('addAllWidgetsColorGroup');
        if (group) group.hidden = e.target.checked;
    });

    // "Toggle all" switch forces every stat toggle in the "All" tab to its own
    // state. Individual toggles never feed back into this switch — it just keeps
    // whatever state it has until clicked again.
    document.getElementById('addAllWidgetsToggleAll')?.addEventListener('change', (e) => {
        const checked = e.target.checked;
        document.querySelectorAll('#addAllWidgetsList .add-all-widgets-toggle').forEach(toggle => {
            toggle.checked = checked;
        });
    });

    // Add All confirm button
    allConfirm?.addEventListener('click', () => {
        const modal      = document.getElementById('addStatWidgetModal');
        const sectionKey = modal.dataset.pendingSection || 'run';
        const random     = document.getElementById('addAllWidgetsRandom')?.checked !== false;
        const colorBtn   = document.querySelector('#addAllWidgetsColorPicker .stat-color-btn.active');
        const color      = colorBtn?.dataset.color || 'white-text';
        const bgBtn      = document.querySelector('#addAllWidgetsBgColorPicker .stat-color-btn.active');
        const bgColor    = bgBtn?.dataset.color || '';

        const added = add_selected_stat_widgets(sectionKey, random, color, bgColor);
        if (added > 0) {
            setup_data_and_graphs();
            const on_finalized = () => {
                document.dispatchEvent(new CustomEvent("layout-user-action"));
                document.removeEventListener("graphs-finalized", on_finalized);
            };
            document.addEventListener("graphs-finalized", on_finalized);
        }
        bootstrap.Modal.getInstance(modal)?.hide();
    });

    // When stat changes: auto-fill title and color (only if user hasn't overridden title)
    statSelect?.addEventListener('change', () => {
        const opt = statSelect.options[statSelect.selectedIndex];
        if (titleInput) titleInput.dataset.userEdited = '';
        sync_modal_defaults_from_stat(opt);
    });

    // Mark title as user-edited once typed
    titleInput?.addEventListener('input', () => {
        if (titleInput.value.trim()) {
            titleInput.dataset.userEdited = '1';
        } else {
            titleInput.dataset.userEdited = '';
        }
    });

    // Confirm button
    document.getElementById('addStatWidgetConfirm')?.addEventListener('click', () => {
        const modal      = document.getElementById('addStatWidgetModal');
        const rawSection = modal.dataset.pendingSection || 'run';
        const section    = rawSection;
        const statKey    = statSelect?.value;
        const title      = titleInput?.value.trim() || statSelect?.options[statSelect.selectedIndex]?.textContent || 'Stat';
        const colorBtn   = document.querySelector('#addStatWidgetColorPicker .stat-color-btn.active');
        const color      = colorBtn?.dataset.color || 'blue-text';
        const bgColorBtn = document.querySelector('#addStatWidgetBgColorPicker .stat-color-btn.active');
        const bgColor    = bgColorBtn?.dataset.color || '';

        if (!statKey) return;

        const widget = add_custom_stat_widget(section, statKey, title, color, bgColor);

        // Add to the live GridStack if it exists
        const capSection = section.charAt(0).toUpperCase() + section.slice(1);
        const grid       = window[`grid${capSection}`];
        if (grid) {
            const item = document.createElement('div');
            item.classList.add('grid-stack-item');
            item.setAttribute('gs-w',     2);
            item.setAttribute('gs-h',     2);
            item.setAttribute('gs-min-w', 1);
            item.setAttribute('gs-min-h', 1);
            item.setAttribute('gs-max-w', 12);
            item.setAttribute('gs-max-h', 12);
            item.setAttribute('data-gs-id', `customStatWidget-${widget.id}`);
            item.innerHTML = `<div class="grid-stack-item-content">${build_widget_html(widget, true)}</div>`;
            grid.makeWidget(item);
            apply_bg_class(item, widget.bgColor);
            apply_widget_control_icons(item);
            // Wire delete on the newly created widget
            const deleteBtn = item.querySelector(`.delete-custom-stat-widget[data-widget-id="${widget.id}"]`);
            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => handle_delete_widget(widget.id, grid));
            }
        }
        update_values_for_section(section);

        // Push a history snapshot so undo/redo can reverse the add
        document.dispatchEvent(new CustomEvent("layout-user-action"));

        // Reset title user-edited flag and close modal
        if (titleInput) {
            titleInput.value = '';
            titleInput.dataset.userEdited = '';
        }
        bootstrap.Modal.getInstance(modal)?.hide();
    });

    // Reset user-edited flag and tab state on modal open
    document.getElementById('addStatWidgetModal')?.addEventListener('show.bs.modal', () => {
        if (titleInput) titleInput.dataset.userEdited = '';
        const singleTab = document.getElementById('addStatWidgetSingleTab-tab');
        if (singleTab && !singleTab.classList.contains('active')) {
            bootstrap.Tab.getOrCreateInstance(singleTab).show();
        }
        if (singleConfirm) singleConfirm.hidden = false;
        if (allConfirm) allConfirm.hidden = true;
    });
}

// Wires delete buttons on all currently rendered custom stat widgets in a grid
function wire_delete_buttons(gridStack, sectionKey) {
    const widgets = (settings.statWidgets || []).filter(w => w.section === sectionKey);
    for (const widget of widgets) {
        const btn = document.querySelector(`.delete-custom-stat-widget[data-widget-id="${widget.id}"]`);
        if (btn) {
            btn.addEventListener('click', () => handle_delete_widget(widget.id, gridStack));
        }
    }
}

function handle_delete_widget(id, gridStack) {
    // Remove from GridStack DOM
    const el = gridStack?.el?.querySelector(`[data-gs-id="customStatWidget-${id}"]`);
    if (el && gridStack) {
        gridStack.removeWidget(el);
    }
    remove_custom_stat_widget(id);
    // Push a history snapshot so undo/redo can reverse the delete
    document.dispatchEvent(new CustomEvent("layout-user-action"));
}

// Opens the Add Stat Widget modal, pre-selecting the given section (lowercase)
function open_add_stat_widget_modal(sectionKey) {
    const modal = document.getElementById('addStatWidgetModal');
    if (!modal) return;
    modal.dataset.pendingSection = sectionKey;
    preselectStatSection(sectionKey);
    populate_all_widgets_list(sectionKey);
    bootstrap.Modal.getOrCreateInstance(modal).show();
}

export {
    render_custom_stat_widgets,
    update_custom_stat_widgets,
    add_custom_stat_widget,
    remove_custom_stat_widget,
    setup_add_stat_widget_modal,
    wire_delete_buttons,
    open_add_stat_widget_modal,
    populate_stat_widget_select,
};
