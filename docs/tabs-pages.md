---
outline: deep
---

# Tabs / Pages

An overview of all pages available in the generated dashboard.html. Learn the purpose of each tab, what information it shows, and how it helps you analyze your test results.

## Overview Page
The Overview page provides a high-level summary of all test runs, highlighting the latest results for each project.  
It shows key metrics such as pass/fail/skip counts, recent trends, and overall performance, enabling users to quickly assess the health of their test suites.  
There are also 2 special sections on the Overview page: The "Latest Runs" and "Total Stats" which show the latest run for each project and the total stats for all runs by project/tag respectively.
The Overview Statistics section shows the latest run for each project, the sections below it show all runs for each project.  
You can toggle if you want to show or hide runs for projects or custom project tags.  
See [Advanced CLI & Examples](advanced-cli-examples.md#project-tagging) for more information on Tags!  
For a more in depth explanation, hover over the "i" icons in the Overview Statistics and the sections below it in the [Example Dashboard](https://marketsquare.github.io/robotframework-dashboard/example/robot_dashboard.html)

## Dashboard Page
The Dashboard page offers rich, interactive visualizations for a detailed analysis of test results. Graphs are available at four levels—runs, suites, tests, and keywords—allowing teams to track performance, detect flaky tests, and monitor trends over time. The layout is fully customizable (see [Customization](customization.md)). You can drag and drop graphs and sections to create your preferred view. Most graphs support multiple display modes, including timeline, percentage, bar, donut, and advanced types like boxplots and heatmaps. Each graph also provides detailed popups to explain what the view represents and how the data is calculated (see [Graphs & Tables](graphs-tables.md)).

### Unified Mode
The Dashboard supports a **Unified Mode** that combines all four sections (run, suite, test, keyword) into a single scrollable view instead of separate tabbed sections. This can be enabled via [Settings - Graphs Tab](/settings#general-settings-graphs-tab) using the **Unified Dashboard Sections** toggle.

In Unified Mode:
- All graphs from all sections are shown on one page
- A **Section Filters** button opens a modal for cross-section filtering (suite, test, and keyword filters)
- The page title defaults to "Dashboard Statistics" or uses the custom `--dashboardtitle` value if provided
- Layout customization and persistence works independently from the standard view

## Compare Page
The Compare page enables side-by-side comparison of up to four test runs. It presents comprehensive statistics, charts, and summaries for each run, making it simple to identify differences, trends, regressions, or improvements between builds or environments.

## Tables Page
The Tables page gives direct access to the raw data stored in the database. It displays detailed tables for runs, suites, tests, and keywords, making it perfect for debugging, verifying imported data, or performing ad-hoc analyses.
