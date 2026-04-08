#!/usr/bin/env node
/**
 * migrate-common-mocks.mjs
 *
 * Mass-migrates inline vi.mock('…/lib/common.js', () => ({…})) blocks
 * to the mockCommonBasic() factory from fixtures/mock-common.ts.
 *
 * Rules:
 * - SKIP files using async + importActual (Pattern C — intentional)
 * - SKIP files already importing mockCommonBasic / mockCommonReal / mockEnv / mockLog
 * - Detect custom overrides in the inline mock vs the default mockCommonBasic() and
 *   pass them as overrides: mockCommonBasic({ custom: vi.fn(() => …) })
 * - Add the import for mockCommonBasic from the appropriate relative fixtures path
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';

const HOOKS_ROOT = new URL('../src/hooks/src/__tests__', import.meta.url).pathname;

// ─────────────────────────────────────────────────────────────────────────────
// Collect all .test.ts files recursively
// ─────────────────────────────────────────────────────────────────────────────
function collectTestFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectTestFiles(full));
    } else if (entry.name.endsWith('.test.ts')) {
      results.push(full);
    }
  }
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Functions that mockCommonBasic() already provides with default behavior.
// If a test file's inline mock defines one of these with the EXACT default
// shape, it's NOT an override.  Otherwise, it IS an override.
// ─────────────────────────────────────────────────────────────────────────────

// Keys that mockCommonBasic() provides out of the box
const DEFAULT_KEYS = new Set([
  'logHook',
  'logPermissionFeedback',
  'writeRulesFile',
  'readHookInput',
  'getProjectDir',
  'getPluginRoot',
  'getLogDir',
  'getPluginDataDir',
  'getSessionId',
  'getEnvFile',
  'getCachedBranch',
  'outputStderrWarning',
  'getLogLevel',
  'shouldLog',
  'outputSilentSuccess',
  'outputSilentAllow',
  'outputBlock',
  'outputWithContext',
  'outputPromptContext',
  'outputWithNotification',
  'outputDefer',
  'outputAllowWithContext',
  'outputError',
  'outputWarning',
  'outputDeny',
  'outputAsk',
  'outputWithUpdatedInput',
  'outputPromptContextBudgeted',
  'extractContext',
  'estimateTokenCount',
  'getField',
  'normalizeCommand',
  'normalizeLineEndings',
  'escapeRegex',
  'lineContainsAll',
  'lineContainsAllCI',
  'fnv1aHash',
]);

// Default return values for functions from mockCommonBasic. When a test
// provides the same default return, it's not a custom override.
const DEFAULT_RETURN_PATTERNS = {
  logHook: 'vi.fn()',
  logPermissionFeedback: 'vi.fn()',
  writeRulesFile: 'vi.fn(() => true)',
  readHookInput: null, // complex default — always treat as override if present
  getProjectDir: "vi.fn(() => '/test/project')",
  getPluginRoot: "vi.fn(() => '/test/plugin-root')",
  getLogDir: "vi.fn(() => '/test/logs')",
  getPluginDataDir: 'vi.fn(() => null)',
  getSessionId: "vi.fn(() => 'test-session-123')",
  getEnvFile: null,
  getCachedBranch: "vi.fn(() => 'main')",
  getLogLevel: "vi.fn(() => 'warn')",
  shouldLog: 'vi.fn(() => false)',
  // Output helpers — complex multi-line, always treat as defaults
  outputSilentSuccess: null,
  outputSilentAllow: null,
  outputBlock: null,
  outputWithContext: null,
  outputPromptContext: null,
  outputWithNotification: null,
  outputDefer: null,
  outputAllowWithContext: null,
  outputError: null,
  outputWarning: null,
  outputDeny: null,
  outputAsk: null,
  outputWithUpdatedInput: null,
  outputPromptContextBudgeted: null,
  extractContext: null,
  estimateTokenCount: null,
  getField: null,
  normalizeCommand: null,
  normalizeLineEndings: null,
  escapeRegex: null,
  lineContainsAll: null,
  lineContainsAllCI: null,
  fnv1aHash: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// Parse a vi.mock block for common.js — extract the whole thing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Given file content and the start index of vi.mock(, finds the full block
 * including the closing );
 * Returns { fullMatch, startIdx, endIdx } or null.
 */
