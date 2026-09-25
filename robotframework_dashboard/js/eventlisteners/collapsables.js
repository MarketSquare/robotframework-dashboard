import { arrowDown, arrowRight } from "../variables/svg.js";

// function to setup collapse buttons and icons
function setup_collapsables() {
    document.querySelectorAll(".collapse-icon").forEach(origIcon => {
        // Replace the element with a clone to remove existing listeners
        // required to readd collapsables for overview project sections
        const icon = origIcon.cloneNode(true);
        origIcon.replaceWith(icon);

        const sectionId = icon.id.replace("collapse", "");
        const update_icon = () => {
            const section = document.getElementById(sectionId);
            icon.innerHTML = section.hidden ? arrowRight : arrowDown;
        };
        icon.addEventListener("click", () => {
            const section = document.getElementById(sectionId);
            section.hidden = !section.hidden;
            update_icon();
        });
        update_icon();
    });
}

export { setup_collapsables };
