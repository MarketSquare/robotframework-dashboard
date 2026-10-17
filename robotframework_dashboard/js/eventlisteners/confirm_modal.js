function confirm_action(message = "Are you sure?") {
    return new Promise((resolve) => {
        const modalEl = document.getElementById("confirmModal");
        // the modal the confirmation was asked from stays open below it
        const openModals = [...document.querySelectorAll(".modal.show")].filter(modal => modal !== modalEl);
        const modalBody = document.getElementById("confirmModalMessage");
        const cancelBtn = document.getElementById("confirmCancel");
        const okBtn = document.getElementById("confirmOk");

        openModals.forEach(modal => modal.classList.add("dimmed"));
        modalBody.innerHTML = message;

        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        const onCancel = () => {
            resolve(false);
            modal.hide();
        };
        const onConfirm = () => {
            resolve(true);
            modal.hide();
        };
        // Esc and a click on the backdrop close the modal without a button: that is a cancel
        const onHidden = () => {
            resolve(false);
            cleanup();
        };
        const cleanup = () => {
            cancelBtn.removeEventListener("click", onCancel);
            okBtn.removeEventListener("click", onConfirm);
            modalEl.removeEventListener("hidden.bs.modal", onHidden);
            openModals.forEach(modal => modal.classList.remove("dimmed"));
        };

        cancelBtn.addEventListener("click", onCancel);
        okBtn.addEventListener("click", onConfirm);
        modalEl.addEventListener("hidden.bs.modal", onHidden);
        modal.show();
    });
}

export { confirm_action };
