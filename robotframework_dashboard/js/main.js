import { setup_local_storage } from "./localstorage.js";
import { setup_database_stats } from "./database.js";
import { setup_dashboard_section_layout_buttons } from "./layout.js";
import { setup_sections_filters } from "./eventlisteners/section_filters.js";
import { setup_collapsables } from "./eventlisteners/collapsables.js";
import { setup_filter_modal } from "./eventlisteners/filter_modal.js";
import { setup_settings_modal } from "./eventlisteners/settings_modal.js";
import { setup_menu, setup_navbar_overflow } from "./menu.js";
import { load_data } from "./variables/data.js";
import { setup_notes } from "./notes/ui.js";
import { setup_notes_modal } from "./eventlisteners/notes_modal.js";
import { setup_message_tests_modal } from "./eventlisteners/message_tests_modal.js";
import { requested_load_limit } from "./data_loading.js";
import { setup_loading_screen, update_loading_projects, show_data_load_progress, show_data_load_error } from "./loading.js";

// function that triggers all functions that should be executed when the dashboard is loaded first
// in the correct order!
async function main() {
    try {
        setup_loading_screen();
        await load_data({
            search: window.location.search,
            maxRuns: requested_load_limit(window.location.search),
            on_progress: show_data_load_progress,
            on_runs: update_loading_projects,
        });
        show_data_load_progress({ dataset: "charts" });
        register_dashboard_chart_types();
        setup_local_storage();
        setup_notes();
        setup_database_stats();
        setup_dashboard_section_layout_buttons();
        setup_sections_filters();
        setup_collapsables();
        setup_filter_modal();
        setup_settings_modal();
        setup_notes_modal();
        setup_message_tests_modal();
        setup_menu();
        setup_navbar_overflow();
    } catch (error) {
        show_data_load_error(error);
    }
}

function register_dashboard_chart_types() {
    Chart.register(ChartDataLabels);

    class TimelineScale extends Chart.LinearScale {
        shiftPixels = false;
        getPixelForTick(index) {
            if (!this.shiftPixels) {
                return super.getPixelForTick(index);
            }
            const ticks = this.ticks;
            if (index < 0 || index > ticks.length - 1) {
                return null;
            }
            // Get the pixel and value for the current tick.
            var px = super.getPixelForTick(index);
            var value = ticks[index].value;
            // Get the next value's pixel value.
            var nextPx = this.right;
            if (index < ticks.length - 1) {
                nextPx = super.getPixelForValue(value + 1);
            }
            // Skip tick if it is on the very right side
            if (px == nextPx) {
                return null;
            }
            // Align the labels in the middle of the current and next value.
            return px + (nextPx - px) / 2;
        }
        _computeLabelItems(chartArea) {
            this.shiftPixels = true;
            var items =  super._computeLabelItems(chartArea);
            this.shiftPixels = false;
            return items;
        }
    }
    TimelineScale.id = 'timelineScale';
    Chart.register(TimelineScale);
}

main() // trigger on first load