function extractViMockBlock(content, searchStart) {
  // Find vi.mock( at or after searchStart
  const mockRegex = /vi\.mock\(\s*['"](?:\.\.\/\.\.\/|\.\.\/\.\.\/\.\.\/)?lib\/common\.js['"]\s*,/g;
  mockRegex.lastIndex = searchStart;
  const m = mockRegex.exec(content);
  if (!m) return null;

  const blockStart = m.index;
  // Now find the matching closing ); by counting parens
  let depth = 0;
  let i = blockStart;
  // Find the opening paren of vi.mock(
  while (i < content.length && content[i] !== '(') i++;
  depth = 1;
  i++; // past the (

  while (i < content.length && depth > 0) {
    const ch = content[i];
    if (ch === '(' || ch === '{') depth++;
    else if (ch === ')' || ch === '}') depth--;
    // Handle string literals
    else if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch;
      i++;
      while (i < content.length && content[i] !== quote) {
        if (content[i] === '\\') i++; // skip escaped
        i++;
      }
    }
    // Handle // comments
    else if (ch === '/' && i + 1 < content.length && content[i + 1] === '/') {
      while (i < content.length && content[i] !== '\n') i++;
      continue;
    }
    // Handle /* */ comments
    else if (ch === '/' && i + 1 < content.length && content[i + 1] === '*') {
      i += 2;
      while (i < content.length && !(content[i] === '*' && content[i + 1] === '/')) i++;
      i++; // skip /
    }
    i++;
  }

  // i is now past the closing ), include any trailing ;
  let endIdx = i;
  while (endIdx < content.length && (content[endIdx] === ' ' || content[endIdx] === '\t')) endIdx++;
  if (endIdx < content.length && content[endIdx] === ';') endIdx++;

  return {
    fullMatch: content.slice(blockStart, endIdx),
    startIdx: blockStart,
    endIdx,
  };
}

/**
 * Detect whether a vi.mock block uses async + importActual or async (importOriginal)
 * Both patterns spread the real module — skip them.
 */
function isAsyncImportActual(blockText) {
  if (!/async\s*\(/.test(blockText)) return false;
  return /importActual/.test(blockText) || /importOriginal/.test(blockText);
}

/**
 * Determine the relative path prefix (../../ or ../../../) from the mock block.
 */
function getRelativePrefix(blockText) {
  const m = blockText.match(/['"](\.\.\/.+?)\/lib\/common\.js['"]/);
  if (!m) return null;
  return m[1]; // e.g. '../..' or '../../..'
}

/**
 * Parse the properties from the inline mock object.
 * Returns an array of { name, valueText } for each property.
 */
function parseInlineMockProperties(blockText) {
  // Extract the object literal inside the () => ({ ... })
  // Find the arrow function body
  const arrowMatch = blockText.match(/=>\s*\(\{/);
  if (!arrowMatch) {
    // Try => { return { ... } } pattern
    const returnMatch = blockText.match(/=>\s*\{\s*return\s*\{/);
    if (!returnMatch) return null;
  }

  // Find the opening { of the return object
  let objStart = -1;
  const arrowIdx = blockText.indexOf('=>');
  if (arrowIdx === -1) return null;

  let searchFrom = arrowIdx + 2;
  // Skip whitespace and possible ({
  while (searchFrom < blockText.length && /\s/.test(blockText[searchFrom])) searchFrom++;

  // pattern: () => ({ ... })
  if (blockText[searchFrom] === '(') {
    searchFrom++;
    while (searchFrom < blockText.length && /\s/.test(blockText[searchFrom])) searchFrom++;
    if (blockText[searchFrom] === '{') {
      objStart = searchFrom;
    }
  }
  // pattern: () => { return { ... }; }
  else if (blockText[searchFrom] === '{') {
    // check if it's { return { or just { key: ...
    const afterBrace = blockText.slice(searchFrom + 1).trimStart();
    if (afterBrace.startsWith('return')) {
      // find the { after return
      const retIdx = blockText.indexOf('return', searchFrom);
      let s = retIdx + 6;
      while (s < blockText.length && /\s/.test(blockText[s])) s++;
      if (blockText[s] === '{') objStart = s;
    } else {
      // it's () => { prop: val } — unlikely but handle
      objStart = searchFrom;
    }
  }

  if (objStart === -1) return null;

  // Now extract key-value pairs from the object at objStart
  // We need to parse property: value pairs handling nested braces
  const props = [];
  let pos = objStart + 1; // past the {

  while (pos < blockText.length) {
    // Skip whitespace and commas
    while (pos < blockText.length && /[\s,]/.test(blockText[pos])) pos++;

    // Check for closing brace
    if (blockText[pos] === '}') break;

    // Handle // comments
    if (blockText[pos] === '/' && blockText[pos + 1] === '/') {
      while (pos < blockText.length && blockText[pos] !== '\n') pos++;
      continue;
    }

    // Parse property name
    const nameMatch = blockText.slice(pos).match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*/);
    if (!nameMatch) {
      // Could be a spread or something we can't parse — bail on this prop
      // Skip to next comma or closing brace
      let depth = 0;
      while (pos < blockText.length) {
        if (blockText[pos] === '{' || blockText[pos] === '(') depth++;
        else if (blockText[pos] === '}' || blockText[pos] === ')') {
          if (depth === 0) break;
          depth--;
        } else if (blockText[pos] === ',' && depth === 0) break;
        pos++;
      }
      continue;
    }

    const propName = nameMatch[1];
    pos += nameMatch[0].length;

    // Now read the value, handling nested braces/parens/brackets
    const valueStart = pos;
    let depth = 0;
    while (pos < blockText.length) {
      const ch = blockText[pos];
      if (ch === '{' || ch === '(' || ch === '[') depth++;
      else if (ch === '}' || ch === ')' || ch === ']') {
        if (depth === 0) break;
        depth--;
      } else if (ch === ',' && depth === 0) break;
      // Handle strings
      else if (ch === "'" || ch === '"' || ch === '`') {
        const q = ch;
        pos++;
        while (pos < blockText.length && blockText[pos] !== q) {
          if (blockText[pos] === '\\') pos++;
          pos++;
        }
      }
      pos++;
    }

    const valueText = blockText.slice(valueStart, pos).trim();
    // Remove trailing comma if present
    const cleanValue = valueText.replace(/,\s*$/, '').trim();
    props.push({ name: propName, valueText: cleanValue });
  }

  return props;
}

/**
 * Determine if a property is a custom override (non-default).
 * Conservative: if we can't confirm it's default, treat as override.
 */
function isOverride(propName, valueText) {
  // Not in the default key set at all → override
  if (!DEFAULT_KEYS.has(propName)) return true;

  // Check simple pattern match for known defaults
  const defaultPattern = DEFAULT_RETURN_PATTERNS[propName];

  // If the value references a variable (not starting with vi.fn), it's
  // always an override — e.g. `fnv1aHash: realFnv1aHash` or `logHook: (...args) => mockLogHook(...args)`
  const trimmedValue = valueText.trim();
  if (!trimmedValue.startsWith('vi.fn') && !trimmedValue.startsWith('(') && !trimmedValue.startsWith('function')) {
    return true;
  }

  // null or undefined means "complex default" — be conservative:
  // If it's a known output helper or pure utility that the factory provides,
  // only treat as non-override if the implementation looks like a standard
  // vi.fn() wrapper (no closure references, no custom logic).
  if (defaultPattern === null || defaultPattern === undefined) {
    // Check for signs of custom logic: closure variable references,
    // array.push, custom return shapes, etc.
    if (/\.push\(|stderrMessages|mock[A-Z]/.test(trimmedValue)) {
      return true; // Clearly uses test-local state
    }
    // If fnv1aHash has custom implementation like vi.fn((s) => `hash_${s.length}`)
    // that's an override
    if (propName === 'fnv1aHash' && trimmedValue !== "vi.fn(() => '00000000')") {
      return true;
    }
    return false;
  }

  // Normalize whitespace for comparison
  const normalizedValue = valueText.replace(/\s+/g, ' ').trim();
  const normalizedDefault = defaultPattern.replace(/\s+/g, ' ').trim();

  return normalizedValue !== normalizedDefault;
}

// ─────────────────────────────────────────────────────────────────────────────
// Determine the fixtures import path based on test file location
// ─────────────────────────────────────────────────────────────────────────────
function getFixturesImportPath(filePath) {
  const fileDir = dirname(filePath);
  const fixturesDir = join(HOOKS_ROOT, 'fixtures');
  let rel = relative(fileDir, fixturesDir);
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel + '/mock-common.js';
}

/**
 * Determine the mock path prefix from the file location.
 * Files directly in __tests__/<category>/ use ../../
 * Files in __tests__/<category>/<sub>/ use ../../../
 */
function getMockPathFromFile(filePath) {
  const relToTests = relative(HOOKS_ROOT, filePath);
  const parts = relToTests.split('/');
  // parts: [category, file.test.ts] or [category, sub, file.test.ts]
  if (parts.length <= 2) return '../../lib/common.js';
  return '../../../lib/common.js';
}

// ─────────────────────────────────────────────────────────────────────────────
// Main migration
// ─────────────────────────────────────────────────────────────────────────────

const allFiles = collectTestFiles(HOOKS_ROOT);
const stats = {
  total: allFiles.length,
  noCommonMock: 0,
  alreadyFactory: 0,
  asyncImportActual: 0,
  migrated: 0,
  migratedWithOverrides: 0,
  errors: [],
};

const migratedFiles = [];
const skippedFiles = [];
const errorFiles = [];

for (const filePath of allFiles) {
  const content = readFileSync(filePath, 'utf-8');
  const shortPath = relative(join(HOOKS_ROOT, '..', '..', '..'), filePath);

  // Check if file has vi.mock for common.js at all
  if (!/vi\.mock\(['"]\.*\.\.\/.*lib\/common\.js['"]/.test(content)) {
    stats.noCommonMock++;
    continue;
  }

  // Skip files already using factory imports
  if (/import\s+\{[^}]*(?:mockCommonBasic|mockCommonReal|mockEnv|mockLog)[^}]*\}\s+from/.test(content)) {
    stats.alreadyFactory++;
    skippedFiles.push({ path: shortPath, reason: 'already uses factory import' });
    continue;
  }

  // Find the vi.mock block
  const block = extractViMockBlock(content, 0);
  if (!block) {
    stats.noCommonMock++;
    continue;
  }

  // Skip async + importActual pattern
  if (isAsyncImportActual(block.fullMatch)) {
    stats.asyncImportActual++;
    skippedFiles.push({ path: shortPath, reason: 'async + importActual (Pattern C)' });
    continue;
  }

  // Determine the mock path prefix
  const relPrefix = getRelativePrefix(block.fullMatch);
  if (!relPrefix) {
    stats.errors.push(shortPath);
    errorFiles.push({ path: shortPath, reason: 'could not determine relative prefix' });
    continue;
  }

  // Parse inline mock properties
  const props = parseInlineMockProperties(block.fullMatch);
  if (props === null) {
    stats.errors.push(shortPath);
    errorFiles.push({ path: shortPath, reason: 'could not parse inline mock properties' });
    continue;
  }

  // Determine overrides
  const overrides = [];
  for (const prop of props) {
    if (isOverride(prop.name, prop.valueText)) {
      overrides.push(prop);
    }
  }

  // Build the replacement vi.mock line
  const mockPath = `${relPrefix}/lib/common.js`;
  let replacement;
  if (overrides.length === 0) {
    replacement = `vi.mock('${mockPath}', () => mockCommonBasic());`;
  } else {
    // Format overrides
    const overrideEntries = overrides.map(o => `  ${o.name}: ${o.valueText},`).join('\n');
    replacement = `vi.mock('${mockPath}', () => mockCommonBasic({\n${overrideEntries}\n}));`;
  }

  // Build the import statement
  const fixturesImport = getFixturesImportPath(filePath);

  // Replace the block
  let newContent = content.slice(0, block.startIdx) + replacement + content.slice(block.endIdx);

  // Add import for mockCommonBasic
  // Strategy: insert after the last existing import line before the vi.mock area,
  // or after the first vi.hoisted block, or after the first import line.
  // Most test files have imports, then mocks.
  // We'll find the right insertion point.

  // Check if there's already an import from fixtures
  if (!newContent.includes("from '" + fixturesImport.replace(/\.js$/, '') + "'") &&
      !newContent.includes('from "' + fixturesImport.replace(/\.js$/, '') + '"') &&
      !newContent.includes("from '" + fixturesImport + "'") &&
      !newContent.includes('from "' + fixturesImport + '"')) {

    const importLine = `import { mockCommonBasic } from '${fixturesImport}';\n`;

    // Find the best place to insert:
    // 1. Right before the vi.mock block for common.js (the one we just replaced)
    // 2. After the last import statement that comes before the mock block

    // Find last import before our replaced mock
    const mockStartInNew = newContent.indexOf(replacement);
    const beforeMock = newContent.slice(0, mockStartInNew);

    // Find the last import line before the mock
    const importRegex = /^import\s+.+$/gm;
    let lastImportEnd = -1;
    let importMatch;
    while ((importMatch = importRegex.exec(beforeMock)) !== null) {
      lastImportEnd = importMatch.index + importMatch[0].length;
    }

    if (lastImportEnd > 0) {
      // Insert after last import, before any blank line or mock
      // Find the newline after the last import
      let insertAt = lastImportEnd;
      // Move past the newline
      if (newContent[insertAt] === '\n') insertAt++;
      newContent = newContent.slice(0, insertAt) + importLine + newContent.slice(insertAt);
    } else {
      // No imports before the mock — insert right before the mock block
      // Look for comment lines or blank lines preceding it
      const lines = newContent.split('\n');
      let insertLineIdx = -1;

      for (let li = 0; li < lines.length; li++) {
        if (lines[li].includes(replacement.split('\n')[0])) {
          // Insert before any preceding comment block about mocks
          insertLineIdx = li;
          // Walk backwards over comments and blank lines
          while (insertLineIdx > 0 &&
                 (lines[insertLineIdx - 1].trim() === '' ||
                  lines[insertLineIdx - 1].trim().startsWith('//'))) {
            insertLineIdx--;
          }
          break;
        }
      }

      if (insertLineIdx >= 0) {
        lines.splice(insertLineIdx, 0, importLine.trimEnd());
        newContent = lines.join('\n');
      } else {
        // Fallback: put it at the very top after any header comment
        newContent = importLine + newContent;
      }
    }
  }

  // Write the file
  try {
    writeFileSync(filePath, newContent, 'utf-8');
    stats.migrated++;
    if (overrides.length > 0) {
      stats.migratedWithOverrides++;
      migratedFiles.push({
        path: shortPath,
        overrides: overrides.map(o => o.name),
      });
    } else {
      migratedFiles.push({ path: shortPath, overrides: [] });
    }
  } catch (err) {
    stats.errors.push(shortPath);
    errorFiles.push({ path: shortPath, reason: `write error: ${err.message}` });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Report
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n════════════════════════════════════════════════════════════════════');
console.log('  migrate-common-mocks — Migration Report');
console.log('════════════════════════════════════════════════════════════════════\n');
console.log(`Total test files scanned:     ${stats.total}`);
console.log(`No common.js mock:            ${stats.noCommonMock}`);
console.log(`Already using factory:        ${stats.alreadyFactory}`);
console.log(`Skipped (async importActual): ${stats.asyncImportActual}`);
console.log(`Migrated (clean):             ${stats.migrated - stats.migratedWithOverrides}`);
console.log(`Migrated (with overrides):    ${stats.migratedWithOverrides}`);
console.log(`Errors (manual fix needed):   ${stats.errors.length}`);

if (migratedFiles.length > 0) {
  console.log('\n── Migrated Files ──────────────────────────────────────────────────\n');
  for (const f of migratedFiles) {
    const overrideInfo = f.overrides.length > 0
      ? ` [overrides: ${f.overrides.join(', ')}]`
      : '';
    console.log(`  ✓ ${f.path}${overrideInfo}`);
  }
}

if (skippedFiles.length > 0) {
  console.log('\n── Skipped Files ───────────────────────────────────────────────────\n');
  for (const f of skippedFiles) {
    console.log(`  ⊘ ${f.path} — ${f.reason}`);
  }
}

if (errorFiles.length > 0) {
  console.log('\n── Errors (manual fix needed) ──────────────────────────────────────\n');
  for (const f of errorFiles) {
    console.log(`  ✗ ${f.path} — ${f.reason}`);
  }
}

console.log('\n════════════════════════════════════════════════════════════════════\n');
