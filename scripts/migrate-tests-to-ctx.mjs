#!/usr/bin/env node
/**
 * migrate-tests-to-ctx.mjs — Migrate test files to createTestContext() DI pattern.
 *
 * Strategy:
 * - KEEP vi.mock for common.js (hooks still call getProjectDir() etc. internally,
 *   and output helpers must stay as vi.fn spies for test assertions)
 * - ADD createTestContext() import and testCtx creation
 * - ADD testCtx as second argument to hook calls
 * - TRANSFORM logHook/logPermissionFeedback/writeRulesFile assertions to use testCtx
 * - REMOVE getProjectDir/getLogDir/etc. assertions (they're just strings on ctx now)
 * - REMOVE side-effectful function imports from common.js (logHook, getProjectDir, etc.)
 *   ONLY when not referenced elsewhere (e.g., vi.mocked(logHook) still needs the import)
 *
 * Variable name: testCtx (not ctx) to avoid collisions with existing local vars
 *
 * Usage: node scripts/migrate-tests-to-ctx.mjs [--dry-run]
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';

const TESTS_ROOT = new URL('../src/hooks/src/__tests__', import.meta.url).pathname;
const DRY_RUN = process.argv.includes('--dry-run');

const stats = { total: 0, migrated: 0, skipped: [], errors: [] };

// ---------------------------------------------------------------------------
// Collect test files
// ---------------------------------------------------------------------------
function collectTestFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      results.push(...collectTestFiles(full));
    } else if (entry.name.endsWith('.test.ts')) {
      results.push(full);
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Balanced paren finder
// ---------------------------------------------------------------------------
function findClosingParen(content, openIdx) {
  let depth = 1;
  let i = openIdx + 1;
  while (i < content.length && depth > 0) {
    const ch = content[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === "'" || ch === '"' || ch === '`') {
      const q = ch;
      i++;
      while (i < content.length) {
        if (content[i] === '\\') i++;
        else if (content[i] === q) break;
        i++;
      }
    }
    else if (ch === '/' && content[i + 1] === '/') {
      while (i < content.length && content[i] !== '\n') i++;
      continue;
    }
    else if (ch === '/' && content[i + 1] === '*') {
      i += 2;
      while (i < content.length - 1 && !(content[i] === '*' && content[i + 1] === '/')) i++;
      i++;
    }
    else if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (ch === '[') depth++;
    else if (ch === ']') depth--;
    i++;
  }
  return depth === 0 ? i - 1 : -1;
}

// ---------------------------------------------------------------------------
// Side-effectful function names from common.js that are now on ctx
// ---------------------------------------------------------------------------
const SIDE_EFFECT_NAMES = new Set([
  'logHook', 'logPermissionFeedback', 'writeRulesFile',
  'getProjectDir', 'getLogDir', 'getSessionId',
  'getPluginRoot', 'getPluginDataDir', 'getEnvFile',
  'getCachedBranch', 'getLogLevel', 'shouldLog',
  'readHookInput', 'outputStderrWarning',
]);

// ---------------------------------------------------------------------------
// Determine createTestContext import path
// ---------------------------------------------------------------------------
function getTestContextImportPath(filePath) {
  const fileDir = dirname(filePath);
  const fixturesDir = join(TESTS_ROOT, 'fixtures');
  let rel = relative(fileDir, fixturesDir);
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel + '/test-context.js';
}

// ---------------------------------------------------------------------------
// Identify hook functions (imported from hook implementation, not lib/)
// ---------------------------------------------------------------------------
function identifyHookFunctions(content) {
  const hookFns = new Set();
  const importRegex = /import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g;
  let m;
  while ((m = importRegex.exec(content)) !== null) {
    const importPath = m[2];
    if (/\/lib\//.test(importPath)) continue;
    if (importPath.startsWith('node:')) continue;
    if (/fixtures/.test(importPath)) continue;
    if (/vitest/.test(importPath)) continue;
    if (/types/.test(importPath)) continue;
    if (/^import\s+type\s/.test(m[0])) continue;

    const names = m[1].split(',').map(n => n.trim()).filter(Boolean);
    for (const name of names) {
      if (name.startsWith('type ')) continue;
      if (/^[A-Z_]/.test(name) && !/(?:Hook|Dispatcher|Handler|Gate|Checker|Guard|Validator|Tracker|Logger|Detector|Enforcer|Learner|Finder|Reporter)/.test(name)) continue;
      hookFns.add(name);
    }
  }
  return hookFns;
}

// ---------------------------------------------------------------------------
// Find the scope where testCtx should be declared
// ---------------------------------------------------------------------------
function findCtxScope(content) {
  const lines = content.split('\n');
  let inDescribe = false;
  let firstDescribeLineIdx = -1;
  let moduleBeforeEachLineIdx = -1;
  let firstDescribeBeforeEachLineIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Only match top-level describe (no indentation) to avoid matching
    // describe() inside template literals or helper functions
    if (/^describe\s*\(/.test(line) && !inDescribe) {
      inDescribe = true;
      if (firstDescribeLineIdx === -1) firstDescribeLineIdx = i;
      continue;
    }

    if (/^beforeEach\s*\(/.test(trimmed) && !inDescribe) {
      moduleBeforeEachLineIdx = i;
      continue;
    }

    if (/^\s+beforeEach\s*\(/.test(line) && inDescribe && firstDescribeBeforeEachLineIdx === -1) {
      firstDescribeBeforeEachLineIdx = i;
    }
  }

  if (moduleBeforeEachLineIdx >= 0) {
    return { type: 'beforeEach-module', lineIdx: moduleBeforeEachLineIdx };
  }
  if (firstDescribeBeforeEachLineIdx >= 0) {
    return { type: 'beforeEach-in-describe', lineIdx: firstDescribeBeforeEachLineIdx, describeLineIdx: firstDescribeLineIdx };
  }
  if (firstDescribeLineIdx >= 0) {
    return { type: 'describe-only', describeLineIdx: firstDescribeLineIdx };
  }
  return { type: 'none' };
}

// ---------------------------------------------------------------------------
// Extract createTestContext overrides from mockCommonBasic/mockCommonReal args
// ---------------------------------------------------------------------------
const OVERRIDE_MAP = {
  getProjectDir: 'projectDir',
  getLogDir: 'logDir',
  getPluginRoot: 'pluginRoot',
  getPluginDataDir: 'pluginDataDir',
  getSessionId: 'sessionId',
  getCachedBranch: 'branch',
  getLogLevel: 'logLevel',
  logHook: 'log',
  logPermissionFeedback: 'logPermission',
  writeRulesFile: 'writeRules',
  shouldLog: 'shouldLog',
};

function extractOverrides(content) {
  const mockBlockMatch = content.match(
    /vi\.mock\(\s*['"](?:\.\.\/)+lib\/common\.js['"]\s*,\s*(?:async\s*)?\(\)\s*=>\s*(mockCommon(?:Basic|Real)\(\s*\{([^}]*)\}\s*\))/s
  );
  if (!mockBlockMatch || !mockBlockMatch[2]) return null;

  const overrideBlock = mockBlockMatch[2].trim();
  if (!overrideBlock) return null;

  const entries = [];
  const entryRegex = /(\w+)\s*:\s*vi\.fn\(\s*\(\)\s*=>\s*(['"`]([^'"`]*?)['"`]|null|true|false|\d+)\s*\)/g;
  let em;
  while ((em = entryRegex.exec(overrideBlock)) !== null) {
    const ctxKey = OVERRIDE_MAP[em[1]];
    if (ctxKey) entries.push(`${ctxKey}: ${em[2]}`);
  }

  const simpleFnRegex = /(\w+)\s*:\s*vi\.fn\(\s*\)/g;
  while ((em = simpleFnRegex.exec(overrideBlock)) !== null) {
    const ctxKey = OVERRIDE_MAP[em[1]];
    if (ctxKey) entries.push(`${ctxKey}: vi.fn()`);
  }

  if (entries.length === 0) return null;
  return `{ ${entries.join(', ')} }`;
}

// ---------------------------------------------------------------------------
// Check if a side-effect name is still referenced outside imports/expect()
// ---------------------------------------------------------------------------
function isStillReferenced(content, name) {
  // Remove all import lines and expect(name) patterns, then check for remaining refs
  const cleaned = content
    .replace(/^\s*import\s.*$/gm, '')
    .replace(new RegExp(`expect\\(\\s*${name}\\s*\\)`, 'g'), '');
  return new RegExp(`\\b${name}\\b`).test(cleaned);
}

// ---------------------------------------------------------------------------
// MAIN MIGRATION
// ---------------------------------------------------------------------------
function migrateFile(filePath) {
  let content = readFileSync(filePath, 'utf-8');
  const original = content;
  const changes = [];

  if (filePath.includes('/fixtures/') || filePath.includes('/helpers/')) {
    return { changed: false, reason: 'fixtures/helpers file' };
  }

  const hasCommonMock = /vi\.mock\(\s*['"](?:\.\.\/)+lib\/common\.js['"]/.test(content);
  if (!hasCommonMock) {
    return { changed: false, reason: 'no common.js mock' };
  }

  if (/import\s+\{[^}]*createTestContext[^}]*\}\s+from/.test(content)) {
    return { changed: false, reason: 'already uses createTestContext' };
  }

  // =========================================================================
  // STEP 1: Extract overrides from vi.mock block (for createTestContext args)
  // =========================================================================
  const ctxOverrides = extractOverrides(content);

  // =========================================================================
  // STEP 2: Import cleanup — DEFERRED
  //   Side-effect imports (logHook, getProjectDir, etc.) are still needed
  //   while hooks use the vi.mock for common.js. Will be cleaned up in the
  //   per-hook migration phase alongside assertion + call transforms.
  // =========================================================================

  // =========================================================================
  // STEP 3: Add createTestContext import
  // =========================================================================
  const testContextPath = getTestContextImportPath(filePath);
  if (!/import\s+\{[^}]*createTestContext[^}]*\}\s+from/.test(content)) {
    const importLine = `import { createTestContext } from '${testContextPath}';`;

    const lines = content.split('\n');
    // Insert createTestContext import AFTER all real top-level imports.
    // Must detect the boundary between real imports and code (including template
    // literals that may contain import-like content at column 0).
    // Strategy: find the last import whose `from` path starts with './' or '../'
    // or 'node:' or 'vitest' (real module specifiers, not test content strings).
    let insertIdx = 0;
    let inImport = false;
    for (let i = 0; i < lines.length; i++) {
      if (/^import\s/.test(lines[i])) {
        inImport = true;
      }
      if (inImport) {
        const trimmed = lines[i].trim();
        if (/from\s+['"][^'"]*['"];?\s*$/.test(trimmed)) {
          // Check if this is a real module import (relative path, node:, vitest)
          const fromMatch = trimmed.match(/from\s+['"](.*?)['"]/);
          if (fromMatch) {
            const specifier = fromMatch[1];
            if (specifier.startsWith('.') || specifier.startsWith('node:') || specifier === 'vitest') {
              insertIdx = i + 1;
            }
          }
          inImport = false;
        }
      }
    }
    lines.splice(insertIdx, 0, importLine);
    content = lines.join('\n');
    changes.push('added createTestContext import');
  }

  // =========================================================================
  // STEP 4: Add testCtx declaration and creation
  // =========================================================================
  const scope = findCtxScope(content);
  const ctxArg = ctxOverrides ? `createTestContext(${ctxOverrides})` : 'createTestContext()';

  // Always declare testCtx at module level (before first describe) to ensure
  // it's accessible from all describe blocks and test helpers.
  if (scope.type === 'beforeEach-module') {
    const lines = content.split('\n');
    lines.splice(scope.lineIdx, 0, 'let testCtx: ReturnType<typeof createTestContext>;');
    const beLineIdx = scope.lineIdx + 1;
    const beLine = lines[beLineIdx];
    const bracePos = beLine.indexOf('{');
    if (bracePos >= 0) {
      const indent = beLine.match(/^(\s*)/)?.[1] || '';
      lines.splice(beLineIdx + 1, 0, `${indent}  testCtx = ${ctxArg};`);
    }
    content = lines.join('\n');
    changes.push('added let testCtx + testCtx = createTestContext() at module-level beforeEach');
  }
  else if (scope.type === 'beforeEach-in-describe') {
    const lines = content.split('\n');

    // Insert let testCtx BEFORE the first describe (module level)
    const insertLine = scope.describeLineIdx;
    lines.splice(insertLine, 0, 'let testCtx: ReturnType<typeof createTestContext>;');

    // Find the first beforeEach inside the first describe (shifted by 1 due to insertion)
    let actualBeLineIdx = -1;
    for (let i = insertLine + 1; i < lines.length; i++) {
      if (/^\s+beforeEach\s*\(/.test(lines[i])) {
        actualBeLineIdx = i;
        break;
      }
    }

    if (actualBeLineIdx >= 0) {
      const beLine = lines[actualBeLineIdx];
      const bracePos = beLine.indexOf('{');
      if (bracePos >= 0) {
        const indent = beLine.match(/^(\s*)/)?.[1] || '  ';
        lines.splice(actualBeLineIdx + 1, 0, `${indent}  testCtx = ${ctxArg};`);
      }
    }

    content = lines.join('\n');
    changes.push('added let testCtx (module-level) + testCtx = createTestContext() in first beforeEach');
  }
  else if (scope.type === 'describe-only') {
    const lines = content.split('\n');
    // Insert before the first describe
    lines.splice(scope.describeLineIdx, 0, `const testCtx = ${ctxArg};`);
    content = lines.join('\n');
    changes.push('added const testCtx = createTestContext() at module level');
  }

  // =========================================================================
  // STEP 5: Hook call transformation — DEFERRED
  //   Adding testCtx to hook calls is deferred to a per-hook migration phase.
  //   Hooks that use `ctx?.field ?? getField()` internally will use testCtx
  //   defaults which may not match the test's vi.mock overrides. Each hook
  //   test must be updated individually to pass correct testCtx overrides.
  //   The infrastructure (import + variable + beforeEach) is in place.
  // =========================================================================

  // =========================================================================
  // STEP 6: Transform mock assertions — DEFERRED
  //   Assertion transforms (expect(logHook) -> expect(testCtx.log)) must happen
  //   simultaneously with hook call transforms (hook(input) -> hook(input, testCtx)).
  //   Without both, testCtx.log is never called but the assertion checks it.
  //   Both are deferred to per-hook migration phase.
  // =========================================================================

  // =========================================================================
  // STEP 7: Dispatcher transform — DEFERRED (same reason as STEP 5)
  // =========================================================================

  // =========================================================================
  // STEP 8: Clean up double blank lines
  // =========================================================================
  content = content.replace(/\n{3,}/g, '\n\n');

  const changed = content !== original;
  if (changed && !DRY_RUN) {
    writeFileSync(filePath, content, 'utf-8');
  }
  return { changed, changes, reason: changed ? null : 'no changes needed' };
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
const allFiles = collectTestFiles(TESTS_ROOT);
stats.total = allFiles.length;
console.log(`Found ${allFiles.length} test files${DRY_RUN ? ' (DRY RUN)' : ''}\n`);

for (const filePath of allFiles) {
  const shortPath = relative(join(TESTS_ROOT, '..', '..', '..'), filePath);
  try {
    const result = migrateFile(filePath);
    if (result.changed) {
      stats.migrated++;
      console.log(`  migrated: ${shortPath} (${result.changes.length} changes)`);
      for (const c of result.changes) console.log(`           ${c}`);
    } else {
      stats.skipped.push({ path: shortPath, reason: result.reason });
    }
  } catch (err) {
    stats.errors.push({ path: shortPath, error: err.message });
    console.error(`  ERROR: ${shortPath} -- ${err.message}`);
  }
}

console.log('\n' + '='.repeat(70));
console.log('  migrate-tests-to-ctx -- Results');
console.log('='.repeat(70));
console.log(`Total test files:   ${stats.total}`);
console.log(`Migrated:           ${stats.migrated}`);
console.log(`Skipped:            ${stats.skipped.length}`);
console.log(`Errors:             ${stats.errors.length}`);

if (stats.skipped.length > 0) {
  console.log('\n-- Skipped --');
  for (const { path, reason } of stats.skipped) {
    console.log(`  ${path} -- ${reason}`);
  }
}

if (stats.errors.length > 0) {
  console.log('\n-- Errors (manual fix needed) --');
  for (const { path, error } of stats.errors) {
    console.log(`  ${path} -- ${error}`);
  }
}

if (DRY_RUN) console.log('\nDRY RUN -- no files were modified.');
console.log('');
