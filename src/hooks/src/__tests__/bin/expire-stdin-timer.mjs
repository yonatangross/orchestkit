// #4769 test fixture, loaded with `node --import`. It makes run-hook.mjs's
// 100ms stdin timer fire as a microtask, right after the runner's synchronous
// setup and before any stdin read can complete. That is what a long
// synchronous block after the timer is set does on a loaded CI runner: the
// timers phase runs before the read callback, and the hook runs on {}.
// Only a 100ms timer is changed; every other timer behaves normally.
const realSetTimeout = globalThis.setTimeout;

globalThis.setTimeout = function expireStdinTimer(fn, ms, ...args) {
  if (ms !== 100) return realSetTimeout(fn, ms, ...args);
  queueMicrotask(() => fn(...args));
  // clearTimeout ignores an object that is not a Node Timeout, so the runner's
  // clearTimeout(timeout) on a later data or end event stays a no-op.
  return { ref() { return this; }, unref() { return this; } };
};
