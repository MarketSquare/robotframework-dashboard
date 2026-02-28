---
outline: deep
---

# Customization

Learn how to customize the look, behavior, and configuration of the generated dashboard. This page covers available customization options, JSON configuration values, and how to tailor the dashboard to your reporting needs.

## Example Customization

<video controls autoplay loop muted playsinline style="max-width:100%; height: auto; border-radius:8px;">
  <source src="/customization.mp4" type="video/mp4">
  Your browser does not support the video element.
</video>

The video above walks through three examples of how you can tailor the dashboard to match your reporting needs:

### 1. The Dashboard Page

See how you can reshape the main dashboard layout by:

- resizing individual graphs  
- reordering graphs within their sections  
- hiding graphs you don’t want to display  
- rearranging entire sections to match your preferred workflow  
- it is also possible to combine all sections into a single unified view, see [Settings - General Settings (Graphs Tab)](/settings#general-settings-graphs-tab), for the details
- the unified title will be the same as the `-t, --dashboardtitle` [CLI argument](/basic-command-line-interface-cli.html#set-a-custom-html-title) if provided, otherwise it defaults to "Dashboard Statistics"

### 2. The Compare Page

Watch how the Compare page can be adjusted by:

- resizing comparison charts  
- reorganizing the visual layout to highlight the most relevant comparisons  

### 3. The Tables Page

The demo also shows how to adapt the Tables view by:

- hiding tables that aren’t needed  
- reordering tables to place the most important information first  

These examples illustrate how flexible the configuration system is, letting you build a dashboard experience that fits your team and your use cases.

### 4. Resetting the Configuration

At the end of the video, you’ll see how you can easily **reset all customizations** by going to the **Settings** page and restoring the defaults.  
This quickly brings the dashboard back to its original configuration.

### 5. Theme Colors

The dashboard supports custom color overrides for both light and dark modes. In the Settings modal's **Theme** tab, you can customize:

| Color | Purpose |
|-------|---------|
| **Background** | Main page background color |
| **Card** | Background color for graph cards and content panels |
| **Highlight** | Accent color for hover states and interactive elements |
| **Text** | Primary text color across the dashboard |

Each color has a **Reset** button to restore its default value. Light and dark mode colors are configured independently, allowing different color schemes per theme.

See [Settings - Theme Tab](/settings#theme-settings-theme-tab) for more details.

### 6. Viewing (and Editing) the JSON Configuration

You can directly inspect the full configuration—exactly as the UI generates it—by opening the `view` key in the JSON output.  
This layout metadata is produced using **[GridStack](https://www.npmjs.com/package/gridstack/v/12.2.1)**.

> ⚠️ Manually editing this JSON can be challenging because GridStack uses nested layout structures, coordinates, and sizing metadata.  
> It’s recommended to adjust your layout through the UI unless you know the GridStack format well.

These examples illustrate how flexible the configuration system is, letting you build a dashboard experience that fits your team and your use cases.