#!/usr/bin/env node
/**
 * Notification Fire-and-Forget Entry Point
 * Issue #243: Eliminates "Async hook Notification completed" message
 * Issue #648: Windows-safe spawning via shared spawn-worker helper
 */

import { spawnWorker, readStdinInput } from './spawn-worker.mjs';

async function main() {
  const input = await readStdinInput();
  if (input) {
    spawnWorker('notification', input);
  }
  console.log(JSON.stringify({ continue: true, suppressOutput: true }));
}

main().catch(() => {
  console.log(JSON.stringify({ continue: true, suppressOutput: true }));
});
