// Leaf module without imports, so variables/globals.js can use it without a circular import.

// Escapes a value for use in HTML text and in quoted attribute values.
function escape_html(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// Allows only http:, https: and relative URLs (no javascript:, data:, etc.).
function is_safe_url(url) {
    const value = String(url ?? "").trim();
    if (value === "") return false;
    // Browsers ignore tabs and newlines inside a scheme, so drop them before checking
    const compact = value.replace(/[\u0000-\u001F\u007F\s]/g, "");
    const scheme = compact.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
    // No scheme: a relative or protocol-relative URL, which stays on http(s)
    if (!scheme) return true;
    const name = scheme[1].toLowerCase();
    return name === "http" || name === "https";
}

export {
    escape_html,
    is_safe_url,
};
