---
outline: deep
---

# Advanced CLI & Examples

Explore advanced CLI features such as combined options, tagging strategies, linking log.html files, customizing dashboard behavior, and grouping error messages. This section provides practical examples and real-world usage patterns.

## Combining Multiple Options in a Single Command

Often you want to perform several actions at once: process new XMLs, remove old runs, use log linking, and use a different database file.

Example of a combined workflow:

```bash
robotdashboard -o output1.xml:tag1 -o output2.xml:tag2 \
               -r index=0:2 -u true -n robot_dashboard.html \
               -t "Cool Robot Dashboard" -d ./data/robot_results.db
```

This command:

- Imports two XML files, each with its own tags  
- Removes the oldest 3 (first 3 added, so index 0, 1, 2) runs  
- Uses the log linking feature enable log opening through graphs
- Uses a custom report name and title
- Uses a custom database path  

Useful when integrating into automation pipelines.

## Advanced Tagging Strategies

Tags can be used to group and categorize runs. These strategies help organize large test repositories or CI environments.
Within the filters it is possible to use AND or OR logic and select these **run tags**.

### Tag multiple XML files differently

```bash
robotdashboard -o output1.xml:chrome \
               -o output2.xml:firefox:nightly \
               -o output3.xml:edge:smoke
```

### Tag entire folder of outputs

```bash
robotdashboard -f ./results:nightly:linux
```

### Project tagging

It is possible to create custom views in the Overview tab. By default runs in this tab are grouped by project name.
However if you want to combine differently and create custom project tags you can do that by prefixing your tag with **project_**.
```bash
robotdashboard -o output.xml:project_custom_name
robotdashboard -f ./results:project_1
```

## Aliases for Clean Dashboard Identification

Aliases help replace long timestamps with clean, readable names. They also significantly improve clarity in comparison views and general dashboard readability.

### How aliases work

- By default, the dashboard identifies runs using their `run_start` timestamp.
- Alias display can be enabled in the **Dashboard Settings**.
- Aliases are generated **during processing** when output files are added to the database.
- The alias is derived from the output filename by removing only:
  - the prefix `output_`
  - the suffix `.xml`
- If no meaningful alias can be generated (e.g., all files are simply `output.xml`), the dashboard will generate fallback aliases such as **Alias 1**, **Alias 2**, etc.

### Important details

- Only the exact strings `output_` and `.xml` are removed.  
- Variations such as `output.xml`, `output-file.xml`, `output-123.xml`, etc. **will keep their prefix in their alias** (`output` or `output-`).

### Apply alias to a single output

- The example below will result in **my_alias1** and **my_alias2**

```bash
robotdashboard -o output_my_alias1.xml
robotdashboard -o output_my_alias2.xml
```

### Apply alias when importing a folder

- The example below will search **all subfolders** of `nightly_runs` and process every file matching `*output*.xml`.
- Aliases are generated from each filename using:
  `{filename}.replace("output_", "").replace(".xml", "")`

```bash
robotdashboard -f ./nightly_runs    
```

## Log Linking

The `--uselogs` (`-u`) flag enables interactive log navigation directly from dashboard graphs. When enabled, clicking on a graph element opens the corresponding `log.html` file.

```bash
robotdashboard -u true
```

For the full guide covering file naming conventions, local vs. server usage, and remote log uploads, see the dedicated [Log Linking](/log-linking.md) page.

## Message Config Details

Message configuration allows grouping similar test error messages.
It is especially useful for grouping recurring errors with changing error messages.

- By default, each message is grouped **only when it is an exact match**.
- Using placeholders enables grouping messages that follow the same pattern, even when certain values differ.
- Placeholder values are not visible in the dashboard graphs.

Example `message_config.txt` contents:

```bash
Expected ${x} but received: ${y}
The test Normal Test ${number} has failed for some strange reason
This test failed on date: ${date}
```

### Use message config

```bash
robotdashboard -m message_config.txt
```

## Using a Custom Dashboard Config (JSON)

When you open the dashboard, a `settings` entry is automatically created in **localStorage**.  
This object stores various user preferences, including:

