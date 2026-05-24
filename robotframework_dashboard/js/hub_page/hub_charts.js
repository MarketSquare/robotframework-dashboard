import { hub_projects } from "./hub_data.js";

// Colour palette for up to 20 projects
const PROJECT_COLORS = [
    '#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f',
    '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac',
    '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
    '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
];

function get_color(index) {
    return PROJECT_COLORS[index % PROJECT_COLORS.length];
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function get_sorted_runs(project) {
    return [...project.runs].sort((a, b) => {
        const da = new Date(a.start_time || a.run_start);
        const db = new Date(b.start_time || b.run_start);
        return da - db;
    });
}

function get_pass_rate(run) {
    const total = run.total || 0;
    if (total === 0) return null;
    return Math.round((run.passed / total) * 100 * 10) / 10;
}

function get_latest_run(project) {
    if (!project.runs || project.runs.length === 0) return null;
    return get_sorted_runs(project).at(-1);
}

function format_elapsed(elapsed_s) {
    const val = parseFloat(elapsed_s);
    if (isNaN(val)) return '-';
    if (val < 60) return `${Math.round(val)}s`;
    const m = Math.floor(val / 60);
    const s = Math.round(val % 60);
    return `${m}m ${s}s`;
}

// ------------------------------------------------------------------
// Stat widgets (one card per project)
// ------------------------------------------------------------------

function create_stat_widgets(projects) {
    const container = document.getElementById("hubStatWidgets");
    if (!container) return;

    container.innerHTML = '';

    projects.forEach((project, idx) => {
        const color = get_color(idx);
        const latest = get_latest_run(project);
        const passRate = latest ? get_pass_rate(latest) : null;
        const total = latest ? (latest.total || 0) : 0;
        const passed = latest ? (latest.passed || 0) : 0;
        const failed = latest ? (latest.failed || 0) : 0;
        const elapsed = latest ? format_elapsed(latest.elapsed_s) : '-';

        let passRateClass = 'text-secondary';
        if (passRate !== null) {
            passRateClass = passRate >= 90 ? 'text-success' : passRate >= 70 ? 'text-warning' : 'text-danger';
        }

        const passRateDisplay = passRate !== null ? `${passRate}%` : 'N/A';
        const lastRunDate = latest ? (latest.start_time || latest.run_start || '').slice(0, 16).replace('T', ' ') : 'No runs';
        const runCount = project.runs ? project.runs.length : 0;
        const linkHtml = project.url ? `<a href="${project.url}" target="_blank" class="btn btn-sm btn-outline-secondary mt-2">Open</a>` : '';

        const col = document.createElement('div');
        col.className = 'col-12 col-sm-6 col-md-4 col-lg-3 col-xl-2';
        col.innerHTML = `
            <div class="card h-100" style="border-left: 4px solid ${color};">
                <div class="card-body p-3">
                    <div class="fw-semibold text-truncate mb-1" title="${project.label}">${project.label}</div>
                    <div class="display-6 fw-bold ${passRateClass}">${passRateDisplay}</div>
                    <div class="small text-muted">pass rate</div>
                    <hr class="my-2">
                    <div class="d-flex justify-content-between small">
                        <span>Total</span><span class="fw-semibold">${total}</span>
                    </div>
                    <div class="d-flex justify-content-between small text-success">
                        <span>Passed</span><span class="fw-semibold">${passed}</span>
                    </div>
                    <div class="d-flex justify-content-between small text-danger">
                        <span>Failed</span><span class="fw-semibold">${failed}</span>
                    </div>
                    <div class="d-flex justify-content-between small">
                        <span>Runs</span><span class="fw-semibold">${runCount}</span>
                    </div>
                    <div class="d-flex justify-content-between small">
                        <span>Duration</span><span class="fw-semibold">${elapsed}</span>
                    </div>
                    <div class="small text-muted mt-1 text-truncate" title="${lastRunDate}">${lastRunDate}</div>
                    ${linkHtml}
                </div>
            </div>`;
        container.appendChild(col);
    });
}

// ------------------------------------------------------------------
// Global pass rate trend (line chart, one line per project over time)
// ------------------------------------------------------------------

function create_global_trend_chart(projects) {
    const canvas = document.getElementById("globalTrendChart");
    if (!canvas) return;

    const datasets = projects.map((project, idx) => {
        const runs = get_sorted_runs(project);
        const data = runs.map(run => ({
            x: new Date(run.start_time || run.run_start),
            y: get_pass_rate(run),
        })).filter(pt => pt.y !== null);

        return {
            label: project.label,
            data,
            borderColor: get_color(idx),
            backgroundColor: get_color(idx) + '33',
            tension: 0.3,
            pointRadius: 3,
            fill: false,
        };
    });

    new Chart(canvas, {
        type: 'line',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: {
                    type: 'time',
                    time: { tooltipFormat: 'yyyy-MM-dd HH:mm' },
                    title: { display: false },
                    ticks: { maxTicksLimit: 8 },
                },
                y: {
                    min: 0,
                    max: 100,
                    title: { display: true, text: 'Pass rate (%)' },
                    ticks: { callback: v => `${v}%` },
                },
            },
            plugins: {
                legend: { position: 'bottom' },
                datalabels: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y}%`,
                    },
                },
            },
        },
    });
}

// ------------------------------------------------------------------
// Pass / Fail per project — horizontal stacked bar (latest run)
// ------------------------------------------------------------------

function create_project_bar_chart(projects) {
    const canvas = document.getElementById("projectBarChart");
    if (!canvas) return;

    const labels = projects.map(p => p.label);
    const passedData = projects.map(p => {
        const r = get_latest_run(p);
        return r ? (r.passed || 0) : 0;
    });
    const failedData = projects.map(p => {
        const r = get_latest_run(p);
        return r ? (r.failed || 0) : 0;
    });
    const skippedData = projects.map(p => {
        const r = get_latest_run(p);
        return r ? (r.skipped || 0) : 0;
    });

    new Chart(canvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: 'Passed', data: passedData, backgroundColor: 'rgba(151, 189, 97, 0.7)', borderColor: '#97bd61', borderWidth: 1 },
                { label: 'Failed', data: failedData, backgroundColor: 'rgba(206, 62, 1, 0.7)', borderColor: '#ce3e01', borderWidth: 1 },
                { label: 'Skipped', data: skippedData, backgroundColor: 'rgba(254, 216, 79, 0.7)', borderColor: '#fed84f', borderWidth: 1 },
            ],
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                x: { stacked: true, title: { display: true, text: 'Tests' } },
                y: { stacked: true },
            },
            plugins: {
                legend: { position: 'bottom' },
                datalabels: { display: false },
                tooltip: { mode: 'index', intersect: false },
            },
        },
    });
}

// ------------------------------------------------------------------
// Execution duration per project (line chart over time)
// ------------------------------------------------------------------

function create_duration_chart(projects) {
    const canvas = document.getElementById("durationChart");
    if (!canvas) return;

    const datasets = projects.map((project, idx) => {
        const runs = get_sorted_runs(project);
        const data = runs.map(run => {
            const val = parseFloat(run.elapsed_s);
            if (isNaN(val)) return null;
            return { x: new Date(run.start_time || run.run_start), y: Math.round(val) };
        }).filter(Boolean);

        return {
            label: project.label,
            data,
            borderColor: get_color(idx),
            backgroundColor: get_color(idx) + '33',
            tension: 0.3,
            pointRadius: 3,
            fill: false,
        };
    });

    new Chart(canvas, {
        type: 'line',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: {
                    type: 'time',
                    time: { tooltipFormat: 'yyyy-MM-dd HH:mm' },
                    ticks: { maxTicksLimit: 8 },
                },
                y: {
                    min: 0,
                    title: { display: true, text: 'Duration (s)' },
                },
            },
            plugins: {
                legend: { position: 'bottom' },
                datalabels: { display: false },
            },
        },
    });
}

export {
    get_color,
    create_stat_widgets,
    create_global_trend_chart,
    create_project_bar_chart,
    create_duration_chart,
};
