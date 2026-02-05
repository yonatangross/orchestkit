#!/usr/bin/env node

/**
 * Hook Registry Validation Script
 *
 * Validates that hooks.json (the manifest Claude Code reads) stays in sync
 * with the actual TypeScript entry files (what gets compiled and executed).
 *
 * Detects:
 * - Ghost hooks: in hooks.json but not in any entry file (will silently fail at runtime)
 * - Orphaned hooks: in entry files but not in hooks.json (compiled but never triggered)
 *
 * Usage: node scripts/validate-registry.mjs
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const hooksRoot = join(__dirname, '..');

// ---------------------------------------------------------------------------
// 1. Parse hooks.json to extract all hook names from command strings
// ---------------------------------------------------------------------------

function parseHooksJson() {
  const raw = readFileSync(join(hooksRoot, 'hooks.json'), 'utf-8');
  const data = JSON.parse(raw);

  const hookNames = new Set();

  // data.hooks is keyed by event type (PreToolUse, PostToolUse, etc.)
  for (const eventType of Object.keys(data.hooks)) {
    const matcherGroups = data.hooks[eventType];
    for (const group of matcherGroups) {
      const hooks = group.hooks || [];
      for (const hook of hooks) {
        if (hook.type === 'command' && hook.command) {
          // Extract hook name from: node ${CLAUDE_PLUGIN_ROOT}/hooks/bin/run-hook.mjs <hook-name>
          const match = hook.command.match(/run-hook\.mjs\s+(.+)$/);
          if (match) {
            hookNames.add(match[1].trim());
          }
        }
      }
    }
  }

  return hookNames;
}

// ---------------------------------------------------------------------------
// 2. Parse entry files to extract hook names from the `hooks` registry objects
// ---------------------------------------------------------------------------

function parseEntryFiles() {
  const entriesDir = join(hooksRoot, 'src', 'entries');
  const entryFiles = readdirSync(entriesDir).filter(f => f.endsWith('.ts'));

  const hookNames = new Set();

  for (const file of entryFiles) {
    const content = readFileSync(join(entriesDir, file), 'utf-8');

    // Match quoted string keys in the hooks registry object.
    // Pattern: 'hook/name': identifier  or  "hook/name": identifier
    const keyRegex = /['"]([a-zA-Z0-9\-_/]+)['"]\s*:/g;

    // Only extract keys that appear within the `hooks` object.
    // Find the hooks object declaration and extract keys from it.
    const hooksBlockMatch = content.match(
      /export\s+const\s+hooks\s*:\s*Record<[^>]+>\s*=\s*\{([\s\S]*?)\};/
    );

    if (hooksBlockMatch) {
      const block = hooksBlockMatch[1];
      let match;
      while ((match = keyRegex.exec(block)) !== null) {
        hookNames.add(match[1]);
      }
    }
  }

  return hookNames;
}

// ---------------------------------------------------------------------------
// 3. Known unified dispatchers whose internal sub-hooks should NOT appear
//    in hooks.json (they are routed internally by the dispatcher).
//    These dispatcher hooks themselves ARE expected in both places.
// ---------------------------------------------------------------------------

const KNOWN_DISPATCHERS = new Set([
  'posttool/unified-dispatcher',
  'stop/unified-dispatcher',
  'subagent-stop/unified-dispatcher',
  'lifecycle/unified-dispatcher',
  'notification/unified-dispatcher',
  'setup/unified-dispatcher',
]);

// ---------------------------------------------------------------------------
// 4. Compare and report
// ---------------------------------------------------------------------------

function main() {
  const hooksJsonNames = parseHooksJson();
  const entryFileNames = parseEntryFiles();

  // Find ghosts: in hooks.json but NOT in any entry file
  const ghosts = [];
  for (const name of hooksJsonNames) {
    if (!entryFileNames.has(name)) {
      ghosts.push(name);
    }
  }

  // Find orphans: in entry files but NOT in hooks.json
  const orphans = [];
  for (const name of entryFileNames) {
    if (!hooksJsonNames.has(name)) {
      orphans.push(name);
    }
  }

  // Find valid: in both
  const valid = [];
  for (const name of hooksJsonNames) {
    if (entryFileNames.has(name)) {
      valid.push(name);
    }
  }

  // Count dispatchers in entry files
  let dispatcherCount = 0;
  for (const name of entryFileNames) {
    if (KNOWN_DISPATCHERS.has(name)) {
      dispatcherCount++;
    }
  }

  // ---------------------------------------------------------------------------
  // Output
  // ---------------------------------------------------------------------------

  console.log('Hook Registry Validation');
  console.log('========================');
  console.log(`hooks.json entries: ${hooksJsonNames.size}`);
  console.log(
    `Entry file exports:  ${entryFileNames.size}` +
      (dispatcherCount > 0
        ? ` (includes ${dispatcherCount} dispatchers)`
        : '')
  );
  console.log('');

  // Valid hooks
  if (valid.length > 0) {
    console.log(
      `\u2713 ${valid.length} hooks validated (in both hooks.json and entry files)`
    );
  }

  // Orphaned hooks (warnings)
  if (orphans.length > 0) {
    console.log(
      `\u26A0 ${orphans.length} orphaned hooks (in entry files but not hooks.json)`
    );
    for (const name of orphans.sort()) {
      console.log(`  - ${name}`);
    }
  }

  // Ghost hooks (errors)
  if (ghosts.length > 0) {
    console.log(
      `\u2717 ${ghosts.length} ghost hooks (in hooks.json but not entry files \u2014 will fail at runtime!)`
    );
    for (const name of ghosts.sort()) {
      console.log(`  - ${name}`);
    }
  }

  console.log('');

  if (ghosts.length > 0) {
    console.log(`Result: FAIL (${ghosts.length} ghost hooks found)`);
    process.exit(1);
  } else if (orphans.length > 0) {
    console.log(
      `Result: PASS with warnings (${orphans.length} orphaned hooks)`
    );
    process.exit(0);
  } else {
    console.log('Result: PASS (all hooks validated)');
    process.exit(0);
  }
}

main();
