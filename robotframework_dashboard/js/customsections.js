import { settings } from './variables/settings.js';
import { set_local_storage_item } from './localstorage.js';
import { generate_id, apply_bg_class, fill_color_picker, build_move_controls_html } from './common.js';
import { STAT_WIDGET_COLORS, STAT_WIDGET_BG_COLORS } from './variables/statwidgetdefs.js';
import { apply_widget_control_icons } from './theme.js';

// Builds the inner HTML for a custom section divider bar
function build_section_divider_html(section, editMode) {
    const deleteBtn = editMode
        ? `<a class="delete-custom-section information" role="button" aria-label="Remove section" data-title="Remove section" data-section-id="${section.id}"></a>`
        : '';
    const moveBtns = editMode ? build_move_controls_html(deleteBtn) : '';
    return `<div class="custom-section-divider ${section.textColor || 'white-text'}">
                ${moveBtns}
                <span class="custom-section-title">${section.title}</span>
            </div>`;
}

// Adds all custom section dividers (for unified grid) to the provided GridStack
function render_custom_sections(gridStack, editMode) {
    const savedLayout = settings.layouts?.['gridUnified']
        ? JSON.parse(settings.layouts['gridUnified'])
        : null;

    const sections = settings.customSections || [];
    for (const section of sections) {
        const saved = savedLayout?.find(l => l.id === `customSection-${section.id}`);

        const item = document.createElement('div');
        item.classList.add('grid-stack-item');
        item.setAttribute('gs-w',     saved ? saved.w : 12);
        item.setAttribute('gs-h',     saved ? saved.h : 1);
        item.setAttribute('gs-min-w', 12);
        item.setAttribute('gs-max-w', 12);
        item.setAttribute('gs-min-h', 1);
        item.setAttribute('gs-max-h', 3);
        if (saved) {
            item.setAttribute('gs-x', saved.x);
            item.setAttribute('gs-y', saved.y);
        }
        item.setAttribute('data-gs-id', `customSection-${section.id}`);
        item.innerHTML = `<div class="grid-stack-item-content">${build_section_divider_html(section, editMode)}</div>`;
        gridStack.makeWidget(item);
        apply_bg_class(item, section.bgColor);
    }
}

// Saves a new custom section divider to localStorage and returns it
function add_custom_section(title, bgColor, textColor) {
    const id      = generate_id();
    const section = { id, title, bgColor, textColor };
    const list    = settings.customSections ? [...settings.customSections] : [];
    list.push(section);
    set_local_storage_item('customSections', list);
    return section;
}

// Removes a custom section divider from localStorage by its id
function remove_custom_section(id) {
    const list = (settings.customSections || []).filter(s => s.id !== id);
    set_local_storage_item('customSections', list);
}

// Populates the background color picker in the Add Custom Section modal
function populate_section_bg_colors() {
    const picker = document.getElementById('addCustomSectionBgColorPicker');
    if (!picker) return;
    fill_color_picker(picker, STAT_WIDGET_BG_COLORS, '');
}

// Populates the text color picker in the Add Custom Section modal
function populate_section_text_colors() {
    const picker = document.getElementById('addCustomSectionTextColorPicker');
    if (!picker) return;
    fill_color_picker(picker, STAT_WIDGET_COLORS, 'white-text');
}

// Wires all events inside the Add Custom Section modal (call once after DOM ready)
function setup_add_custom_section_modal() {
    populate_section_bg_colors();
    populate_section_text_colors();

    document.getElementById('addCustomSectionConfirm')?.addEventListener('click', () => {
        const titleInput   = document.getElementById('addCustomSectionTitle');
        const title        = titleInput?.value.trim() || 'Section';
        const bgColorBtn   = document.querySelector('#addCustomSectionBgColorPicker .stat-color-btn.active');
        const bgColor      = bgColorBtn?.dataset.color || '';
        const textColorBtn = document.querySelector('#addCustomSectionTextColorPicker .stat-color-btn.active');
        const textColor    = textColorBtn?.dataset.color || 'white-text';

        const section = add_custom_section(title, bgColor, textColor);

        const grid = window['gridUnified'];
        if (grid) {
            const item = document.createElement('div');
            item.classList.add('grid-stack-item');
            item.setAttribute('gs-w',     12);
            item.setAttribute('gs-h',      1);
            item.setAttribute('gs-min-w', 12);
            item.setAttribute('gs-max-w', 12);
            item.setAttribute('gs-min-h',  1);
            item.setAttribute('gs-max-h',  3);
            item.setAttribute('data-gs-id', `customSection-${section.id}`);
            item.innerHTML = `<div class="grid-stack-item-content">${build_section_divider_html(section, true)}</div>`;
            grid.makeWidget(item);
            apply_bg_class(item, section.bgColor);
            apply_widget_control_icons(item);
            const deleteBtn = item.querySelector(`.delete-custom-section[data-section-id="${section.id}"]`);
            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => handle_delete_section(section.id, grid));
            }
        }

        document.dispatchEvent(new CustomEvent("layout-user-action"));

        if (titleInput) titleInput.value = '';
        bootstrap.Modal.getInstance(document.getElementById('addCustomSectionModal'))?.hide();
    });

    // Reset color pickers each time the modal opens
    document.getElementById('addCustomSectionModal')?.addEventListener('show.bs.modal', () => {
        populate_section_bg_colors();
        populate_section_text_colors();
    });
}

// Wires delete buttons on all currently rendered custom section dividers
function wire_delete_section_buttons(gridStack) {
    const sections = settings.customSections || [];
    for (const section of sections) {
        const btn = document.querySelector(`.delete-custom-section[data-section-id="${section.id}"]`);
        if (btn) {
            btn.addEventListener('click', () => handle_delete_section(section.id, gridStack));
        }
    }
}

function handle_delete_section(id, gridStack) {
    const el = gridStack?.el?.querySelector(`[data-gs-id="customSection-${id}"]`);
    if (el && gridStack) {
        gridStack.removeWidget(el);
    }
    remove_custom_section(id);
    document.dispatchEvent(new CustomEvent("layout-user-action"));
}

// Opens the Add Custom Section modal
function open_add_custom_section_modal() {
    const modal = document.getElementById('addCustomSectionModal');
    if (!modal) return;
    bootstrap.Modal.getOrCreateInstance(modal).show();
}

export {
    render_custom_sections,
    setup_add_custom_section_modal,
    wire_delete_section_buttons,
    open_add_custom_section_modal,
};
