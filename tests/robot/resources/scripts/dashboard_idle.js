() => {
    // Injected into the dashboard page by `Open Dashboard` (Browser library `Evaluate JavaScript`), so it
    // exists only in the test browser: the shipped dashboard carries no test hooks.
    //
    // Defines window.dashboard_is_idle(): true when the dashboard has finished rendering - no loading
    // spinner or filter overlay visible, no graph overlay, no modal open or still closing (the settings
    // modal re-renders on hidden.bs.modal, i.e. after its fade) and no backdrop, no jQuery fade running,
    // no Chart.js animation in progress - and none of that for the last 50 ms either, so work queued
    // with requestAnimationFrame has had its turn. `Wait For Dashboard Idle` polls it once per frame.
    //
    // Must stay synchronous: Playwright's waitForFunction treats a returned Promise as truthy.
    // If the dashboard gains a new async render path (a setTimeout, a fade, a new overlay) extend the
    // busy check here instead of sleeping in the tests.
    //
    // (this file must start with the arrow function: Browser's Evaluate JavaScript only calls strings that look like one)
    let lastBusy = 0;
    window.dashboard_is_idle = () => {
        const busy =
            $("#loading").is(":visible") ||
            $("#filterLoadingOverlay").is(":visible") ||
            document.querySelector(".graph-loading-overlay, .modal.show, .modal-backdrop") !== null ||
            $(":animated").length > 0 ||
            Object.values(Chart.instances).some(chart => Chart.animator.running(chart));
        if (busy) {
            lastBusy = performance.now();
            return false;
        }
        return performance.now() - lastBusy > 50;
    };
}
