function confirm_action(message = "Are you sure?") {
    return new Promise((resolve) => {
        const settingsModal = document.getElementById("settingsModal");
        const filtersModal = document.getElementById("filtersModal");
        const modalEl = document.getElementById("confirmModal");
        const modalBody = document.getElementById("confirmModalMessage");
        const cancelBtn = document.getElementById("confirmCancel");
        const okBtn = document.getElementById("confirmOk");

        settingsModal.classList.add("dimmed");
        filtersModal.classList.add("dimmed");
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
            settingsModal.classList.remove("dimmed");
            filtersModal.classList.remove("dimmed");
        };

        cancelBtn.addEventListener("click", onCancel);
        okBtn.addEventListener("click", onConfirm);
        modalEl.addEventListener("hidden.bs.modal", onHidden);
        modal.show();
    });
}

export { confirm_action };
