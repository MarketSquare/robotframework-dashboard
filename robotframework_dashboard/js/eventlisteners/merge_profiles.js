import { settings } from "../variables/settings.js";
import { lastMergeResult, filterRows } from "../variables/globals.js";
import { add_alert } from "../common.js";
import { merge_two_profiles } from "../filter/profile_merge.js";
import {
    save_filter_profile_to_storage,
    populate_filter_profile_select,
    update_profile_select_display,
} from "../filter/profiles.js";

function render_merge_profile_settings(profile, side) {
    const rows = filterRows
        .filter(def => def.present(profile))
        .map(def => {
            const checkId = `mergeCheck_${side}_${def.key}`;
            return `<div class="form-check mb-1">
                <input class="form-check-input merge-setting-check" type="checkbox"
                    id="${checkId}" data-side="${side}" data-key="${def.key}" checked>
                <label class="form-check-label small" for="${checkId}">
                    <span class="fw-semibold">${def.label}:</span> ${def.valueHtml(profile)}
                </label>
            </div>`;
        });
    return rows.length
        ? rows.join('')
        : '<p class="text-muted small mb-0">No settings in this profile.</p>';
}

function get_checked_partial_profile(side, fullProfile) {
    const result = {};
    for (const def of filterRows) {
        const el = document.getElementById(`mergeCheck_${side}_${def.key}`);
        if (el && el.checked) {
            def.fields.forEach(f => {
                if (fullProfile[f] !== undefined) result[f] = fullProfile[f];
            });
        }
    }
    return result;
}

function render_merge_result_html(result) {
    if (!Object.keys(result).length) {
        return '<span class="text-muted small">Select profiles and settings above to preview.</span>';
    }
    const rows = filterRows
        .filter(def => def.present(result))
        .map(def => `<dt class="col-sm-3 small fw-semibold">${def.label}</dt><dd class="col-sm-9 small mb-1">${def.valueHtml(result)}</dd>`);
    return `<dl class="row mb-0">${rows.join('')}</dl>`;
}

function update_merge_result_preview() {
    const leftName = document.getElementById("mergeProfileLeft").value;
    const rightName = document.getElementById("mergeProfileRight").value;
    const profiles = settings.filterProfiles || {};
    const leftFull = leftName && profiles[leftName] ? profiles[leftName] : {};
    const rightFull = rightName && profiles[rightName] ? profiles[rightName] : {};
    const leftPartial = get_checked_partial_profile('left', leftFull);
    const rightPartial = get_checked_partial_profile('right', rightFull);
    lastMergeResult = merge_two_profiles(leftPartial, rightPartial);
    document.getElementById("mergeResultPreview").innerHTML = render_merge_result_html(lastMergeResult);
}

// wires the merge dialogue that the filter modal's "merge profiles" button opens
function setup_merge_profiles_modal() {
    document.getElementById("mergeFilterProfiles").addEventListener("click", function () {
        const profiles = settings.filterProfiles || {};
        const names = Object.keys(profiles).sort();
        const leftSelect = document.getElementById("mergeProfileLeft");
        const rightSelect = document.getElementById("mergeProfileRight");
        leftSelect.innerHTML = '<option value="">-- Select Profile --</option>';
        rightSelect.innerHTML = '<option value="">-- Select Profile --</option>';
        names.forEach(name => {
            leftSelect.options.add(new Option(name, name));
            rightSelect.options.add(new Option(name, name));
        });
        document.getElementById("mergeProfileNewName").value = "";
        document.getElementById("mergeLeftSettings").innerHTML = "";
        document.getElementById("mergeLeftSettings").style.display = "none";
        document.getElementById("mergeRightSettings").innerHTML = "";
        document.getElementById("mergeRightSettings").style.display = "none";
        update_merge_result_preview();
        const filtersModalEl = document.getElementById("filtersModal");
        const mergeModalEl = document.getElementById("mergeProfilesModal");
        filtersModalEl.classList.add("dimmed");
        const mergeModal = new bootstrap.Modal(mergeModalEl);
        mergeModalEl.addEventListener("hidden.bs.modal", function cleanup() {
            filtersModalEl.classList.remove("dimmed");
            mergeModalEl.removeEventListener("hidden.bs.modal", cleanup);
        });
        mergeModal.show();
    });
    function setup_merge_side_listener(selectId, settingsDivId, side) {
        document.getElementById(selectId).addEventListener("change", function () {
            const profiles = settings.filterProfiles || {};
            const name = this.value;
            const settingsDiv = document.getElementById(settingsDivId);
            if (name && profiles[name]) {
                settingsDiv.innerHTML = render_merge_profile_settings(profiles[name], side);
                settingsDiv.style.display = "";
            } else {
                settingsDiv.innerHTML = "";
                settingsDiv.style.display = "none";
            }
            update_merge_result_preview();
        });
    }
    setup_merge_side_listener("mergeProfileLeft", "mergeLeftSettings", "left");
    setup_merge_side_listener("mergeProfileRight", "mergeRightSettings", "right");
    document.getElementById("mergeProfilesModal").addEventListener("change", function (event) {
        if (event.target.classList.contains("merge-setting-check")) {
            update_merge_result_preview();
        }
    });
    document.getElementById("saveMergeProfile").addEventListener("click", function () {
        const leftName = document.getElementById("mergeProfileLeft").value;
        const rightName = document.getElementById("mergeProfileRight").value;
        const newName = document.getElementById("mergeProfileNewName").value.trim();
        if (!newName) {
            add_alert("Please enter a name for the merged profile!", "warning");
            return;
        }
        if (!leftName && !rightName) {
            add_alert("Please select at least one profile!", "warning");
            return;
        }
        const profileData = lastMergeResult;
        if (!Object.keys(profileData).length) {
            add_alert("Please select at least one filter setting!", "warning");
            return;
        }
        save_filter_profile_to_storage(newName, profileData);
        populate_filter_profile_select();
        update_profile_select_display();
        add_alert(`Filter profile "${newName}" saved!`, "success");
        bootstrap.Modal.getInstance(document.getElementById("mergeProfilesModal")).hide();
    });
}

export { setup_merge_profiles_modal };
