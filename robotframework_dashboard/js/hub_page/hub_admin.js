import { add_alert } from "./hub_common.js";

// Read the flag injected by hub_generator.py into the <body> attribute.
// "true"  → served by a live hub server  (gear icon active)
// "false" → static offline HTML          (gear icon hidden)
const hub_is_server = document.body.dataset.hubIsServer === "true";

// -------------------------------------------------------------------------
// Setup
// -------------------------------------------------------------------------

function setup_hub_admin() {
    const gearItem = document.getElementById("hubAdminGearItem");
    const gearBtn  = document.getElementById("hubAdminGear");
    if (!gearItem || !gearBtn) return;

    if (!hub_is_server) return;  // hide gear in static mode

    gearItem.hidden = false;

    gearBtn.addEventListener("click", () => {
        _open_sources_modal();
    });

    document.getElementById("hubAddSourceBtn")?.addEventListener("click", _on_add_source);

    // Allow submitting the add-form with Enter inside the inputs
    ["hubSourceInput", "hubSourceLabelInput"].forEach(id => {
        document.getElementById(id)?.addEventListener("keydown", e => {
            if (e.key === "Enter") _on_add_source();
        });
    });
}

// -------------------------------------------------------------------------
// Modal helpers
// -------------------------------------------------------------------------

function _open_sources_modal() {
    const modal = new bootstrap.Modal(document.getElementById("hubSourcesModal"));
    modal.show();
    _load_sources_into_table();
}

async function _load_sources_into_table() {
    const tbody = document.getElementById("hubSourcesTableBody");
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" class="text-muted text-center p-3">Loading…</td></tr>';
    try {
        const resp = await fetch("/hub-sources");
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        _render_sources_table(data.sources || []);
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-danger p-3">Failed to load sources: ${err.message}</td></tr>`;
    }
}

function _render_sources_table(sources) {
    const tbody = document.getElementById("hubSourcesTableBody");
    if (!tbody) return;
    if (sources.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-muted text-center p-3">No sources configured yet.</td></tr>';
        return;
    }
    tbody.innerHTML = sources.map(src => `
        <tr>
            <td>${_esc(src.label || src.source)}</td>
            <td class="text-break small">${_esc(src.source)}</td>
            <td><span class="badge bg-secondary">${_esc(src.source_type)}</span></td>
            <td class="text-end">
                <button class="btn btn-sm btn-outline-danger"
                        data-source="${_esc(src.source)}"
                        onclick="window._hub_admin_remove(this)">Remove</button>
            </td>
        </tr>
    `).join("");
}

// -------------------------------------------------------------------------
// Add source
// -------------------------------------------------------------------------

async function _on_add_source() {
    const sourceInput = document.getElementById("hubSourceInput");
    const labelInput  = document.getElementById("hubSourceLabelInput");
    const source = sourceInput?.value.trim();
    const label  = labelInput?.value.trim();

    if (!source) {
        add_alert("Please enter a path or URL.", "warning");
        return;
    }

    try {
        const resp = await fetch("/add-hub-source", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ source, label: label || source }),
        });
        const data = await resp.json();
        if (data.success === "1") {
            add_alert(`Source added: ${source}`, "success");
            if (sourceInput) sourceInput.value = "";
            if (labelInput)  labelInput.value  = "";
            _load_sources_into_table();
        } else {
            add_alert(data.message || "Failed to add source.", "danger");
        }
    } catch (err) {
        add_alert(`Error: ${err.message}`, "danger");
    }
}

// -------------------------------------------------------------------------
// Remove source  (called from inline onclick so it must be on window)
// -------------------------------------------------------------------------

window._hub_admin_remove = async function(btn) {
    const source = btn.dataset.source;
    if (!source) return;
    if (!confirm(`Remove source:\n${source}?`)) return;
    try {
        const resp = await fetch("/remove-hub-source", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ source }),
        });
        const data = await resp.json();
        if (data.success === "1") {
            add_alert(`Source removed: ${source}`, "success");
            _load_sources_into_table();
        } else {
            add_alert(data.message || "Failed to remove source.", "danger");
        }
    } catch (err) {
        add_alert(`Error: ${err.message}`, "danger");
    }
};

// -------------------------------------------------------------------------
// Utility
// -------------------------------------------------------------------------

function _esc(str) {
    return String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

export { setup_hub_admin };
