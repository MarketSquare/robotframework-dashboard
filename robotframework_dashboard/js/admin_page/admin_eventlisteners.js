import {
    add_output_path,
    add_output_data,
    add_output_file,
    add_output_folder_path,
    remove_outputs,
    remove_all_outputs,
    add_log,
    add_log_file,
    remove_log,
    remove_all_logs,
    refresh_dashboard,
    refresh_admin_tables,
} from './admin_api.js';
import { toggle_theme } from './admin_theme.js';

function setup_output_button_eventlisteners() {
    // add eventlisteners to all buttons
    document.getElementById("addOutputPath").addEventListener("click", add_output_path);
    document.getElementById("addOutputFile").addEventListener("click", add_output_file);
    document.getElementById("addOutputData").addEventListener("click", add_output_data);
    document.getElementById("addOutputFolderPath").addEventListener("click", add_output_folder_path);
    document.getElementById("removeOutputs").addEventListener("click", remove_outputs);
    document.getElementById("removeLimit").addEventListener("click", remove_outputs);
    document.getElementById("removeAllOutputs").addEventListener("click", remove_all_outputs);
    document.getElementById("addLogData").addEventListener("click", add_log);
    document.getElementById("addLogFile").addEventListener("click", add_log_file);
    document.getElementById("removeLogData").addEventListener("click", remove_log);
    document.getElementById("removeAllLogs").addEventListener("click", remove_all_logs);
    document.getElementById("refreshDashboard").addEventListener("click", refresh_dashboard);
    document.getElementById("refreshAdminTables").addEventListener("click", refresh_admin_tables);
    document.getElementById("themeLight").addEventListener("click", () => toggle_theme());
    document.getElementById("themeDark").addEventListener("click", () => toggle_theme());
}

function confirm_action(message = "Are you sure?") {
    return new Promise((resolve) => {
        const modalEl = document.getElementById("confirmModal");
        const modalBody = document.getElementById("confirmModalMessage");
        const cancelBtn = document.getElementById("confirmCancel");
        const okBtn = document.getElementById("confirmOk");

        modalBody.innerHTML = message;

        const modal = new bootstrap.Modal(modalEl);
        const onCancel = () => {
            resolve(false);
            modal.hide();
        };
        const onConfirm = () => {
            resolve(true);
            modal.hide();
        };
        const onHidden = () => {
            cleanup();
        };
        const cleanup = () => {
            cancelBtn.removeEventListener("click", onCancel);
            okBtn.removeEventListener("click", onConfirm);
            modalEl.removeEventListener("hidden.bs.modal", onHidden);
        };

        cancelBtn.addEventListener("click", onCancel);
        okBtn.addEventListener("click", onConfirm);
        modalEl.addEventListener("hidden.bs.modal", onHidden);
        modal.show();
    });
}

export {
    setup_output_button_eventlisteners,
    confirm_action
};