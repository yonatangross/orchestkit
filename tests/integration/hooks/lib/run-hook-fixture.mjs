#!/usr/bin/env node
/**
 * run-hook-fixture.mjs — minimal hook test driver
 *
 * Imports a hook module dynamically, builds a HookInput from --input JSON
 * (or stdin), invokes the default/run export with a stub HookContext, and
 * prints the resulting HookResult as pretty JSON.
 *
 * Usage:
 *   node run-hook-fixture.mjs <hook-module-path> [--input <json>]
 *   echo '{...}' | node run-hook-fixture.mjs <hook-module-path>
 *
 * Exit codes:
 *   0 — hook returned a HookResult (object with `continue` boolean)
 *   1 — module load failed, hook threw, or output was not a HookResult
 *   2 — bad invocation arguments
 */

import { readFileSync } from 'node:fs';
import { resolve, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';

function parseArgs(argv) {
  if (argv.length < 1) {
    process.stderr.write('usage: run-hook-fixture.mjs <module> [--input <json>]\n');
    process.exit(2);
  }
  const modulePath = argv[0];
  let inputJson = null;
  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === '--input') {
      inputJson = argv[i + 1];
      i++;
    }
  }
  return { modulePath, inputJson };
}

function readStdinSync() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function buildInput(raw) {
  // Minimal HookInput skeleton. Caller-supplied JSON wins for any fields.
  const base = {
    session_id: 'fixture-session',
    transcript_path: '',
    cwd: process.cwd(),
    hook_event_name: 'PostToolUse',
    tool_name: '',
    tool_input: {},
  };
  if (!raw || !raw.trim()) return base;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    process.stderr.write(`fixture: invalid --input JSON: ${e.message}\n`);
    process.exit(2);
  }
  return { ...base, ...parsed };
}

function buildStubContext() {
  const noop = () => {};
  return {
    projectDir: process.env.CLAUDE_PROJECT_DIR || process.cwd(),
    logDir: '',
    pluginRoot: process.env.CLAUDE_PLUGIN_ROOT || '',
    pluginDataDir: null,
    sessionId: 'fixture-session',
    branch: '',
    isWorktree: false,
    logLevel: 'warn',
    log: noop,
    logPermission: noop,
    writeRules: () => false,
    shouldLog: () => false,
  };
}

function isHookResult(v) {
  return v && typeof v === 'object' && typeof v.continue === 'boolean';
}

async function main() {
  const { modulePath, inputJson } = parseArgs(process.argv.slice(2));
  const abs = isAbsolute(modulePath) ? modulePath : resolve(process.cwd(), modulePath);

  let mod;
  try {
    mod = await import(pathToFileURL(abs).href);
  } catch (e) {
    process.stderr.write(`fixture: failed to import ${abs}: ${e.message}\n`);
    process.exit(1);
  }

  // Pick the hook function: prefer named `run`, then default export, then
  // any single exported function that looks hook-shaped.
  let hookFn = null;
  if (typeof mod.run === 'function') hookFn = mod.run;
  else if (typeof mod.default === 'function') hookFn = mod.default;
  else {
    const fns = Object.values(mod).filter((v) => typeof v === 'function');
    if (fns.length === 1) hookFn = fns[0];
  }
  if (!hookFn) {
    process.stderr.write(`fixture: no callable export (run/default/sole fn) in ${abs}\n`);
    process.exit(1);
  }

  const raw = inputJson !== null ? inputJson : readStdinSync();
  const input = buildInput(raw);
  const ctx = buildStubContext();

  let result;
  try {
    result = await hookFn(input, ctx);
  } catch (e) {
    process.stderr.write(`fixture: hook threw: ${e.stack || e.message}\n`);
    process.exit(1);
  }

  if (!isHookResult(result)) {
    process.stderr.write(`fixture: hook returned non-HookResult: ${JSON.stringify(result)}\n`);
    process.exit(1);
  }

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exit(0);
}

main();
