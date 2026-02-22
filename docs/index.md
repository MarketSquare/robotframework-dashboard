---
layout: home

hero:
  name: "RobotDashboard"
  text: "Robot Framework Dashboard and Result Database command line tool"
  tagline: Visualize and analyze Robot Framework test results across multiple runs with an interactive dashboard
  image:
    light: /robotdashboard-light.svg
    dark: /robotdashboard-dark.svg
    alt: "RobotDashboard Logo"
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started.md
    - theme: alt
      text: View on PyPi
      link: https://pypi.org/project/robotframework-dashboard/
    - theme: alt
      text: ⭐ Star on GitHub
      link: https://github.com/marketsquare/robotframework-dashboard
    - theme: alt
      text: Contributions
      link: /contributions.md
  
features:
  - title: 🚀 Getting Started
    details: Quick setup instructions to install Robot Framework and RobotFramework Dashboard, and verify it is working.
    link: /getting-started.md
  - title: 📦 Installation & Version Info
    details: Install the dashboard via pip, check Python and Robot Framework requirements, and view version information.
    link: /installation-version-info.md
  - title: 💻 Basic Command Line Interface (CLI)
    details: Manage your test results database, add output XML files, remove runs, and generate dashboards directly from the command line.
    link: /basic-command-line-interface-cli.md
  - title: ⚡ Advanced CLI & Examples
    details: Advanced usage examples including combined commands, tagging strategies, aliases, batch imports, message configuration, and performance tips.
    link: /advanced-cli-examples.md
  - title: 🗂️ Tabs / Pages
    details: Explore the dashboard's interactive pages including Overview, Dashboard, Compare, and detailed suite/test/keyword views.
    link: /tabs-pages.md
  - title: 📊 Graphs & Tables
    details: View detailed statistics for runs, suites, tests, and keywords using charts, tables, and summary visualizations.
    link: /graphs-tables.md
  - title: 🔍 Filtering
    details: Apply filters to analyze trends in your test data and highlight specific tags, amounts or datetime ranges.
    link: /filtering.md
  - title: 🎨 Customization
    details: Customize dashboard sections, graph layouts, and visualizations to suit your workflow.
    link: /customization.md
  - title: ⚙️ Settings
    details: Configure dashboard preferences including themes, default views, graph options, and save your settings for consistent team-wide use.
    link: /settings.md
  - title: 🖥️ Dashboard Server
    details: Host the dashboard for multi-user access, programmatic updates, and remote server integration.
    link: /dashboard-server.md
  - title: 🗄️ Custom Database Class
    details: Extend or replace the default database backend to suit your storage needs, including SQLite, MySQL, or custom implementations.
    link: /custom-database-class.md
  - title: 🔔 Listener Integration
    details: Use a listener to automatically push test results to the dashboard for every executed run, integrating seamlessly into CI/CD pipelines.
    link: /listener-integration.md

---

## Setup and use the RobotDashboard command line interface (CLI)

<video controls autoplay loop muted playsinline style="max-width:100%; height: auto; border-radius:8px;">
  <source src="/setup.mp4" type="video/mp4">
  Your browser does not support the video element.
</video>

The video above demonstrates:

- How to install **robotdashboard**
- How to check the installed version
- How to access the robotdashboard help
- How to run your first command and load output files (with a custom dashboard name, run tags, and using log file linking)

> **Tip:** For detailed command-line instructions, check out [Basic Command Line Interface (CLI)](/basic-command-line-interface-cli.md) and [Advanced CLI & Examples](advanced-cli-examples.md)!


## View the dashboard and it's features

<video controls autoplay loop muted playsinline style="max-width:100%; height: auto; border-radius:8px;">
  <source src="/dashboard.mp4" type="video/mp4">
  Your browser does not support the video element.
</video>

The video above demonstrates:

- How to open the dashboard
- Which pages are available (dashboard, overview, compare, tables)
- Which sections are available (run, suite, test, keyword)
- How to switch graph views (bar/line/timeline etc.)
- How to apply filters
- How to customize your view

> **Tip:** For details regarding the dashboard checkout the related parts in the [Dashboard Documenation Section](/tabs-pages.md)!
