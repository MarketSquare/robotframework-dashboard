// Match database.py _get_run_projects: every project_* tag and the run name.
function get_run_projects(run) {
    const projects = [];
    for (const tag of String(run.tags ?? "").split(",")) {
        if (tag.toLowerCase().startsWith("project_")) projects.push(`tag:${tag}`);
    }
    projects.push(`name:${run.name}`);
    return projects;
}

export { get_run_projects };
