from setuptools import setup, find_packages

extras = {
    "server": [
        "fastapi_offline>=1.7.5",
        "uvicorn>=0.33.0",
        "python-multipart",
    ],
}

extras["all"] = sorted({pkg for group in extras.values() for pkg in group})

setup(
    name="robotframework-dashboard",
    version="1.7.0",
    description="Output processor and dashboard generator for Robot Framework output files",
    long_description="""# 📊 Robot Framework Dashboard

Before reading anything else here is a [Fully Functioning Dashboard](https://marketsquare.github.io/robotframework-dashboard/example/robot_dashboard.html) you can checkout right away!

## 🎯 Overview

Robot Framework Dashboard is a tool for [Robot Framework](https://robotframework.org/) that provides insight of your test results across multiple runs. The tool makes use of the built in Robot Framework [Result Visitor API](https://robot-framework.readthedocs.io/en/stable/_modules/robot/result/visitor.html) to analyse output.xml files, stores these in a simple sqlite3 database and finally creates a HTML dashboard that makes use of [Chart.js](https://www.chartjs.org/docs/latest/) and [Datatables](https://datatables.net/) for the graphs and tables and makes use of [Bootstrap](https://getbootstrap.com/) for styling. Additionally [GridStack](https://gridstackjs.com/) is used for the interactive layout grids.

## 🚀 Getting Started
Install Robot Framework 6.0 or higher (if not already installed):
```bash
pip install robotframework
```
Install Robot Framework Dashboard:
```bash
pip install robotframework-dashboard
```
Install Robot Framework Dashboard with Server:
```bash
pip install robotframework-dashboard[server]
pip install robotframework-dashboard[all]
```

## 🔍 Key Features

- 🏃 **Multi-run Analysis** - Compare and track results across multiple Robot Framework test runs.  
- 🌐 **Interactive HTML Dashboard** - Fully interactive dashboard using Chart.js, Datatables, and GridStack.  
- 🗄️ **SQLite Database Storage** - Lightweight database for easy querying and persistent storage.  
- 📄 **Dashboard Pages** - Overview, Dashboard, and Compare pages for multi-level insights.  
- 🎛️ **Customizable Layouts** - Drag-and-drop sections with adjustable size and order.  
- 📊 **Graph Customization** - Toggle legends, axis titles, labels, and control animations.  
- 🔎 **Global Filters** - Filter runs by name, tags, date, metadata, or quantity.  
- ⚖️ **Comparison Mode** - Compare up to 4 runs side by side with visual statistics.  
- 🔗 **Automatic Log Linking** - Open Robot Framework logs directly from the dashboard.  
- 🛠️ **Custom Database Classes** - Extend or replace the database processor for custom backends.  
- 🖥️ **Server Mode** - Host your dashboard for multi-user access and automatic updates.  
- 🎧 **Listener Integration** - Automatically updates dashboard after every test run.  
- 📝 **Message Config Support** - Group similar test failures using regex-based patterns.  
- ⚙️ **Configurable Defaults** - Preload dashboard settings via JSON for consistent appearance.  

…and many more advanced features to help you visualize, analyze, and manage your Robot Framework test results with ease!

## 📖 Read the Docs
For detailed usage instructions, advanced examples, and full documentation, visit the [official robotdashboard docs](https://marketsquare.github.io/robotframework-dashboard/)!

### Quick Links
- 🚀 [**Getting Started**](https://marketsquare.github.io/robotframework-dashboard/getting-started.html) - Quick setup instructions to install Robot Framework and RobotFramework Dashboard, and verify it is working.
- 📦 [**Installation & Version Info**](https://marketsquare.github.io/robotframework-dashboard/installation-version-info.html) - Install the dashboard via pip, check Python and Robot Framework requirements, and view version information.
- 💻 [**Basic Command Line Interface (CLI)**](https://marketsquare.github.io/robotframework-dashboard/basic-command-line-interface-cli.html) - Manage your test results database, add output XML files, remove runs, and generate dashboards directly from the command line.
- ⚡ [**Advanced CLI & Examples**](https://marketsquare.github.io/robotframework-dashboard/advanced-cli-examples.html) - Advanced usage examples including combined commands, tagging strategies, aliases, batch imports, message configuration, and performance tips.
- 🗂️ [**Tabs / Pages**](https://marketsquare.github.io/robotframework-dashboard/tabs-pages.html) - Explore the dashboard's interactive pages including Overview, Dashboard, Compare, and detailed suite/test/keyword views.
- 📊 [**Graphs & Tables**](https://marketsquare.github.io/robotframework-dashboard/graphs-tables.html) - View and filter detailed statistics for runs, suites, tests, and keywords using charts, tables, and summary visualizations.
- 🔍 [**Filtering**](https://marketsquare.github.io/robotframework-dashboard/filtering.html) - Apply filters to analyze trends in your test data and highlight specific tags, amounts or datetime ranges.
- 🎨 [**Customization**](https://marketsquare.github.io/robotframework-dashboard/customization.html) - Customize dashboard sections, graph layouts, and visualizations to suit your workflow.
- ⚙️ [**Settings**](https://marketsquare.github.io/robotframework-dashboard/settings.html) - Configure dashboard preferences including themes, default views, graph options, and save your settings for consistent team-wide use.
- 🖥️ [**Dashboard Server**](https://marketsquare.github.io/robotframework-dashboard/dashboard-server.html) - Host the dashboard for multi-user access, programmatic updates, and remote server integration.
- 🗄️ [**Custom Database Class**](https://marketsquare.github.io/robotframework-dashboard/custom-database-class.html) - Extend or replace the default database backend to suit your storage needs, including SQLite, MySQL, or custom implementations.
- 🔔 [**Listener Integration**](https://marketsquare.github.io/robotframework-dashboard/listener-integration.html) - Use a listener to automatically push test results to the dashboard for every executed run, integrating seamlessly into CI/CD pipelines.
- 📂 [**Log Linking**](https://marketsquare.github.io/robotframework-dashboard/log-linking.html) - Enable clickable log navigation from dashboard graphs, covering file naming conventions, local and server usage, and remote log uploads.

## 🛠️ Contributions

Contributions are welcome! If you encounter any issues, have suggestions for improvements, or would like to add new features, feel free to open an issue or submit a pull request. Additional information can be found here in [Contributing](https://github.com/marketsquare/robotframework-dashboard/blob/main/CONTRIBUTING.md)

## 📋 License
This project is licensed under the MIT License.

> **Note:** This project is not officially affiliated with or endorsed by Robot Framework.
""",
    long_description_content_type="text/markdown",
    classifiers=[
        "Framework :: Robot Framework",
        "Programming Language :: Python",
        "Topic :: Software Development",
    ],
    keywords="robotframework dashboard reporting database",
    author="Tim de Groot",
    author_email="tim-degroot@live.nl",
    url="https://github.com/marketsquare/robotframework-dashboard",
    license="MIT",
    packages=find_packages(),
    include_package_data=True,
    zip_safe=False,
    install_requires=[
        "robotframework>=6.0",
    ],
    extras_require=extras,
    entry_points={
        "console_scripts": [
            "robotdashboard=robotframework_dashboard.main:main",
        ]
    },
)
