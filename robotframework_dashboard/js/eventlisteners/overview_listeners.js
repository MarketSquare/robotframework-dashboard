import { show_loading_overlay, hide_loading_overlay } from "../common.js";
import { update_menu } from "../menu.js";
import { clear_all_filters, set_filter_show_current_version } from "../filter/controls.js";
import { create_overview_latest_graphs, set_filter_show_current_project } from "../graph_creation/overview.js";

function attach_run_card_version_listener(versionElement, projectName, projectVersion) {
    versionElement.addEventListener("click", (event) => {
        clear_all_filters();
        set_filter_show_current_project(projectName);
        set_filter_show_current_version(projectVersion);
        event.stopPropagation();
        update_menu("menuDashboard");
    });
}

// this function setups the project bar "sort by" filters eventlisteners
function setup_overview_order_filters() {
    const parseProjectId = (selectId) => selectId.replace(/SectionOrder$/i, "");
    const parseRunStatsFromCard = (cardEl) => {
        const text = cardEl.innerText || "";
        const runMatch = text.match(/#\s*(\d+)/); // e.g., "#8"
        const passedMatch = text.match(/Passed:\s*(\d+)/i);
        const failedMatch = text.match(/Failed:\s*(\d+)/i);
        const skippedMatch = text.match(/Skipped:\s*(\d+)/i);
        return {
            runNumber: runMatch ? parseInt(runMatch[1]) : 0,
            passed: passedMatch ? parseInt(passedMatch[1]) : 0,
            failed: failedMatch ? parseInt(failedMatch[1]) : 0,
            skipped: skippedMatch ? parseInt(skippedMatch[1]) : 0,
        };
    };

    const reorderProjectCards = (projectId, order) => {
        const containerId = `${projectId}RunCardsContainer`;
        const container = document.getElementById(containerId);
        if (!container) return;
        const cards = Array.from(container.querySelectorAll('.overview-card'));
        if (cards.length === 0) return;
        const enriched = cards.map(card => ({ el: card, stats: parseRunStatsFromCard(card) }));

        const cmpDesc = (a, b, key) => (b.stats[key] - a.stats[key]);
        const cmpAsc = (a, b, key) => (a.stats[key] - b.stats[key]);

        if (order === "oldest" || order.toLowerCase() === "oldest run") {
            enriched.sort((a, b) => cmpAsc(a, b, 'runNumber'));
        } else if (order === "most failed") {
            enriched.sort((a, b) => cmpDesc(a, b, 'failed'));
        } else if (order === "most skipped") {
            enriched.sort((a, b) => cmpDesc(a, b, 'skipped'));
        } else if (order === "most passed") {
            enriched.sort((a, b) => cmpDesc(a, b, 'passed'));
        } else {
            enriched.sort((a, b) => cmpDesc(a, b, 'runNumber'));
        }
        const fragment = document.createDocumentFragment();
        enriched.forEach(item => fragment.appendChild(item.el));
        container.innerHTML = '';
        container.appendChild(fragment);
    };

    document.querySelectorAll('.section-order-filter').forEach(select => {
        const selectId = select.id;
        if (selectId === "overviewLatestSectionOrder") {
            select.addEventListener('change', (e) => {
                show_loading_overlay();
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        create_overview_latest_graphs();
                        hide_loading_overlay();
                    });
                });
            });
        } else {
            const projectId = parseProjectId(selectId);
            select.addEventListener('change', (e) => {
                const order = (e.target.value || '').toLowerCase();
                reorderProjectCards(projectId, order);
            });
        }
    });
}

export { attach_run_card_version_listener, setup_overview_order_filters };
