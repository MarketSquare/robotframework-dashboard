import { add_alert } from "./admin_common.js";
import { confirm_action } from "./admin_eventlisteners.js";

let runTable;
let logTable;

// function to add an output to the database based on a path
function add_output_path() {
    document.getElementById("addPathSpinner").hidden = false
    const outputPath = document.getElementById("outputPath").value
    const outputTags = document.getElementById("outputTags").value.split(":")
    const outputVersion = document.getElementById("outputVersion").value
    document.getElementById("outputPath").value = ""
    document.getElementById("outputTags").value = ""
    document.getElementById("outputVersion").value = ""

    const body = JSON.stringify({
        output_path: outputPath,
        output_tags: outputTags,
        output_version: outputVersion,
    });
    send_request("POST", "/add-outputs", body, "addPathSpinner")
}

// function to upload an output file to the database
function add_output_file() {
    document.getElementById("addFileSpinner").hidden = false
    const fileInput = document.getElementById("outputFile")
    const file = fileInput.files[0]

    if (!file) {
        alert("Please select a file first!")
        document.getElementById("addFileSpinner").hidden = true
        return
    }

    const formData = new FormData()
    formData.append("file", file)
    formData.append("tags", document.getElementById("outputFileTags").value)
    formData.append("version", document.getElementById("outputFileVersion").value)

    send_request("POST", "/add-output-file", formData, "addFileSpinner")
}

// function to add an output to the database based on raw data
function add_output_data() {
    document.getElementById("addDataSpinner").hidden = false
    const outputData = document.getElementById("outputData").value
    const outputDataTags = document.getElementById("outputDataTags").value.split(":")
    const outputAlias = document.getElementById("outputDataAlias").value
    const outputDataVersion = document.getElementById("outputDataVersion").value
    document.getElementById("outputData").value = ""
    document.getElementById("outputDataTags").value = ""
    document.getElementById("outputDataAlias").value = ""
    document.getElementById("outputDataVersion").value = ""

    const body = JSON.stringify({
        output_data: outputData,
        output_tags: outputDataTags,
        output_alias: outputAlias,
        output_version: outputDataVersion,
    });
    send_request("POST", "/add-outputs", body, "addDataSpinner")
}

// function to add output(s) to the database based on a folder path
function add_output_folder_path() {
    document.getElementById("addFolderSpinner").hidden = false
    const outputFolderPath = document.getElementById("outputFolderPath").value
    const outputFolderTags = document.getElementById("outputFolderTags").value.split(":")
    const outputFolderVersion = document.getElementById("outputFolderVersion").value
    document.getElementById("outputFolderPath").value = ""
    document.getElementById("outputFolderTags").value = ""
    document.getElementById("outputFolderVersion").value = ""

    const body = JSON.stringify({
        output_folder_path: outputFolderPath,
        output_tags: outputFolderTags,
        output_version: outputFolderVersion,
    });
    send_request("POST", "/add-outputs", body, "addFolderSpinner")
}

// function to remove outputs from the database
function remove_outputs() {
    document.getElementById("removeSpinner").hidden = false
    var [data, run_starts, indexes, aliases, tags] = [{}, [], [], [], []]
    const removeRunStarts = document.getElementById("removeRunStarts").value.split(",")
    for (const runStart of removeRunStarts) {
        if (runStart == "") { continue }
        run_starts.push(runStart)
    }
    if (run_starts.length > 0) { data["run_starts"] = run_starts }
    const removeIndexes = document.getElementById("removeIndexes").value.split(";")
    for (const index of removeIndexes) {
        if (index == "") { continue }
        indexes.push(index)
    }
    if (indexes.length > 0) { data["indexes"] = indexes }
    const removeAliases = document.getElementById("removeAliases").value.split(",")
    for (const removeAlias of removeAliases) {
        if (removeAlias == "") { continue }
        aliases.push(removeAlias)
    }
    if (aliases.length > 0) { data["aliases"] = aliases }
    const removeTags = document.getElementById("removeTags").value.split(",")
    const removeLimit = document.getElementById("removeLimit").value
    if (removeLimit != "") { data["limit"] = removeLimit }
    for (const removeTag of removeTags) {
        if (removeTag == "") { continue }
        tags.push(removeTag)
    }
    if (tags.length > 0) { data["tags"] = tags }
    document.getElementById("removeRunStarts").value = ""
    document.getElementById("removeIndexes").value = ""
    document.getElementById("removeAliases").value = ""
    document.getElementById("removeTags").value = ""
    document.getElementById("removeLimit").value = ""
    const body = JSON.stringify(data)
    send_request("DELETE", "/remove-outputs", body, "removeSpinner")
}

