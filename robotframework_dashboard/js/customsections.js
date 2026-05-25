import { settings } from './variables/settings.js';
import { set_local_storage_item } from './localstorage.js';
import { STAT_WIDGET_COLORS, STAT_WIDGET_BG_COLORS } from './variables/statwidgetdefs.js';

// Generates a short random ID (safe across all modern browsers)
function generate_section_id() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    }
    return Math.random().toString(36).slice(2, 14);
}

// Applies (or updates) the bg class on the grid-stack-item-content of a section item el
function apply_section_bg_class(itemEl, bgColor) {
    const content = itemEl.querySelector('.grid-stack-item-content');
    if (!content) return;
    content.classList.remove('blue-bg', 'green-bg', 'red-bg', 'yellow-bg');
    if (bgColor) content.classList.add(bgColor);
}

// Builds the inner HTML for a custom section divider bar
function build_section_divider_html(section, editMode) {
    const deleteBtn = editMode
        ? `<button type="button" class="btn-close btn-close-sm delete-custom-section" aria-label="Remove section" data-section-id="${section.id}"></button>`
        : '';
    return `<div class="custom-section-divider ${section.textColor || 'white-text'}">
                <span class="custom-section-title">${section.title}</span>
                ${deleteBtn}
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
        apply_section_bg_class(item, section.bgColor);
    }
}

// Adds a special "Add custom section" horizontal tile to the unified GridStack for edit mode
function render_add_section_tile(gridStack) {
    const tileId = 'addSectionTile-unified';
    if (gridStack.el.querySelector(`[data-gs-id="${tileId}"]`)) return;

    const item = document.createElement('div');
    item.classList.add('grid-stack-item');
    item.setAttribute('gs-w',       12);
    item.setAttribute('gs-h',        1);
    item.setAttribute('gs-min-w',   12);
    item.setAttribute('gs-max-w',   12);
    item.setAttribute('gs-min-h',    1);
    item.setAttribute('gs-max-h',    1);
    item.setAttribute('gs-no-resize', 'true');
    item.setAttribute('data-gs-id', tileId);
    item.innerHTML = `<div class="grid-stack-item-content add-section-tile">
        <div class="add-section-tile-inner">
            <div class="add-section-plus">+</div>
            <div class="add-section-tile-label">Add custom section</div>
        </div>
    </div>`;
    gridStack.makeWidget(item);
    item.querySelector('.add-section-tile').addEventListener('click', () => {
        open_add_custom_section_modal();
    });
}

// Saves a new custom section divider to localStorage and returns it
function add_custom_section(title, bgColor, textColor) {
    const id      = generate_section_id();
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
    picker.innerHTML = '';
    for (const c of STAT_WIDGET_BG_COLORS) {
        const btn = document.createElement('button');
        btn.type          = 'button';
        btn.className     = 'btn btn-outline-light btn-sm stat-color-btn';
        btn.dataset.color = c.value;
        btn.textContent   = c.label;
        if (c.value === '') btn.classList.add('active');
        btn.addEventListener('click', () => {
            picker.querySelectorAll('.stat-color-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
        picker.appendChild(btn);
    }
}

// Populates the text color picker in the Add Custom Section modal
function populate_section_text_colors() {
    const picker = document.getElementById('addCustomSectionTextColorPicker');
    if (!picker) return;
    picker.innerHTML = '';
    for (const c of STAT_WIDGET_COLORS) {
        const btn = document.createElement('button');
        btn.type          = 'button';
        btn.className     = 'btn btn-outline-light btn-sm stat-color-btn';
        btn.dataset.color = c.value;
        btn.textContent   = c.label;
        if (c.value === 'white-text') btn.classList.add('active');
        btn.addEventListener('click', () => {
            picker.querySelectorAll('.stat-color-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
        picker.appendChild(btn);
    }
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
            apply_section_bg_class(item, section.bgColor);
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
    render_add_section_tile,
    setup_add_custom_section_modal,
    wire_delete_section_buttons,
};
