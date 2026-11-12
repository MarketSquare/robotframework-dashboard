import { open_message_tests_modal } from "../eventlisteners/message_tests_modal.js";
import { open_test_messages_modal } from "../eventlisteners/test_messages_modal.js";
import { get_test_messages } from "../graph_data/test_messages.js";

// the label on the clickable axis under the pointer, or null
function get_axis_label_at(chart, event, labelClick) {
    const scale = chart.scales[labelClick.axis];
    if (!scale || event.x < scale.left || event.x > scale.right || event.y < scale.top || event.y > scale.bottom) return null;
    // a rotated x axis label runs down and to the left from its tick, follow it back up to the axis
    const rotation = labelClick.axis === "x" ? scale.labelRotation * Math.PI / 180 : 0;
    const x = rotation > 0 ? event.x + (event.y - scale.top) / Math.tan(rotation) : event.x;
    const index = Math.round(scale.getValueForPixel(labelClick.axis === "y" ? event.y : x));
    const labels = labelClick.labels ?? chart.data.labels;
    return labels[index] ?? null;
}

// Chart.js calls onClick only inside the chart area, the axis labels are outside it. The plugin reads
// chart.data.labelClick ({ axis, labels?, open(label) }): update_chart refreshes the data of the chart
// it updates and keeps its plugins.
const axisLabelClickPlugin = {
    id: "axisLabelClick",
    afterEvent(chart, args) {
        const labelClick = chart.data.labelClick;
        if (!labelClick) return;
        const event = args.event;
        const label = args.inChartArea ? null : get_axis_label_at(chart, event, labelClick);
        if (event.type === "mousemove") {
            const onPoint = args.inChartArea && chart.getActiveElements().length > 0;
            chart.canvas.style.cursor = label !== null || onPoint ? "pointer" : "default";
        } else if (event.type === "click" && label !== null) {
            labelClick.open(label);
        }
    },
};

// a click on a label of the axis opens open(label); in a bar view (the labels on the x axis) a click on a
// bar does the same, in a timeline a point keeps its own click (the log of its run)
function apply_label_click(config, open, { axis = config.options.indexAxis === "y" ? "y" : "x", labels = null } = {}) {
    config.data.labelClick = { axis, labels, open };
    config.plugins = [axisLabelClickPlugin];
    if (axis !== "x") return;
    config.options.onClick = (event, elements, chart) => {
        const label = elements.length ? chart.data.labels[elements[0].index] : null;
        if (label !== null) open(label);
    };
}

// the test messages graph: a message opens the tests behind it
function apply_message_tests_click(config, messageTests) {
    apply_label_click(config, message => {
        if (messageTests[message]) open_message_tests_modal(message, messageTests[message]);
    });
}

// a graph with a test per label: a test opens its full messages, labelOf gives the label of a test row
function apply_test_messages_click(config, tests, labelOf, options = {}) {
    apply_label_click(config, label => open_test_messages_modal(label, get_test_messages(tests, test => labelOf(test) === label)), options);
    // a bar opens them too, its tooltip says so (a timeline point names it when its message is shortened)
    if (config.data.labelClick.axis === "x") {
        const tooltip = (config.options.plugins ??= {}).tooltip ??= {};
        tooltip.callbacks = { ...tooltip.callbacks, footer: () => "Click to see the full messages" };
    }
}

export { apply_label_click, apply_message_tests_click, apply_test_messages_click };