async function remove_all_outputs() {
    const confirmed = await confirm_action(`Are you sure you want to remove ALL outputs from the database?<br><br>
                This is irreversible and will remove all outputs stored in the database!
                `);
    if (confirmed) {
        try {
            document.getElementById("removeAllOutputsSpinner").hidden = false
            const body = JSON.stringify({
                all: true,
            });
            send_request("DELETE", "/remove-outputs", body, "removeAllOutputsSpinner")
        } catch (e) {
            add_alert("Failed to remove all outputs: " + e, "danger")
        }
    }
}

// function to retrieve all outputs currently in the database
function get_outputs() {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", "/get-outputs");
    xhr.setRequestHeader("Content-Type", "application/json; charset=UTF-8");
    xhr.onload = () => {
        if (xhr.readyState == 4 && xhr.status == 200) {
            const runs = JSON.parse(xhr.responseText)
            const data = runs.map((run, index) => [
                index,
                run.run_start ?? "",
                run.name ?? "",
                run.alias ?? "",
                Array.isArray(run.tags) ? run.tags.join(", ") : (run.tags ?? ""),
            ])

            if (runTable) {
                runTable.clear();
                runTable.rows.add(data);
                runTable.draw();
            } else {
                runTable = new DataTable("#runTable", {
                    columns: [
                        { title: "Run Index" },
                        { title: "Run Start" },
                        { title: "Run Name" },
                        { title: "Run Alias" },
                        { title: "Run Tags" },
                    ],
                    data: data,
                });
            }
        } else {
            add_alert(`Error: ${xhr.status}, ${xhr.responseText}`, "danger")
        }
    };
    xhr.send();
}

// function to send requests (helper function for other functions that do similar server requests)
function send_request(method, endpoint, body, spinner, notifications = true) {
    const xhr = new XMLHttpRequest();
    xhr.open(method, endpoint);
    if (endpoint != "/add-output-file" && endpoint != "/add-log-file") {
        xhr.setRequestHeader("Content-Type", "application/json; charset=UTF-8");
    }
    xhr.onload = () => {
        if (xhr.readyState == 4 && xhr.status == 200) {
            document.getElementById(spinner).hidden = true
            response = JSON.parse(xhr.responseText);
            if (response.success == "1") {
                console.log(response.console)
                if (notifications) {
                    if (response.console.includes("ERROR")) {
                        add_alert("SUCCESS: The processing was handled but some errors occurred, see the browser console for more details!", "warning")
                    } else {
                        add_alert(response.message, "success")
                    }
                }
            } else {
                add_alert(response.message, "danger")
                console.log(response.console)
            }
            if (document.body.dataset.noAutoupdate !== "true") {
                get_outputs()
                get_logs()
            }
        } else {
            document.getElementById(spinner).hidden = true
            add_alert(`Error: ${xhr.status}, ${xhr.responseText}`, "danger")
        }
    };
    xhr.send(body);
}

