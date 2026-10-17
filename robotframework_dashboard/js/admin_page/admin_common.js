// function to add an alert to the admin page
function add_alert(message, category, timeout = 10000) {
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

// copy of js/escape.js, the admin bundle only includes the files in js/admin_page/
function escape_html(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// DataTables renders cell data as HTML, so the displayed text is escaped
const textRender = (data, type) => type === "display" ? escape_html(data) : data;

export {
    add_alert,
    close_alert,
    escape_html,
    textRender,
};