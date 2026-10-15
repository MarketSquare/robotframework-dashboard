import { runs, suites, tests, keywords } from './variables/data.js';

// set default values
function setup_database_stats() {
    document.getElementById("stats").innerHTML = `<div class="list-group">
            <div class="list-group-item d-flex justify-content-between align-items-center">
                <span>Runs</span>
                <div class="d-flex align-items-center">
                    <span >${runs.length}</span>
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