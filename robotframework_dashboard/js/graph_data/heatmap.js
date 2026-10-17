import { barConfig } from "../variables/chartconfig.js";
import { heatMapHourAll } from "../variables/globals.js";

function get_heatmap_graph_data(filteredData) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const type = document.getElementById("heatMapTestType").value; // All, Passed, Failed, Skipped
    const hour = document.getElementById("heatMapHour").value;
    const counts = new Map();
    for (const value of filteredData) {
        if (type !== "All") {
            const key = type.toLowerCase(); // 'passed', 'failed', 'skipped'
            if (value[key] != 1) continue;
        }
        const date = new Date(value.start_time);
        if (hour === "All") {
            const x = date.getHours() + 0.5;
            const y = date.getDay() + 0.5;
            const key = `${x},${y}`;
            counts.set(key, (counts.get(key) || 0) + 1);
        } else {
            if (date.getHours() != parseInt(hour)) continue;
            const x = date.getMinutes() + 0.5;
            const y = date.getDay() + 0.5;
            const key = `${x},${y}`;
            counts.set(key, (counts.get(key) || 0) + 1);
        }

    }
    const data = Array.from(counts.entries()).map(([key, count]) => {
        const [x, y] = key.split(',').map(Number);
        return { x, y, v: count };
    });
    const baseColors = {
        All: [0, 123, 255], // Blue
        Passed: [151, 189, 97], // Green
        Skipped: [254, 216, 79], // Yellow
        Failed: [206, 62, 1], // Red
    };
    const colorRGB = baseColors[type] || baseColors['All'];
    if (data.length == 0) { return [[], []] }
    const maxV = Math.max(...data.map(d => d.v));
    const graphData = {
        datasets: [{
            label: 'Test Execution Heatmap',
            data: data,
            backgroundColor(ctx) {
                const v = ctx.dataset.data[ctx.dataIndex].v;
                let alpha = v / maxV;
                alpha = Math.max(alpha, 0.2);
                return `rgba(${colorRGB[0]}, ${colorRGB[1]}, ${colorRGB[2]}, ${alpha})`;
            },
            width: ({ chart }) => (chart.chartArea?.width || 0) / (heatMapHourAll ? 24 : 60) - 1,
            height: ({ chart }) => (chart.chartArea?.height || 0) / 7 - 1,
            ...barConfig,
        }]
    };
    return [graphData, days];
}

export {
    get_heatmap_graph_data
};