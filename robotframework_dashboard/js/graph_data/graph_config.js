import { settings } from "../variables/settings.js";
import { heatMapHourAll } from "../variables/globals.js";
import { open_log_file } from "../log.js";
import { format_duration } from "../common.js";

// function to retrieve the required graph config for chartjs, based on the different type of graphs
// Generate a Chart.js config object based on the graph type and data
function get_graph_config(graphType, graphData, graphTitle, xTitle, yTitle, dataSets = true) {
    if (dataSets && graphType === "line") {
        graphData = { datasets: graphData };
    }

    const baseConfig = {
        onClick: (event, chartElement) => {
            if (chartElement.length) open_log_file(event, chartElement);
        },
        normalized: true,
        responsive: true,
        maintainAspectRatio: false,
        animation: settings.show.animation
            ? {
                delay: (ctx) => {
                    const dataLength = ctx.chart.data.datasets.reduce(
                        (a, b) => (b.data.length > a.data.length ? b : a)
                    ).data.length;
                    return ctx.dataIndex * (settings.show.duration / dataLength);
                },
            }
            : false,
        plugins: {
            title: {
                display: graphTitle == "" ? false : true,
                text: graphTitle,
            },
            datalabels: {
                display: false,
            },
        },
    };

    const commonScales = {
        x: {
            title: { display: true, text: xTitle },
            ticks: {
                minRotation: 45,
                maxRotation: 45,
                callback(value) {
                    return this.getLabelForValue(value).slice(0, 40);
                },
            },
        },
        y: {
            title: { display: true, text: yTitle },
            beginAtZero: true,
            grace: "5%",
            ticks: {
                callback(value) {
                    return this.getLabelForValue(value).slice(0, 40);
                },
            },
        },
    };

    const configMap = {
        line: () => ({
            type: "line",
            data: graphData,
            options: {
                ...baseConfig,
                scales: {
                    ...commonScales,
                    x: {
                        ...commonScales.x,
                        type: "time",
                        time: { tooltipFormat: "dd.MM.yyyy HH:mm:ss" },
                        ticks: {
                            ...commonScales.x.ticks,
                            maxTicksLimit: 10,
                        },
                    },
                },
                plugins: {
                    ...baseConfig.plugins,
                    tooltip: {
                        callbacks: {
                            title: function (tooltipItems) {
                                const raw = tooltipItems[0]?.raw;
                                if (raw && typeof raw === 'object' && raw._run_start) {
                                    return raw._run_start;
                                }
                                return tooltipItems[0]?.label;
                            },
                        },
                    },
                },
            },
        }),
        bar: () => ({
            type: "bar",
            data: graphData,
            options: {
                ...baseConfig,
                scales: {
                    ...commonScales,
                    y: { ...commonScales.y, stacked: true },
                },
                interaction: { mode: "x" },
                plugins: {
                    ...baseConfig.plugins,
                    tooltip: {
                        filter: (item) => item.dataset.data[item.dataIndex] > 0,
                    },
                    datalabels: {
                        color: "#000",
                        align: "center",
                        anchor: "center",
                        formatter: (val) => (val > 0 ? val : null),
                    },
                },
            },
        }),
        timeline: () => ({
            type: "bar",
            data: graphData,
            options: {
                ...baseConfig,
                indexAxis: "y",
                scales: {
                    ...commonScales,
                    y: { ...commonScales.y, stacked: true },
                },
                plugins: {
                    ...baseConfig.plugins,
                    legend: { display: false },
                },
            },
        }),
        boxplot: () => ({
            type: "boxplot",
            data: graphData,
            options: {
                ...baseConfig,
                scales: {
                    ...commonScales,
                    x: {
                        ...commonScales.x,
                        ticks: commonScales.x.ticks,
                    },
                },
                plugins: {
                    ...baseConfig.plugins,
                    tooltip: { enabled: true },
                    legend: { display: false },
                },
            },
        }),
        donut: () => ({
            type: "doughnut",
            data: graphData,
            options: {
                ...baseConfig,
                animation: settings.show.animation ? { duration: settings.show.duration } : false,
                radius: "90%",
                plugins: {
                    ...baseConfig.plugins,
                    tooltip: {
                        callbacks: {
                            title: function (tooltipItem) {
                                const label = tooltipItem[0].label;
                                const value = tooltipItem[0].formattedValue;
                                const datalabelModel = tooltipItem[0].element?.$datalabels?.[0]?._model;
                                return datalabelModel?.lines?.[0] || `${label}: ${value}`;
                            },
                        },
                    },
                    legend: {
                        display: true,
                        labels: {
                            generateLabels(chart) {
                                const dataset = chart.data.datasets[0];
                                const meta = chart.getDatasetMeta(0);
                                const labels = chart.data.labels;

                                return labels.map((label, i) => {
                                    const style = meta.controller.getStyle(i);
                                    const hidden = !chart.isDatasetVisible(0) || meta.data[i].hidden;

                                    return {
                                        text: label.split(".").pop(),
                                        fillStyle: style.backgroundColor,
                                        strokeStyle: style.borderColor,
                                        lineWidth: style.borderWidth,
                                        lineCap: style.borderCapStyle || "butt",
                                        lineDash: style.borderDash || [],
                                        lineDashOffset: style.borderDashOffset || 0,
                                        pointStyle: style.pointStyle || "circle",
                                        rotation: style.rotation || 0,
                                        hidden,
                                        index: i,
                                        datasetIndex: 0,
                                        fontColor: Chart.defaults.color,
                                    };
                                });
                            },
                        },
                    },
                    datalabels: {
                        ...dataLabelConfig,
                        align: "center",
                        anchor: "center",
                        formatter(value, context) {
                            if (value === 0) return null;
                            const total = graphData.datasets[0].data.reduce((a, b) => a + b, 0);
                            const percentage = Math.round((value / total) * 100);
                            if (percentage <= 5) return null;
                            const label = graphData.labels[context.dataIndex].split(".").pop();
                            return `${label}: ${value} (${percentage}%)`;
                        },
                    },
                },
            },
        }),
        heatmap: () => ({
            type: "matrix",
            data: graphData,
            options: {
                ...baseConfig,
                scales: {
                    x: {
                        type: "linear",
                        position: "bottom",
                        min: 0,
                        max: heatMapHourAll ? 24 : 60,
                        offset: false,
                        grid: { display: true, drawTicks: true, tickLength: 8 },
                        ticks: {
                            minRotation: 45,
                            maxRotation: 45,
                            stepSize: 1,
                            callback: (val) => {
                                if (heatMapHourAll) return `${val}:00`;
                                const hour = document.getElementById("heatMapHour").value;
                                return `${("0" + hour).slice(-2)}:${("0" + val).slice(-2)}`;
                            },
                        },
                        title: {
                            display: true,
                            text: heatMapHourAll ? "Hour" : "Minute",
                        },
                    },
                    y: {
                        type: "linear",
                        reverse: true,
                        min: 0,
                        max: 7,
                        offset: false,
                        grid: { display: true, drawTicks: true, tickLength: 8 },
                        title: { display: true, text: "Day" },
                    },
                },
                plugins: {
                    ...baseConfig.plugins,
                    legend: { display: false },
                },
            },
        }),
        radar: () => ({
            type: "radar",
            data: graphData,
            options: {
                ...baseConfig,
                elements: {
                    line: {
                        borderWidth: 3
                    },
                },
                plugins: {
                    ...baseConfig.plugins,
                    tooltip: { enabled: true },
                    legend: { display: true },
                },
                scales: {
                    r: {
                        angleLines: {
                            display: true
                        },
                        grid: {
                            display: true
                        },
                        pointLabels: {
                            display: true
                        },
                        ticks: {
                            display: false
                        }
                    }
                }
            },
        }),
    };

    const config = configMap[graphType]?.();

    if (config?.options?.scales) {
        if (xTitle === "Duration" && config.options.scales.x) {
            config.options.scales.x.ticks.callback = (value) => format_duration(value);
        }
        if (yTitle === "Duration" && config.options.scales.y) {
            config.options.scales.y.ticks.callback = (value) => format_duration(value);
        }
    }

    if (xTitle === "Duration" || yTitle === "Duration") {
        config.options.plugins.tooltip = {
            ...config.options.plugins.tooltip,
            callbacks: {
                ...config.options.plugins.tooltip?.callbacks,
                label: function (context) {
                    const val = context.parsed.y ?? context.parsed.x ?? context.raw;
                    if (typeof val === "number") {
                        return format_duration(val);
                    }
                    return val;
                },
            },
        };
    }

    if (!settings.show.legends) {
        config.options.plugins.legend = config.options.plugins.legend || {};
        config.options.plugins.legend.display = false;
    }
    if (!settings.show.axisTitles) {
        if (config.options.scales && config.options.scales.x && config.options.scales.x.title) {
            config.options.scales.x.title.display = false;
        }
        if (config.options.scales && config.options.scales.y && config.options.scales.y.title) {
            config.options.scales.y.title.display = false;
        }
    }
    return config;
}

export {
    get_graph_config
};