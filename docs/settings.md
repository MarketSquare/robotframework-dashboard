---
outline: deep
---

# Settings

RobotFramework Dashboard includes a fully customizable configuration system that controls how the dashboard looks and behaves.  

## General

The settings modal is divided into **five tabs**:

1. **Graphs** – general dashboard and chart behavior  
2. **Keywords** – which keyword libraries appear in keyword graphs  
3. **Overview** – controls for the Overview page layout and toggles  
4. **Theme** – custom color overrides for light and dark mode  
5. **JSON** – direct editing of the full JSON config for advanced users  

## Theme Toggle

The dashboard can be displayed in **light mode** or **dark mode**.  
This setting is applied globally across all dashboard pages and graphs.
This can be set through the sun/moon icon in the menu bar.

## General Settings (Graphs Tab)

The **Graphs** tab contains the core configuration options for all charts in the dashboard. These settings influence how the dashboard is generated and how graphs are rendered.

### Details

| Setting | Description |
|--------|-------------|
| **Unified Dashboard Sections** | Show all dashboard sections in a single unified view. (Instead of run/suite/test/keyword separate) |
| **Display Legends** | Show or hide graph legends. Useful to disable this when graphs contain many series. |
| **Display Axis Titles** | Shows axis labels (e.g., *Run Time*, *Pass/Fail Count*). Disable for a cleaner look. |
| **Display Run Start/Alias Labels On Axes** | Enables labels directly on graph axes. Disable for a cleaner look. |
| **Display Alias Labels** | Labels graphs using **aliases** instead of the default *run_start*. |
| **Display Prefixes** | Shows or hides the `project_` prefix text on Overview page tags. |
| **Display Milliseconds Run Start Labels** | Adds millisecond precision to run_start timestamps. |
| **Display Drawing Animations** | Enables animated graph rendering. |
| **Animation Duration (Milliseconds)** | Length of animation, e.g. `1500` ms. |
| **Bar Graph Edge Rounding (Pixels)** | Controls rounding of bar edges (e.g., `0` = square, `8` = softer). |

### Saving Settings

- Press **Close** or click outside the modal -> **settings are saved automatically**
- No need to manually apply changes for the **Graphs** tab

## Keyword Settings (Keywords Tab)

The **Keywords** tab controls which libraries appear inside the Keyword Graphs.  
This allows you to include or exclude specific libraries based on your dashboard needs.

### Details

- A list of discovered libraries is shown  
- Each library has an **enable/disable toggle**  
- Disabled libraries will **not** appear in the keyword section  
- Enabled libraries remain fully visible and included in statistics  

### Saving Keyword Settings

- Closing the modal **automatically saves** your keyword selections  
- No need to press additional buttons in this tab

## Overview Settings (Overview Tab)

The **Overview** tab controls which sections and filters are visible on the Overview page. These toggles let you tailor the Overview layout to your needs.

### Details

| Setting | Default | Description |
|---------|---------|-------------|
| **Latest Runs** | On | Show the Latest Runs bar displaying the most recent run per project with color-coded durations. |
| **Total Stats** | On | Show the Total Stats bar with aggregate pass/fail/skip counts and average pass rates across all runs per project. |
| **Projects by Name** | On | Group and display projects by their run name on the Overview. |
| **Projects by Tag** | Off | Group and display projects by custom `project_` tags. See [Project Tagging](/advanced-cli-examples#project-tagging). |
| **Display Prefixes** | On | Show the `project_` prefix text on tag-based project names. |
| **Percentage Filters** | On | Show the duration percentage threshold filter for color-coding run durations. |
| **Version Filters** | On | Show the version filter allowing per-project version selection. |
| **Sort Filters** | On | Show the sort filter controls on the Overview. |

### Saving Overview Settings

- Closing the modal **automatically saves** your overview selections  
- No need to press additional buttons in this tab

## Theme Settings (Theme Tab)

The **Theme** tab allows you to override the default colors used by the dashboard in both light and dark modes. Each mode has independent color customization.

### Details

| Color | Description |
|-------|-------------|
| **Background** | The main page background color. |
| **Card** | The background color for graph cards and content panels. |
| **Highlight** | The accent color used for hover states and interactive elements. |
| **Text** | The primary text color across the dashboard. |

### Usage

- Select **Light** or **Dark** mode to edit the colors for that theme  
- Use the color pickers to set custom values  
- Each color has a **Reset** button to restore its default value  
- Changes apply immediately when closing the modal  

### Saving Theme Settings

- Closing the modal **automatically saves** your theme selections  
- Theme colors are stored in localStorage alongside other settings  
- Export via the JSON tab to share custom themes with your team

## JSON Settings (JSON Tab)

For advanced use cases, you can directly edit the internal settings JSON.  
This allows complete control over:

- Section ordering  
- Graph ordering  
- Graph sizes  
- Switch toggles  
- Display toggles  
- Keyword configuration  
- Animation settings  
- Theme and visual preferences  

> **Tip:** See [Advanced CLI](/advanced-cli-examples.html#using-a-custom-dashboard-config-json) for sharing a default config with team members!

### Details

- The “Current Settings JSON” textfield shows the current configuration  
- You may edit it directly to modify any setting  
- Available options:
  - **Copy Settings JSON** — copies the settings JSON to clipboard
  - **Apply Settings JSON** — applies the content of the JSON box  
  - **Reset Settings JSON** — resets the JSON to default values
- Pressing **Close** will *not* apply changes in this tab
