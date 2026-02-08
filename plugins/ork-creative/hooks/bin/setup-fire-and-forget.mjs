#!/usr/bin/env node
/**
 * Setup Fire-and-Forget Entry Point
 * Issue #243: Eliminates "Async hook Setup completed" message
 */

import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  let input;
  try {
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    const raw = Buffer.concat(chunks).toString('utf-8');
    input = JSON.parse(raw);
  } catch {
    console.log(JSON.stringify({ continue: true, suppressOutput: true }));
    return;
  }

  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const tempDir = join(projectDir, '.claude', 'hooks', 'pending');
  mkdirSync(tempDir, { recursive: true });

  const workId = randomUUID();
  const workFile = join(tempDir, `setup-${workId}.json`);
  writeFileSync(workFile, JSON.stringify({
    id: workId,
    hook: 'setup',
    input,
    timestamp: Date.now()
  }));

  const workerPath = join(__dirname, 'background-worker.mjs');
  const child = spawn('node', [workerPath, workFile], {
    detached: true,
    stdio: 'ignore',
    env: process.env
  });
  child.unref();

  console.log(JSON.stringify({ continue: true, suppressOutput: true }));
}

main().catch(() => {
  console.log(JSON.stringify({ continue: true, suppressOutput: true }));
});
