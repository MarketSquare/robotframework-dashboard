import { get_color } from "./hub_charts.js";

function get_avg_duration(project) {
    if (!project.runs || project.runs.length === 0) return null;
    const vals = project.runs.map(r => parseFloat(r.elapsed_s)).filter(v => !isNaN(v));
    if (vals.length === 0) return null;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

function create_project_table(projects) {
    const tableEl = document.getElementById("projectHealthTable");
    if (!tableEl) return;

    const tbody = tableEl.querySelector("tbody");
    tbody.innerHTML = '';

    projects.forEach((project, idx) => {
        const color = get_color(idx);
        const latest = get_latest_run(project);
        const passRate = latest ? get_pass_rate(latest) : null;
        const avgDuration = get_avg_duration(project);
        const runCount = project.runs ? project.runs.length : 0;
        const lastRunDate = latest
            ? (latest.start_time || latest.run_start || '').slice(0, 16).replace('T', ' ')
            : '-';

        let statusHtml = '<span class="badge bg-secondary">No data</span>';
        if (passRate !== null) {
            if (passRate >= 90) {
                statusHtml = '<span class="badge bg-success">Healthy</span>';
            } else if (passRate >= 70) {
                statusHtml = '<span class="badge bg-warning text-dark">Degraded</span>';
            } else {
                statusHtml = '<span class="badge bg-danger">Critical</span>';
            }
        }

        const linkHtml = project.url
            ? `<a href="${project.url}" target="_blank" class="btn btn-sm btn-outline-secondary">Open</a>`
            : '-';

        const passRateDisplay = passRate !== null ? `${passRate}%` : '-';
        const avgDurDisplay = avgDuration !== null ? `${avgDuration}s` : '-';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};margin-right:6px;"></span>${project.label}</td>
            <td>${runCount}</td>
            <td>${lastRunDate}</td>
            <td>${passRateDisplay}</td>
            <td>${avgDurDisplay}</td>
            <td>${statusHtml}</td>
            <td>${linkHtml}</td>`;
        tbody.appendChild(tr);
    });

    // Initialise DataTable if available
    if (typeof $ !== 'undefined' && $.fn && $.fn.DataTable) {
        $(tableEl).DataTable({
            paging: false,
            searching: false,
            info: false,
            order: [[3, 'asc']],
        });
    }
}

export {
    create_project_table,
};
