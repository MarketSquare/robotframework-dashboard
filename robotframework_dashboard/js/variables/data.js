// prepare input data
const runs = decode_and_decompress("placeholder_runs");
const suites = decode_and_decompress("placeholder_suites");
const tests = decode_and_decompress("placeholder_tests");
const keywords = decode_and_decompress("placeholder_keywords");
const exceptions = decode_and_decompress("placeholder_exceptions");

function decode_and_decompress(base64Str) {
    if (base64Str.includes("placeholder_")) return [];
    const compressedData = Uint8Array.from(atob(base64Str), c => c.charCodeAt(0));
    const decompressedData = pako.inflate(compressedData, { to: 'string' });
    return JSON.parse(decompressedData);
}

var unified_dashboard_title = '"placeholder_dashboard_title"'
var message_config = '"placeholder_message_config"'
var force_json_config = "placeholder_force_json_config"
var json_config = "placeholder_json_config"
var filteredAmount = "placeholder_amount"
var filteredAmountDefault = 0
const use_logs = "placeholder_use_logs"
const server = "placeholder_server"
const no_auto_update = "placeholder_no_autoupdate"
if (!message_config.includes("placeholder_message_config")) { message_config = JSON.parse(message_config) }

export {
    runs,
    suites,
    tests,
    keywords,
    exceptions,
    message_config,
    force_json_config,
    json_config,
    filteredAmount,
    filteredAmountDefault,
    use_logs,
    server,
    unified_dashboard_title,
    no_auto_update
};