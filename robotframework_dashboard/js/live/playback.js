// The screenshot timeline of a test, from the screenshots that robotframework-events takes after browser
// steps (listener option `screenshots`, `step.screenshot` events): when each was taken, and which one shows
// the page at a moment of the test. Pure data, no DOM.

// the screenshots of a test in the order they were taken: { stepId, t, path, status }
function playback_frames(state, testId) {
    const test = testId ? state.tests.get(testId) : null;
    if (!test || !test.frames) return [];
    return test.frames
        .map((id) => state.steps.get(id))
        .filter((step) => step && step.screenshot)
        .map((step) => ({ stepId: step.id, t: step.screenshotT, path: step.screenshot, status: step.status }));
}

// the time the timeline covers: the test's run, up to now while it runs
function playback_span(test, now) {
    const start = test.startT;
    const end = test.elapsed !== null && test.elapsed !== undefined ? start + test.elapsed : now;
    return { start, end: Math.max(end, start + 0.001) };
}

// the screenshot that shows the page at time t: the last one taken by then; -1 before the first
function playback_frame_at(frames, t) {
    let index = -1;
    for (let i = 0; i < frames.length && frames[i].t <= t; i++) index = i;
    return index;
}

export { playback_frames, playback_span, playback_frame_at };
