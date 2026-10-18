import { settings } from "../variables/settings.js";
import { parse_test_tags } from "../common.js";

// function to prepare the data in the correct format for the duration deviation graph
function get_duration_deviation_data(dataType, graphType, filteredData) {
    const suiteSelectTests = document.getElementById("suiteSelectTests").value;
    const testSelect = document.getElementById("testSelect").value;
    const testTagsSelect = document.getElementById("testTagsSelect").value;
    const data = new Map();
    for (const value of filteredData) {
        if (dataType === "test") {
            if (settings.switch.suitePathsTestSection) {
                if (suiteSelectTests !== "All" && value.full_name !== `${suiteSelectTests}.${value.name}`) {
                    continue;
                }
            } else {
                if (suiteSelectTests !== "All" && !value.full_name.includes(`.${suiteSelectTests}.${value.name}`) && value.full_name !== `${suiteSelectTests}.${value.name}`) {
                    continue;
                }
            }
            if (testSelect !== "All" && value.name !== testSelect) {
                continue;
            }
            if (testTagsSelect !== "All" && !parse_test_tags(value.tags).includes(testTagsSelect)) {
                continue;
            }
        }
        if (data.has(value.name)) {
            data.get(value.name).push(value.elapsed_s);
        } else {
            data.set(value.name, [value.elapsed_s]);
        }
    }
    const labels = [];
    const datasets = [];
    for (const [testName, elapsedTimes] of data.entries()) {
        labels.push(testName);
        datasets.push(elapsedTimes);
    }
    return {
        labels,
        datasets: [{
            itemRadius: 3,
            data: datasets
        }],
    };
}

export {
    get_duration_deviation_data
};
