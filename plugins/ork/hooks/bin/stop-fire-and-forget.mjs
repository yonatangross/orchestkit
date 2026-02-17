#!/usr/bin/env node
/**
 * Stop Fire-and-Forget Entry Point
 * Issue #243: Eliminates slow session exit by running Stop hooks in background
 * Issue #648: Windows-safe spawning via shared spawn-worker helper
 */

import { spawnWorker, readStdinInput } from './spawn-worker.mjs';

async function main() {
  const input = await readStdinInput();
  if (input) {
    spawnWorker('stop', input);
  }
  console.log(JSON.stringify({ continue: true, suppressOutput: true }));
}

main().catch(() => {
  console.log(JSON.stringify({ continue: true, suppressOutput: true }));
});
