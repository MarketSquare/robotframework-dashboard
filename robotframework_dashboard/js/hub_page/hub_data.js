// Hub data — decoded from the embedded base64+pako payload at generation time.
// These variables are set via placeholder substitution by hub_generator.py.
const hub_projects = decode_and_decompress("placeholder_hub_data");

var hub_title_raw = '"placeholder_hub_title"';
var hub_version_raw = '"placeholder_version"';

if (!hub_title_raw.includes('placeholder_')) { hub_title_raw = JSON.parse(hub_title_raw); }
if (!hub_version_raw.includes('placeholder_')) { hub_version_raw = JSON.parse(hub_version_raw); }

function decode_and_decompress(base64Str) {
    if (base64Str.includes("placeholder_")) return [];
    const compressedData = Uint8Array.from(atob(base64Str), c => c.charCodeAt(0));
    const decompressedData = pako.inflate(compressedData, { to: 'string' });
    return JSON.parse(decompressedData);
}

export {
    hub_projects,
    hub_title_raw,
    hub_version_raw,
};
