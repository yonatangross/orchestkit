#!/usr/bin/env node
/**
 * wire-testctx.mjs — Phase 4 Step A: Wire testCtx into hook calls.
 *
 * For each test file that already has createTestContext scaffolding:
 * 1. Identify hook function names from non-lib/fixtures/types imports
 * 2. Add `, testCtx` as second arg to each hook call (not in expect/vi.mocked/vi.mock)
 * 3. Fix .toHaveBeenCalledWith(input, undefined) → .toHaveBeenCalledWith(input, testCtx)
 *    for dispatcher tests that assert sub-hook call args
 *
 * KEEPS vi.mock, imports, assertions — hooks still call global functions internally.
 * Phase 4b migrates hook source to use ctx, then a follow-up removes vi.mock.
 *
 * Usage: node scripts/wire-testctx.mjs [--dry-run]
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const TESTS_ROOT = new URL('../src/hooks/src/__tests__', import.meta.url).pathname;
const DRY_RUN = process.argv.includes('--dry-run');

const stats = { total: 0, wired: 0, skipped: [], errors: [] };

// ─────────────────────────────────────────────────────────────────────────────
// Collect test files
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// Balanced paren finder
// ─────────────────────────────────────────────────────────────────────────────
function findClosingParen(content, openIdx) {
  let depth = 1;
  let i = openIdx + 1;
  while (i < content.length && depth > 0) {
    const ch = content[i];
    if (ch === '(') depth++;
    else if (ch === ')') { depth--; if (depth === 0) return i; }
    else if (ch === "'" || ch === '"' || ch === '`') {
      const q = ch;
      i++;
      while (i < content.length) {
        if (content[i] === '\\') { i++; }
        else if (ch === '`' && content[i] === '$' && i + 1 < content.length && content[i + 1] === '{') {
          i += 2;
          let tdepth = 1;
          while (i < content.length && tdepth > 0) {
            if (content[i] === '{') tdepth++;
            else if (content[i] === '}') tdepth--;
            if (tdepth > 0) i++;
          }
        }
        else if (content[i] === q) break;
        i++;
      }
    }
    else if (ch === '/' && i + 1 < content.length && content[i + 1] === '/') {
      while (i < content.length && content[i] !== '\n') i++;
      continue;
    }
    else if (ch === '/' && i + 1 < content.length && content[i + 1] === '*') {
      i += 2;
      while (i < content.length - 1 && !(content[i] === '*' && content[i + 1] === '/')) i++;
      i++;
    }
    i++;
  }
  return depth === 0 ? i - 1 : -1;
}

// ─────────────────────────────────────────────────────────────────────────────
// Non-hook utilities (must NOT get testCtx)
// ─────────────────────────────────────────────────────────────────────────────
const NON_HOOK_UTILITIES = new Set([
  'registeredHookNames', 'registeredHookMatchers', 'matchesTool',
  '_resetSkillPathIndex', '_resetCommandCacheForTesting',
  'flushPendingPreferences', 'materializeAntipatternRules', 'materializeProfileRules',
  'ruleConflictDetector', 'smartRuleSuggestions', 'driftDetection',
  'tokenBudgetTracker', 'priorityMap', 'contentDedupScanner',
  'getProjectSlug', 'signPayload', 'classifySource', 'mcpHealthCheck',
  '_analyzeTranscript', 'analyzeTranscript', 'detectFrustration',
  'setupServer', 'http', 'HttpResponse',
  'z', 'useFormStatus', 'config',
]);

/**
 * Simple heuristic: count unescaped backticks in all lines BEFORE lineIdx.
 * If the count is odd, the line is inside a template literal.
 */
function isLineInsideTemplateLiteral(lines, lineIdx) {
  let backtickCount = 0;
  for (let i = 0; i < lineIdx; i++) {
    const line = lines[i];
    for (let j = 0; j < line.length; j++) {
      if (line[j] === '`' && (j === 0 || line[j - 1] !== '\\')) {
        backtickCount++;
      }
    }
  }
  return backtickCount % 2 === 1;
}

function escapeForRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─────────────────────────────────────────────────────────────────────────────
// Identify hook functions from imports
// ─────────────────────────────────────────────────────────────────────────────
function identifyHookFunctions(content) {
  const hookFns = new Set();
  const importRegex = /import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g;
  let m;
  while ((m = importRegex.exec(content)) !== null) {
    const importPath = m[2];
    if (/\/lib\//.test(importPath)) continue;
    if (importPath.startsWith('node:')) continue;
    if (/fixtures/.test(importPath)) continue;
    if (/helpers/.test(importPath)) continue;
    if (/vitest/.test(importPath)) continue;
    if (/types/.test(importPath)) continue;
    if (/^import\s+type\s/.test(m[0])) continue;

    const names = m[1].split(',').map(n => n.trim()).filter(Boolean);
    for (const name of names) {
      const aliasMatch = name.match(/^(\w+)\s+as\s+(\w+)$/);
      const originalName = aliasMatch ? aliasMatch[1] : name;
      const localName = aliasMatch ? aliasMatch[2] : name;

      if (originalName.startsWith('type ')) continue;
      if (/^[A-Z_]+$/.test(localName)) continue;
      if (NON_HOOK_UTILITIES.has(originalName)) continue;

      hookFns.add(localName);
    }
  }
  return hookFns;
}

// ─────────────────────────────────────────────────────────────────────────────
// Detect if position is inside vi.mock factory
// ─────────────────────────────────────────────────────────────────────────────
function isInsideViMockFactory(content, pos) {
  const viMockRegex = /vi\.mock\s*\(/g;
  let m;
  while ((m = viMockRegex.exec(content)) !== null) {
    const openParen = m.index + m[0].length - 1;
    const closeParen = findClosingParen(content, openParen);
    if (closeParen === -1) continue;
    if (pos > openParen && pos < closeParen) return true;
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Wire testCtx into hook calls
// ─────────────────────────────────────────────────────────────────────────────
function wireTestCtxIntoCalls(content, hookFns) {
  for (const fnName of hookFns) {
    const callRegex = new RegExp(`(?<!\\w)${escapeForRegex(fnName)}\\s*\\(`, 'g');
    let match;
    const insertions = [];

    while ((match = callRegex.exec(content)) !== null) {
      const matchStart = match.index;
      const parenOpen = matchStart + match[0].length - 1;
      const before = content.substring(Math.max(0, matchStart - 50), matchStart);

      if (/expect\s*\(\s*$/.test(before)) continue;
      if (/vi\.mocked\s*\(\s*$/.test(before)) continue;
      if (/vi\.fn\s*\(\s*$/.test(before)) continue;
      if (/describe\s*\(\s*$/.test(before)) continue;
      if (/test\s*\(\s*$/.test(before)) continue;
      if (/it\s*\(\s*$/.test(before)) continue;
      if (/\.mock\s*\(\s*$/.test(before)) continue;
      if (isInsideViMockFactory(content, matchStart)) continue;

      const closeParen = findClosingParen(content, parenOpen);
      if (closeParen === -1) continue;

      const callArgs = content.substring(parenOpen + 1, closeParen);
      if (/\btestCtx\b/.test(callArgs)) continue;

      insertions.push({ pos: closeParen });
    }

    insertions.sort((a, b) => b.pos - a.pos);
    for (const { pos } of insertions) {
      const argContent = content.substring(
        content.lastIndexOf('(', pos) + 1,
        pos,
      ).trim();
      if (argContent === '') {
        content = content.substring(0, pos) + 'testCtx' + content.substring(pos);
      } else {
        content = content.substring(0, pos) + ', testCtx' + content.substring(pos);
      }
    }
  }
  return content;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fix .toHaveBeenCalledWith(input, undefined) in dispatcher tests
// ─────────────────────────────────────────────────────────────────────────────
function fixCalledWithUndefined(content) {
  return content.replace(
    /\.toHaveBeenCalledWith\((\w+),\s*undefined\)/g,
    '.toHaveBeenCalledWith($1, testCtx)',
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sync vi.mocked(getter).mockReturnValue(X) to (testCtx as any).field = X
// When hooks use ctx?.field ?? getField(), the mock on getField is bypassed
// if ctx is provided. This adds a testCtx field assignment after each mock.
// ─────────────────────────────────────────────────────────────────────────────
const GETTER_TO_CTX = {
  getProjectDir: 'projectDir',
  getLogDir: 'logDir',
  getSessionId: 'sessionId',
  getPluginRoot: 'pluginRoot',
  getPluginDataDir: 'pluginDataDir',
  getCachedBranch: 'branch',
  getLogLevel: 'logLevel',
};

function syncMockOverridesToCtx(content) {
  for (const [getter, ctxField] of Object.entries(GETTER_TO_CTX)) {
    // Pattern: vi.mocked(getProjectDir).mockReturnValue('/custom');
    // Add after: (testCtx as any).projectDir = '/custom';
    const mockReturnRegex = new RegExp(
      `^([ \\t]*)(vi\\.mocked\\(${escapeForRegex(getter)}\\)\\.mockReturnValue\\(([^)]+)\\);?)[ \\t]*$`,
      'gm',
    );
    content = content.replace(mockReturnRegex, (_match, indent, originalLine, value) => {
      return `${indent}${originalLine}\n${indent}(testCtx as any).${ctxField} = ${value};`;
    });

    // Also handle: vi.mocked(getProjectDir).mockReturnValue(VARIABLE) on one line
    // Already handled above since ([^)]+) captures variable names too.

    // NOTE: vi.mocked(getter).mockImplementation() is NOT handled automatically.
    // Multi-line throw blocks and complex implementations need manual attention.
  }

  // Sync overrides from the vi.mock block for common.js into createTestContext calls.
  // Detect getter overrides in BOTH patterns:
  //   1. mockCommonBasic({ getXxx: vi.fn(() => VALUE) })
  //   2. Inline vi.mock with { getXxx: vi.fn(() => VALUE) } in the return
  const defaults = {
    getProjectDir: "'/test/project'",
    getLogDir: "'/test/logs'",
    getSessionId: "'test-session-123'",
    getPluginRoot: "'/test/plugin-root'",
    getPluginDataDir: 'null',
    getCachedBranch: "'main'",
    getLogLevel: "'warn'",
  };

  const ctxOverrides = {};
  for (const [getter, ctxField] of Object.entries(GETTER_TO_CTX)) {
    // Pattern 1: mockCommonBasic({ getXxx: vi.fn(() => VALUE) })
    // Pattern 2: inline { getXxx: vi.fn(() => VALUE) }
    const overrideRegex = new RegExp(
      `${escapeForRegex(getter)}:\\s*vi\\.fn\\(\\s*\\(\\)\\s*=>\\s*([^)]+)\\)`,
    );
    const overrideMatch = content.match(overrideRegex);
    if (overrideMatch) {
      const value = overrideMatch[1].trim();
      if (defaults[getter] && value === defaults[getter]) continue;
      ctxOverrides[ctxField] = value;
    }
  }

  if (Object.keys(ctxOverrides).length > 0) {
    const overrideStr = Object.entries(ctxOverrides)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');

    // Add overrides to createTestContext() calls
    content = content.replace(/createTestContext\(\)/g, () => {
      return `createTestContext({ ${overrideStr} })`;
    });

    // Merge into existing createTestContext({ ... }) calls
    content = content.replace(/createTestContext\(\{([^}]+)\}\)/g, (match, existingArgs) => {
      const existingFields = existingArgs.split(',').map(s => s.trim().split(':')[0].trim());
      const newOverrides = Object.entries(ctxOverrides)
        .filter(([k]) => !existingFields.includes(k))
        .map(([k, v]) => `${k}: ${v}`);
      if (newOverrides.length === 0) return match;
      return `createTestContext({ ${existingArgs.trim()}, ${newOverrides.join(', ')} })`;
    });
  }

  return content;
}

// ─────────────────────────────────────────────────────────────────────────────
// Remove getter spy assertions that test implementation details.
// With ctx passed, hooks use ctx.field instead of calling getField().
// Assertions like `expect(getProjectDir).toHaveBeenCalled()` are now wrong.
// ─────────────────────────────────────────────────────────────────────────────
const GETTER_NAMES = [
  'getProjectDir', 'getLogDir', 'getSessionId', 'getPluginRoot',
  'getPluginDataDir', 'getCachedBranch', 'getLogLevel', 'getEnvFile',
];

function removeGetterSpyAssertions(content) {
  const lines = content.split('\n');
  const result = [];
  for (const line of lines) {
    const trimmed = line.trim();
    let shouldRemove = false;
    for (const getter of GETTER_NAMES) {
      // Remove: expect(getProjectDir).toHaveBeenCalled();
      // Remove: expect(getProjectDir).toHaveBeenCalledTimes(1);
      // Keep: expect(vi.mocked(getProjectDir).mock.calls[0][0]).toBe('something');
      if (trimmed.startsWith(`expect(${getter}).toHave`) ||
          trimmed.startsWith(`expect(${getter}).not.toHave`)) {
        shouldRemove = true;
        break;
      }
    }
    if (!shouldRemove) {
      result.push(line);
    }
  }
  return result.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Transform logHook assertions to testCtx.log.
// 154/180 hooks use ctx?.log, so expect(logHook) should become expect(testCtx.log).
// Also transform vi.mocked(logHook).mock.calls → testCtx.log.mock.calls
// ─────────────────────────────────────────────────────────────────────────────
function transformLogAssertions(content) {
  // expect(logHook) → expect(testCtx.log)
  content = content.replace(/expect\(logHook\)/g, 'expect(testCtx.log)');

  // vi.mocked(logHook).mock.calls → testCtx.log.mock.calls
  content = content.replace(/vi\.mocked\(logHook\)\.mock\.calls/g, 'testCtx.log.mock.calls');
  content = content.replace(/vi\.mocked\(logHook\)\.mockClear/g, 'testCtx.log.mockClear');

  // const mockLogHook = vi.mocked(logHook) → remove and replace refs
  const constLines = content.match(/^\s*const\s+(\w+)\s*=\s*vi\.mocked\(\s*logHook\s*\)\s*;?\s*$/gm);
  if (constLines) {
    for (const constLine of constLines) {
      const varMatch = constLine.match(/const\s+(\w+)/);
      if (!varMatch) continue;
      const varName = varMatch[1];
      // Remove the const line
      content = content.replace(constLine + '\n', '');
      content = content.replace(constLine, '');
      // Replace all references to the variable with testCtx.log
      content = content.replace(new RegExp(`\\b${escapeForRegex(varName)}\\b`, 'g'), 'testCtx.log');
    }
  }

  // Similarly for logPermissionFeedback → testCtx.logPermission
  content = content.replace(/expect\(logPermissionFeedback\)/g, 'expect(testCtx.logPermission)');
  content = content.replace(/vi\.mocked\(logPermissionFeedback\)/g, 'testCtx.logPermission');

  return content;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
function migrateFile(filePath) {
  let content = readFileSync(filePath, 'utf-8');
  const original = content;

  if (filePath.includes('/fixtures/') || filePath.includes('/helpers/')) {
    return { changed: false, reason: 'fixtures/helpers file' };
  }
  if (!/createTestContext/.test(content)) {
    return { changed: false, reason: 'no createTestContext scaffolding' };
  }
  // Guard: must have a real top-level `let testCtx` or `const testCtx` declaration.
  // Template literal content may contain `testCtx` but won't have it at column 0.
  const lines = content.split('\n');
  const hasRealDecl = lines.some(line =>
    /^(?:let|const)\s+testCtx\b/.test(line.trimStart()) &&
    // Exclude lines that are clearly inside template literals (preceded by backtick-open line)
    !isLineInsideTemplateLiteral(lines, lines.indexOf(line))
  );
  if (!hasRealDecl) {
    return { changed: false, reason: 'no real testCtx declaration (may be in string content)' };
  }

  const hookFns = identifyHookFunctions(content);
  if (hookFns.size === 0) {
    return { changed: false, reason: 'no hook functions identified' };
  }

  content = wireTestCtxIntoCalls(content, hookFns);
  content = fixCalledWithUndefined(content);
  content = syncMockOverridesToCtx(content);
  content = removeGetterSpyAssertions(content);
  content = transformLogAssertions(content);

  const changed = content !== original;
  if (changed && !DRY_RUN) {
    writeFileSync(filePath, content, 'utf-8');
  }
  return { changed, hookFns: [...hookFns] };
}

// ─────────────────────────────────────────────────────────────────────────────
// Run
// ─────────────────────────────────────────────────────────────────────────────
const allFiles = collectTestFiles(TESTS_ROOT);
stats.total = allFiles.length;
console.log(`Found ${allFiles.length} test files${DRY_RUN ? ' (DRY RUN)' : ''}\n`);

for (const filePath of allFiles) {
  const shortPath = relative(join(TESTS_ROOT, '..', '..', '..'), filePath);
  try {
    const result = migrateFile(filePath);
    if (result.changed) {
      stats.wired++;
      console.log(`  wired: ${shortPath}  [${result.hookFns.join(', ')}]`);
    } else {
      stats.skipped.push({ path: shortPath, reason: result.reason });
    }
  } catch (err) {
    stats.errors.push({ path: shortPath, error: err.message });
    console.error(`  ERROR: ${shortPath} -- ${err.message}`);
  }
}

console.log('\n' + '='.repeat(70));
console.log('  wire-testctx -- Results');
console.log('='.repeat(70));
console.log(`Total test files:   ${stats.total}`);
console.log(`Wired:              ${stats.wired}`);
console.log(`Skipped:            ${stats.skipped.length}`);
console.log(`Errors:             ${stats.errors.length}`);

if (stats.skipped.length > 0 && process.argv.includes('--verbose')) {
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
