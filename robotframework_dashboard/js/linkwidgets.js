import { settings } from './variables/settings.js';
import { set_local_storage_item } from './localstorage.js';
import { generate_id, apply_bg_class, fill_color_picker, build_move_controls_html } from './common.js';
import { gridEditMode } from './variables/globals.js';
import { STAT_WIDGET_COLORS, STAT_WIDGET_BG_COLORS } from './variables/statwidgetdefs.js';
import { apply_widget_control_icons } from './theme.js';

// Strips the protocol from a URL for compact display (https://foo.com/x → foo.com/x)
function strip_protocol(url) {
    return url.replace(/^https?:\/\//, '');
}

// Builds the inner HTML for one custom link widget card
function build_link_widget_html(widget, editMode) {
    const deleteBtn = editMode
        ? `<a class="delete-custom-link-widget information" role="button" aria-label="Remove widget" data-title="Remove widget" data-widget-id="${widget.id}"></a>`
        : '';
    // In non-edit mode wrap in a clickable div (not an <a> to avoid GridStack drag conflicts)
    const clickable = editMode ? '' : ' link-widget-clickable';
    const moveBtns = editMode ? build_move_controls_html(deleteBtn) : '';
    const displayUrl = strip_protocol(widget.url);
    return `<div class="link-widget-inner${clickable}" data-href="${widget.url}" data-newtab="${widget.newTab ? '1' : '0'}">
                ${moveBtns}
                <div class="link-widget-label ${widget.color}" id="customLinkWidget-${widget.id}-label">${widget.label}</div>
                <div class="link-widget-url">${displayUrl}</div>
            </div>`;
}

// Adds all custom link widgets that belong to sectionKey to the provided GridStack
function render_custom_link_widgets(gridStack, sectionKey, editMode) {
    const capSection = sectionKey.charAt(0).toUpperCase() + sectionKey.slice(1);
    const gridId     = `grid${capSection}`;
    const savedLayout = settings.layouts?.[gridId]
        ? JSON.parse(settings.layouts[gridId])
        : null;

    const widgets = (settings.linkWidgets || []).filter(w => w.section === sectionKey);
    for (const widget of widgets) {
        const saved = savedLayout?.find(l => l.id === `customLinkWidget-${widget.id}`);

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
        item.setAttribute('data-gs-id', `customLinkWidget-${widget.id}`);
        item.innerHTML = `<div class="grid-stack-item-content">${build_link_widget_html(widget, editMode)}</div>`;
        gridStack.makeWidget(item);
        apply_bg_class(item, widget.bgColor);

        // Wire click navigation on non-edit tiles
        if (!editMode) {
            wire_link_click(item, widget);
        }
    }
}

// Wires a click handler on a rendered link widget item that navigates to widget.url
function wire_link_click(itemEl, widget) {
    const inner = itemEl.querySelector('.link-widget-clickable');
    if (!inner) return;
    inner.addEventListener('click', () => {
        // Do not navigate if we are in edit mode (e.g. after toggling without re-render)
        if (gridEditMode) return;
        const url = widget.url;
        if (!url) return;
        if (widget.newTab) {
            window.open(url, '_blank', 'noopener,noreferrer');
        } else {
            window.location.href = url;
        }
    });
}

// Saves a new custom link widget to localStorage and returns it
function add_custom_link_widget(section, label, url, newTab, color, bgColor) {
    const id     = generate_id();
    const widget = { id, section, label, url, newTab, color, bgColor };
    const list   = settings.linkWidgets ? [...settings.linkWidgets] : [];
    list.push(widget);
    set_local_storage_item('linkWidgets', list);
    return widget;
}

// Removes a custom link widget from localStorage by its id
function remove_custom_link_widget(id) {
    const list = (settings.linkWidgets || []).filter(w => w.id !== id);
    set_local_storage_item('linkWidgets', list);
}

// Populates the text + bg color pickers in the Add Link Widget modal
function populate_link_widget_colors() {
    const colorPicker = document.getElementById('addLinkWidgetColorPicker');
    const bgPicker    = document.getElementById('addLinkWidgetBgColorPicker');
    if (colorPicker) fill_color_picker(colorPicker, STAT_WIDGET_COLORS, 'white-text');
    if (bgPicker)    fill_color_picker(bgPicker,    STAT_WIDGET_BG_COLORS, '');
}

// Wires all events inside the Add Link Widget modal (call once after DOM ready)
function setup_add_link_widget_modal() {
    populate_link_widget_colors();

    const labelInput = document.getElementById('addLinkWidgetLabel');

    // Confirm button
    document.getElementById('addLinkWidgetConfirm')?.addEventListener('click', () => {
        const modal    = document.getElementById('addLinkWidgetModal');
        const section  = modal.dataset.pendingSection || 'run';
        const label    = labelInput?.value.trim() || 'Link';
        const url      = document.getElementById('addLinkWidgetUrl')?.value.trim() || '';
        const newTab   = document.getElementById('addLinkWidgetNewTab')?.checked !== false;
        const colorBtn = document.querySelector('#addLinkWidgetColorPicker .stat-color-btn.active');
        const color    = colorBtn?.dataset.color || 'white-text';
        const bgBtn    = document.querySelector('#addLinkWidgetBgColorPicker .stat-color-btn.active');
        const bgColor  = bgBtn?.dataset.color || '';

        if (!url) return;

        const widget = add_custom_link_widget(section, label, url, newTab, color, bgColor);

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
            item.setAttribute('data-gs-id', `customLinkWidget-${widget.id}`);
            item.innerHTML = `<div class="grid-stack-item-content">${build_link_widget_html(widget, true)}</div>`;
            grid.makeWidget(item);
            apply_bg_class(item, widget.bgColor);
            apply_widget_control_icons(item);
            // Wire delete on the newly created widget
            const deleteBtn = item.querySelector(`.delete-custom-link-widget[data-widget-id="${widget.id}"]`);
            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => handle_delete_link_widget(widget.id, grid));
            }
        }

        // Push a history snapshot so undo/redo can reverse the add
        document.dispatchEvent(new CustomEvent("layout-user-action"));

        // Reset inputs and close modal
        if (labelInput) labelInput.value = '';
        const urlInput = document.getElementById('addLinkWidgetUrl');
        if (urlInput) urlInput.value = '';
        bootstrap.Modal.getInstance(modal)?.hide();
    });
}

