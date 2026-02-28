import { settings } from "./settings.js";

// colors
const passedBackgroundBorderColor = "#97bd61";
const passedBackgroundColor = "rgba(151, 189, 97, 0.7)";
const skippedBackgroundBorderColor = "#fed84f";
const skippedBackgroundColor = "rgba(254, 216, 79, 0.7)";
const failedBackgroundBorderColor = "#ce3e01";
const failedBackgroundColor = "rgba(206, 62, 1, 0.7)";
const greyBackgroundBorderColor = "#0f172a";
const greyBackgroundColor = "rgba(33, 37, 41, 0.7)";
const blueBackgroundBorderColor = "rgba(54, 162, 235)";
const blueBackgroundColor = "rgba(54, 162, 235, 0.5)";
const graphFontSize = 12;

// base bar config
const barConfig = {
    borderSkipped: false,
    borderRadius: () => {
        return {
            topLeft: settings.show.rounding,
            topRight: settings.show.rounding,
            bottomLeft: settings.show.rounding,
            bottomRight: settings.show.rounding
        };
    }
};
const passedConfig = {
    backgroundColor: passedBackgroundColor,
    borderColor: passedBackgroundBorderColor,
    ...barConfig,
}
const failedConfig = {
    backgroundColor: failedBackgroundColor,
    borderColor: failedBackgroundBorderColor,
    ...barConfig,
}
const skippedConfig = {
    backgroundColor: skippedBackgroundColor,
    borderColor: skippedBackgroundBorderColor,
    ...barConfig,
}
const blueConfig = {
    backgroundColor: blueBackgroundColor,
    borderColor: blueBackgroundBorderColor,
    ...barConfig,
}
// base line config
const lineConfig = {
    tension: 0.1,
    pointRadius: 4,
    pointHoverRadius: 6
}
// data label background rectangle config
const dataLabelConfig = {
    color: "#eee",
    backgroundColor: function (context) {
        return "rgba(0, 0, 0, 0.6)";
    },
    borderRadius: 4,
    padding: 3,
    align: "center",
    anchor: "center",
    font: {
        size: graphFontSize,
    },
}

export {
    passedBackgroundBorderColor,
    passedBackgroundColor,
    skippedBackgroundBorderColor,
    skippedBackgroundColor,
    failedBackgroundBorderColor,
    failedBackgroundColor,
    greyBackgroundBorderColor,
    greyBackgroundColor,
    blueBackgroundBorderColor,
    blueBackgroundColor,
    graphFontSize,
    barConfig,
    passedConfig,
    failedConfig,
    skippedConfig,
    blueConfig,
    lineConfig,
    dataLabelConfig,
};