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

## 1. The Dashboard Page

See how you can reshape the main dashboard layout by:

- resizing individual graphs  
- reordering graphs within their sections, either by dragging or using the **Move to First** / **Move to Last** buttons (see [Move to First / Move to Last](#12-move-to-first-move-to-last))
- hiding graphs you don’t want to display  
- rearranging entire sections to match your preferred workflow  
- it is also possible to combine all sections into a single unified view, see [Settings - Defaults Tab](/settings#defaults-settings-defaults-tab), for the details
- the unified title will be the same as the `-t, --dashboardtitle` [CLI argument](/basic-command-line-interface-cli.html#set-a-custom-html-title) if provided, otherwise it defaults to "Dashboard Statistics"

## 2. The Compare Page

Watch how the Compare page can be adjusted by:

- resizing comparison charts  
- reorganizing the visual layout to highlight the most relevant comparisons  

## 3. The Tables Page

The demo also shows how to adapt the Tables view by:

- hiding tables that aren’t needed  
- reordering tables to place the most important information first  

These examples illustrate how flexible the configuration system is, letting you build a dashboard experience that fits your team and your use cases.

## 4. Resetting the Configuration

At the end of the video, you’ll see how you can easily **reset all customizations** by going to the **Settings** page and restoring the defaults.  
This quickly brings the dashboard back to its original configuration.

## 5. Theme Colors

The dashboard supports custom color overrides for both light and dark modes. In the Settings modal's **Theme** tab, you can customize:

| Color | Purpose |
|-------|---------|
| **Background** | Main page background color |
| **Card** | Background color for graph cards and content panels |
| **Highlight** | Accent color for hover states and interactive elements |
| **Text** | Primary text color across the dashboard |

Each color has a **Reset** button to restore its default value. Light and dark mode colors are configured independently, allowing different color schemes per theme.

See [Settings - Theme Tab](/settings#theme-settings-theme-tab) for more details.

## 6. Custom Branding (Title and Logo)

The **Theme** tab also lets you personalize the navigation bar with your own branding:

- **Custom Title** — type a label into the *Custom Title* field and it appears in the menu bar next to the logo. Leave the field blank to hide it. The title is stored in localStorage under `branding.title`.
  > If `-t` / `--dashboardtitle` was set when generating the dashboard, that value takes **priority** over the Custom Title field and cannot be overridden from the UI.
- **Custom Logo** — upload a PNG image via the *Custom Logo* file picker to replace the default Robot Framework logo in the navigation bar. Click **Reset** to restore the default logo. Images of any size or aspect ratio are accepted — the dashboard automatically scales and pads the image to a square before storing it, so it fits neatly in the 24 × 24 px logo slot. The logo is also applied as the browser tab **favicon**. The image is stored as a data-URL in localStorage under `branding.logo`.

Both settings take effect immediately and persist across page reloads.

## 7. Responsive Menu Bar

The navigation bar automatically adapts to any screen width — no manual configuration required:

- When the viewport becomes too narrow to display all page links, the menu items (*Overview*, *Dashboard*, *Compare*, *Tables*, etc.) are moved into a **slide-in sidebar**.
- If the viewport is even smaller and the icon shortcuts also no longer fit, those move into the sidebar too.
- A **hamburger button** (☰) appears in the top-right corner whenever items have been moved to the sidebar. Clicking it opens the sidebar; clicking the backdrop or the close button dismisses it.
- The sidebar reorganizes itself to reflect the current page order configured by the user.

This behavior is fully automatic and requires no action from the user.

## 8. Viewing (and Editing) the JSON Configuration

You can directly inspect the full configuration—exactly as the UI generates it—by opening the `view` key in the JSON output.  
This layout metadata is produced using **[GridStack](https://www.npmjs.com/package/gridstack/v/12.2.1)**.

> ⚠️ Manually editing this JSON can be challenging because GridStack uses nested layout structures, coordinates, and sizing metadata.  
> It’s recommended to adjust your layout through the UI unless you know the GridStack format well.

These examples illustrate how flexible the configuration system is, letting you build a dashboard experience that fits your team and your use cases.

## 9. Stat Widgets

Stat widgets display a single KPI value (executed runs, failed tests, etc.) as a compact tile you can add to any dashboard section grid — both in regular dashboard mode and in [Unified View](/settings#defaults-settings-defaults-tab).

To add a stat widget:

1. Enter **Customize view** mode.
2. Click the **"Add stat widget"** icon in the section header (top-right of the section, next to the other header icons) of the target grid.
3. The popup has two tabs:
   - **Single** — choose one **statistic** to display and optionally pick a **text color** and **background color**, then click **Add Widget**.
   - **Multiple** — toggle on any number of stats from the list (use **Toggle all** to select/deselect everything at once), optionally adjust each widget's title, and either use **random colors** or pick a shared **text color** and **background color** for all of them. Click **Add Selected Widgets** to add them all at once.
4. The widget(s) are placed in the grid and can be dragged or resized like any other graph.
5. Click **Save** to persist the layout to localStorage.

To remove a stat widget, enter Customize view mode and click the **✕** button in its top-right corner.

Stat widgets are stored in localStorage and survive page reloads.

## 10. Custom Section Dividers

Custom section dividers are full-width horizontal bars you can place anywhere in the **Unified View** grid as visual separators or group headers. They are only available when [Unified View](/settings#defaults-settings-defaults-tab) is active.

To add a section divider:

1. Enter **Customize view** mode.
2. Click the **"Add custom section"** icon in the unified section's header (top-right, next to the other header icons).
3. In the popup, enter a **title** (up to 60 characters) and optionally choose a **text color** and **background color**.
4. Click **Add** — the divider spans the full grid width and can be dragged to any row.
5. Click **Save** to persist the layout to localStorage.

To remove a divider, enter Customize view mode and click the **✕** button on the right side of the bar.

Section dividers are stored in localStorage and survive page reloads.

## 11. Link Widgets

Link widgets are clickable tiles you can add to any dashboard section grid. Each tile displays a label and the destination URL, and navigates to that URL when clicked — either in the same tab or in a new tab. They are available in all sections (Run, Suite, Test, Keyword) and in [Unified View](/settings#defaults-settings-defaults-tab).

To add a link widget:

1. Enter **Customize view** mode.
2. Click the **"Add link widget"** icon in the section header (top-right of the section, next to the other header icons) of the target grid.
3. In the popup, enter a **label** (the display name shown on the tile) and the **URL** to navigate to.
4. Check **Open in new tab** if you want the link to open in a new browser tab. Leave it unchecked to navigate in the current tab.
5. Optionally pick a **text color** and **background color** for the tile.
6. Click **Add** — the widget is placed in the grid and can be dragged or resized like any other tile.
7. Click **Save** to persist the layout to localStorage.

To remove a link widget, enter Customize view mode and click the **✕** button in its top-right corner.

> Link widgets are not clickable while Customize view mode is active — this prevents accidental navigation while you are rearranging the layout. Clicking the tile in normal mode navigates to the configured URL.

Link widgets are stored in localStorage and survive page reloads.

## 12. Move to First / Move to Last

While in **Customize view** mode, every graph and widget shows a **"Move to First"** and **"Move to Last"** control alongside its other edit icons. Clicking one of these instantly moves the item to the start or end of its grid, without needing to drag it past every other item in between.

This works for regular graphs as well as stat widgets, link widgets, and custom section dividers. Click **Save** to persist the new order to localStorage.