// Frame the records in our JSON arrays; JSON.parse still validates each complete record.
// Keeping only one record as text avoids the browser's limit on a single giant JSON string.
async function read_json_array(stream, accept = () => true, on_progress = () => {}) {
    const reader = stream.getReader();
    const decoder = new TextDecoder("utf-8", { fatal: true });
    const records = [];
    let state = "start";
    let depth = 0;
    let quoted = false;
    let escaped = false;
    let parts = [];
    let scanned = 0;
    let lastYield = performance.now();

    function consume(text) {
        let start = state === "record" ? 0 : -1;
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            if (state === "record") {
                if (quoted) {
                    if (escaped) escaped = false;
                    else if (char === "\\") escaped = true;
                    else if (char === '"') quoted = false;
                } else if (char === '"') {
                    quoted = true;
                } else if (char === "{" || char === "[") {
                    depth++;
                } else if (char === "}" || char === "]") {
                    depth--;
                    if (depth === 0) {
                        parts.push(text.slice(start, i + 1));
                        const record = JSON.parse(parts.join(""));
                        if (accept(record)) records.push(record);
                        scanned++;
                        parts = [];
                        start = -1;
                        state = "separator";
                    }
                }
                continue;
            }
            if (char === " " || char === "\t" || char === "\r" || char === "\n") continue;
            if (state === "start" && char === "[") {
                state = "first";
            } else if ((state === "first" || state === "value") && char === "{") {
                state = "record";
                depth = 1;
                start = i;
            } else if ((state === "first" || state === "separator") && char === "]") {
                state = "done";
            } else if (state === "separator" && char === ",") {
                state = "value";
            } else {
                throw new SyntaxError("The result data is not a complete JSON array of records.");
            }
        }
        if (state === "record") parts.push(text.slice(start));
        on_progress({ scanned, retained: records.length });
    }

    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            consume(decoder.decode(value, { stream: true }));
            // Native stream reads can resolve back-to-back; give the loading UI time to paint.
            if (performance.now() - lastYield > 16) {
                await new Promise(resolve => setTimeout(resolve, 0));
                lastYield = performance.now();
            }
        }
        consume(decoder.decode());
        if (state !== "done") throw new SyntaxError("The result data ended before it was complete.");
        return records;
    } catch (error) {
        await reader.cancel(error).catch(() => {});
        throw error;
    } finally {
        reader.releaseLock();
    }
}

export { read_json_array };
