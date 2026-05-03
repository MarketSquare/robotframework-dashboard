import { settings } from './variables/settings.js';
import { set_local_storage_item } from './localstorage.js';
import { format_duration, add_alert } from './common.js';
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

// Generates a short random ID (safe across all modern browsers)
function generate_id() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    }
    return Math.random().toString(36).slice(2, 14);
}

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
        ? `<button type="button" class="btn-close btn-close-sm delete-custom-stat-widget" aria-label="Remove widget" data-widget-id="${widget.id}"></button>`
        : '';
    return `<div class="stat-widget-inner">
                <h6 class="stat-widget-title" id="customStatWidget-${widget.id}-title">${widget.title}</h6>
                <div class="stat-value ${widget.color}" id="customStatWidget-${widget.id}-value"></div>
                ${deleteBtn}
            </div>`;
}

// Applies (or updates) the bg class on the grid-stack-item-content of a widget item el
function apply_bg_class(itemEl, bgColor) {
    const content = itemEl.querySelector('.grid-stack-item-content');
    if (!content) return;
    content.classList.remove('blue-bg', 'green-bg', 'red-bg', 'yellow-bg');
    if (bgColor) content.classList.add(bgColor);
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

// Populates a color picker container with the given color definitions
function fill_color_picker(picker, colors, defaultValue) {
    picker.innerHTML = '';
    for (const c of colors) {
        const btn = document.createElement('button');
        btn.type          = 'button';
        btn.className     = 'btn btn-outline-light btn-sm stat-color-btn';
        btn.dataset.color = c.value;
        btn.textContent   = c.label;
        if (c.value === defaultValue) btn.classList.add('active');
        btn.addEventListener('click', () => {
            picker.querySelectorAll('.stat-color-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
        picker.appendChild(btn);
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

// Adds a special "+ Add Widget" tile to the GridStack for edit mode
function render_add_stat_widget_tile(gridStack, sectionKey) {
    const tileId = `addStatWidgetTile-${sectionKey}`;
    // Avoid duplicates
    if (gridStack.el.querySelector(`[data-gs-id="${tileId}"]`)) return;
    const item = document.createElement('div');
    item.classList.add('grid-stack-item');
    item.setAttribute('gs-w', 2);
    item.setAttribute('gs-h', 2);
    item.setAttribute('gs-min-w', 2);
    item.setAttribute('gs-min-h', 2);
    item.setAttribute('gs-max-w', 2);
    item.setAttribute('gs-max-h', 2);
    item.setAttribute('gs-no-resize', 'true');
    item.setAttribute('data-gs-id', tileId);
    item.innerHTML = `<div class="grid-stack-item-content add-stat-widget-tile" data-section="${sectionKey}">
        <div class="add-stat-widget-tile-inner">
            <div class="add-stat-widget-plus">+</div>
            <div class="add-stat-widget-tile-label">Add stat widget</div>
        </div>
    </div>`;
    gridStack.makeWidget(item);
    item.querySelector('.add-stat-widget-tile').addEventListener('click', () => {
        open_add_stat_widget_modal(sectionKey);
    });
}

// Wires all events inside the Add Stat Widget modal (call once after DOM ready)
function setup_add_stat_widget_modal() {
    populate_stat_widget_select();
    populate_stat_widget_colors();
    populate_stat_widget_bg_colors();

    const statSelect = document.getElementById('addStatWidgetStat');
    const titleInput = document.getElementById('addStatWidgetTitle');

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

    // Reset user-edited flag on modal open
    document.getElementById('addStatWidgetModal')?.addEventListener('show.bs.modal', () => {
        if (titleInput) titleInput.dataset.userEdited = '';
    });

    // One-time notice about the new stat widget system (shown until 2026-09-01 or dismissed)
    const NOTICE_EXPIRY = new Date('2026-09-01');
    if (new Date() < NOTICE_EXPIRY && !settings.notices.statWidgets) {
        const customizeIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>`;
        const msg = `Stat widgets have a new look! Enter <b>Customize mode</b> ${customizeIcon} in any section to add your own stat widgets with custom colors and titles. `
                  + '<a href="#" onclick="event.preventDefault(); '
                  + 'window.set_local_storage_item(\'notices.statWidgets\', true); '
                  + 'document.getElementById(\'alertContainer\').innerHTML=\'\'">Don\'t show again</a>';
        add_alert(msg, 'info', 30000);
    }
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
    bootstrap.Modal.getOrCreateInstance(modal).show();
}

export {
    render_custom_stat_widgets,
    render_add_stat_widget_tile,
    update_custom_stat_widgets,
    add_custom_stat_widget,
    remove_custom_stat_widget,
    setup_add_stat_widget_modal,
    wire_delete_buttons,
    open_add_stat_widget_modal,
    populate_stat_widget_select,
};