- Theme (dark or light)
- Default Graph View (e.g., timeline or bar)
- Last Opened Tab (e.g., Overview or Dashboard)
- Last Saved Toggle Settings (e.g., suite paths, project tags)
- Graph Settings (e.g., animations, legends, axis titles)
- Customized Layout Configuration (e.g., size and position of graphs and sections)

You can export this configuration from:  
**Settings -> JSON -> Copy settings JSON**

After saving it as a file such as `dashboard_config.json`, you can supply it to the dashboard using the `--jsonconfig` flag.

### Settings Logic

1. If `--forcejsonconfig` is set and a `json_config` was provided, use that (merged with defaults).
2. If a `settings` item exists in localStorage, use it (merged with defaults). If it fails to parse, fall back to defaults and show an alert.
3. If not forcing and a `json_config` is provided, use it (merged with defaults).
4. Otherwise, keep the built-in defaults.

This order lets you pin a forced config, otherwise prefer what’s already stored, and finally fall back to defaults.

### Load a custom config on first dashboard load
```bash
robotdashboard -j ./configs/dashboard_config.json --forcejsonconfig
```
This ensures a consistent dashboard experience for all users.
```bash
robotdashboard -j ./configs/dashboard_config.json
```
With above command, the config is only applied on first load if no localStorage exists yet.

## Offline Dependencies

To accommodate environments with no internet access or very strict firewall rules, the dashboard can be generated using prepackaged JavaScript and CSS resources. When enabled, the `--offlinedependencies` option embeds these files directly into the generated `dashboard.html` instead of referencing external CDNs. The size of the dashboard.html will increase by about 1 MB when using this option.

The following dependencies are bundled with the package and will be used offline automatically:

| Name | Type | CDN URL | Used For |
|------|------|---------|----------|
| **chartjs** | JS | https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js | Core charting library |
| **datalabels** | JS | https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0 | Chart.js plugin for data labels |
| **adapter_date_fns** | JS | https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns/dist/chartjs-adapter-date-fns.bundle.min.js | Date handling adapter for time-based charts |
| **boxplot** | JS | https://unpkg.com/@sgratzl/chartjs-chart-boxplot@3.6.0/build/index.umd.min.js | Boxplot chart support |
| **matrix** | JS | https://cdn.jsdelivr.net/npm/chartjs-chart-matrix@2.0.1/dist/chartjs-chart-matrix.min.js | Matrix/heatmap charts |
| **gridstack_css** | CSS | https://cdn.jsdelivr.net/npm/gridstack@12.2.1/dist/gridstack.min.css | Layout grid styling |
| **gridstack_js** | JS | https://cdn.jsdelivr.net/npm/gridstack@12.2.1/dist/gridstack-all.min.js | Grid-based dashboard layout engine |
| **bootstrap_css** | CSS | https://cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/5.3.0/css/bootstrap.min.css | General UI styling |
| **datatables_css** | CSS | https://cdn.datatables.net/v/bs5/jq-3.7.0/dt-2.1.8/datatables.min.css | Table component styling |
| **bootstrap_js** | JS | https://cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/5.3.0/js/bootstrap.bundle.min.js | Bootstrap interactive components |
| **datatables_js** | JS | https://cdn.datatables.net/v/bs5/jq-3.7.0/dt-2.1.8/datatables.min.js | DataTables functionality |
| **pako** | JS | https://cdn.jsdelivr.net/npm/pako@2.1.0/dist/pako.min.js | Compression/decompression used for smaller dashboard file sizes |

### Behaviour

- When **not** using `--offlinedependencies`, the dashboard loads JS/CSS from the CDN URLs above and network access is required.
- When `--offlinedependencies` **is** enabled, the generator embeds the full content of each dependency directly into the HTML, ensuring zero external network requests.

For basic CLI documentation see [Basic Command Line Interface (CLI)](/basic-command-line-interface-cli.md) and for more advanced usage, the [Dashboard Server](/dashboard-server.md) and [Custom Database Class](/custom-database-class.md) pages
