// function to add an alert to the hub page
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

export {
    add_alert,
    close_alert,
};
