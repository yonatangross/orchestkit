#!/usr/bin/env node
/**
 * UserPromptSubmit Fire-and-Forget Entry Point
 * Issue #243: Eliminates "Async hook UserPromptSubmit completed" message
 * Issue #648: Windows-safe spawning via shared spawn-worker helper
 */

import { spawnWorker, readStdinInput } from './spawn-worker.mjs';

async function main() {
  const input = await readStdinInput();
  if (input) {
    spawnWorker('prompt', input);
  }
  console.log(JSON.stringify({ continue: true, suppressOutput: true }));
}

main().catch(() => {
  console.log(JSON.stringify({ continue: true, suppressOutput: true }));
});
