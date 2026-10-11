// Replay of a finished run from its events file (robotframework-events format v1).
// Pure data, no DOM, so it can be tested on recorded event files.

import { create_run_state, apply_event } from "./projection.js";

// the events files that belong to an output file, most likely first: named like the output file with
// "output" replaced by "events", the way log.html is found ("output" becomes "log"); RobotCode archives
// them gzipped. output.xml -> events.jsonl.gz, events.jsonl
function events_paths_for_output(outputPath) {
    if (!outputPath) return [];
    const segments = outputPath.replace(/\\/g, "/").split("/");
    const filename = segments.pop();
    if (!/\.(xml|json)$/i.test(filename)) return [];
    const name = filename.replace(/output/g, "events").replace(/\.(xml|json)$/i, ".jsonl");
    const joined = [...segments, name].join("/");
    const eventsPath = outputPath.includes("\\") ? joined.replace(/\//g, "\\") : joined;
    return [`${eventsPath}.gz`, eventsPath];
}

// the events in the text of an events file: one JSON object per line; damaged lines are skipped
function parse_events_text(text) {
    const events = [];
    for (const line of text.split("\n")) {
        if (!line.trim()) continue;
        try {
            const event = JSON.parse(line);
            if (event && typeof event.type === "string") events.push(event);
        } catch {
            // a line cut off by a crash, or not an event
        }
    }
    return events;
}

// the events of a File from a file picker; .gz files are unpacked with the browser's DecompressionStream
async function read_events_file(file) {
    if (file.name.toLowerCase().endsWith(".gz")) {
        const stream = file.stream().pipeThrough(new DecompressionStream("gzip"));
        return parse_events_text(await new Response(stream).text());
    }
    return parse_events_text(await file.text());
}

// the run state after events[0..index]; moving forward from `state` (at `from`) only applies the new events
function replay_state_at(events, index, state = null, from = -1) {
    let current = state;
    let start = from + 1;
    if (!current || index < from) {
        current = create_run_state();
        start = 0;
    }
    for (let i = start; i <= index && i < events.length; i++) apply_event(current, events[i]);
    return current;
}

export { events_paths_for_output, parse_events_text, read_events_file, replay_state_at };
