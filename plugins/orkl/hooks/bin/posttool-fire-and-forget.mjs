#!/usr/bin/env node
/**
 * PostToolUse Fire-and-Forget Entry Point
 * Issue #243: Eliminates "Async hook PostToolUse completed" message
 *
 * This is a thin wrapper that:
 * 1. Reads hook input from stdin
 * 2. Spawns background-worker.mjs detached
 * 3. Returns immediately with silent success
 */

import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  // Read input from stdin
  let input;
  try {
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    const raw = Buffer.concat(chunks).toString('utf-8');
    input = JSON.parse(raw);
  } catch (error) {
    // Return silent success even on parse error - fire-and-forget
    console.log(JSON.stringify({ continue: true, suppressOutput: true }));
    return;
  }

  // Get temp directory
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const tempDir = join(projectDir, '.claude', 'hooks', 'pending');
  mkdirSync(tempDir, { recursive: true });

  // Write work to temp file
  const workId = randomUUID();
  const workFile = join(tempDir, `posttool-${workId}.json`);
  writeFileSync(workFile, JSON.stringify({
    id: workId,
    hook: 'posttool',
    input,
    timestamp: Date.now()
  }));

  // Spawn detached worker
  const workerPath = join(__dirname, 'background-worker.mjs');
  const child = spawn('node', [workerPath, workFile], {
    detached: true,
    stdio: 'ignore',
    env: process.env
  });
  child.unref();

  // Return immediately - no "Async hook completed" message!
  console.log(JSON.stringify({ continue: true, suppressOutput: true }));
}

main().catch(() => {
  // Always return success for fire-and-forget
  console.log(JSON.stringify({ continue: true, suppressOutput: true }));
});