// Wires delete buttons on all currently rendered custom link widgets in a grid
function wire_link_delete_buttons(gridStack, sectionKey) {
    const widgets = (settings.linkWidgets || []).filter(w => w.section === sectionKey);
    for (const widget of widgets) {
        const btn = document.querySelector(`.delete-custom-link-widget[data-widget-id="${widget.id}"]`);
        if (btn) {
            btn.addEventListener('click', () => handle_delete_link_widget(widget.id, gridStack));
        }
    }
}

function handle_delete_link_widget(id, gridStack) {
    const el = gridStack?.el?.querySelector(`[data-gs-id="customLinkWidget-${id}"]`);
    if (el && gridStack) {
        gridStack.removeWidget(el);
    }
    remove_custom_link_widget(id);
    document.dispatchEvent(new CustomEvent("layout-user-action"));
}

// Opens the Add Link Widget modal for the given section (lowercase)
function open_add_link_widget_modal(sectionKey) {
    const modal = document.getElementById('addLinkWidgetModal');
    if (!modal) return;
    modal.dataset.pendingSection = sectionKey;
    bootstrap.Modal.getOrCreateInstance(modal).show();
}

export {
    render_custom_link_widgets,
    setup_add_link_widget_modal,
    wire_link_delete_buttons,
    open_add_link_widget_modal,
};
