#!/usr/bin/env node
/**
 * CLI Runner for OrchestKit TypeScript Hooks
 *
 * Usage: run-hook.mjs <hook-name>
 * Example: run-hook.mjs permission/auto-approve-readonly
 *
 * Loads event-specific split bundles for fast startup (~89% smaller than unified)
 * Reads hook input from stdin, executes the hook, outputs result to stdout.
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const distDir = join(__dirname, '..', 'dist');

/**
 * Map hook name prefix to bundle name
 */
function getBundleName(hookName) {
  const prefix = hookName.split('/')[0];
  const bundleMap = {
    permission: 'permission',
    pretool: 'pretool',
    posttool: 'posttool',
    prompt: 'prompt',
    lifecycle: 'lifecycle',
    stop: 'stop',
    'subagent-start': 'subagent',
    'subagent-stop': 'subagent',
    notification: 'notification',
    setup: 'setup',
    skill: 'skill',
    agent: 'agent',
  };
  return bundleMap[prefix] || null;
}

/**
 * Load the appropriate split bundle for the hook
 */
async function loadBundle(hookName) {
  const bundleName = getBundleName(hookName);
  if (!bundleName) return null;

  const bundlePath = join(distDir, `${bundleName}.mjs`);
  if (!existsSync(bundlePath)) return null;

  return await import(bundlePath);
}

const hookName = process.argv[2];

// If no hook name provided, output silent success
if (!hookName) {
  console.log('{"continue":true,"suppressOutput":true}');
  process.exit(0);
}

// Load the appropriate bundle
let hooks;
try {
  hooks = await loadBundle(hookName);
} catch (err) {
  // Bundle not found - likely not built yet
  // Output silent success to not block Claude Code
  console.log('{"continue":true,"suppressOutput":true}');
  process.exit(0);
}

if (!hooks) {
  console.log('{"continue":true,"suppressOutput":true}');
  process.exit(0);
}

// Get the hook function from the registry
const hookFn = hooks.hooks?.[hookName];

// If hook not found (not migrated yet), output silent success
if (!hookFn) {
  console.log('{"continue":true,"suppressOutput":true}');
  process.exit(0);
}

// Read stdin with timeout to prevent hanging
let input = '';
let stdinClosed = false;

// Set up timeout - if no input received within 100ms, assume no input
const timeout = setTimeout(() => {
  if (!stdinClosed) {
    stdinClosed = true;
    runHook({});
  }
}, 100);

process.stdin.setEncoding('utf8');

process.stdin.on('data', (chunk) => {
  clearTimeout(timeout);
  input += chunk;
});

process.stdin.on('end', () => {
  clearTimeout(timeout);
  if (!stdinClosed) {
    stdinClosed = true;
    try {
      const parsedInput = input.trim() ? JSON.parse(input) : {};
      runHook(parsedInput);
    } catch (err) {
      // JSON parse error - output error message but continue
      console.log(JSON.stringify({
        continue: true,
        systemMessage: `Hook input parse error: ${err.message}`,
      }));
    }
  }
});

process.stdin.on('error', () => {
  clearTimeout(timeout);
  if (!stdinClosed) {
    stdinClosed = true;
    runHook({});
  }
});

/**
 * Execute the hook and output result
 */
async function runHook(parsedInput) {
  try {
    const result = await hookFn(parsedInput);
    console.log(JSON.stringify(result));
  } catch (err) {
    // On any error, output silent success to not block Claude Code
    console.log(JSON.stringify({
      continue: true,
      systemMessage: `Hook error (${hookName}): ${err.message}`,
    }));
  }
}
