#!/usr/bin/env node
// Passive only: read no prompt, tool input, tool response, model, or opaque IDs.
// The generated plugin adds ../runtime/jev-shadow-runtime.mjs and its integrity file.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const event = process.argv[2];
const root = process.env.JEV_SHADOW_ROOT;

async function runtime() {
  const here = dirname(fileURLToPath(import.meta.url));
  const artifact = join(here, '..', 'runtime', 'jev-shadow-runtime.mjs');
  const integrity = JSON.parse(readFileSync(join(here, 'jev-shadow-runtime.integrity.json'), 'utf8'));
  const actual = createHash('sha256').update(readFileSync(artifact)).digest('hex');
  if (integrity.runtime_sha256 !== actual) throw new Error('Jev shadow runtime integrity mismatch');
  return import(pathToFileURL(artifact).href);
}

async function main() {
  if (!root) return;
  let payload = {};
  try { payload = JSON.parse(readFileSync(0, 'utf8')); } catch { /* opaque input remains unknown */ }
  // Only SessionStart session_id was locally evidenced. All other payload fields
  // are opaque and must not become a correlation key or leak into the journal.
  const session_id = event === 'SessionStart' && payload && typeof payload === 'object'
    ? payload.session_id : undefined;
  const module = await runtime();
  const record = module.createPassiveRecord({ namespace: process.env.JEV_SHADOW_NAMESPACE ?? 'default',
    producer: 'ork-codex', event, session_id });
  await module.emitJevShadow(record, root);
}

// Codex command hooks must remain neutral. Diagnostics stay in the caller's
// process status; stdout never contains hook control JSON or captured content.
main().catch(() => { process.exitCode = 0; });
