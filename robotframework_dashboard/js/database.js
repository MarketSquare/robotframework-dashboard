import { runs, suites, tests, keywords, data_load_scope } from './variables/data.js';

// set default values
function setup_database_stats() {
    document.getElementById("stats").innerHTML = `${data_load_scope ? '<p>Counts reflect the history currently loaded in this dashboard.</p>' : ''}<div class="list-group">
            <div class="list-group-item d-flex justify-content-between align-items-center">
                <span>Runs</span>
                <div class="d-flex align-items-center">
                    <span >${data_load_scope ? data_load_scope.loadedRuns : runs.length}</span>
                </div>
            </div>
            <div class="list-group-item d-flex justify-content-between align-items-center">
                <span>Suites</span>
                <div class="d-flex align-items-center">
                    <span >${suites.length}</span>
                </div>
            </div>
            <div class="list-group-item d-flex justify-content-between align-items-center">
                <span>Tests</span>
                <div class="d-flex align-items-center">
                    <span >${tests.length}</span>
                </div>
            </div>
            <div class="list-group-item d-flex justify-content-between align-items-center">
                <span>Keywords</span>
                <div class="d-flex align-items-center">
                    <span >${keywords.length}</span>
                </div>
            </div>
        </div>`
}

export { setup_database_stats};
