import { setup_local_storage } from "./localstorage.js";
import { setup_database_stats } from "./database.js";
import { setup_dashboard_section_layout_buttons } from "./layout.js";
import {
    setup_sections_filters,
    setup_collapsables,
    setup_filter_modal,
    setup_settings_modal,
} from "./eventlisteners.js";
import { setup_menu, setup_navbar_overflow } from "./menu.js";

// function that triggers all functions that should be executed when the dashboard is loaded first
// in the correct order!
function main() {
    setup_local_storage();
    setup_database_stats();
    setup_dashboard_section_layout_buttons();
    setup_sections_filters();
    setup_collapsables();
    setup_filter_modal();
    setup_settings_modal();
    setup_menu();
    setup_navbar_overflow();
}

Chart.register(ChartDataLabels);
main() // trigger on first load