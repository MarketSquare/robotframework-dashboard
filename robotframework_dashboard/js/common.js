// function to get a higher folder path based on the full_path or partial full_path provided
function get_next_folder_level(currentPath, fullPath) {
    const fullParts = fullPath.split(".");
    const currentParts = currentPath.split(".");
    if (
        currentParts.length < fullParts.length &&
        fullParts.slice(0, currentParts.length).join(".") === currentPath
    ) {
        return fullParts.slice(0, currentParts.length + 1).join(".");
    }
    return currentPath;
}

// helper to format seconds into d/h/m/s + 100ths of a second
function format_duration(seconds) {
    if (seconds < 60) {
        // keep up to 2 decimals for sub-minute values
        const fixed = seconds.toFixed(2);
        return `${fixed.replace(/\.?0+$/, "")}s`; // strip trailing zeros
    }

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const sec = Math.floor(seconds % 60);

    let parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (sec > 0 && days === 0) parts.push(`${sec}s`); // only show seconds if <1d
    return parts.join(" ");
}

// returns run card duration class
function compare_to_average(duration, average, percent) {
    const t = parseFloat(percent) / 100;
    return duration < average * (1 - t) ? 'text-passed' :
        duration > average * (1 + t) ? 'text-failed' : '';
}

// function to convert to camelcase
function space_to_camelcase(string) {
    return string.replace(/(?:^\w|[A-Z]|\b\w)/g, function (word, index) {
        return index === 0 ? word.toLowerCase() : word.toUpperCase();
    }).replace(/\s+/g, "");
}

// function to convert to camelcase from underscores
function underscore_to_camelcase(str) {
    return str.replace(/_(.)/g, (match, group) => group.toUpperCase());
}

// function to convert camelcose to underscores
function camelcase_to_underscore(str) {
    return str
        .replace(/([A-Z]+)/g, "_$1")     // Prefix all capital groups with _
        .replace(/^_/, "")               // Remove leading underscore if it appears
        .toLowerCase();                  // Convert everything to lowercase
}

// function to convert a date object to the desired string format
function format_date_to_string(date) {
    const pad = (n) => n.toString().padStart(2, "0");
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1); // Months are 0-indexed
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// function to transform an output.xml path to a log.html path
function transform_file_path(filePath) {
    const normalizedPath = filePath.replace(/\\/g, "/");
    const pathSegments = normalizedPath.split("/");
    const filename = pathSegments.pop();
    const updatedFilename = filename.replace(/output/g, "log").replace(/\.xml$/i, ".html");
    const updatedPath = [...pathSegments, updatedFilename].join("/");
    return filePath.includes("\\") ? updatedPath.replace(/\//g, "\\") : updatedPath;
}

// function used to combine paths to open the correct log file, used in combination with a file server
function combine_paths(baseUrlStr, relativePath) {
    const baseUrl = new URL(baseUrlStr);
    const baseParts = baseUrl.pathname.split("/").filter(Boolean);
    const relParts = relativePath.replaceAll("\\", "/").split("/").filter(Boolean);
    // Find the first matching folder name from the relative path in the base path
    let match = null;
    for (let i = 0; i < relParts.length; i++) {
        const folder = relParts[i];
        const baseMatchIndex = baseParts.lastIndexOf(folder);
        if (baseMatchIndex !== -1) {
            match = { baseIndex: baseMatchIndex, relIndex: i };
            break;
        }
    }

    let combinedParts;
    if (match) {
        const baseSlice = baseParts.slice(0, match.baseIndex);
        const relSlice = relParts.slice(match.relIndex);
        combinedParts = [...baseSlice, ...relSlice];
    } else {
        combinedParts = relParts;
    }

    // Resolve "." and ".."
    const resolvedParts = [];
    for (const part of combinedParts) {
        if (part === ".") continue;
        if (part === "..") {
            if (resolvedParts.length > 0) resolvedParts.pop();
        } else {
            resolvedParts.push(part);
        }
    }

    return baseUrl.origin + "/" + resolvedParts.join("/");
}

// function to add an alert to the page
function add_alert(message, category, timeout = 5000) {
    const alertHTML = `<div class="row alert alert-${category} alert-dismissible" role="alert">
                <div class="col">${message}</div>
                <div class="col-auto">
                    <span onclick="close_alert()" type="button" class="close" data-dismiss="alert" aria-label="Close">
                        <span aria-hidden="true">&times;</span>
                    </span>
                </div>
            </div>`
    document.getElementById("alertContainer").innerHTML = alertHTML

    setTimeout(() => {
        close_alert()
    }, timeout);
}

// function to close the alerts
function close_alert() {
    document.getElementById("alertContainer").innerHTML = ""
}

// delay in milliseconds
function debounce(func, delay) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

// Show a loading overlay on an individual graph's container
function show_graph_loading(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const container = el.closest('.grid-stack-item-content') || el.closest('.table-section');
    if (!container || container.querySelector('.graph-loading-overlay')) return;
    const overlay = document.createElement('div');
    overlay.className = 'graph-loading-overlay';
    overlay.innerHTML = '<div class="ball-grid-beat ball-grid-beat-sm"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div>';
    container.appendChild(overlay);
}

// Hide the loading overlay from an individual graph's container
function hide_graph_loading(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const container = el.closest('.grid-stack-item-content') || el.closest('.table-section');
    if (!container) return;
    const overlay = container.querySelector('.graph-loading-overlay');
    if (overlay) overlay.remove();
}

// Show loading overlays on multiple graphs, run updateFn, then hide overlays
function update_graphs_with_loading(elementIds, updateFn) {
    elementIds.forEach(id => show_graph_loading(id));
    setTimeout(() => {
        updateFn();
        elementIds.forEach(id => hide_graph_loading(id));
    }, 0);
}

export {
    camelcase_to_underscore,
    get_next_folder_level,
    format_duration,
    compare_to_average,
    space_to_camelcase,
    underscore_to_camelcase,
    format_date_to_string,
    transform_file_path,
    combine_paths,
    add_alert,
    close_alert,
    debounce,
    show_graph_loading,
    hide_graph_loading,
    update_graphs_with_loading
};