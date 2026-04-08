#!/usr/bin/env node
/**
 * migrate-hooks-to-ctx.mjs — Phase 4b: Mass-migrate hooks to HookContext DI
 *
 * Scope-aware migration: only replaces env/log calls inside functions that
 * receive the ctx parameter. Helper functions keep their original calls.
 *
 * Usage: node scripts/migrate-hooks-to-ctx.mjs [--dry-run]
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const HOOKS_SRC = new URL('../src/hooks/src', import.meta.url).pathname;
const DRY_RUN = process.argv.includes('--dry-run');

// ─────────────────────────────────────────────────────────────────────────────
// Skip configuration
// ─────────────────────────────────────────────────────────────────────────────

const SKIP_DIRS = new Set(['__tests__', 'lib', 'node_modules']);
const SKIP_FILES = new Set(['types.ts', 'index.ts']);
const SKIP_PATHS = new Set([
  'entries/agent.ts', 'entries/lifecycle.ts', 'entries/notification.ts',
  'entries/permission.ts', 'entries/posttool.ts', 'entries/pretool.ts',
  'entries/prompt.ts', 'entries/setup.ts', 'entries/skill.ts',
  'entries/stop.ts', 'entries/subagent.ts',
]);

// ─────────────────────────────────────────────────────────────────────────────
// Collect all .ts hook files recursively
// ─────────────────────────────────────────────────────────────────────────────

function collectHookFiles(dir, base = dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    const rel = relative(base, full);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      results.push(...collectHookFiles(full, base));
    } else if (entry.name.endsWith('.ts')) {
      if (SKIP_FILES.has(entry.name)) continue;
      if (SKIP_PATHS.has(rel)) continue;
      results.push(full);
    }
  }
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scope tracker: find brace-delimited function body ranges
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Find the body range {start, end} of an exported function that has HookInput.
 * Returns all such function ranges (there may be more than one export per file).
 */
function findExportedHookFunctionRanges(content) {
  const ranges = [];
  // Match: export [async] function name(input: HookInput[, ctx?: HookContext]): ...
  // Also: export default [async] function [name](input: HookInput ...
  // Also matches _input: HookInput
  const funcRegex = /export\s+(?:default\s+)?(?:async\s+)?function\s+\w*\s*\([^)]*HookInput[^)]*\)/g;
  let match;
  while ((match = funcRegex.exec(content)) !== null) {
    // Find the opening brace of the function body
    const searchStart = match.index + match[0].length;
    const braceIdx = content.indexOf('{', searchStart);
    if (braceIdx === -1) continue;

    // Track brace depth to find the closing brace
    let depth = 1;
    let i = braceIdx + 1;
    while (i < content.length && depth > 0) {
      const ch = content[i];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      // Skip string literals
      else if (ch === "'" || ch === '"' || ch === '`') {
        const quote = ch;
        i++;
        while (i < content.length) {
          if (content[i] === '\\') { i++; } // skip escaped char
          else if (content[i] === quote) break;
          else if (quote === '`' && content[i] === '$' && content[i+1] === '{') {
            // template literal expression — skip over it
            // (simplified: just continue, the brace counter will handle it)
          }
          i++;
        }
      }
      // Skip line comments
      else if (ch === '/' && content[i+1] === '/') {
        while (i < content.length && content[i] !== '\n') i++;
      }
      // Skip block comments
      else if (ch === '/' && content[i+1] === '*') {
        i += 2;
        while (i < content.length - 1 && !(content[i] === '*' && content[i+1] === '/')) i++;
        i++; // skip the closing /
      }
      i++;
    }

    ranges.push({ start: braceIdx, end: i });
  }
  return ranges;
}

/**
 * Check if a position falls inside any of the given ranges.
 * Also checks we're not inside a NESTED function (helper function).
 */
