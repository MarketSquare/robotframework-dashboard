// the input data, filled by load_data() which main() awaits before anything reads it
let runs = [];
let suites = [];
let tests = [];
let keywords = [];
let exceptions = [];

async function load_data() {
    [runs, suites, tests, keywords, exceptions] = await Promise.all([
        decode_and_decompress("placeholder_runs"),
        decode_and_decompress("placeholder_suites"),
        decode_and_decompress("placeholder_tests"),
        decode_and_decompress("placeholder_keywords"),
        decode_and_decompress("placeholder_exceptions"),
    ]);
}

// the payloads are zlib compressed JSON, inflated with the native DecompressionStream
async function decode_and_decompress(base64Str) {
    if (base64Str.includes("placeholder_")) return [];
    // a plain loop is much faster than Uint8Array.from with a map callback on large payloads
    const binaryStr = atob(base64Str);
    const compressedData = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
        compressedData[i] = binaryStr.charCodeAt(i);
    }
    const stream = new Blob([compressedData]).stream().pipeThrough(new DecompressionStream("deflate"));
    return new Response(stream).json();
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
    load_data,
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