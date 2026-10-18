---
outline: deep
---

# RobotDashboard Hub

[robotframework-dashboard-hub](https://github.com/timdegroot1996/robotframework-dashboard-hub) is a separate package that combines several robotdashboard databases or servers into one overview: the pass rate, run count and duration of every project side by side, with links to each project's own dashboard. It is meant for teams that run one dashboard per project and want a single page across all of them.

```bash
pip install robotframework-dashboard-hub
robotdashboardhub -s team_a/robot_results.db -s http://dashboards.example.com:8543
```

The hub reads only run level statistics:

- **Database sources** are read with the same `DatabaseProcessor` robotdashboard uses, so older databases are migrated the same way.
- **Server sources** are read from the server's [`GET /get-run-stats`](/dashboard-server.md#server-features-endpoints) endpoint, which needs no authentication, like `/get-outputs`.

A [custom database class](/custom-database-class.md) works with the hub once it implements the optional `get_run_stats` method.

See the [hub README](https://github.com/timdegroot1996/robotframework-dashboard-hub#readme) for installation, the command line options and the sources file.