function isInExportedFunctionScope(content, position, ranges) {
  for (const range of ranges) {
    if (position >= range.start && position < range.end) {
      // Check we're not inside a nested function definition
      // Look backwards from position for `function ` that's NOT the exported one
      const segment = content.slice(range.start, position);
      // Count nested function definitions and their brace depth
      // Simple heuristic: find `function (` or `function name(` that's not at the top level
      let depth = 0;
      for (let i = 0; i < segment.length; i++) {
        const ch = segment[i];
        if (ch === '{') depth++;
        else if (ch === '}') depth--;
        // Skip strings
        else if (ch === "'" || ch === '"' || ch === '`') {
          const q = ch;
          i++;
          while (i < segment.length) {
            if (segment[i] === '\\') i++;
            else if (segment[i] === q) break;
            i++;
          }
        }
      }
      // If depth > 0, we're inside a nested block (could be a nested function, if/for, etc.)
      // This is too coarse — nested if/for blocks are fine. We need to check specifically
      // for nested function definitions.
      // Better approach: we're fine if depth=0 (at top level of the function body)
      // But we also need to handle calls inside if/for/try blocks which increase depth
      // So let's check: is there a `function ` keyword between the last `{` at our depth
      // and the current position?

      // Actually, the simplest correct approach: scan for function keywords and track if
      // we're inside one. Let's look at the most recent function definition before our position.
      let insideNestedFunction = false;
      let scanIdx = 0;
      let braceStack = []; // Track which braces are function braces

      while (scanIdx < segment.length) {
        const ch = segment[scanIdx];
        // Skip strings
        if (ch === "'" || ch === '"' || ch === '`') {
          const q = ch;
          scanIdx++;
          while (scanIdx < segment.length) {
            if (segment[scanIdx] === '\\') scanIdx++;
            else if (segment[scanIdx] === q) break;
            scanIdx++;
          }
          scanIdx++;
          continue;
        }
        // Skip comments
        if (ch === '/' && segment[scanIdx+1] === '/') {
          while (scanIdx < segment.length && segment[scanIdx] !== '\n') scanIdx++;
          continue;
        }
        if (ch === '/' && segment[scanIdx+1] === '*') {
          scanIdx += 2;
          while (scanIdx < segment.length - 1 && !(segment[scanIdx] === '*' && segment[scanIdx+1] === '/')) scanIdx++;
          scanIdx += 2;
          continue;
        }

        if (ch === '{') {
          // Check if this brace follows a function definition
          const preceding = segment.slice(Math.max(0, scanIdx - 200), scanIdx).trim();
          const isFuncBrace = /(?:function\s*\w*\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*$)|(?:=>\s*$)/.test(preceding);
          braceStack.push(isFuncBrace ? 'func' : 'block');
          scanIdx++;
          continue;
        }
        if (ch === '}') {
          braceStack.pop();
          scanIdx++;
          continue;
        }
        scanIdx++;
      }

      // Check if we're currently inside a nested function
      insideNestedFunction = braceStack.some(b => b === 'func');

      if (!insideNestedFunction) {
        return true;
      }
    }
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Migration logic
// ─────────────────────────────────────────────────────────────────────────────

const stats = {
  filesProcessed: 0, filesChanged: 0, signatureChanges: 0,
  envReplacements: 0, logReplacements: 0, typeImportAdded: 0,
  localHookFnUpdated: 0, dispatcherCtxForwarded: 0,
};

function getTypesRelativePath(filePath) {
  const dir = relative(HOOKS_SRC, filePath).split('/').slice(0, -1).join('/');
  const depth = dir ? dir.split('/').length : 0;
  return `${depth === 0 ? './' : '../'.repeat(depth)}types.js`;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check if position is on an import line.
 */
function isImportLine(content, position) {
  const lineStart = content.lastIndexOf('\n', position) + 1;
  const line = content.slice(lineStart, content.indexOf('\n', position));
  return /^\s*import\s/.test(line);
}

/**
 * Check if position is in a comment.
 */
function isInComment(content, position) {
  const lineStart = content.lastIndexOf('\n', position) + 1;
  const lineContent = content.slice(lineStart, position);
  return lineContent.includes('//');
}

/**
 * Check if position is in a function definition (e.g., `export function logHook`).
 */
function isFunctionDefinition(content, position) {
  const before = content.slice(Math.max(0, position - 30), position);
  return /function\s+$/.test(before);
}

/**
 * Check if position is in a re-export statement.
 */
function isReExport(content, position) {
  const lineStart = content.lastIndexOf('\n', position) + 1;
  const line = content.slice(lineStart, content.indexOf('\n', position));
  return /^\s*export\s+\{/.test(line) && /from\s+['"]/.test(line);
}

/**
 * Check if a file has local `ctx` variable declarations that would shadow the parameter.
 * If so, use `hookCtx` as the parameter name instead.
 */
function hasLocalCtxVariable(content) {
  // Check for const/let/var ctx = ... outside of __tests__
  // We need to be careful: we want to detect `const ctx = ...` in non-test code
  const localCtxRegex = /\b(?:const|let|var)\s+ctx\b\s*=/g;
  return localCtxRegex.test(content);
}

/**
 * Migrate a single hook file.
 */
function migrateFile(filePath) {
  const original = readFileSync(filePath, 'utf-8');
  let content = original;
  const changes = [];
  const relPath = relative(HOOKS_SRC, filePath);

  // ─── Pre-flight: does this file have hook functions? ──────────────────
  const hasHookResult = /HookResult/.test(content);
  const hasExportFunction = /export\s+(async\s+)?function\s+/.test(content);
  const usesEnvOrLog = /(?:getProjectDir|getLogDir|getSessionId|getCachedBranch|getPluginRoot|getPluginDataDir|logHook|logPermissionFeedback|writeRulesFile)\s*\(/.test(content);

  if (!hasHookResult && !usesEnvOrLog) {
    return { changed: false, changes: ['skip: no HookResult and no env/log usage'] };
  }

  // Determine ctx parameter name — use `hookCtx` if file has local `ctx` variable
  const useHookCtx = hasLocalCtxVariable(content);
  const ctxParam = useHookCtx ? 'hookCtx' : 'ctx';
  const ctxAccess = useHookCtx ? 'hookCtx' : 'ctx';

  // ─── Step 1: Add HookContext import ───────────────────────────────────

  if (!/import\s+(?:type\s+)?{[^}]*HookContext[^}]*}\s+from/.test(content)) {
    const typesPath = getTypesRelativePath(filePath);
    const typesImportRegex = new RegExp(
      `(import\\s+type\\s*\\{)([^}]*)(\\}\\s*from\\s*['"]${escapeRegex(typesPath)}['"])`,
    );
    const match = content.match(typesImportRegex);
    if (match && !match[2].includes('HookContext')) {
      content = content.replace(typesImportRegex, `$1$2, HookContext$3`);
      changes.push('added HookContext to existing types import');
      stats.typeImportAdded++;
    } else if (!match) {
      // Try non-type import
      const nonTypeRegex = new RegExp(
        `(import\\s*\\{)([^}]*)(\\}\\s*from\\s*['"]${escapeRegex(typesPath)}['"])`,
      );
      const nm = content.match(nonTypeRegex);
      if (nm && !nm[2].includes('HookContext')) {
        content = content.replace(nonTypeRegex, `$1$2, HookContext$3`);
        changes.push('added HookContext to import from types');
        stats.typeImportAdded++;
      } else if (!nm && (usesEnvOrLog || hasHookResult)) {
        // Add new import line
        const lastImportIdx = content.lastIndexOf('\nimport ');
        if (lastImportIdx !== -1) {
          const semiIdx = content.indexOf(';', lastImportIdx + 1);
          const insertPoint = semiIdx !== -1 ? semiIdx + 1 : content.indexOf('\n', lastImportIdx + 1);
          content = content.slice(0, insertPoint) +
            `\nimport type { HookContext } from '${typesPath}';` +
            content.slice(insertPoint);
          changes.push('added new HookContext type import');
          stats.typeImportAdded++;
        }
      }
    }
  }

  // ─── Step 2: Add ctx parameter to exported hook functions ─────────────

  // Pattern: export [async] function name(input: HookInput): ...
  // Also matches _input: HookInput (underscore prefix for unused params)
  const funcSigRegex = /^(export\s+(?:async\s+)?function\s+\w+\s*\(\s*)(_?input\s*:\s*HookInput)(\s*\))/gm;
  for (const m of [...content.matchAll(funcSigRegex)]) {
    if (m[0].includes('ctx') || m[0].includes('hookCtx')) continue;
    const replacement = `${m[1]}${m[2]}, ${ctxParam}?: HookContext${m[3]}`;
    content = content.replace(m[0], replacement);
    changes.push(`added ${ctxParam} param to: ${m[0].slice(0, 60).trim()}...`);
    stats.signatureChanges++;
  }

  // Default exports
  const defFuncRegex = /^(export\s+default\s+(?:async\s+)?function\s*(?:\w+\s*)?\(\s*)(_?input\s*:\s*HookInput)(\s*\))/gm;
  for (const m of [...content.matchAll(defFuncRegex)]) {
    if (m[0].includes('ctx') || m[0].includes('hookCtx')) continue;
    const replacement = `${m[1]}${m[2]}, ${ctxParam}?: HookContext${m[3]}`;
    content = content.replace(m[0], replacement);
    changes.push(`added ${ctxParam} param to default export`);
    stats.signatureChanges++;
  }

  // ─── Step 3: Update local HookFn type aliases and interface fn properties ──

  // type HookFn = (input: HookInput) => HookResult
  const localFnRegex = /^(type\s+(?:\w*)?Fn\s*=\s*\(\s*)(_?input\s*:\s*HookInput)(\s*\))/gm;
  for (const m of [...content.matchAll(localFnRegex)]) {
    if (m[0].includes('ctx') || m[0].includes('hookCtx')) continue;
    const replacement = `${m[1]}${m[2]}, ${ctxParam}?: HookContext${m[3]}`;
    content = content.replace(m[0], replacement);
    changes.push(`updated local type alias to include ${ctxParam}`);
    stats.localHookFnUpdated++;
  }

  // interface HookConfig { fn: (input: HookInput) => HookResult; }
  const interfaceFnRegex = /(fn:\s*\(\s*)(_?input\s*:\s*HookInput)(\s*\)\s*=>)/gm;
  for (const m of [...content.matchAll(interfaceFnRegex)]) {
    if (m[0].includes('ctx') || m[0].includes('hookCtx')) continue;
    const replacement = `${m[1]}${m[2]}, ${ctxParam}?: HookContext${m[3]}`;
    content = content.replace(m[0], replacement);
    changes.push(`updated interface fn property to include ${ctxParam}`);
    stats.localHookFnUpdated++;
  }

  // ─── Step 4: Scope-aware env/log replacements ─────────────────────────
  // Only replace calls inside functions that have the ctx parameter

  const funcRanges = findExportedHookFunctionRanges(content);

  // Environment calls
  const envReplacements = [
    { pattern: 'getProjectDir()', prop: 'projectDir' },
    { pattern: 'getLogDir()', prop: 'logDir' },
    { pattern: 'getSessionId()', prop: 'sessionId' },
    { pattern: 'getPluginRoot()', prop: 'pluginRoot' },
    { pattern: 'getPluginDataDir()', prop: 'pluginDataDir' },
  ];

  for (const { pattern, prop } of envReplacements) {
    const escaped = escapeRegex(pattern);
    const regex = new RegExp(escaped, 'g');
    const matches = [...content.matchAll(regex)];

    // Process in reverse order to maintain index validity
    for (let i = matches.length - 1; i >= 0; i--) {
      const m = matches[i];
      const idx = m.index;

      // Skip if not in exported function scope
      if (!isInExportedFunctionScope(content, idx, funcRanges)) continue;
      // Skip imports, comments, function definitions
      if (isImportLine(content, idx)) continue;
      if (isInComment(content, idx)) continue;
      if (isFunctionDefinition(content, idx)) continue;
      // Skip if already wrapped
      const before = content.slice(Math.max(0, idx - 60), idx);
      if (new RegExp(`${escapeRegex(ctxAccess)}\\?\\.${escapeRegex(prop)}\\s*\\?\\?\\s*$`).test(before)) continue;

      const replacement = `(${ctxAccess}?.${prop} ?? ${pattern})`;

      // Check if we need parentheses around the ?? expression:
      // - Before || or && operators
      // - After unary ! operator (else !ctx?.prop ?? fn() has wrong precedence)
      const trimmedBefore = before.trimEnd();
      const needsParens = /\|\|\s*$/.test(trimmedBefore) || /&&\s*$/.test(trimmedBefore) || /!\s*$/.test(trimmedBefore);

      let finalReplacement = needsParens ? replacement : `${ctxAccess}?.${prop} ?? ${pattern}`;

      content = content.slice(0, idx) + finalReplacement + content.slice(idx + pattern.length);
      changes.push(`${pattern} → ${ctxAccess}?.${prop} ?? ${pattern}`);
      stats.envReplacements++;
    }
  }

  // getCachedBranch special case (has arguments)
  const branchRegex = /getCachedBranch\([^)]*\)/g;
  const branchMatches = [...content.matchAll(branchRegex)];
  for (let i = branchMatches.length - 1; i >= 0; i--) {
    const m = branchMatches[i];
    const idx = m.index;
    if (!isInExportedFunctionScope(content, idx, funcRanges)) continue;
    if (isImportLine(content, idx)) continue;
    if (isInComment(content, idx)) continue;
    const before = content.slice(Math.max(0, idx - 60), idx);
    if (new RegExp(`${escapeRegex(ctxAccess)}\\?\\.branch\\s*\\?\\?\\s*$`).test(before)) continue;

    const fullCall = m[0];
    const trimmedBefore = before.trimEnd();
    const needsParens = /\|\|\s*$/.test(trimmedBefore);
    const replacement = needsParens
      ? `(${ctxAccess}?.branch ?? ${fullCall})`
      : `${ctxAccess}?.branch ?? ${fullCall}`;

    content = content.slice(0, idx) + replacement + content.slice(idx + fullCall.length);
    changes.push(`getCachedBranch → ${ctxAccess}?.branch ?? getCachedBranch`);
    stats.envReplacements++;
  }

  // Log calls — scope-aware
  content = replaceScopedLogCall(content, changes, funcRanges, ctxAccess, 'logHook', `${ctxAccess}?.log ?? logHook`);
  content = replaceScopedLogCall(content, changes, funcRanges, ctxAccess, 'logPermissionFeedback', `${ctxAccess}?.logPermission ?? logPermissionFeedback`);
  content = replaceScopedLogCall(content, changes, funcRanges, ctxAccess, 'writeRulesFile', `${ctxAccess}?.writeRules ?? writeRulesFile`);

  // ─── Step 5: Forward ctx in dispatcher calls ──────────────────────────

  // hook.fn(input) → hook.fn(input, ctx)
  const dispatcherRegex = /(\w+\.fn\(\s*)(input)(\s*\))/g;
  const dispMatches = [...content.matchAll(dispatcherRegex)];
  for (let i = dispMatches.length - 1; i >= 0; i--) {
    const m = dispMatches[i];
    if (m[0].includes(ctxParam)) continue;
    if (!isInExportedFunctionScope(content, m.index, funcRanges)) continue;
    const replacement = `${m[1]}${m[2]}, ${ctxParam}${m[3]}`;
    content = content.slice(0, m.index) + replacement + content.slice(m.index + m[0].length);
    changes.push(`forwarded ${ctxParam} in: ${m[0].trim()}`);
    stats.dispatcherCtxForwarded++;
  }

  // Direct sub-hook calls: someHook(input) → someHook(input, ctx)
  // ONLY for imports from sibling hook directories (./foo.js, ../category/foo.js)
  // NEVER from lib/ (../lib/*, ../../lib/*) — those are utility functions
  const hookImports = new Set();
  const importRegex = /import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g;
  for (const m of content.matchAll(importRegex)) {
    const importPath = m[2];
    // Skip lib/ imports — utility functions, not hooks
    if (/\/lib\//.test(importPath)) continue;
    // Skip node: imports
    if (importPath.startsWith('node:')) continue;
    // Only include relative imports (./foo.js, ../cat/foo.js)
    if (!importPath.startsWith('.')) continue;
    for (const name of m[1].split(',').map(n => n.trim()).filter(Boolean)) {
      if (!name.startsWith('type ')) hookImports.add(name);
    }
  }

  for (const fnName of hookImports) {
    const callRegex = new RegExp(`(?<![.\\w])${escapeRegex(fnName)}\\(\\s*input\\s*\\)`, 'g');
    const callMatches = [...content.matchAll(callRegex)];
    for (let i = callMatches.length - 1; i >= 0; i--) {
      const cm = callMatches[i];
      if (isImportLine(content, cm.index)) continue;
      if (!isInExportedFunctionScope(content, cm.index, funcRanges)) continue;
      const replacement = `${fnName}(input, ${ctxParam})`;
      content = content.slice(0, cm.index) + replacement + content.slice(cm.index + cm[0].length);
      changes.push(`forwarded ${ctxParam} to: ${fnName}(input) → ${fnName}(input, ${ctxParam})`);
      stats.dispatcherCtxForwarded++;
    }
  }

  // ─── Done ─────────────────────────────────────────────────────────────

  const changed = content !== original;
  if (changed && !DRY_RUN) {
    writeFileSync(filePath, content, 'utf-8');
  }
  return { changed, changes };
}

/**
 * Replace log function calls ONLY within exported hook function scope.
 */
function replaceScopedLogCall(content, changes, funcRanges, ctxAccess, funcName, wrapper) {
  const escaped = escapeRegex(funcName);
  const regex = new RegExp(`(?<!\\w)${escaped}\\(`, 'g');
  const matches = [...content.matchAll(regex)];
  let offset = 0;
  let count = 0;

  for (const match of matches) {
    const idx = match.index + offset;

    // Scope check: only replace inside exported hook functions
    if (!isInExportedFunctionScope(content, idx, funcRanges)) continue;
    if (isImportLine(content, idx)) continue;
    if (isInComment(content, idx)) continue;
    if (isFunctionDefinition(content, idx)) continue;
    if (isReExport(content, idx)) continue;

    // Already wrapped?
    const before = content.slice(Math.max(0, idx - 60), idx);
    if (/\(\s*(?:ctx|hookCtx)\?\.\w+\s*\?\?\s*$/.test(before)) continue;

    const replacement = `(${wrapper})(`;
    content = content.slice(0, idx) + replacement + content.slice(idx + funcName.length + 1);
    offset += replacement.length - funcName.length - 1;
    count++;
  }

  if (count > 0) {
    changes.push(`${funcName}(...) → (${wrapper})(...) [${count}x]`);
    stats.logReplacements += count;
  }
  return content;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

const files = collectHookFiles(HOOKS_SRC);
console.log(`Found ${files.length} hook files to process${DRY_RUN ? ' (DRY RUN)' : ''}\n`);

for (const file of files) {
  const relPath = relative(HOOKS_SRC, file);
  stats.filesProcessed++;

  const { changed, changes } = migrateFile(file);

  if (changed) {
    stats.filesChanged++;
    console.log(`✓ ${relPath} (${changes.length} changes)`);
    for (const c of changes) console.log(`    ${c}`);
  } else if (changes[0]?.startsWith('skip:')) {
    // silent
  }
}

console.log('\n' + '='.repeat(70));
console.log('Migration Summary');
console.log('='.repeat(70));
console.log(`Files processed:       ${stats.filesProcessed}`);
console.log(`Files changed:         ${stats.filesChanged}`);
console.log(`Signature changes:     ${stats.signatureChanges}`);
console.log(`Env replacements:      ${stats.envReplacements}`);
console.log(`Log replacements:      ${stats.logReplacements}`);
console.log(`Type imports added:    ${stats.typeImportAdded}`);
console.log(`Local HookFn updated:  ${stats.localHookFnUpdated}`);
console.log(`Dispatcher ctx fwd:    ${stats.dispatcherCtxForwarded}`);
if (DRY_RUN) {
  console.log('\n⚠ DRY RUN — no files were modified. Run without --dry-run to apply.');
}
