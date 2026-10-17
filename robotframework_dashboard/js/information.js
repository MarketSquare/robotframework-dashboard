import { informationMap } from "./variables/information.js";
import { getActiveDecorationName } from "./variables/svg.js";

// Map decoration names to holiday greetings
const holidayGreetings = {
    'christmas': 'Robot Framework - Happy Christmas',
    'aprilFools': 'Robot Framework - Happy April Fools',
    'stPatricksDay': 'Robot Framework - Happy St. Patrick\'s Day',
    'valentinesDay': 'Robot Framework - Happy Valentine\'s Day',
    'halloween': 'Robot Framework - Happy Halloween',
    'piDay': 'Robot Framework - Happy Pi Day',
    'earthDay': 'Robot Framework - Happy Earth Day',
    'oktoberfest': 'Robot Framework - Happy Oktoberfest',
    'easter': 'Robot Framework - Happy Easter'
};

let informationListenersBound = false;
let tooltipEl = null;
let currentTarget = null;

// function to fill the information icons with the correct data
function setup_information_popups() {
    // Get the active decoration and customize rflogo text if needed
    const activeDecoration = getActiveDecorationName();
    const customInfoMap = { ...informationMap };
    
    if (activeDecoration && holidayGreetings[activeDecoration]) {
        customInfoMap["rflogo"] = holidayGreetings[activeDecoration];
    }

    for (const id in customInfoMap) {
        const title = customInfoMap[id];
        const element = document.getElementById(id);
        if (!element) continue;
        element.setAttribute("data-title", title);
    }

    // the page is rebuilt often and every rebuild calls this function, so the delegated listeners
    // below are added once and share one tooltip
    if (informationListenersBound) return;
    informationListenersBound = true;

    function createTooltip(el) {
        if (tooltipEl) removeTooltip();

        const text = el.getAttribute('data-title');
        if (!text) return;

        tooltipEl = document.createElement('div');
        tooltipEl.className = 'tooltip-popup';
        tooltipEl.textContent = text;
        document.body.appendChild(tooltipEl);

        const rect = el.getBoundingClientRect();
        const padding = 8;
        const maxWidth = 440;

        const baseCharWidth = 8;
        const dynamicWidth = Math.min(text.length * baseCharWidth + 26, maxWidth);

        tooltipEl.style.width = dynamicWidth + 'px';
        tooltipEl.style.maxWidth = maxWidth + 'px';

        let left = rect.left + rect.width / 2;
        let top = rect.bottom + 8;

        tooltipEl.style.left = `${left}px`;
        tooltipEl.style.top = `${top}px`;
        tooltipEl.style.transform = 'translateX(-50%)';

        const tooltipRect = tooltipEl.getBoundingClientRect();

        const overflowLeft = tooltipRect.left < padding;
        const overflowRight = tooltipRect.right > window.innerWidth - padding;

        if (overflowLeft) {
            const shiftAmount = padding - tooltipRect.left;
            tooltipEl.style.transform = `translateX(calc(-50% + ${shiftAmount}px))`;
        } else if (overflowRight) {
            const shiftAmount = tooltipRect.right - (window.innerWidth - padding);
            tooltipEl.style.transform = `translateX(calc(-50% - ${shiftAmount}px))`;
        }

        // the tooltip hangs below its icon, so a long text on an icon near the bottom of the
        // window runs off screen: flip it above the icon, keep it inside the window (an icon
        // that is itself below the fold would take the tooltip off screen with it) and pin it
        // to the top edge when even that does not fit (a tooltip taller than the window)
        if (tooltipRect.bottom > window.innerHeight - padding) {
            const lowestTop = window.innerHeight - tooltipRect.height - padding;
            top = Math.max(Math.min(rect.top - tooltipRect.height - 8, lowestTop), padding);
            tooltipEl.style.top = `${top}px`;
        }
    }

    function removeTooltip() {
        document.querySelectorAll('.tooltip-popup').forEach(el => el.remove());
        tooltipEl = null;
        currentTarget = null;
    }

    function isElementVisible(el) {
        const style = window.getComputedStyle(el);
        return !(style.display === 'none' || style.visibility === 'hidden' || el.offsetParent === null);
    }

    // an icon that hides itself on click (e.g. the layout buttons) leaves no mouseover to remove its tooltip
    document.addEventListener('click', () => {
        setTimeout(() => {
            if (currentTarget && !isElementVisible(currentTarget)) removeTooltip();
        }, 0);
    });

    // leaving the window fires no mouseover on another element
    document.addEventListener('mouseout', e => {
        if (!e.relatedTarget && currentTarget) removeTooltip();
    });

    document.addEventListener('mouseover', e => {
        const target = e.target.closest('.information[data-title]');
        if (target !== currentTarget) {
            removeTooltip();
            if (target) {
                currentTarget = target;
                createTooltip(target);
            }
        }
    });
}

export { setup_information_popups };