// function to retrieve all logs currently on the server
function get_logs() {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", "/get-logs");
    xhr.setRequestHeader("Content-Type", "application/json; charset=UTF-8");
    xhr.onload = () => {
        if (xhr.readyState == 4 && xhr.status == 200) {
            const logs = JSON.parse(xhr.responseText)
            const data = logs.map((log, index) => [
                index,
                log.log_name,
            ])
            if (logTable) {
                logTable.clear();
                logTable.rows.add(data);
                logTable.draw();
            } else {
                logTable = new DataTable("#logTable", {
                    columns: [
                        { title: "Log Index" },
                        { title: "Log Name" },
                    ],
                    data: data,
                });
            }
        } else {
            add_alert(`Error: ${xhr.status}, ${xhr.responseText}`, "danger")
        }
    };
    xhr.send();
}

// function to add a logs raw data to the server and update the database
function add_log() {
    document.getElementById("addLogDataSpinner").hidden = false
    const logData = document.getElementById("logData").value
    const logName = document.getElementById("logName").value
    document.getElementById("logData").value = ""
    document.getElementById("logName").value = ""

    const body = JSON.stringify({
        log_data: logData,
        log_name: logName,
    });
    send_request("POST", "/add-log", body, "addLogDataSpinner")
}

// function to upload an log file to the server
function add_log_file() {
    document.getElementById("addFileSpinner").hidden = false
    const fileInput = document.getElementById("logFile")
    const file = fileInput.files[0]

    if (!file) {
        alert("Please select a file first!")
        document.getElementById("addLogFileSpinner").hidden = true
        return
    }

    const formData = new FormData()
    formData.append("file", file)

    send_request("POST", "/add-log-file", formData, "addFileSpinner")
}

// function to remove outputs from the database
function remove_log() {
    document.getElementById("removeLogDataSpinner").hidden = false
    const removeLog = document.getElementById("removeLog").value
    document.getElementById("removeLog").value = ""
    const body = JSON.stringify({
        log_name: removeLog,
    });
    send_request("DELETE", "/remove-log", body, "removeLogDataSpinner")
}

async function remove_all_logs() {
    const confirmed = await confirm_action(`Are you sure you want to remove ALL logs from the database?<br><br>
                This is irreversible and will remove all logs stored in the database!
                `);
    if (confirmed) {
        try {
            document.getElementById("removeAllLogsSpinner").hidden = false
            const body = JSON.stringify({
                all: true,
            });
            send_request("DELETE", "/remove-log", body, "removeAllLogsSpinner")
        } catch (e) {
            add_alert("Failed to remove all logs: " + e, "danger")
        }
    }
}

// function to manually trigger dashboard HTML regeneration
function refresh_dashboard() {
    document.getElementById("refreshDashboardSpinner").hidden = false
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/refresh-dashboard");
    xhr.setRequestHeader("Content-Type", "application/json; charset=UTF-8");
    xhr.onload = () => {
        document.getElementById("refreshDashboardSpinner").hidden = true
        if (xhr.readyState == 4 && xhr.status == 200) {
            const response = JSON.parse(xhr.responseText);
            if (response.success == "1") {
                console.log(response.console)
                add_alert(response.message, "success")
            } else {
                add_alert(response.message, "danger")
                console.log(response.console)
            }
        } else {
            add_alert(`Error: ${xhr.status}, ${xhr.responseText}`, "danger")
        }
    };
    xhr.send(JSON.stringify({}));
}

// function to manually refresh the admin page tables (outputs and logs)
function refresh_admin_tables() {
    document.getElementById("refreshAdminTablesSpinner").hidden = false
    get_outputs()
    get_logs()
    document.getElementById("refreshAdminTablesSpinner").hidden = true
    add_alert("Admin page tables refreshed!", "success")
}

export {
    add_output_path,
    add_output_file,
    add_output_data,
    add_output_folder_path,
    remove_outputs,
    remove_all_outputs,
    get_outputs,
    get_logs,
    add_log,
    add_log_file,
    remove_log,
    remove_all_logs,
    refresh_dashboard,
    refresh_admin_tables,
};